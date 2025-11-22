const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Stock quantity cannot be negative']
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Reserved quantity cannot be negative']
  },
  location: {
    type: String,
    trim: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure unique product-warehouse combination
stockSchema.index({ product: 1, warehouse: 1 }, { unique: true });

// Virtual for available quantity (quantity - reservedQuantity)
stockSchema.virtual('availableQuantity').get(function() {
  return this.quantity - this.reservedQuantity;
});

// Ensure virtual fields are serialized
stockSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Stock', stockSchema);