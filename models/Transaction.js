const mongoose = require('mongoose');

const transactionItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    min: [0, 'Unit price cannot be negative']
  },
  location: String
});

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['receipt', 'delivery', 'transfer', 'adjustment'],
    required: true
  },
  reference: {
    type: String,
    unique: true
  },
  status: {
    type: String,
    enum: ['draft', 'waiting', 'ready', 'completed', 'cancelled'],
    default: 'draft'
  },
  fromWarehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse'
  },
  toWarehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse'
  },
  supplier: String,
  customer: String,
  items: [transactionItemSchema],
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completedAt: Date
}, {
  timestamps: true
});

// Generate reference number before saving
transactionSchema.pre('save', async function(next) {
  if (this.isNew && !this.reference) {
    const prefix = this.type.toUpperCase().substring(0, 3);
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    this.reference = `${prefix}-${timestamp}-${random}`;
  }
  next();
});

// Index for better query performance
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ reference: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);