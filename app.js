const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
require('dotenv').config();

// Database connection
const connectDB = require('./config/database');

// Route files
const auth = require('./routes/auth');
const dashboard = require('./routes/dashboard');
const products = require('./routes/products');
const warehouses = require('./routes/warehouses');
const transactions = require('./routes/transactions');
const stock = require('./routes/stock');
const seed = require('./routes/seed');

// Conditionally load OCR routes
let ocrRoutes;
try {
  ocrRoutes = require('./routes/ocr');
} catch (error) {
  console.warn('⚠️  OCR routes not available (tesseract.js may not be installed)');
  ocrRoutes = null;
}

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// Serve static files from public directory
app.use(express.static('public'));

// Serve manifest.json with correct content type
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// Mount routers
app.use('/api/auth', auth);
app.use('/api/dashboard', dashboard);
app.use('/api/products', products);
app.use('/api/warehouses', warehouses);
app.use('/api/transactions', transactions);
app.use('/api/stock', stock);
app.use('/api/seed', seed);
if (ocrRoutes) {
  app.use('/api/ocr', ocrRoutes);
}

// Basic route - serve HTML interface
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// API status endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'StockMaster API is running',
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

// Error handling middleware
const errorHandler = require('./middleware/error');
app.use(errorHandler);

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join-warehouse', (warehouseId) => {
    socket.join(warehouseId);
    console.log(`User joined warehouse: ${warehouseId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io available to routes
app.set('io', io);

const PORT = process.env.PORT || 3000;

// Connect to database, then start server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log('\n========================================');
    console.log('🚀 StockMaster API Server Started!');
    console.log('========================================');
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🌐 Web Interface: http://localhost:${PORT}`);
    console.log(`📊 API Base URL: http://localhost:${PORT}/api`);
    console.log('========================================\n');
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use!`);
      console.error(`\n💡 To fix this, you can:`);
      console.error(`   1. Find and stop the process using port ${PORT}:`);
      console.error(`      Windows: netstat -ano | findstr :${PORT}`);
      console.error(`      Then kill it: taskkill /PID <PID> /F`);
      console.error(`   2. Or use a different port by setting PORT environment variable:`);
      console.error(`      set PORT=3001 && npm start`);
      console.error(`\n`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
}).catch((err) => {
  console.error('❌ Failed to connect to MongoDB. Server not started.', err);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', err);
  server.close(() => {
    process.exit(1);
  });
});
