import express from 'express';
import { db } from '../models.js';

const router = express.Router();

// 1. Get all stores
router.get('/', async (req, res) => {
  try {
    const stores = await db.getStores();
    res.json({ success: true, stores });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Get a single store's details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const store = await db.getStoreById(id);
    if (!store) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    res.json({ success: true, store });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Get products by store
router.get('/:id/products', async (req, res) => {
  const { id } = req.params;
  try {
    const products = await db.getProductsByStore(id);
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Toggle product availability (Vendor dashboard control)
router.post('/:id/products/:productId/toggle-stock', async (req, res) => {
  const { productId } = req.params;
  const { isAvailable, stock } = req.body;

  try {
    let updatedProduct;
    if (stock !== undefined) {
      updatedProduct = await db.updateProductStock(productId, stock);
    } else if (isAvailable !== undefined) {
      updatedProduct = await db.updateProductAvailability(productId, isAvailable);
    }

    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    res.json({
      success: true,
      message: "Product stock updated successfully.",
      product: updatedProduct
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Update Store Active status (Open/Close)
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const updatedStore = await db.updateStore(id, { isActive });
    if (!updatedStore) {
      return res.status(404).json({ success: false, message: "Store not found." });
    }
    res.json({
      success: true,
      message: `Store status updated to ${isActive ? 'Open' : 'Closed'}.`,
      store: updatedStore
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
