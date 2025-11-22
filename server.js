const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 StockMaster API is running!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      dashboard: '/api/dashboard', 
      products: '/api/products',
      warehouses: '/api/warehouses',
      transactions: '/api/transactions',
      stock: '/api/stock'
    }
  });
});

// Simple test routes - FIXED JSON SYNTAX
app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    data: [
      { 
        id: 1, 
        name: 'Steel Rods', 
        sku: 'STEEL-001', 
        stock: 100, 
        category: 'Raw Materials' 
      },
      { 
        id: 2, 
        name: 'Wooden Chairs', 
        sku: 'CHAIR-001', 
        stock: 50, 
        category: 'Furniture' 
      }
    ]
  });
});

app.get('/api/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      totalProducts: 15,
      lowStockItems: 3,
      pendingReceipts: 2,
      pendingDeliveries: 5,
      totalWarehouses: 2
    }
  });
});

// Auth routes (simple version)
app.post('/api/auth/register', (req, res) => {
  res.json({
    success: true,
    message: 'User registered successfully',
    user: {
      id: 1,
      name: req.body.name,
      email: req.body.email,
      role: 'inventory_manager'
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({
    success: true,
    token: 'demo_jwt_token_for_testing',
    user: {
      id: 1,
      name: 'Demo User',
      email: req.body.email,
      role: 'inventory_manager'
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📊 StockMaster Prototype Ready!`);
});