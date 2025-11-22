const express = require('express');
const {
  getStock,
  getProductStock,
  updateStockLocation,
  getLowStockAlerts
} = require('../controllers/stockController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, getStock);

router.route('/alerts')
  .get(protect, getLowStockAlerts);

router.route('/product/:productId')
  .get(protect, getProductStock);

router.route('/:id/location')
  .put(protect, updateStockLocation);

module.exports = router;