import express from 'express';
import { db } from '../models.js';

const router = express.Router();

// 1. Get Admin Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const orders = await db.getOrders();
    const stores = await db.getStores();
    const drivers = await db.getDrivers();
    const users = await db.getOrders(); // We can query users instead, but let's query all users

    // Calculate metrics
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'delivered');
    const revenue = completedOrders.reduce((sum, o) => sum + (o.amounts.total || 0), 0);

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? Math.round(revenue / completedOrders.length || 0) : 0;

    // Fraud alerts mockup (just items with extremely high quantity or cancelled orders)
    const fraudAlerts = orders
      .filter(o => o.status === 'cancelled' || o.amounts.total > 15000)
      .map(o => ({
        id: `alert-${o.id}`,
        type: o.amounts.total > 15000 ? 'High Value Order' : 'Cancelled Order',
        message: o.amounts.total > 15000 
          ? `Order ${o.id} is valued at ₹${o.amounts.total} (Requires verification)`
          : `Order ${o.id} was cancelled by system/user`,
        severity: o.amounts.total > 15000 ? 'warning' : 'info',
        createdAt: o.createdAt
      }));

    // Group sales by store
    const salesByStore = {};
    stores.forEach(s => { salesByStore[s.id] = { name: s.name, sales: 0, count: 0 }; });
    completedOrders.forEach(o => {
      if (salesByStore[o.storeId]) {
        salesByStore[o.storeId].sales += o.amounts.total;
        salesByStore[o.storeId].count += 1;
      }
    });

    res.json({
      success: true,
      stats: {
        totalRevenue: revenue,
        totalOrders,
        avgOrderValue,
        activeStoresCount: stores.length,
        activeDriversCount: drivers.filter(d => d.status !== 'offline').length,
        totalDriversCount: drivers.length
      },
      storeSales: Object.values(salesByStore),
      fraudAlerts: fraudAlerts.slice(0, 5),
      recentOrders: orders.slice(0, 5)
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
