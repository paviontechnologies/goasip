import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // Authentication & Session
  user: JSON.parse(localStorage.getItem('goasip_user')) || null,
  token: localStorage.getItem('goasip_token') || '',
  currentRole: localStorage.getItem('goasip_role') || 'customer', // customer, vendor, driver, admin

  // Cart
  cart: JSON.parse(localStorage.getItem('goasip_cart')) || [],
  cartStoreId: localStorage.getItem('goasip_cart_store_id') || null,

  // Active Order & Live Tracking
  activeOrder: null,
  driverLocation: null,
  routeCoordinates: [],

  // Authentication Actions
  login: (user, token) => {
    localStorage.setItem('goasip_user', JSON.stringify(user));
    localStorage.setItem('goasip_token', token);
    localStorage.setItem('goasip_role', user.role);
    set({ user, token, currentRole: user.role });
  },

  logout: () => {
    localStorage.removeItem('goasip_user');
    localStorage.removeItem('goasip_token');
    localStorage.removeItem('goasip_role');
    localStorage.removeItem('goasip_cart');
    localStorage.removeItem('goasip_cart_store_id');
    set({ user: null, token: '', currentRole: 'customer', cart: [], cartStoreId: null, activeOrder: null, driverLocation: null, routeCoordinates: [] });
  },

  setRole: (role) => {
    localStorage.setItem('goasip_role', role);
    set({ currentRole: role });
  },

  updateUserKyc: (kycData) => {
    const { user } = get();
    if (!user) return;
    const updatedUser = { ...user, ...kycData };
    localStorage.setItem('goasip_user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  // Cart Actions
  addToCart: (product) => {
    const { cart, cartStoreId } = get();
    
    // Clear cart if adding item from a different store
    if (cartStoreId && cartStoreId !== product.storeId) {
      const confirmed = window.confirm("Adding items from a different store will clear your current cart. Proceed?");
      if (!confirmed) return;
      
      const newCart = [{ ...product, quantity: 1 }];
      localStorage.setItem('goasip_cart', JSON.stringify(newCart));
      localStorage.setItem('goasip_cart_store_id', product.storeId);
      set({ cart: newCart, cartStoreId: product.storeId });
      return;
    }

    const existingIdx = cart.findIndex(item => item.id === product.id);
    let newCart = [];
    if (existingIdx !== -1) {
      newCart = [...cart];
      newCart[existingIdx].quantity += 1;
    } else {
      newCart = [...cart, { ...product, quantity: 1 }];
    }

    localStorage.setItem('goasip_cart', JSON.stringify(newCart));
    localStorage.setItem('goasip_cart_store_id', product.storeId);
    set({ cart: newCart, cartStoreId: product.storeId });
  },

  removeFromCart: (productId) => {
    const { cart } = get();
    const existing = cart.find(item => item.id === productId);
    if (!existing) return;

    let newCart = [];
    if (existing.quantity > 1) {
      newCart = cart.map(item => 
        item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
      );
    } else {
      newCart = cart.filter(item => item.id !== productId);
    }

    if (newCart.length === 0) {
      localStorage.removeItem('goasip_cart');
      localStorage.removeItem('goasip_cart_store_id');
      set({ cart: [], cartStoreId: null });
    } else {
      localStorage.setItem('goasip_cart', JSON.stringify(newCart));
      set({ cart: newCart });
    }
  },

  clearCart: () => {
    localStorage.removeItem('goasip_cart');
    localStorage.removeItem('goasip_cart_store_id');
    set({ cart: [], cartStoreId: null });
  },

  // Active Order & Live Tracking Actions
  setActiveOrder: (order) => {
    set({ activeOrder: order });
  },

  setDriverLocation: (location) => {
    set({ driverLocation: location });
  },

  setRouteCoordinates: (coordinates) => {
    set({ routeCoordinates: coordinates });
  }
}));
