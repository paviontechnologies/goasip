import express from 'express';
import { db } from '../models.js';

const router = express.Router();

// Geofence boundaries for North Goa
const NORTH_GOA_GEOFENCE = {
  minLat: 15.45,
  maxLat: 15.75,
  minLng: 73.70,
  maxLng: 73.95
};

// Helper to check if coordinates are within North Goa
const isWithinNorthGoa = (lat, lng) => {
  return (
    lat >= NORTH_GOA_GEOFENCE.minLat &&
    lat <= NORTH_GOA_GEOFENCE.maxLat &&
    lng >= NORTH_GOA_GEOFENCE.minLng &&
    lng <= NORTH_GOA_GEOFENCE.maxLng
  );
};

// 1. Get orders list
router.get('/', async (req, res) => {
  const { userId, role } = req.query;

  try {
    let orders;
    if (userId && role) {
      orders = await db.getOrdersByUser(userId, role);
    } else {
      orders = await db.getOrders();
    }
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Get single order details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const order = await db.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Create a new order
router.post('/create', async (req, res) => {
  const {
    customerId,
    customerName,
    customerPhone,
    storeId,
    products,
    amounts,
    deliveryAddress,
    paymentMethod
  } = req.body;

  try {
    // 1. Fetch user to verify KYC and age
    const user = await db.getUserById(customerId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Customer profile not found." });
    }

    if (!user.kyc || user.kyc.status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: "Age and identity verification required before purchasing alcohol. Please upload your ID in the profile section."
      });
    }

    // 2. Geofencing check (North Goa bounds)
    const { lat, lng, address } = deliveryAddress;
    if (!isWithinNorthGoa(lat, lng)) {
      return res.status(400).json({
        success: false,
        message: "Delivery zone restriction: GoaSip services are strictly limited to the North Goa region (Panaji, Calangute, Baga, Candolim, Mapusa, Anjuna, Assagao, Vagator). The selected location falls outside our active boundary."
      });
    }

    // 3. Fetch Store details
    const store = await db.getStoreById(storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    // 4. Create Order
    const newOrder = await db.createOrder({
      customerId,
      customerName,
      customerPhone,
      storeId,
      storeName: store.name,
      products,
      amounts,
      deliveryAddress: { address, lat, lng },
      status: 'placed',
      paymentStatus: paymentMethod === 'COD' ? 'pending' : 'completed', // Simulator sets payment status
      paymentMethod,
      driverId: '',
      driverName: '',
      driverPhone: ''
    });

    // Reduce product stocks
    for (const p of products) {
      const prod = await db.getProductById(p.productId);
      if (prod) {
        const remainingStock = Math.max(0, prod.stock - p.quantity);
        await db.updateProductStock(p.productId, remainingStock);
      }
    }

    // Notify sockets (via global io if attached to req)
    if (req.app.get('io')) {
      const io = req.app.get('io');
      // Emit new order to vendor-room and admin-room
      io.emit('new_order', newOrder);
      console.log(`[SOCKET] Broadcasted new_order: ${newOrder.id}`);
    }

    res.json({
      success: true,
      message: "Order placed successfully.",
      order: newOrder
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Assign Driver to Order (Store or Auto-dispatch)
router.post('/:id/assign-driver', async (req, res) => {
  const { id } = req.params;
  const { driverId } = req.body;

  try {
    const driver = await db.getDriverById(driverId);
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found." });
    }

    const updatedOrder = await db.updateOrder(id, {
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      status: 'accepted' // Moves from placed -> accepted when driver assigned
    });

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Update driver status to busy
    await db.updateDriver(driverId, { status: 'busy' });

    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('order_status_changed', updatedOrder);
      console.log(`[SOCKET] Broadcasted order_status_changed (assigned): ${updatedOrder.id}`);
    }

    res.json({
      success: true,
      message: `Driver ${driver.name} assigned to order.`,
      order: updatedOrder
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Update Order Status
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['placed', 'accepted', 'preparing', 'picked_up', 'near_you', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid order status." });
  }

  try {
    const order = await db.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const updates = { status };
    if (status === 'delivered') {
      updates.paymentStatus = 'completed';
      // Free up driver
      if (order.driverId) {
        await db.updateDriver(order.driverId, { status: 'online' });
      }
    }

    const updatedOrder = await db.updateOrder(id, updates);

    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('order_status_changed', updatedOrder);
      console.log(`[SOCKET] Broadcasted order_status_changed: ${updatedOrder.id} -> ${status}`);
    }

    res.json({
      success: true,
      message: `Order status updated to ${status}.`,
      order: updatedOrder
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
