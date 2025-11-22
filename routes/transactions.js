const express = require('express');
const {
  getTransactions,
  getTransaction,
  createReceipt,
  createDelivery,
  createTransfer,
  createAdjustment,
  completeTransaction,
  cancelTransaction
} = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, getTransactions);

router.route('/receipt')
  .post(protect, createReceipt);

router.route('/delivery')
  .post(protect, createDelivery);

router.route('/transfer')
  .post(protect, createTransfer);

router.route('/adjustment')
  .post(protect, createAdjustment);

router.route('/:id')
  .get(protect, getTransaction);

router.route('/:id/complete')
  .put(protect, completeTransaction);

router.route('/:id/cancel')
  .put(protect, cancelTransaction);

module.exports = router;