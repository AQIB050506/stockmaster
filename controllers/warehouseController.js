const Warehouse = require('../models/Warehouse');
const Stock = require('../models/Stock');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all warehouses
// @route   GET /api/warehouses
exports.getWarehouses = async (req, res, next) => {
  try {
    const warehouses = await Warehouse.find({ isActive: true })
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: warehouses.length,
      data: warehouses
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single warehouse
// @route   GET /api/warehouses/:id
exports.getWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);

    if (!warehouse) {
      return next(new ErrorResponse('Warehouse not found', 404));
    }

    // Get warehouse stock summary
    const stockSummary = await Stock.aggregate([
      {
        $match: { warehouse: warehouse._id }
      },
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
          _id: null,
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: {
            $sum: {
              $multiply: ['$quantity', '$productInfo.costPrice']
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        warehouse,
        stockSummary: stockSummary[0] || { totalProducts: 0, totalQuantity: 0, totalValue: 0 }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new warehouse
// @route   POST /api/warehouses
exports.createWarehouse = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.create(req.body);

    res.status(201).json({
      success: true,
      data: warehouse
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update warehouse
// @route   PUT /api/warehouses/:id
exports.updateWarehouse = async (req, res, next) => {
  try {
    let warehouse = await Warehouse.findById(req.params.id);

    if (!warehouse) {
      return next(new ErrorResponse('Warehouse not found', 404));
    }

    warehouse = await Warehouse.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: warehouse
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get warehouse stock
// @route   GET /api/warehouses/:id/stock
exports.getWarehouseStock = async (req, res, next) => {
  try {
    const stock = await Stock.find({ warehouse: req.params.id })
      .populate('product', 'name sku category unitOfMeasure minStockLevel')
      .sort({ 'product.name': 1 });

    res.status(200).json({
      success: true,
      count: stock.length,
      data: stock
    });
  } catch (error) {
    next(error);
  }
};