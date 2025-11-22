const Stock = require('../models/Stock');
const Product = require('../models/Product');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all stock levels
// @route   GET /api/stock
exports.getStock = async (req, res, next) => {
  try {
    const { warehouse, product, lowStock } = req.query;
    
    let query = {};
    
    if (warehouse) query.warehouse = warehouse;
    if (product) query.product = product;
    
    let stockQuery = Stock.find(query)
      .populate('product', 'name sku category unitOfMeasure minStockLevel')
      .populate('warehouse', 'name code')
      .sort({ 'product.name': 1 });

    // If lowStock filter is applied
    if (lowStock === 'true') {
      stockQuery = stockQuery.where('quantity').lte('product.minStockLevel');
    }

    const stock = await stockQuery;

    res.status(200).json({
      success: true,
      count: stock.length,
      data: stock
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock for specific product
// @route   GET /api/stock/product/:productId
exports.getProductStock = async (req, res, next) => {
  try {
    const stock = await Stock.find({ product: req.params.productId })
      .populate('warehouse', 'name code address')
      .sort({ 'warehouse.name': 1 });

    const product = await Product.findById(req.params.productId);

    if (!product) {
      return next(new ErrorResponse('Product not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        product,
        stock
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update stock location
// @route   PUT /api/stock/:id/location
exports.updateStockLocation = async (req, res, next) => {
  try {
    const { location } = req.body;

    const stock = await Stock.findByIdAndUpdate(
      req.params.id,
      { location },
      { new: true, runValidators: true }
    ).populate('product warehouse');

    if (!stock) {
      return next(new ErrorResponse('Stock record not found', 404));
    }

    res.status(200).json({
      success: true,
      data: stock
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get low stock alerts
// @route   GET /api/stock/alerts
exports.getLowStockAlerts = async (req, res, next) => {
  try {
    const lowStock = await Stock.aggregate([
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
      }
    ]).exec();

    // Populate warehouse information
    const populatedResults = await Stock.populate(lowStock, {
      path: 'warehouse',
      select: 'name code'
    });

    res.status(200).json({
      success: true,
      count: populatedResults.length,
      data: populatedResults
    });
  } catch (error) {
    next(error);
  }
};