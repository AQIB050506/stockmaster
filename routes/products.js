const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, getProducts)
  .post(protect, authorize('inventory_manager'), createProduct);

router.route('/categories')
  .get(protect, getCategories);

router.route('/:id')
  .get(protect, getProduct)
  .put(protect, authorize('inventory_manager'), updateProduct)
  .delete(protect, authorize('inventory_manager'), deleteProduct);

module.exports = router;