# 📦 StockMaster - Inventory Management System

StockMaster is a comprehensive, modern Inventory Management System (IMS) that digitizes and streamlines all stock-related operations within a business. Built with Node.js, Express, MongoDB, and a responsive web interface, it provides real-time inventory tracking, multi-warehouse support, and intelligent demand forecasting.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

## ✨ Features

### Core Functionality
- **📊 Dashboard** - Real-time KPIs, inventory valuation, and analytics
- **📦 Product Management** - Complete CRUD operations with categories and pricing
- **🏢 Multi-Warehouse Support** - Manage multiple warehouses with location tracking
- **📥 Receipts** - Track incoming stock with supplier information
- **📤 Deliveries** - Manage outgoing stock and customer orders
- **🔄 Internal Transfers** - Transfer stock between warehouses
- **⚙️ Stock Adjustments** - Correct inventory discrepancies
- **📋 Move History** - Complete audit trail of all stock movements

### Advanced Features
- **🔐 Authentication & Authorization** - JWT-based auth with role-based access control
- **📱 Progressive Web App (PWA)** - Works offline with service workers
- **🤖 AI-Powered Demand Forecasting** - Predictive analytics for inventory planning
- **📄 OCR Document Scanner** - Extract data from invoices and receipts using Tesseract.js
- **🔔 Real-time Updates** - Socket.io for live inventory updates
- **📊 Stock Alerts** - Low stock and out-of-stock notifications
- **🖨️ Receipt Printing** - Print-friendly receipt views
- **📈 Inventory Valuation** - Track total inventory value and potential revenue

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v14.0.0 or higher)
- **MongoDB** (v4.4 or higher) - Local or Atlas
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stockmaster
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # MongoDB Connection
   MONGO_URI=mongodb://localhost:27017/stockmaster
   # Or for MongoDB Atlas:
   # MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/stockmaster

   # JWT Secret
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=30d

   # Email Configuration (for password reset)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   FROM_EMAIL=noreply@stockmaster.com
   FROM_NAME=StockMaster
   ```

4. **Start MongoDB**
   
   Make sure MongoDB is running on your system:
   ```bash
   # Windows
   net start MongoDB

   # macOS (using Homebrew)
   brew services start mongodb-community

   # Linux
   sudo systemctl start mongod
   ```

5. **Run the application**
   ```bash
   # Development mode (with auto-reload)
   npm run dev

   # Production mode
   npm start
   ```

6. **Access the application**
   
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
stockmaster/
├── app.js                 # Main application entry point
├── config/
│   └── database.js        # MongoDB connection configuration
├── controllers/
│   ├── authController.js      # Authentication logic
│   ├── dashboardController.js # Dashboard KPIs
│   ├── ocrController.js       # OCR processing
│   ├── productController.js   # Product operations
│   ├── stockController.js     # Stock management
│   ├── transactionController.js # Transaction operations
│   └── warehouseController.js  # Warehouse management
├── middleware/
│   ├── auth.js            # JWT authentication middleware
│   ├── error.js           # Error handling middleware
│   └── validation.js     # Request validation
├── models/
│   ├── Product.js         # Product schema
│   ├── Stock.js           # Stock schema
│   ├── Transaction.js     # Transaction schema
│   ├── User.js            # User schema
│   └── Warehouse.js      # Warehouse schema
├── public/
│   ├── app.js             # Frontend JavaScript
│   ├── index.html         # Main HTML file
│   ├── styles.css         # Application styles
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # Service worker
│   └── offlineManager.js # Offline functionality
├── routes/
│   ├── auth.js            # Authentication routes
│   ├── dashboard.js       # Dashboard routes
│   ├── ocr.js             # OCR routes
│   ├── products.js        # Product routes
│   ├── seed.js            # Seed data routes
│   ├── stock.js           # Stock routes
│   ├── transactions.js    # Transaction routes
│   └── warehouses.js     # Warehouse routes
├── utils/
│   ├── demandForecast.js  # AI demand forecasting
│   ├── errorResponse.js   # Error response utility
│   ├── generateOTP.js     # OTP generation
│   ├── generateReference.js # Reference number generation
│   ├── ocrProcessor.js    # OCR processing utility
│   ├── seedData.js        # Database seeding
│   └── sendEmail.js       # Email utility
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgotpassword` - Request password reset OTP
- `PUT /api/auth/resetpassword` - Reset password with OTP

### Dashboard
- `GET /api/dashboard` - Get dashboard KPIs and metrics

### Products
- `GET /api/products` - Get all products (with filters)
- `POST /api/products` - Create product (Manager only)
- `GET /api/products/:id` - Get single product
- `PUT /api/products/:id` - Update product (Manager only)
- `DELETE /api/products/:id` - Delete product (Manager only)
- `GET /api/products/categories` - Get all categories

### Warehouses
- `GET /api/warehouses` - Get all warehouses
- `POST /api/warehouses` - Create warehouse (Manager only)
- `GET /api/warehouses/:id` - Get single warehouse
- `PUT /api/warehouses/:id` - Update warehouse (Manager only)
- `GET /api/warehouses/:id/stock` - Get warehouse stock

### Transactions
- `GET /api/transactions` - Get all transactions (filterable by type, status, warehouse)
- `POST /api/transactions/receipt` - Create receipt (incoming stock)
- `POST /api/transactions/delivery` - Create delivery (outgoing stock)
- `POST /api/transactions/transfer` - Create internal transfer
- `POST /api/transactions/adjustment` - Create stock adjustment
- `GET /api/transactions/:id` - Get single transaction
- `PUT /api/transactions/:id/complete` - Complete transaction
- `PUT /api/transactions/:id/cancel` - Cancel transaction

### Stock
- `GET /api/stock` - Get all stock records
- `GET /api/stock/product/:productId` - Get product stock across warehouses
- `GET /api/stock/alerts` - Get low stock alerts
- `PUT /api/stock/:id/location` - Update stock location

### OCR (Optional)
- `POST /api/ocr/scan` - Scan document and extract data

## 👥 User Roles

### Inventory Manager
- Full access to all features
- Can create/edit/delete products and warehouses
- Can manage all transactions
- Access to analytics and reports

### Warehouse Staff
- View products and warehouses
- Create receipts, deliveries, and transfers
- Update stock locations
- Limited access to management features

## 🛠️ Technologies Used

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication
- **Socket.io** - Real-time communication
- **Tesseract.js** - OCR capabilities
- **Nodemailer** - Email functionality

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **HTML5/CSS3** - Modern web standards
- **Service Workers** - PWA support
- **Chart.js** - Data visualization (if used)

## 📝 Usage Examples

### Creating a Product
```javascript
POST /api/products
Headers: { Authorization: Bearer <token> }
Body: {
  "name": "Aluminum Sheets",
  "sku": "ALM-SHT-001",
  "category": "RAW MATERIALS",
  "unitOfMeasure": "kg",
  "costPrice": 500,
  "sellingPrice": 750,
  "minStockLevel": 100
}
```

### Creating a Receipt
```javascript
POST /api/transactions/receipt
Headers: { Authorization: Bearer <token> }
Body: {
  "toWarehouse": "warehouse_id",
  "supplier": "ABC Suppliers",
  "items": [
    {
      "product": "product_id",
      "quantity": 50,
      "unitPrice": 500
    }
  ]
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3000 |
| `MONGO_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | Secret for JWT tokens | Yes | - |
| `JWT_EXPIRE` | JWT expiration time | No | 30d |
| `SMTP_HOST` | SMTP server host | No | - |
| `SMTP_PORT` | SMTP server port | No | 587 |
| `SMTP_USER` | SMTP username | No | - |
| `SMTP_PASS` | SMTP password | No | - |

## 🧪 Seeding Database

To populate the database with sample data:

```bash
npm run seed
```

Or use the seed endpoint (if available):
```bash
POST /api/seed
```

## 📱 Progressive Web App

StockMaster is a Progressive Web App (PWA) that:
- Works offline with cached data
- Can be installed on mobile devices
- Syncs data when connection is restored
- Provides native app-like experience

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC)
- Input validation and sanitization
- CORS configuration
- Error handling middleware

## 🐛 Troubleshooting

### Port Already in Use
If you get `EADDRINUSE` error:
```bash
# Find process using port 3000
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # macOS/Linux

# Kill the process or change PORT in .env
```

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check `MONGO_URI` in `.env`
- Verify network connectivity for Atlas

### OCR Not Working
- Tesseract.js is optional
- Install with: `npm install tesseract.js`
- OCR routes will be disabled if not installed

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

**AQIB**
- Email: aqibchoudhary57@gmail.com
- GitHub: [@AQIB050506](https://github.com/AQIB050506)

**ARNAV**
- Email: arnavsurve1000@gmail.com
- GitHub: [@ArnavSurve27](https://github.com/ArnavSurve27)

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by industry-standard inventory management systems
- Uses best practices for security and scalability

## 📞 Support

For support, email support@stockmaster.com or open an issue in the repository.

---

**Made with ❤️ for efficient inventory management**

