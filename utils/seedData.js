const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const Stock = require('../models/Stock');
const Transaction = require('../models/Transaction');

// Sample Data
const sampleUsers = [
  {
    name: 'John Manager',
    email: 'john@stockmaster.com',
    password: 'password123',
    role: 'inventory_manager'
  },
  {
    name: 'Sarah Staff',
    email: 'sarah@stockmaster.com',
    password: 'password123',
    role: 'warehouse_staff'
  }
];

// More realistic supplier and customer names for demos
const sampleSuppliers = [
  'Akash Metals Pvt. Ltd.',
  'BrightBuild Industrial Supplies',
  'Metro Hardware Distributors',
  'Shakti Engineering Traders',
  'Prime Electricals & Co.',
  'Vision Safety Gear India'
];

const sampleCustomers = [
  'Omkar Constructions',
  'Skyline Developers',
  'GreenLeaf Furnishings',
  'CityTech Offices Pvt. Ltd.',
  'Sunrise Manufacturing Works',
  'BlueStone Infrastructure'
];

const sampleWarehouses = [
  {
    name: 'Main Warehouse',
    code: 'WH001',
    address: {
      street: '123 Industrial Blvd',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400001'
    },
    contactPerson: {
      name: 'Raj Kumar',
      phone: '+91-9876543210',
      email: 'raj@stockmaster.com'
    },
    capacity: 10000
  },
  {
    name: 'Secondary Warehouse',
    code: 'WH002',
    address: {
      street: '456 Commerce Park',
      city: 'Delhi',
      state: 'Delhi',
      zipCode: '110001'
    },
    contactPerson: {
      name: 'Priya Sharma',
      phone: '+91-9876543211',
      email: 'priya@stockmaster.com'
    },
    capacity: 5000
  },
  {
    name: 'Production Floor',
    code: 'PF001',
    address: {
      street: '789 Factory Road',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560001'
    },
    contactPerson: {
      name: 'Amit Patel',
      phone: '+91-9876543212',
      email: 'amit@stockmaster.com'
    },
    capacity: 2000
  }
];

const sampleProducts = [
  // Raw Materials
  { name: 'Steel Rods', sku: 'STL-ROD-001', category: 'Raw Materials', unitOfMeasure: 'kg', costPrice: 50, sellingPrice: 75, minStockLevel: 100, maxStockLevel: 1000, description: 'High-grade steel rods for construction' },
  { name: 'Aluminum Sheets', sku: 'ALM-SHT-002', category: 'Raw Materials', unitOfMeasure: 'kg', costPrice: 120, sellingPrice: 180, minStockLevel: 50, maxStockLevel: 500, description: 'Premium aluminum sheets' },
  { name: 'Copper Wire', sku: 'COP-WIR-003', category: 'Raw Materials', unitOfMeasure: 'meters', costPrice: 80, sellingPrice: 120, minStockLevel: 200, maxStockLevel: 2000, description: 'Copper wire for electrical use' },
  { name: 'Wood Planks', sku: 'WOD-PLK-004', category: 'Raw Materials', unitOfMeasure: 'pcs', costPrice: 200, sellingPrice: 300, minStockLevel: 30, maxStockLevel: 300, description: 'Premium quality wood planks' },
  
  // Finished Goods
  { name: 'Office Chairs', sku: 'FUR-CHA-101', category: 'Furniture', unitOfMeasure: 'pcs', costPrice: 2500, sellingPrice: 3500, minStockLevel: 10, maxStockLevel: 100, description: 'Ergonomic office chairs' },
  { name: 'Desk Tables', sku: 'FUR-TBL-102', category: 'Furniture', unitOfMeasure: 'pcs', costPrice: 5000, sellingPrice: 7500, minStockLevel: 5, maxStockLevel: 50, description: 'Modern office desk tables' },
  { name: 'Storage Cabinets', sku: 'FUR-CAB-103', category: 'Furniture', unitOfMeasure: 'pcs', costPrice: 3500, sellingPrice: 5000, minStockLevel: 8, maxStockLevel: 80, description: 'Metal storage cabinets' },
  
  // Electronics
  { name: 'LED Bulbs', sku: 'ELE-BLB-201', category: 'Electronics', unitOfMeasure: 'pcs', costPrice: 150, sellingPrice: 250, minStockLevel: 50, maxStockLevel: 500, description: 'Energy-efficient LED bulbs' },
  { name: 'Switches', sku: 'ELE-SWT-202', category: 'Electronics', unitOfMeasure: 'pcs', costPrice: 80, sellingPrice: 150, minStockLevel: 100, maxStockLevel: 1000, description: 'Electrical switches' },
  { name: 'Wires', sku: 'ELE-WIR-203', category: 'Electronics', unitOfMeasure: 'meters', costPrice: 25, sellingPrice: 40, minStockLevel: 500, maxStockLevel: 5000, description: 'Electrical wires' },
  
  // Tools
  { name: 'Hammer', sku: 'TL-HMR-301', category: 'Tools', unitOfMeasure: 'pcs', costPrice: 500, sellingPrice: 800, minStockLevel: 20, maxStockLevel: 200, description: 'Heavy-duty hammer' },
  { name: 'Screwdriver Set', sku: 'TL-SCR-302', category: 'Tools', unitOfMeasure: 'pcs', costPrice: 800, sellingPrice: 1200, minStockLevel: 15, maxStockLevel: 150, description: 'Complete screwdriver set' },
  { name: 'Drill Machine', sku: 'TL-DRL-303', category: 'Tools', unitOfMeasure: 'pcs', costPrice: 3500, sellingPrice: 5000, minStockLevel: 5, maxStockLevel: 50, description: 'Electric drill machine' },
  
  // Safety Equipment
  { name: 'Safety Helmets', sku: 'SAF-HLM-401', category: 'Safety', unitOfMeasure: 'pcs', costPrice: 400, sellingPrice: 600, minStockLevel: 30, maxStockLevel: 300, description: 'Industrial safety helmets' },
  { name: 'Safety Gloves', sku: 'SAF-GLV-402', category: 'Safety', unitOfMeasure: 'pcs', costPrice: 150, sellingPrice: 250, minStockLevel: 50, maxStockLevel: 500, description: 'Work safety gloves' },
  { name: 'Safety Shoes', sku: 'SAF-SHO-403', category: 'Safety', unitOfMeasure: 'pcs', costPrice: 1200, sellingPrice: 1800, minStockLevel: 20, maxStockLevel: 200, description: 'Industrial safety shoes' }
];

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Product.deleteMany({});
    await Warehouse.deleteMany({});
    await Stock.deleteMany({});
    await Transaction.deleteMany({});
    console.log('✅ Existing data cleared\n');

    // Create Users (use save() so password hashing middleware runs)
    console.log('👥 Creating users...');
    const users = [];
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      users.push(user);
    }
    console.log(`✅ Created ${users.length} users\n`);

    // Create Warehouses
    console.log('🏢 Creating warehouses...');
    const warehouses = await Warehouse.insertMany(sampleWarehouses);
    console.log(`✅ Created ${warehouses.length} warehouses\n`);

    // Create Products
    console.log('📦 Creating products...');
    const products = await Product.insertMany(sampleProducts);
    console.log(`✅ Created ${products.length} products\n`);

    // Create Stock entries
  console.log('📊 Creating stock entries...');
  const stockEntries = [];
  for (const product of products) {
    for (const warehouse of warehouses) {
      // Random quantity between min and max stock level
      const quantity = Math.floor(Math.random() * (product.maxStockLevel - product.minStockLevel + 1)) + product.minStockLevel;
      
      // Mix of normal, low, and out-of-stock items for a richer demo
      const isOutOfStock = Math.random() < 0.1; // ~10% pure out of stock
      let finalQuantity;

      if (isOutOfStock) {
        finalQuantity = 0;
      } else {
        const lowStockChance = Math.random();
        const lowStockQuantity = Math.max(0, Math.floor(product.minStockLevel * 0.5));
        finalQuantity = lowStockChance < 0.3 ? lowStockQuantity : quantity;
      }

      stockEntries.push({
        product: product._id,
        warehouse: warehouse._id,
        quantity: finalQuantity,
        reservedQuantity: Math.floor(Math.random() * 10),
        location: `Rack-${Math.floor(Math.random() * 10) + 1}-Shelf-${Math.floor(Math.random() * 5) + 1}`
      });
    }
  }
  await Stock.insertMany(stockEntries);
  console.log(`✅ Created ${stockEntries.length} stock entries\n`);

    // Create Sample Transactions
    console.log('📝 Creating sample transactions...');
    const allTransactions = [];
    
    // Receipts
    for (let i = 0; i < 5; i++) {
      const randomWarehouse = warehouses[Math.floor(Math.random() * warehouses.length)];
      const randomProducts = products.slice(0, Math.floor(Math.random() * 3) + 1);
      const statuses = ['completed', 'completed', 'completed', 'ready', 'waiting'];
      const supplierName = sampleSuppliers[i % sampleSuppliers.length];
      const reference = `REC-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const createdAt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      
      allTransactions.push({
        type: 'receipt',
        reference,
        status,
        toWarehouse: randomWarehouse._id,
        supplier: supplierName,
        items: randomProducts.map(p => ({
          product: p._id,
          quantity: Math.floor(Math.random() * 50) + 10,
          unitPrice: p.costPrice,
          location: `Rack-${i + 1}`
        })),
        createdBy: users[0]._id,
        notes: `Receipt from supplier ${i + 1}`,
        createdAt,
        completedAt: status === 'completed' ? createdAt : undefined
      });
    }

    // Deliveries - Enhanced for AI Demand Forecasting
    // Create many more deliveries spread over the last 60 days
    console.log('📦 Creating historical delivery transactions for AI forecasting...');
    
    // Create demand patterns for different products
    // High-demand products (sold frequently)
    const highDemandProducts = products.slice(0, 5); // First 5 products
    // Medium-demand products
    const mediumDemandProducts = products.slice(5, 10);
    // Low-demand products
    const lowDemandProducts = products.slice(10);
    
    // Generate deliveries over the last 60 days
    const daysBack = 60;
    let deliveryCount = 0;
    
    // High-demand products: 2-3 deliveries per week (30-40 total)
    for (let day = 0; day < daysBack; day++) {
      if (Math.random() < 0.4) { // 40% chance per day
        const product = highDemandProducts[Math.floor(Math.random() * highDemandProducts.length)];
        const warehouse = warehouses[Math.floor(Math.random() * warehouses.length)];
        const customerName = sampleCustomers[Math.floor(Math.random() * sampleCustomers.length)];
        const completedDate = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
        
        // Add some randomness to time of day
        completedDate.setHours(Math.floor(Math.random() * 12) + 8); // 8 AM to 8 PM
        completedDate.setMinutes(Math.floor(Math.random() * 60));
        
        allTransactions.push({
          type: 'delivery',
          reference: `DEL-${Date.now()}-${deliveryCount}-${Math.floor(Math.random() * 1000)}`,
          status: 'completed',
          fromWarehouse: warehouse._id,
          customer: customerName,
          items: [{
            product: product._id,
            quantity: Math.floor(Math.random() * 30) + 10, // 10-40 units
            unitPrice: product.sellingPrice,
          }],
          createdBy: users[0]._id,
          notes: `Delivery to ${customerName}`,
          createdAt: new Date(completedDate.getTime() - 2 * 60 * 60 * 1000), // Created 2 hours before completion
          completedAt: completedDate
        });
        deliveryCount++;
      }
    }
    
    // Medium-demand products: 1-2 deliveries per week (15-20 total)
    for (let day = 0; day < daysBack; day++) {
      if (Math.random() < 0.25) { // 25% chance per day
        const product = mediumDemandProducts[Math.floor(Math.random() * mediumDemandProducts.length)];
        const warehouse = warehouses[Math.floor(Math.random() * warehouses.length)];
        const customerName = sampleCustomers[Math.floor(Math.random() * sampleCustomers.length)];
        const completedDate = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
        completedDate.setHours(Math.floor(Math.random() * 12) + 8);
        completedDate.setMinutes(Math.floor(Math.random() * 60));
        
        allTransactions.push({
          type: 'delivery',
          reference: `DEL-${Date.now()}-${deliveryCount}-${Math.floor(Math.random() * 1000)}`,
          status: 'completed',
          fromWarehouse: warehouse._id,
          customer: customerName,
          items: [{
            product: product._id,
            quantity: Math.floor(Math.random() * 20) + 5, // 5-25 units
            unitPrice: product.sellingPrice,
          }],
          createdBy: users[0]._id,
          notes: `Delivery to ${customerName}`,
          createdAt: new Date(completedDate.getTime() - 2 * 60 * 60 * 1000),
          completedAt: completedDate
        });
        deliveryCount++;
      }
    }
    
    // Low-demand products: occasional deliveries (5-10 total)
    for (let day = 0; day < daysBack; day++) {
      if (Math.random() < 0.1) { // 10% chance per day
        const product = lowDemandProducts[Math.floor(Math.random() * lowDemandProducts.length)];
        const warehouse = warehouses[Math.floor(Math.random() * warehouses.length)];
        const customerName = sampleCustomers[Math.floor(Math.random() * sampleCustomers.length)];
        const completedDate = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
        completedDate.setHours(Math.floor(Math.random() * 12) + 8);
        completedDate.setMinutes(Math.floor(Math.random() * 60));
        
        allTransactions.push({
          type: 'delivery',
          reference: `DEL-${Date.now()}-${deliveryCount}-${Math.floor(Math.random() * 1000)}`,
          status: 'completed',
          fromWarehouse: warehouse._id,
          customer: customerName,
          items: [{
            product: product._id,
            quantity: Math.floor(Math.random() * 15) + 3, // 3-18 units
            unitPrice: product.sellingPrice,
          }],
          createdBy: users[0]._id,
          notes: `Delivery to ${customerName}`,
          createdAt: new Date(completedDate.getTime() - 2 * 60 * 60 * 1000),
          completedAt: completedDate
        });
        deliveryCount++;
      }
    }
    
    // Add some pending deliveries (not completed yet)
    for (let i = 0; i < 4; i++) {
      const randomWarehouse = warehouses[Math.floor(Math.random() * warehouses.length)];
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      const statuses = ['ready', 'waiting', 'draft'];
      const customerName = sampleCustomers[i % sampleCustomers.length];
      const reference = `DEL-${Date.now()}-${deliveryCount}-${Math.floor(Math.random() * 1000)}`;
      
      allTransactions.push({
        type: 'delivery',
        reference,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        fromWarehouse: randomWarehouse._id,
        customer: customerName,
        items: [{
          product: randomProduct._id,
          quantity: Math.floor(Math.random() * 20) + 5,
          unitPrice: randomProduct.sellingPrice,
        }],
        createdBy: users[0]._id,
        notes: `Delivery to customer ${i + 1}`,
        createdAt: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000)
        // No completedAt for pending deliveries
      });
      deliveryCount++;
    }

    // Transfers
    for (let i = 0; i < 3; i++) {
      const fromWarehouse = warehouses[Math.floor(Math.random() * warehouses.length)];
      const toWarehouse = warehouses.filter(w => w._id.toString() !== fromWarehouse._id.toString())[Math.floor(Math.random() * (warehouses.length - 1))];
      const randomProducts = products.slice(0, Math.floor(Math.random() * 2) + 1);
      const reference = `TRF-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
      const status = i === 0 ? 'waiting' : 'completed';
      const createdAt = new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000);
      
      allTransactions.push({
        type: 'transfer',
        reference,
        status,
        fromWarehouse: fromWarehouse._id,
        toWarehouse: toWarehouse._id,
        items: randomProducts.map(p => ({
          product: p._id,
          quantity: Math.floor(Math.random() * 30) + 10,
          unitPrice: p.costPrice,
        })),
        createdBy: users[0]._id,
        notes: `Transfer from ${fromWarehouse.name} to ${toWarehouse.name}`,
        createdAt,
        completedAt: status === 'completed' ? createdAt : undefined
      });
    }

    // Adjustments
    for (let i = 0; i < 2; i++) {
      const randomWarehouse = warehouses[Math.floor(Math.random() * warehouses.length)];
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      
      let rawQuantity = Math.floor(Math.random() * 10) - 5;
      if (rawQuantity === 0) rawQuantity = 1;
      const adjustmentQuantity = Math.abs(rawQuantity);
      const reference = `ADJ-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
      const createdAt = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
      
      allTransactions.push({
        type: 'adjustment',
        reference,
        status: 'completed',
        toWarehouse: randomWarehouse._id,
        items: [{
          product: randomProduct._id,
          quantity: adjustmentQuantity,
          unitPrice: randomProduct.costPrice,
        }],
        createdBy: users[0]._id,
        notes: `Stock adjustment for ${randomProduct.name}`,
        createdAt,
        completedAt: createdAt
      });
    }

    await Transaction.insertMany(allTransactions);
    console.log(`✅ Created ${allTransactions.length} transactions`);
    console.log(`   - ${deliveryCount} delivery transactions (${allTransactions.filter(t => t.type === 'delivery' && t.status === 'completed').length} completed)`);
    console.log(`   - Historical data spans last ${daysBack} days\n`);

    console.log('✅ Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - ${users.length} Users`);
    console.log(`   - ${warehouses.length} Warehouses`);
    console.log(`   - ${products.length} Products`);
    console.log(`   - ${stockEntries.length} Stock Entries`);
    console.log(`   - ${allTransactions.length} Transactions\n`);
    console.log('🔑 Login Credentials:');
    console.log('   Manager: john@stockmaster.com / password123');
    console.log('   Staff: sarah@stockmaster.com / password123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run seeder
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;

