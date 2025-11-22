const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add warehouse name'],
    trim: true,
    maxlength: [100, 'Warehouse name cannot be more than 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Please add warehouse code'],
    unique: true,
    uppercase: true,
    match: [/^[A-Z0-9]+$/, 'Warehouse code can only contain uppercase letters and numbers']
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'India'
    }
  },
  contactPerson: {
    name: String,
    phone: String,
    email: String
  },
  capacity: {
    type: Number,
    min: [0, 'Capacity cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Warehouse', warehouseSchema);