import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonDbPath = path.join(__dirname, 'db.json');

// --- MOCK / JSON DATABASE HELPER ---
const readJsonDb = () => {
  try {
    const data = fs.readFileSync(jsonDbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading JSON database:", err);
    return { users: [], stores: [], products: [], orders: [], drivers: [] };
  }
};

const writeJsonDb = (data) => {
  try {
    fs.writeFileSync(jsonDbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing JSON database:", err);
  }
};

// --- MONGOOSE SCHEMAS (FOR PRODUCTION/LOCAL MONGODB ATTEMPT) ---
let isMongoConnected = false;

const userSchema = new mongoose.Schema({
  id: String,
  phone: { type: String, required: true, unique: true },
  name: String,
  email: String,
  role: { type: String, enum: ['customer', 'vendor', 'driver', 'admin'], default: 'customer' },
  dob: String,
  isVerified: { type: Boolean, default: false },
  storeId: String,
  kyc: {
    status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    documentType: String,
    documentNumber: String
  }
});

const storeSchema = new mongoose.Schema({
  id: String,
  name: String,
  image: String,
  rating: Number,
  reviewsCount: Number,
  address: String,
  location: {
    lat: Number,
    lng: Number
  },
  isActive: Boolean,
  featured: Boolean
});

const productSchema = new mongoose.Schema({
  id: String,
  storeId: String,
  name: String,
  category: String,
  price: Number,
  stock: Number,
  description: String,
  image: String,
  rating: Number,
  isAvailable: Boolean
});

const orderSchema = new mongoose.Schema({
  id: String,
  customerId: String,
  customerName: String,
  customerPhone: String,
  storeId: String,
  storeName: String,
  products: [{
    productId: String,
    name: String,
    price: Number,
    quantity: Number
  }],
  amounts: {
    subtotal: Number,
    deliveryFee: Number,
    tax: Number,
    total: Number
  },
  deliveryAddress: {
    address: String,
    lat: Number,
    lng: Number
  },
  status: {
    type: String,
    enum: ['placed', 'accepted', 'preparing', 'picked_up', 'near_you', 'delivered', 'cancelled'],
    default: 'placed'
  },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentMethod: String,
  driverId: String,
  driverName: String,
  driverPhone: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const driverSchema = new mongoose.Schema({
  id: String,
  name: String,
  phone: String,
  status: { type: String, enum: ['online', 'offline', 'busy'], default: 'offline' },
  currentLocation: {
    lat: Number,
    lng: Number
  },
  walletBalance: Number
});

let User, Store, Product, Order, Driver;

export const connectDB = async (uri) => {
  if (!uri) {
    console.log("No MongoDB URI specified. Falling back to Local JSON database.");
    isMongoConnected = false;
    return false;
  }
  try {
    await mongoose.connect(uri);
    isMongoConnected = true;
    console.log("MongoDB Connected Successfully.");
    
    // Register Models
    User = mongoose.model('User', userSchema);
    Store = mongoose.model('Store', storeSchema);
    Product = mongoose.model('Product', productSchema);
    Order = mongoose.model('Order', orderSchema);
    Driver = mongoose.model('Driver', driverSchema);

    // Sync seed data to MongoDB if empty
    await seedMongoDb();
    return true;
  } catch (err) {
    console.error("MongoDB Connection Failed:", err.message);
    console.log("Falling back to Local JSON database.");
    isMongoConnected = false;
    return false;
  }
};

const seedMongoDb = async () => {
  const usersCount = await User.countDocuments();
  if (usersCount === 0) {
    console.log("Seeding MongoDB with default data...");
    const seedData = readJsonDb();
    await User.insertMany(seedData.users);
    await Store.insertMany(seedData.stores);
    await Product.insertMany(seedData.products);
    await Driver.insertMany(seedData.drivers);
    console.log("MongoDB seeded successfully.");
  }
};

// --- DATA ACCESS LAYER (DAL) LAYER DISPATCHING MONGO OR JSON ---
export const db = {
  // Users
  getUserByPhone: async (phone) => {
    if (isMongoConnected) {
      return await User.findOne({ phone }).lean();
    } else {
      const { users } = readJsonDb();
      return users.find(u => u.phone === phone) || null;
    }
  },

  getUserById: async (id) => {
    if (isMongoConnected) {
      return await User.findOne({ id }).lean();
    } else {
      const { users } = readJsonDb();
      return users.find(u => u.id === id) || null;
    }
  },

  createUser: async (userData) => {
    const id = userData.id || `u-${Date.now()}`;
    const user = { id, ...userData };
    if (isMongoConnected) {
      const mongoUser = new User(user);
      await mongoUser.save();
      return mongoUser.toObject();
    } else {
      const data = readJsonDb();
      data.users.push(user);
      writeJsonDb(data);
      return user;
    }
  },

  updateUser: async (id, updates) => {
    if (isMongoConnected) {
      return await User.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
    } else {
      const data = readJsonDb();
      const idx = data.users.findIndex(u => u.id === id);
      if (idx !== -1) {
        // Deep merge helper for nested KYC object
        if (updates.kyc && data.users[idx].kyc) {
          updates.kyc = { ...data.users[idx].kyc, ...updates.kyc };
        }
        data.users[idx] = { ...data.users[idx], ...updates };
        writeJsonDb(data);
        return data.users[idx];
      }
      return null;
    }
  },

  // Stores
  getStores: async () => {
    if (isMongoConnected) {
      return await Store.find({ isActive: true }).lean();
    } else {
      const { stores } = readJsonDb();
      return stores.filter(s => s.isActive);
    }
  },

  getStoreById: async (id) => {
    if (isMongoConnected) {
      return await Store.findOne({ id }).lean();
    } else {
      const { stores } = readJsonDb();
      return stores.find(s => s.id === id) || null;
    }
  },

  updateStore: async (id, updates) => {
    if (isMongoConnected) {
      return await Store.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
    } else {
      const data = readJsonDb();
      const idx = data.stores.findIndex(s => s.id === id);
      if (idx !== -1) {
        data.stores[idx] = { ...data.stores[idx], ...updates };
        writeJsonDb(data);
        return data.stores[idx];
      }
      return null;
    }
  },

  // Products
  getProductsByStore: async (storeId) => {
    if (isMongoConnected) {
      return await Product.find({ storeId, isAvailable: true }).lean();
    } else {
      const { products } = readJsonDb();
      return products.filter(p => p.storeId === storeId && p.isAvailable);
    }
  },

  getProductById: async (id) => {
    if (isMongoConnected) {
      return await Product.findOne({ id }).lean();
    } else {
      const { products } = readJsonDb();
      return products.find(p => p.id === id) || null;
    }
  },

  updateProductStock: async (id, newStock) => {
    if (isMongoConnected) {
      return await Product.findOneAndUpdate({ id }, { $set: { stock: newStock } }, { new: true }).lean();
    } else {
      const data = readJsonDb();
      const idx = data.products.findIndex(p => p.id === id);
      if (idx !== -1) {
        data.products[idx].stock = newStock;
        data.products[idx].isAvailable = newStock > 0;
        writeJsonDb(data);
        return data.products[idx];
      }
      return null;
    }
  },

  updateProductAvailability: async (id, isAvailable) => {
    if (isMongoConnected) {
      return await Product.findOneAndUpdate({ id }, { $set: { isAvailable } }, { new: true }).lean();
    } else {
      const data = readJsonDb();
      const idx = data.products.findIndex(p => p.id === id);
      if (idx !== -1) {
        data.products[idx].isAvailable = isAvailable;
        writeJsonDb(data);
        return data.products[idx];
      }
      return null;
    }
  },

  // Orders
  getOrders: async () => {
    if (isMongoConnected) {
      return await Order.find().sort({ createdAt: -1 }).lean();
    } else {
      const { orders } = readJsonDb();
      return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  getOrderById: async (id) => {
    if (isMongoConnected) {
      return await Order.findOne({ id }).lean();
    } else {
      const { orders } = readJsonDb();
      return orders.find(o => o.id === id) || null;
    }
  },

  createOrder: async (orderData) => {
    const id = orderData.id || `ord-${Date.now()}`;
    const order = {
      id,
      ...orderData,
      status: orderData.status || 'placed',
      paymentStatus: orderData.paymentStatus || 'pending',
      createdAt: orderData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (isMongoConnected) {
      const mongoOrder = new Order(order);
      await mongoOrder.save();
      return mongoOrder.toObject();
    } else {
      const data = readJsonDb();
      data.orders.push(order);
      writeJsonDb(data);
      return order;
    }
  },

  updateOrder: async (id, updates) => {
    updates.updatedAt = new Date().toISOString();
    if (isMongoConnected) {
      return await Order.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
    } else {
      const data = readJsonDb();
      const idx = data.orders.findIndex(o => o.id === id);
      if (idx !== -1) {
        data.orders[idx] = { ...data.orders[idx], ...updates };
        writeJsonDb(data);
        return data.orders[idx];
      }
      return null;
    }
  },

  getOrdersByUser: async (userId, role) => {
    if (isMongoConnected) {
      const query = role === 'customer' 
        ? { customerId: userId } 
        : role === 'vendor' 
        ? { storeId: userId } // storeId is stored on the user object
        : { driverId: userId };
      return await Order.find(query).sort({ createdAt: -1 }).lean();
    } else {
      const { orders } = readJsonDb();
      let filtered = [];
      if (role === 'customer') {
        filtered = orders.filter(o => o.customerId === userId);
      } else if (role === 'vendor') {
        // Find which store this vendor manages
        const user = await db.getUserById(userId);
        const storeId = user ? user.storeId : userId;
        filtered = orders.filter(o => o.storeId === storeId);
      } else if (role === 'driver') {
        filtered = orders.filter(o => o.driverId === userId);
      }
      return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  // Drivers
  getDrivers: async () => {
    if (isMongoConnected) {
      return await Driver.find().lean();
    } else {
      const { drivers } = readJsonDb();
      return drivers;
    }
  },

  getDriverById: async (id) => {
    if (isMongoConnected) {
      return await Driver.findOne({ id }).lean();
    } else {
      const { drivers } = readJsonDb();
      return drivers.find(d => d.id === id) || null;
    }
  },

  updateDriver: async (id, updates) => {
    if (isMongoConnected) {
      return await Driver.findOneAndUpdate({ id }, { $set: updates }, { new: true }).lean();
    } else {
      const data = readJsonDb();
      const idx = data.drivers.findIndex(d => d.id === id);
      if (idx !== -1) {
        data.drivers[idx] = { ...data.drivers[idx], ...updates };
        writeJsonDb(data);
        return data.drivers[idx];
      }
      return null;
    }
  }
};
