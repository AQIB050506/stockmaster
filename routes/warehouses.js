const express = require('express');
const {
  getWarehouses,
  getWarehouse,
  createWarehouse,
  updateWarehouse,
  getWarehouseStock
} = require('../controllers/warehouseController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, getWarehouses)
  .post(protect, authorize('inventory_manager'), createWarehouse);

router.route('/:id')
  .get(protect, getWarehouse)
  .put(protect, authorize('inventory_manager'), updateWarehouse);

router.route('/:id/stock')
  .get(protect, getWarehouseStock);

module.exports = router;