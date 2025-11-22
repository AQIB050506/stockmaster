const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add product name'],
    trim: true,
    maxlength: [100, 'Product name cannot be more than 100 characters']
  },
  sku: {
    type: String,
    required: [true, 'Please add SKU'],
    unique: true,
    uppercase: true,
    match: [/^[A-Z0-9-]+$/, 'SKU can only contain uppercase letters, numbers and hyphens']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Please add category'],
    trim: true
  },
  unitOfMeasure: {
    type: String,
    required: [true, 'Please add unit of measure'],
    enum: ['kg', 'pcs', 'liters', 'boxes', 'units', 'meters']
  },
  costPrice: {
    type: Number,
    min: [0, 'Cost price cannot be negative']
  },
  sellingPrice: {
    type: Number,
    min: [0, 'Selling price cannot be negative']
  },
  minStockLevel: {
    type: Number,
    default: 0,
    min: [0, 'Minimum stock level cannot be negative']
  },
  maxStockLevel: {
    type: Number,
    min: [0, 'Maximum stock level cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better search performance
productSchema.index({ name: 'text', sku: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);