import express from 'express';
import { db } from '../models.js';

const router = express.Router();

// Helper to interpolate coordinates between two points (simulating driving routes)
const interpolateCoordinates = (start, end, steps = 12) => {
  const coordinates = [];
  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const lat = start.lat + (end.lat - start.lat) * fraction;
    const lng = start.lng + (end.lng - start.lng) * fraction;
    coordinates.push({ lat, lng });
  }
  return coordinates;
};

// 1. Get route coordinates for simulation
router.get('/:orderId/route', async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const store = await db.getStoreById(order.storeId);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }

    // Start coordinate: Store location
    const startLoc = store.location;
    // End coordinate: Customer delivery address location
    const endLoc = order.deliveryAddress;

    // Generate intermediate coordinates to simulate driving route
    const route = interpolateCoordinates(startLoc, endLoc, 15);

    res.json({
      success: true,
      route,
      storeLocation: startLoc,
      deliveryLocation: endLoc
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Update driver location (HTTP endpoint or WebSockets)
router.post('/update-location', async (req, res) => {
  const { driverId, lat, lng, orderId } = req.body;

  if (!driverId || !lat || !lng) {
    return res.status(400).json({ success: false, message: "Missing driverId, lat, or lng." });
  }

  try {
    const updatedDriver = await db.updateDriver(driverId, {
      currentLocation: { lat, lng }
    });

    if (!updatedDriver) {
      return res.status(404).json({ success: false, message: "Driver not found." });
    }

    // Broadcast driver location update to anyone tracking this order or active dashboard
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.emit('driver_location_updated', {
        driverId,
        orderId,
        location: { lat, lng }
      });
    }

    res.json({
      success: true,
      message: "Location updated successfully.",
      driver: updatedDriver
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
