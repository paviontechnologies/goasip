import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useStore } from './store/store.js';
import TrackingMap from './components/TrackingMap.jsx';
import PaymentModal from './components/PaymentModal.jsx';
import { 
  ShoppingBag, Shield, CheckCircle2, User, MapPin, 
  Sparkles, Star, Plus, Minus, X, AlertTriangle, 
  DollarSign, Truck, Store, Settings, LogOut, Check, ArrowRight
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';
const API_BASE = `${API_URL}/api`;
let socket;

// Popular Goan Addresses with Coordinates (North vs South)
const SAMPLE_ADDRESSES = [
  { name: "Panaji Main Market (North Goa)", lat: 15.4920, lng: 73.8250, inside: true },
  { name: "Calangute Beach Road (North Goa)", lat: 15.5412, lng: 73.7580, inside: true },
  { name: "Anjuna Starco Junction (North Goa)", lat: 15.5800, lng: 73.7420, inside: true },
  { name: "Mapusa Bus Stand (North Goa)", lat: 15.5920, lng: 73.8120, inside: true },
  { name: "Margao Railway Station (South Goa)", lat: 15.2730, lng: 73.9580, inside: false },
  { name: "Mumbai Marine Drive (Out of State)", lat: 19.0760, lng: 72.8777, inside: false }
];

export default function App() {
  const {
    user, token, currentRole, cart, cartStoreId, activeOrder, driverLocation, routeCoordinates,
    login, logout, setRole, addToCart, removeFromCart, clearCart, setActiveOrder, setDriverLocation, setRouteCoordinates, updateUserKyc
  } = useStore();

  // Local UI States
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [storeProducts, setStoreProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Auth Screen State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sandboxOtp, setSandboxOtp] = useState('');
  const [authStep, setAuthStep] = useState('phone'); // phone, otp, register
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', dob: '' });
  const [errorMsg, setErrorMsg] = useState('');

  // KYC State
  const [kycForm, setKycForm] = useState({ documentType: 'Aadhaar', documentNumber: '', dob: '' });
  const [isUploadingId, setIsUploadingId] = useState(false);
  const [kycStatusMsg, setKycStatusMsg] = useState('');

  // Checkout State
  const [selectedAddress, setSelectedAddress] = useState(SAMPLE_ADDRESSES[0]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Panels States
  const [vendorOrders, setVendorOrders] = useState([]);
  const [vendorProducts, setVendorProducts] = useState([]);
  const [driverOrders, setDriverOrders] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [adminStores, setAdminStores] = useState([]);
  const [adminRecentOrders, setAdminRecentOrders] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState([]);

  // Socket Connection & Real-time Listeners
  useEffect(() => {
    socket = io(API_URL);

    socket.on('connect', () => {
      console.log("[SOCKET] Connected to backend simulation server");
    });

    socket.on('order_status_changed', (updatedOrder) => {
      // If customer is tracking this order, update local state
      if (activeOrder && activeOrder.id === updatedOrder.id) {
        setActiveOrder(updatedOrder);
      }
      
      // Refresh panel data
      if (currentRole === 'vendor') fetchVendorOrders();
      if (currentRole === 'driver') fetchDriverOrders();
      if (currentRole === 'admin') fetchAdminStats();
    });

    socket.on('driver_location_updated', ({ orderId, location }) => {
      if (activeOrder && activeOrder.id === orderId) {
        setDriverLocation(location);
      }
      if (currentRole === 'admin') fetchAdminStats();
    });

    socket.on('new_order', (newOrder) => {
      if (currentRole === 'vendor' && user && user.storeId === newOrder.storeId) {
        alert(`🔔 New Order Received! Order ID: ${newOrder.id}`);
        fetchVendorOrders();
      }
      if (currentRole === 'admin') {
        fetchAdminStats();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeOrder, currentRole, user]);

  // Load Initial Customer Stores List
  useEffect(() => {
    if (currentRole === 'customer') {
      fetchStores();
    } else if (currentRole === 'vendor' && user) {
      fetchVendorOrders();
      fetchVendorProducts();
    } else if (currentRole === 'driver') {
      fetchDriverOrders();
    } else if (currentRole === 'admin') {
      fetchAdminStats();
    }
  }, [currentRole, user]);

  // Fetch API Helpers
  const fetchStores = async () => {
    try {
      const res = await axios.get(`${API_BASE}/stores`);
      setStores(res.data.stores);
    } catch (err) {
      console.error(err);
    }
  };

  const selectStore = async (store) => {
    setSelectedStore(store);
    try {
      const res = await axios.get(`${API_BASE}/stores/${store.id}/products`);
      setStoreProducts(res.data.products);
    } catch (err) {
      console.error(err);
    }
  };

  // Vendor Panel Functions
  const fetchVendorOrders = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_BASE}/orders?userId=${user.id}&role=vendor`);
      setVendorOrders(res.data.orders);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVendorProducts = async () => {
    if (!user || !user.storeId) return;
    try {
      const res = await axios.get(`${API_BASE}/stores/${user.storeId}/products`);
      setVendorProducts(res.data.products);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStock = async (productId, currentStatus) => {
    try {
      await axios.post(`${API_BASE}/stores/${user.storeId}/products/${productId}/toggle-stock`, {
        isAvailable: !currentStatus
      });
      fetchVendorProducts();
    } catch (err) {
      console.error(err);
    }
  };

  // Driver Panel Functions
  const fetchDriverOrders = async () => {
    try {
      const res = await axios.get(`${API_BASE}/orders`); // For demo, drivers can view all active orders to assign
      setDriverOrders(res.data.orders);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignDriver = async (orderId) => {
    try {
      await axios.post(`${API_BASE}/orders/${orderId}/assign-driver`, {
        driverId: user?.id || 'd-1' // Fallback to Ramesh
      });
      fetchDriverOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartSimulation = (orderId, driverId) => {
    socket.emit('start_delivery_simulation', { orderId, driverId });
  };

  const handleUpdateStatus = async (orderId, status) => {
    try {
      await axios.put(`${API_BASE}/orders/${orderId}/status`, { status });
      fetchDriverOrders();
    } catch (err) {
      console.error(err);
    }
  };

  // Admin Panel Functions
  const fetchAdminStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/stats`);
      setAdminStats(res.data.stats);
      setAdminStores(res.data.storeSales);
      setAdminRecentOrders(res.data.recentOrders);
      setAdminAlerts(res.data.fraudAlerts);
    } catch (err) {
      console.error(err);
    }
  };

  // Auth Operations
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await axios.post(`${API_BASE}/auth/send-otp`, { phone });
      setOtpSent(true);
      setSandboxOtp(res.data.otp); // Prefill in demo UI
      setAuthStep('otp');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await axios.post(`${API_BASE}/auth/verify-otp`, { phone, otp });
      if (res.data.newUser) {
        setAuthStep('register');
      } else {
        login(res.data.user, res.data.token);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'OTP verification failed');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await axios.post(`${API_BASE}/auth/register`, {
        phone,
        name: registerForm.name,
        email: registerForm.email,
        dob: registerForm.dob,
        role: 'customer' // Signups are customers by default
      });
      login(res.data.user, res.data.token);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Registration failed');
    }
  };

  // KYC ID Upload Simulation
  const handleKycVerify = async (e) => {
    e.preventDefault();
    setIsUploadingId(true);
    setKycStatusMsg("Uploading identity documents...");

    setTimeout(async () => {
      setKycStatusMsg("Scanning parameters & Face matching...");

      setTimeout(async () => {
        try {
          const res = await axios.post(`${API_BASE}/auth/kyc-verify`, {
            userId: user.id,
            documentType: kycForm.documentType,
            documentNumber: kycForm.documentNumber,
            dob: kycForm.dob
          });
          setIsUploadingId(false);
          updateUserKyc({ kyc: res.data.user.kyc, dob: res.data.user.dob });
          setKycStatusMsg('');
        } catch (err) {
          setIsUploadingId(false);
          setKycStatusMsg('');
          alert(err.response?.data?.message || 'KYC verification rejected.');
        }
      }, 1500);
    }, 1500);
  };

  // Checkout Operations
  const handleCheckout = () => {
    if (!user?.kyc || user?.kyc?.status !== 'verified') {
      alert("⚠️ Verification required: Please upload your Government ID under your Profile tab to verify legal age (21+).");
      return;
    }
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = async (method) => {
    setPaymentModalOpen(false);
    
    // Calculate charges
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = Math.round(subtotal * 0.18); // 18% Goa Liquor Tax
    const deliveryFee = selectedAddress.inside ? 100 : 250;

    const orderData = {
      customerId: user.id,
      customerName: user.name,
      customerPhone: user.phone,
      storeId: cartStoreId,
      products: cart.map(item => ({
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      amounts: {
        subtotal,
        deliveryFee,
        tax,
        total: subtotal + deliveryFee + tax
      },
      deliveryAddress: {
        address: selectedAddress.name,
        lat: selectedAddress.lat,
        lng: selectedAddress.lng
      },
      paymentMethod: method
    };

    try {
      const res = await axios.post(`${API_BASE}/orders/create`, orderData);
      clearCart();
      setActiveOrder(res.data.order);
      setDriverLocation(null);
      // Fetch route coordinates
      const routeRes = await axios.get(`${API_BASE}/tracking/${res.data.order.id}/route`);
      setRouteCoordinates(routeRes.data.route);
    } catch (err) {
      alert(err.response?.data?.message || 'Order creation failed');
    }
  };

  // Cart Calculations
  const getSubtotal = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const getTax = () => Math.round(getSubtotal() * 0.18);
  const getDeliveryFee = () => selectedAddress.inside ? 100 : 250;
  const getTotal = () => getSubtotal() + getTax() + getDeliveryFee();

  return (
    <div className="min-h-screen bg-dark-bg text-gray-200 font-sans flex flex-col pb-24">
      {/* HEADER BAR */}
      <header className="border-b border-dark-border bg-dark-card sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center text-black font-bold text-lg shadow-lg shadow-gold-500/20">
            GS
          </div>
          <div>
            <h1 className="font-heading text-lg font-extrabold tracking-tight text-white m-0 leading-none">
              GoaSip <span className="text-gold-500 font-normal text-xs uppercase tracking-widest ml-1">North Goa Exclusive</span>
            </h1>
            <p className="text-[10px] text-dark-text-muted mt-0.5">Premium Spirits Delivery</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-white">{user.name}</p>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${user.kyc?.status === 'verified' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <p className="text-[10px] text-dark-text-muted uppercase font-bold tracking-wider">
                    {user.kyc?.status === 'verified' ? 'Age Verified (21+)' : 'Verification Needed'}
                  </p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="p-2 rounded-xl text-dark-text-muted hover:text-red-500 hover:bg-red-500/10 active:scale-95 transition cursor-pointer"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <span className="text-xs text-gold-500 font-semibold px-3 py-1 bg-gold-500/10 border border-gold-500/20 rounded-full">
              Sandbox Guest Mode
            </span>
          )}
        </div>
      </header>

      {/* CORE CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col">
        
        {/* CUSTOMER APP FLOW */}
        {currentRole === 'customer' && (
          <div className="flex-1 flex flex-col">
            {!user ? (
              /* OTP Login Screen */
              <div className="max-w-md w-full mx-auto my-12 bg-dark-card border border-dark-border rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="inline-flex p-3 bg-gold-500/10 rounded-2xl text-gold-500 mb-3 border border-gold-500/20">
                    <Shield size={32} />
                  </div>
                  <h3 className="font-heading text-xl font-bold text-white">Enter Mobile Number</h3>
                  <p className="text-xs text-dark-text-muted mt-1">We will send a 6-digit OTP verification code to verify your identity</p>
                </div>

                {errorMsg && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {authStep === 'phone' && (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-dark-text-muted uppercase tracking-wider mb-1.5">Mobile Number</label>
                      <input 
                        type="tel" 
                        placeholder="+91 XXXXX XXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white text-sm focus:border-gold-500 focus:outline-none transition"
                      />
                    </div>
                    <button type="submit" className="w-full py-3 bg-gold-500 hover:bg-gold-600 active:scale-95 transition text-black font-bold rounded-xl cursor-pointer shadow-lg shadow-gold-500/15">
                      Request OTP Code
                    </button>
                  </form>
                )}

                {authStep === 'otp' && (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-dark-text-muted uppercase tracking-wider mb-1.5">Verification Code (OTP)</label>
                      <input 
                        type="text" 
                        placeholder="Enter 6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                        className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white text-sm focus:border-gold-500 focus:outline-none text-center font-mono tracking-widest text-lg transition"
                      />
                    </div>

                    {sandboxOtp && (
                      <div className="bg-gold-500/5 border border-gold-500/25 p-3 rounded-lg text-center">
                        <span className="text-[10px] text-gold-400 uppercase font-bold tracking-wider block">Sandbox Auto-OTP</span>
                        <span className="text-lg font-bold text-white font-mono tracking-widest">{sandboxOtp}</span>
                      </div>
                    )}

                    <button type="submit" className="w-full py-3 bg-gold-500 hover:bg-gold-600 active:scale-95 transition text-black font-bold rounded-xl cursor-pointer shadow-lg shadow-gold-500/15">
                      Verify OTP Code
                    </button>
                  </form>
                )}

                {authStep === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-dark-text-muted uppercase tracking-wider mb-1">Full Name</label>
                      <input 
                        type="text" 
                        value={registerForm.name}
                        onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                        required
                        placeholder="John Doe"
                        className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-white text-sm focus:border-gold-500 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-dark-text-muted uppercase tracking-wider mb-1">Email Address</label>
                      <input 
                        type="email" 
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                        required
                        placeholder="john@gmail.com"
                        className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-white text-sm focus:border-gold-500 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-dark-text-muted uppercase tracking-wider mb-1">Birth Date (Goa Excise Law: 21+ Required)</label>
                      <input 
                        type="date" 
                        value={registerForm.dob}
                        onChange={(e) => setRegisterForm({...registerForm, dob: e.target.value})}
                        required
                        className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-white text-sm focus:border-gold-500 focus:outline-none transition"
                      />
                    </div>
                    <button type="submit" className="w-full py-3 bg-gold-500 hover:bg-gold-600 active:scale-95 transition text-black font-bold rounded-xl cursor-pointer shadow-lg shadow-gold-500/15">
                      Complete Registration
                    </button>
                  </form>
                )}
              </div>
            ) : activeOrder ? (
              /* Live Order Tracking Screen */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[500px]">
                {/* Left status tracker */}
                <div className="lg:col-span-5 bg-dark-card border border-dark-border rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <span className="text-xs text-gold-500 font-semibold tracking-wide uppercase">Order Active Status</span>
                        <h3 className="font-heading text-lg font-bold text-white mt-1">ID: {activeOrder.id}</h3>
                        <p className="text-xs text-dark-text-muted mt-0.5">Purchased from {activeOrder.storeName}</p>
                      </div>
                      <span className="px-3 py-1 bg-gold-500/10 border border-gold-500/30 text-gold-500 text-xs font-bold rounded-full capitalize">
                        {activeOrder.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Step Tracking Line */}
                    <div className="relative pl-6 space-y-6">
                      <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-dark-border" />
                      
                      {[
                        { status: 'placed', title: 'Order Placed', desc: 'Awaiting vendor confirmation' },
                        { status: 'accepted', title: 'Accepted by Vendor', desc: 'Dispatching liquor bottles' },
                        { status: 'preparing', title: 'Preparing Package', desc: 'Secure wrapping & packing' },
                        { status: 'picked_up', title: 'Package Picked Up', desc: 'Driver is moving towards you' },
                        { status: 'near_you', title: 'Rider is Near You', desc: 'Delivery partner in your area' },
                        { status: 'delivered', title: 'Delivered', desc: 'Order completed successfully' }
                      ].map((step, idx) => {
                        const statusesOrder = ['placed', 'accepted', 'preparing', 'picked_up', 'near_you', 'delivered'];
                        const currentIdx = statusesOrder.indexOf(activeOrder.status);
                        const stepIdx = statusesOrder.indexOf(step.status);
                        const isDone = stepIdx <= currentIdx;
                        const isCurrent = step.status === activeOrder.status;

                        return (
                          <div key={step.status} className="relative flex gap-4">
                            <div className={`absolute -left-5 w-3.5 h-3.5 rounded-full border-2 ${
                              isDone ? 'bg-gold-500 border-black ring-2 ring-gold-500/30' : 'bg-dark-bg border-dark-border'
                            } ${isCurrent ? 'animate-pulse bg-gold-400' : ''}`} />
                            
                            <div>
                              <h4 className={`text-sm font-semibold ${isDone ? 'text-white' : 'text-dark-text-muted'}`}>
                                {step.title}
                              </h4>
                              <p className="text-xs text-dark-text-muted mt-0.5">{step.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-8 border-t border-dark-border pt-4">
                    {activeOrder.status === 'delivered' ? (
                      <div className="space-y-4">
                        <div className="bg-green-500/10 border border-green-500/25 p-4 rounded-xl text-center flex flex-col items-center gap-1.5">
                          <CheckCircle2 className="text-green-500" size={24} />
                          <h4 className="text-sm font-bold text-white">Order Delivered!</h4>
                          <p className="text-xs text-dark-text-muted">Thanks for ordering with GoaSip. Drink responsibly.</p>
                        </div>
                        <button 
                          onClick={() => { setActiveOrder(null); setRouteCoordinates([]); setDriverLocation(null); }}
                          className="w-full py-2.5 bg-dark-surface hover:bg-dark-border border border-dark-border text-xs font-bold rounded-xl transition cursor-pointer text-center block"
                        >
                          Back to Storefront
                        </button>
                      </div>
                    ) : (
                      <div className="bg-gold-500/5 border border-gold-500/20 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-xs text-dark-text-muted">Assigned Rider</p>
                          <h4 className="text-sm font-bold text-white mt-0.5">{activeOrder.driverName || 'Finding partner...'}</h4>
                          <p className="text-[10px] text-dark-text-muted mt-0.5">{activeOrder.driverPhone || 'Standby'}</p>
                        </div>
                        {activeOrder.driverId && (
                          <span className="text-[10px] text-gold-400 font-bold uppercase border border-gold-500/30 px-2 py-1 rounded bg-gold-500/5">
                            Active GPS Tracker
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Map */}
                <div className="lg:col-span-7 h-[500px]">
                  <TrackingMap 
                    storeLocation={activeOrder.deliveryAddress ? { lat: 15.4912, lng: 73.8264 } : null} // Map center store
                    deliveryLocation={activeOrder.deliveryAddress}
                    driverLocation={driverLocation}
                    routePoints={routeCoordinates}
                  />
                </div>
              </div>
            ) : selectedStore ? (
              /* Products List for Selected Store */
              <div className="space-y-6 flex-1 flex flex-col">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedStore(null)}
                    className="p-1.5 rounded-lg border border-dark-border text-dark-text-muted hover:text-white bg-dark-card hover:bg-dark-border transition cursor-pointer"
                  >
                    ← Back
                  </button>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-white">{selectedStore.name}</h3>
                    <p className="text-xs text-dark-text-muted mt-0.5">{selectedStore.address}</p>
                  </div>
                </div>

                {/* Grid Split: Products list & Cart Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
                  
                  {/* Products Feed */}
                  <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {storeProducts.map(product => (
                      <div key={product.id} className="bg-dark-card border border-dark-border rounded-xl p-5 flex flex-col justify-between hover:border-gold-500/40 transition">
                        <div>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] text-gold-400 font-bold uppercase tracking-wider bg-gold-500/5 border border-gold-500/25 px-1.5 py-0.5 rounded">
                                {product.category}
                              </span>
                              <h4 className="font-heading text-base font-bold text-white mt-2 leading-tight">{product.name}</h4>
                            </div>
                            <span className="text-base font-bold text-gold-500">₹{product.price}</span>
                          </div>
                          <p className="text-xs text-dark-text-muted mt-2 line-clamp-2">{product.description}</p>
                        </div>

                        <div className="mt-5 pt-3 border-t border-dark-border flex justify-between items-center">
                          <span className="text-[10px] text-dark-text-muted font-bold">
                            Stock: {product.stock} units
                          </span>
                          <button
                            onClick={() => addToCart(product)}
                            className="px-3.5 py-1.5 bg-gold-500 hover:bg-gold-600 text-black text-xs font-bold rounded-lg flex items-center gap-1 active:scale-95 transition cursor-pointer"
                          >
                            <Plus size={12} />
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cart Sidebar */}
                  <div className="lg:col-span-4 bg-dark-card border border-dark-border rounded-2xl p-5 space-y-4">
                    <h4 className="font-heading text-base font-bold text-white border-b border-dark-border pb-3 flex items-center justify-between">
                      <span>Checkout Package</span>
                      <ShoppingBag size={18} className="text-gold-500" />
                    </h4>

                    {cart.length === 0 ? (
                      <div className="py-12 text-center text-dark-text-muted space-y-2">
                        <ShoppingBag className="mx-auto" size={32} />
                        <p className="text-xs">Your basket is currently empty.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Cart items */}
                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                          {cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center gap-2 text-xs">
                              <div className="flex-1 min-w-0">
                                <h5 className="font-semibold text-white truncate">{item.name}</h5>
                                <p className="text-dark-text-muted mt-0.5">₹{item.price} × {item.quantity}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => removeFromCart(item.id)}
                                  className="p-1 rounded bg-dark-surface border border-dark-border text-dark-text-muted hover:text-white"
                                >
                                  <Minus size={10} />
                                </button>
                                <span className="font-bold text-white text-xs">{item.quantity}</span>
                                <button 
                                  onClick={() => addToCart(item)}
                                  className="p-1 rounded bg-dark-surface border border-dark-border text-dark-text-muted hover:text-white"
                                >
                                  <Plus size={10} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Location Select (Geofence test) */}
                        <div className="border-t border-dark-border pt-4">
                          <label className="block text-[10px] font-bold text-gold-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <MapPin size={12} />
                            <span>Select Delivery Location</span>
                          </label>
                          <select 
                            value={selectedAddress.name}
                            onChange={(e) => {
                              const found = SAMPLE_ADDRESSES.find(a => a.name === e.target.value);
                              if (found) setSelectedAddress(found);
                            }}
                            className="w-full bg-dark-surface border border-dark-border rounded-lg px-2.5 py-2 text-xs text-white focus:border-gold-500 focus:outline-none cursor-pointer"
                          >
                            {SAMPLE_ADDRESSES.map(addr => (
                              <option key={addr.name} value={addr.name}>
                                {addr.name}
                              </option>
                            ))}
                          </select>
                          
                          {/* Alert based on address geofence */}
                          {!selectedAddress.inside && (
                            <div className="mt-2.5 p-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-lg flex items-start gap-1.5">
                              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                              <span>Geofence Alert: Selected location is outside North Goa limits. Ordering will block.</span>
                            </div>
                          )}
                        </div>

                        {/* Billing summary */}
                        <div className="border-t border-dark-border pt-3 space-y-2 text-xs">
                          <div className="flex justify-between text-dark-text-muted">
                            <span>Subtotal</span>
                            <span>₹{getSubtotal()}</span>
                          </div>
                          <div className="flex justify-between text-dark-text-muted">
                            <span>Goa Liquor Tax (18%)</span>
                            <span>₹{getTax()}</span>
                          </div>
                          <div className="flex justify-between text-dark-text-muted">
                            <span>Delivery Partner Fee</span>
                            <span>₹{getDeliveryFee()}</span>
                          </div>
                          <div className="flex justify-between font-bold text-white text-sm border-t border-dark-border/40 pt-2">
                            <span>Total Package</span>
                            <span className="text-gold-500">₹{getTotal()}</span>
                          </div>
                        </div>

                        {/* Order Button */}
                        <button
                          onClick={handleCheckout}
                          className="w-full py-3 mt-2 bg-gold-500 hover:bg-gold-600 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer shadow-lg shadow-gold-500/15"
                        >
                          <span>Proceed to Payment Simulation</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ) : (
              /* Stores List Grid (Home Screen) */
              <div className="space-y-6">
                {/* Search / Filters banner */}
                <div className="bg-dark-card border border-dark-border rounded-2xl p-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xl">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-white">Find Liquor Stores Near You</h3>
                    <p className="text-xs text-dark-text-muted mt-0.5">Delivering cold spirits across North Goa exclusive boundaries</p>
                  </div>
                  <div className="w-full md:w-80 relative">
                    <input 
                      type="text" 
                      placeholder="Search stores, brands..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 text-xs text-white focus:border-gold-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Grid List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {stores
                    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(store => (
                      <div 
                        key={store.id} 
                        onClick={() => selectStore(store)}
                        className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden hover:border-gold-500/40 active:scale-98 transition shadow-lg cursor-pointer flex flex-col justify-between"
                      >
                        {/* Mock Image placeholder */}
                        <div className="h-32 bg-dark-surface border-b border-dark-border flex items-center justify-center text-gold-500 relative">
                          <Store size={48} className="opacity-40" />
                          <span className="absolute bottom-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] text-white flex items-center gap-1 font-bold">
                            <Star size={10} className="fill-gold-500 text-gold-500" />
                            {store.rating} ({store.reviewsCount})
                          </span>
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-heading text-base font-bold text-white leading-tight">{store.name}</h4>
                            <p className="text-[11px] text-dark-text-muted mt-1 leading-snug">{store.address}</p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-dark-border flex items-center justify-between text-[10px]">
                            <span className="text-green-500 font-bold bg-green-500/5 px-2 py-0.5 rounded">Store Open</span>
                            <span className="text-gold-500 font-semibold">15-30 Min ETA</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Profile Tab / KYC Setup inside Customer panel */}
            {user && (
              <div className="max-w-xl w-full mx-auto mt-12 bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl space-y-6">
                <div className="border-b border-dark-border pb-4">
                  <h4 className="font-heading text-base font-bold text-white flex items-center gap-2">
                    <User size={18} className="text-gold-500" />
                    <span>Your Verification Status (Excise KYC)</span>
                  </h4>
                  <p className="text-xs text-dark-text-muted mt-1">Government ID age-checks required by Goa excise laws (21+ rule)</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-dark-surface rounded-xl border border-dark-border">
                  <div>
                    <span className="text-[10px] text-dark-text-muted uppercase font-bold tracking-wider">Status</span>
                    <h5 className={`text-sm font-bold mt-1 uppercase ${user.kyc?.status === 'verified' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {user.kyc?.status || 'none'}
                    </h5>
                  </div>
                  {user.kyc?.status === 'verified' ? (
                    <span className="px-3 py-1 bg-green-500/10 border border-green-500/25 text-green-500 text-xs font-bold rounded-full flex items-center gap-1">
                      <Check size={12} />
                      Verified Profile
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/25 text-yellow-500 text-xs font-bold rounded-full">
                      Awaiting Upload
                    </span>
                  )}
                </div>

                {user.kyc?.status !== 'verified' && (
                  <form onSubmit={handleKycVerify} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-dark-text-muted mb-1">Document Type</label>
                        <select
                          value={kycForm.documentType}
                          onChange={(e) => setKycForm({...kycForm, documentType: e.target.value})}
                          className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs text-white"
                        >
                          <option value="Aadhaar">Aadhaar Card</option>
                          <option value="PAN">PAN Card</option>
                          <option value="Driving License">Driving License</option>
                          <option value="Passport">Passport</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-dark-text-muted mb-1">Document Number</label>
                        <input
                          type="text"
                          placeholder="XXXX-XXXX-XXXX"
                          required
                          value={kycForm.documentNumber}
                          onChange={(e) => setKycForm({...kycForm, documentNumber: e.target.value})}
                          className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-dark-text-muted mb-1">Official Birth Date (Must match ID exactly)</label>
                      <input
                        type="date"
                        required
                        value={kycForm.dob}
                        onChange={(e) => setKycForm({...kycForm, dob: e.target.value})}
                        className="w-full bg-dark-surface border border-dark-border rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>

                    {/* ID Document Scanner Mockup */}
                    <div className="border border-dashed border-dark-border rounded-xl p-6 text-center bg-dark-surface/50 space-y-3">
                      <span className="text-[10px] text-dark-text-muted uppercase font-bold tracking-wider block">Mock Document Scanner</span>
                      <div className="w-24 h-16 border border-dark-border rounded bg-dark-bg mx-auto flex items-center justify-center text-xs font-bold text-gold-500">
                        FRONT SCAN
                      </div>
                      <p className="text-[10px] text-dark-text-muted">Consent-based verification. Camera capture is fully secure.</p>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isUploadingId}
                      className="w-full py-3 bg-gold-500 hover:bg-gold-600 disabled:bg-dark-border text-black font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-gold-500/10 flex items-center justify-center gap-2"
                    >
                      {isUploadingId ? (
                        <>
                          <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>{kycStatusMsg}</span>
                        </>
                      ) : (
                        <span>Simulate Document Verification Check</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* VENDOR STORE PANEL */}
        {currentRole === 'vendor' && (
          <div className="space-y-6">
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 flex justify-between items-center shadow-lg">
              <div>
                <span className="text-xs text-gold-500 font-bold uppercase tracking-wider">Vendor Management Portal</span>
                <h3 className="font-heading text-lg font-bold text-white mt-1">Panaji Spirits Palace (Dashboard)</h3>
              </div>
              <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-500 text-xs font-bold rounded-full">
                Active Store Outlet
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Order Feed */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-heading text-base font-bold text-white border-b border-dark-border pb-2">
                  Live Customer Orders Feed
                </h4>

                {vendorOrders.length === 0 ? (
                  <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center text-dark-text-muted">
                    <Store className="mx-auto opacity-30 mb-3" size={32} />
                    <p className="text-xs">No active liquor delivery orders placed.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vendorOrders.map(order => (
                      <div key={order.id} className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] text-dark-text-muted font-bold font-mono">ID: {order.id}</span>
                            <h5 className="font-bold text-white mt-1">Total: ₹{order.amounts?.total}</h5>
                          </div>
                          <span className="px-2 py-0.5 bg-gold-500/10 border border-gold-500/35 text-gold-500 text-[10px] font-bold rounded-full capitalize">
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Products ordered */}
                        <div className="bg-dark-surface p-3 rounded-lg text-xs space-y-1.5">
                          {order.products?.map((p, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-white">{p.name}</span>
                              <span className="text-dark-text-muted font-bold">Qty: {p.quantity}</span>
                            </div>
                          ))}
                        </div>

                        {/* Customer details */}
                        <div className="text-[11px] text-dark-text-muted flex justify-between">
                          <span>Client: {order.customerName} ({order.customerPhone})</span>
                          <span>Addr: {order.deliveryAddress?.address}</span>
                        </div>

                        {/* Action Control Panel */}
                        <div className="pt-3 border-t border-dark-border flex gap-3 justify-end">
                          {order.status === 'placed' && (
                            <button
                              onClick={() => handleAssignDriver(order.id)}
                              className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-black text-xs font-bold rounded-lg cursor-pointer active:scale-95 transition"
                            >
                              Accept & Assign Delivery Rider
                            </button>
                          )}
                          {order.status === 'accepted' && (
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'preparing')}
                              className="px-4 py-2 bg-dark-surface border border-dark-border hover:bg-dark-border text-white text-xs font-bold rounded-lg cursor-pointer transition"
                            >
                              Mark as Packaging Box
                            </button>
                          )}
                          {order.status === 'preparing' && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gold-400 font-semibold">Packaging Complete. Dispatching...</span>
                              <button
                                onClick={() => handleStartSimulation(order.id, order.driverId || 'd-1')}
                                className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-black text-xs font-bold rounded-lg cursor-pointer active:scale-95 transition"
                              >
                                Trigger Route simulation
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Inventory Toggle Control */}
              <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-4">
                <h4 className="font-heading text-base font-bold text-white border-b border-dark-border pb-2">
                  Inventory Stock Controls
                </h4>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {vendorProducts.map(prod => (
                    <div key={prod.id} className="flex justify-between items-center text-xs p-2.5 bg-dark-surface/40 rounded-lg border border-dark-border/40">
                      <div className="min-w-0 pr-2">
                        <h5 className="font-bold text-white truncate">{prod.name}</h5>
                        <p className="text-[10px] text-dark-text-muted mt-0.5">Price: ₹{prod.price} | Stock: {prod.stock}</p>
                      </div>
                      <button
                        onClick={() => handleToggleStock(prod.id, prod.isAvailable)}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold cursor-pointer transition ${
                          prod.isAvailable 
                            ? 'bg-green-500/10 text-green-500 border border-green-500/30' 
                            : 'bg-red-500/10 text-red-500 border border-red-500/30'
                        }`}
                      >
                        {prod.isAvailable ? 'In Stock' : 'Out of Stock'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DELIVERY PARTNER APP */}
        {currentRole === 'driver' && (
          <div className="space-y-6">
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 flex justify-between items-center shadow-lg">
              <div>
                <span className="text-xs text-gold-500 font-bold uppercase tracking-wider">Driver Companion App</span>
                <h3 className="font-heading text-lg font-bold text-white mt-1">Ramesh Kumar (On-Duty Dashboard)</h3>
              </div>
              <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-500 text-xs font-bold rounded-full">
                Rider Available
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left active deliveries feed */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-heading text-base font-bold text-white border-b border-dark-border pb-2">
                  Assigned Deliveries Feed
                </h4>

                {driverOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length === 0 ? (
                  <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center text-dark-text-muted">
                    <Truck className="mx-auto opacity-30 mb-3" size={32} />
                    <p className="text-xs">No active liquor delivery offers mapped.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {driverOrders
                      .filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
                      .map(order => (
                        <div key={order.id} className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-4">
                          <div className="flex justify-between">
                            <div>
                              <span className="text-[10px] text-dark-text-muted font-bold font-mono">ID: {order.id}</span>
                              <h5 className="font-bold text-white mt-1">{order.storeName}</h5>
                            </div>
                            <span className="px-2 py-0.5 bg-gold-500/10 border border-gold-500/35 text-gold-500 text-[10px] font-bold rounded-full capitalize">
                              {order.status.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="text-xs text-dark-text-muted space-y-1">
                            <p><strong className="text-white">Customer:</strong> {order.customerName}</p>
                            <p><strong className="text-white">Address:</strong> {order.deliveryAddress?.address}</p>
                            <p><strong className="text-white">Collect Amount:</strong> ₹{order.amounts?.total} ({order.paymentMethod === 'COD' ? 'COD - Collect Cash' : 'Prepaid Online'})</p>
                          </div>

                          <div className="pt-3 border-t border-dark-border flex gap-3 justify-end">
                            {!order.driverId ? (
                              <button
                                onClick={() => handleAssignDriver(order.id)}
                                className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-black text-xs font-bold rounded-lg cursor-pointer"
                              >
                                Accept Delivery Offer
                              </button>
                            ) : (
                              <div className="flex gap-2">
                                {order.status === 'preparing' && (
                                  <button
                                    onClick={() => handleStartSimulation(order.id, order.driverId)}
                                    className="px-4 py-2 bg-gold-500 hover:bg-gold-600 text-black text-xs font-bold rounded-lg cursor-pointer animate-pulse"
                                  >
                                    Accept Package & Start Route GPS Simulation
                                  </button>
                                )}
                                {order.status === 'picked_up' && (
                                  <button
                                    onClick={() => handleUpdateStatus(order.id, 'near_you')}
                                    className="px-4 py-2 bg-dark-surface border border-dark-border hover:bg-dark-border text-white text-xs font-bold rounded-lg cursor-pointer"
                                  >
                                    Arrived Near Customer Area
                                  </button>
                                )}
                                {order.status === 'near_you' && (
                                  <button
                                    onClick={() => handleUpdateStatus(order.id, 'delivered')}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                                  >
                                    Verify Customer ID & Complete Delivery
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Right Wallet Status */}
              <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-4">
                <h4 className="font-heading text-base font-bold text-white border-b border-dark-border pb-2">
                  Earnings & Wallet Balance
                </h4>
                <div className="p-4 bg-dark-surface rounded-xl border border-dark-border text-center space-y-2">
                  <span className="text-[10px] text-dark-text-muted font-bold uppercase tracking-wider block">Total Wallet Balance</span>
                  <h3 className="text-3xl font-extrabold text-gold-500">₹1,850</h3>
                  <span className="text-[10px] text-green-500 font-bold block">✓ Weekly payout scheduled</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN PANEL */}
        {currentRole === 'admin' && adminStats && (
          <div className="space-y-6">
            <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-lg">
              <span className="text-xs text-gold-500 font-bold uppercase tracking-wider">Super Admin Control Dashboard</span>
              <h3 className="font-heading text-lg font-bold text-white mt-1">Platform Analytics (North Goa Zone)</h3>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: "Total Revenue", value: `₹${adminStats.totalRevenue}`, icon: DollarSign, color: "text-green-400" },
                { title: "Liquor Orders", value: adminStats.totalOrders, icon: ShoppingBag, color: "text-blue-400" },
                { title: "Active Stores", value: adminStats.activeStoresCount, icon: Store, color: "text-gold-500" },
                { title: "Riders Online", value: adminStats.activeDriversCount, icon: Truck, color: "text-purple-400" }
              ].map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div key={idx} className="bg-dark-card border border-dark-border rounded-xl p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-dark-text-muted font-bold uppercase tracking-wider">{card.title}</p>
                      <h4 className="text-2xl font-extrabold text-white mt-2 leading-none">{card.value}</h4>
                    </div>
                    <Icon className={card.color} size={28} />
                  </div>
                );
              })}
            </div>

            {/* Admin subpanels */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Store Performance */}
              <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-4">
                <h4 className="font-heading text-sm font-bold text-white border-b border-dark-border pb-2">
                  Vendor Outlets Performance
                </h4>
                <div className="space-y-3">
                  {adminStores.map((st, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-2 bg-dark-surface/40 border border-dark-border/40 rounded-lg">
                      <span className="text-white font-semibold">{st.name}</span>
                      <div className="text-right">
                        <span className="text-gold-500 font-bold block">₹{st.sales}</span>
                        <span className="text-[10px] text-dark-text-muted">{st.count} orders</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fraud Alerts & Audits */}
              <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-4">
                <h4 className="font-heading text-sm font-bold text-white border-b border-dark-border pb-2 flex items-center justify-between">
                  <span>Fraud Monitoring & Auditing</span>
                  <Shield className="text-red-500" size={16} />
                </h4>
                {adminAlerts.length === 0 ? (
                  <p className="text-xs text-dark-text-muted text-center py-6">No security alerts flagged.</p>
                ) : (
                  <div className="space-y-2.5">
                    {adminAlerts.map(alert => (
                      <div key={alert.id} className="p-2.5 bg-red-500/5 border border-red-500/25 rounded-lg text-[10px] space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-red-400 font-bold uppercase">{alert.type}</span>
                          <span className="text-dark-text-muted font-mono">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-gray-300 leading-snug">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Drivers Geolocation list */}
              <div className="bg-dark-card border border-dark-border rounded-2xl p-5 space-y-4">
                <h4 className="font-heading text-sm font-bold text-white border-b border-dark-border pb-2">
                  Delivery Zone Configuration (North Goa)
                </h4>
                <div className="bg-dark-surface p-4 rounded-xl border border-dark-border space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted font-semibold">Active Geofence</span>
                    <span className="text-green-500 font-bold">ON</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-text-muted font-semibold">Excise Age Verify Check</span>
                    <span className="text-gold-500 font-bold">21+ Goa Excise</span>
                  </div>
                  <div className="pt-2 border-t border-dark-border/40 text-[10px] text-dark-text-muted leading-relaxed">
                    Geofence limits latitude between 15.45 and 15.75. Orders originating outside this grid block at payment.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FIXED PLATFORM SIMULATOR/ROLE SWITCHER FLOATING PANEL */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-dark-card/95 border border-gold-500/30 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md">
        <span className="text-[10px] text-gold-500 font-bold uppercase tracking-wider mr-2 select-none border-r border-dark-border pr-3">
          Demo Switcher
        </span>
        {[
          { id: 'customer', label: 'Customer App', icon: User },
          { id: 'vendor', label: 'Store Owner', icon: Store },
          { id: 'driver', label: 'Rider App', icon: Truck },
          { id: 'admin', label: 'Super Admin', icon: Settings }
        ].map(role => {
          const Icon = role.icon;
          const isSelected = currentRole === role.id;
          return (
            <button
              key={role.id}
              onClick={() => setRole(role.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer active:scale-95 transition ${
                isSelected 
                  ? 'bg-gold-500 text-black font-bold' 
                  : 'text-dark-text-muted hover:text-white hover:bg-dark-border'
              }`}
            >
              <Icon size={12} />
              <span className="hidden sm:inline">{role.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sandbox Checkout Payment Modal */}
      <PaymentModal 
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        totalAmount={getTotal()}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
