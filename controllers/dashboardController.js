const Product = require('../models/Product');
const Stock = require('../models/Stock');
const Transaction = require('../models/Transaction');
const Warehouse = require('../models/Warehouse');
const { getAllForecasts } = require('../utils/demandForecast'); // Add this import

// @desc    Get dashboard KPIs
// @route   GET /api/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    // Total Products
    const totalProducts = await Product.countDocuments({ isActive: true });

    // Total Warehouses
    const totalWarehouses = await Warehouse.countDocuments({ isActive: true });

    // Low Stock Items (quantity <= minStockLevel)
    const lowStockItems = await Stock.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $unwind: '$productInfo'
      },
      {
        $match: {
          'productInfo.isActive': true,
          $expr: { $lte: ['$quantity', '$productInfo.minStockLevel'] }
        }
      },
      {
        $count: 'count'
      }
    ]);

    // Detailed low stock list for dashboard analytics
    const lowStockDetailsAgg = await Stock.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $unwind: '$productInfo'
      },
      {
        $match: {
          'productInfo.isActive': true,
          $expr: { $lte: ['$quantity', '$productInfo.minStockLevel'] }
        }
      },
      {
        $project: {
          product: 1,
          warehouse: 1,
          quantity: 1,
          location: 1,
          'productInfo.name': 1,
          'productInfo.sku': 1,
          'productInfo.category': 1,
          'productInfo.minStockLevel': 1,
          'productInfo.unitOfMeasure': 1
        }
      },
      {
        $sort: { quantity: 1 }
      },
      {
        $limit: 8
      }
    ]).exec();

    const lowStockDetails = await Stock.populate(lowStockDetailsAgg, {
      path: 'warehouse',
      select: 'name code'
    });

    // Out of Stock Items
    const outOfStockItems = await Stock.countDocuments({
      quantity: 0
    });

    // Pending Receipts
    const pendingReceipts = await Transaction.countDocuments({
      type: 'receipt',
      status: { $in: ['draft', 'waiting', 'ready'] }
    });

    // Pending Deliveries
    const pendingDeliveries = await Transaction.countDocuments({
      type: 'delivery',
      status: { $in: ['draft', 'waiting', 'ready'] }
    });

    // Internal Transfers Scheduled
    const scheduledTransfers = await Transaction.countDocuments({
      type: 'transfer',
      status: { $in: ['draft', 'waiting', 'ready'] }
    });

    // Recent Transactions
    const recentTransactions = await Transaction.find()
      .populate('fromWarehouse toWarehouse', 'name code')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    // Stock value by category (example calculation)
    const stockValue = await Stock.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $unwind: '$productInfo'
      },
      {
        $group: {
          _id: '$productInfo.category',
          totalValue: {
            $sum: {
              $multiply: ['$quantity', '$productInfo.costPrice']
            }
          }
        }
      }
    ]);

    // Get demand forecasts
    let demandForecasts = [];
    try {
      demandForecasts = await getAllForecasts();
      console.log(`[Dashboard] Generated ${demandForecasts.length} demand forecasts`);
    } catch (error) {
      console.error('[Dashboard] Error getting forecasts:', error);
    }

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalProducts,
          totalWarehouses,
          lowStockItems: lowStockItems[0]?.count || 0,
          outOfStockItems,
          pendingReceipts,
          pendingDeliveries,
          scheduledTransfers
        },
        recentTransactions,
        stockValue,
        lowStockDetails,
        demandForecasts
      }
    });
  } catch (error) {
    next(error);
  }
};