import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { connectDB, db } from './models.js';

import authRouter from './routes/auth.js';
import storesRouter from './routes/stores.js';
import ordersRouter from './routes/orders.js';
import trackingRouter from './routes/tracking.js';
import adminRouter from './routes/admin.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT"]
  }
});

// Configure CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Attach io to express app to use in routers
app.set('io', io);

// API Routing
app.use('/api/auth', authRouter);
app.use('/api/stores', storesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/tracking', trackingRouter);
app.use('/api/admin', adminRouter);

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: "healthy", time: new Date() });
});

// --- REAL-TIME SOCKETS & SIMULATION ---
io.on('connection', (socket) => {
  console.log(`[SOCKET] User connected: ${socket.id}`);

  // Simulating active delivery partner movement from the backend
  socket.on('start_delivery_simulation', async ({ orderId, driverId }) => {
    console.log(`[SOCKET] Starting delivery simulation for Order: ${orderId}, Driver: ${driverId}`);
    
    try {
      const order = await db.getOrderById(orderId);
      if (!order) return;

      const store = await db.getStoreById(order.storeId);
      if (!store) return;

      // Helper to interpolate coordinates
      const interpolate = (start, end, steps = 15) => {
        const coords = [];
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          coords.push({
            lat: start.lat + (end.lat - start.lat) * t,
            lng: start.lng + (end.lng - start.lng) * t
          });
        }
        return coords;
      };

      const startLoc = store.location;
      const endLoc = order.deliveryAddress;
      const routePoints = interpolate(startLoc, endLoc, 10); // 11 points total

      let step = 0;

      // First, order goes to preparing
      await db.updateOrder(orderId, { status: 'preparing' });
      let updatedOrder = await db.getOrderById(orderId);
      io.emit('order_status_changed', updatedOrder);

      // Simulate preparation time (3 seconds)
      setTimeout(async () => {
        // Next, order goes to picked_up (driver starts moving)
        await db.updateOrder(orderId, { status: 'picked_up' });
        updatedOrder = await db.getOrderById(orderId);
        io.emit('order_status_changed', updatedOrder);
        
        // Start coordinate stream timer
        const intervalId = setInterval(async () => {
          if (step >= routePoints.length) {
            clearInterval(intervalId);
            
            // Final stage: delivered
            await db.updateOrder(orderId, { status: 'delivered', paymentStatus: 'completed' });
            await db.updateDriver(driverId, { status: 'online' }); // Driver free again
            
            updatedOrder = await db.getOrderById(orderId);
            io.emit('order_status_changed', updatedOrder);
            console.log(`[SIMULATOR] Order ${orderId} successfully DELIVERED.`);
            return;
          }

          // Middle stage: near_you when close to final destination
          if (step === routePoints.length - 2) {
            await db.updateOrder(orderId, { status: 'near_you' });
            updatedOrder = await db.getOrderById(orderId);
            io.emit('order_status_changed', updatedOrder);
          }

          const currentPos = routePoints[step];
          
          // Update database
          await db.updateDriver(driverId, { currentLocation: currentPos });

          // Emit location to clients
          io.emit('driver_location_updated', {
            driverId,
            orderId,
            location: currentPos
          });

          console.log(`[SIMULATOR] Order ${orderId} - Driver step ${step + 1}/${routePoints.length}: Lat ${currentPos.lat.toFixed(4)}, Lng ${currentPos.lng.toFixed(4)}`);
          step++;
        }, 3000); // Update every 3 seconds

      }, 3500);

    } catch (err) {
      console.error("[SIMULATOR] Error in delivery simulation:", err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] User disconnected: ${socket.id}`);
  });
});

// --- START SERVER ---
const PORT = process.env.PORT || 5002;
const MONGODB_URI = process.env.MONGODB_URI || '';

connectDB(MONGODB_URI).then(() => {
  server.listen(PORT, () => {
    console.log(`\n=============================================`);
    console.log(`GoaSip Backend listening on PORT ${PORT}`);
    console.log(`Ready for North Goa Liquor Deliveries!`);
    console.log(`=============================================\n`);
  });
});
