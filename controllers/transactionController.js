const Transaction = require('../models/Transaction');
const Stock = require('../models/Stock');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all transactions
// @route   GET /api/transactions
exports.getTransactions = async (req, res, next) => {
  try {
    const { type, status, warehouse, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    if (type) query.type = type;
    if (status) query.status = status;
    if (warehouse) {
      query.$or = [
        { fromWarehouse: warehouse },
        { toWarehouse: warehouse }
      ];
    }

    const transactions = await Transaction.find(query)
      .populate('fromWarehouse toWarehouse', 'name code')
      .populate('createdBy', 'name')
      .populate('items.product', 'name sku unitOfMeasure')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      pagination: {
        page: Number(page),
        pages: Math.ceil(total / limit)
      },
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
exports.getTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('fromWarehouse toWarehouse', 'name code address')
      .populate('createdBy', 'name email')
      .populate('items.product', 'name sku category unitOfMeasure');

    if (!transaction) {
      return next(new ErrorResponse('Transaction not found', 404));
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create receipt (incoming goods)
// @route   POST /api/transactions/receipt
exports.createReceipt = async (req, res, next) => {
  try {
    const { toWarehouse, supplier, items, notes } = req.body;

    const transaction = await Transaction.create({
      type: 'receipt',
      toWarehouse,
      supplier,
      items,
      notes,
      createdBy: req.user.id,
      status: 'draft'
    });

    await transaction.populate([
      { path: 'toWarehouse', select: 'name code' },
      { path: 'items.product', select: 'name sku unitOfMeasure' }
    ]);

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create delivery (outgoing goods)
// @route   POST /api/transactions/delivery
exports.createDelivery = async (req, res, next) => {
  try {
    const { fromWarehouse, customer, items, notes } = req.body;

    // Check stock availability for all items
    for (let item of items) {
      const stock = await Stock.findOne({
        product: item.product,
        warehouse: fromWarehouse
      });

      const availableQuantity = stock ? stock.quantity - stock.reservedQuantity : 0;
      
      if (availableQuantity < item.quantity) {
        return next(new ErrorResponse(
          `Insufficient stock for product. Available: ${availableQuantity}, Requested: ${item.quantity}`,
          400
        ));
      }
    }

    const transaction = await Transaction.create({
      type: 'delivery',
      fromWarehouse,
      customer,
      items,
      notes,
      createdBy: req.user.id,
      status: 'draft'
    });

    await transaction.populate([
      { path: 'fromWarehouse', select: 'name code' },
      { path: 'items.product', select: 'name sku unitOfMeasure' }
    ]);

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create internal transfer
// @route   POST /api/transactions/transfer
exports.createTransfer = async (req, res, next) => {
  try {
    const { fromWarehouse, toWarehouse, items, notes } = req.body;

    // Check stock availability in source warehouse
    for (let item of items) {
      const stock = await Stock.findOne({
        product: item.product,
        warehouse: fromWarehouse
      });

      if (!stock || stock.quantity < item.quantity) {
        return next(new ErrorResponse(
          `Insufficient stock in source warehouse for transfer. Available: ${stock ? stock.quantity : 0}, Requested: ${item.quantity}`,
          400
        ));
      }
    }

    const transaction = await Transaction.create({
      type: 'transfer',
      fromWarehouse,
      toWarehouse,
      items,
      notes,
      createdBy: req.user.id,
      status: 'draft'
    });

    await transaction.populate([
      { path: 'fromWarehouse toWarehouse', select: 'name code' },
      { path: 'items.product', select: 'name sku unitOfMeasure' }
    ]);

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create stock adjustment
// @route   POST /api/transactions/adjustment
exports.createAdjustment = async (req, res, next) => {
  try {
    const { warehouse, items, notes, reason } = req.body;

    const transaction = await Transaction.create({
      type: 'adjustment',
      fromWarehouse: warehouse,
      items,
      notes: notes || `Stock adjustment: ${reason}`,
      createdBy: req.user.id,
      status: 'draft'
    });

    await transaction.populate([
      { path: 'fromWarehouse', select: 'name code' },
      { path: 'items.product', select: 'name sku unitOfMeasure' }
    ]);

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete transaction
// @route   PUT /api/transactions/:id/complete
exports.completeTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('items.product');

    if (!transaction) {
      return next(new ErrorResponse('Transaction not found', 404));
    }

    if (transaction.status === 'completed') {
      return next(new ErrorResponse('Transaction already completed', 400));
    }

    if (transaction.status === 'cancelled') {
      return next(new ErrorResponse('Cannot complete cancelled transaction', 400));
    }

    // Update stock based on transaction type
    switch (transaction.type) {
      case 'receipt':
        // Increase stock in toWarehouse
        for (let item of transaction.items) {
          await Stock.findOneAndUpdate(
            { product: item.product, warehouse: transaction.toWarehouse },
            { $inc: { quantity: item.quantity } },
            { upsert: true, new: true }
          );
        }
        break;

      case 'delivery':
        // Decrease stock from fromWarehouse
        for (let item of transaction.items) {
          await Stock.findOneAndUpdate(
            { product: item.product, warehouse: transaction.fromWarehouse },
            { $inc: { quantity: -item.quantity } },
            { upsert: true, new: true }
          );
        }
        break;

      case 'transfer':
        // Decrease from source, increase in destination
        for (let item of transaction.items) {
          await Stock.findOneAndUpdate(
            { product: item.product, warehouse: transaction.fromWarehouse },
            { $inc: { quantity: -item.quantity } },
            { upsert: true, new: true }
          );
          
          await Stock.findOneAndUpdate(
            { product: item.product, warehouse: transaction.toWarehouse },
            { $inc: { quantity: item.quantity } },
            { upsert: true, new: true }
          );
        }
        break;

      case 'adjustment':
        // Set stock to adjusted quantity (items should have negative/positive quantities)
        for (let item of transaction.items) {
          await Stock.findOneAndUpdate(
            { product: item.product, warehouse: transaction.fromWarehouse },
            { $inc: { quantity: item.quantity } },
            { upsert: true, new: true }
          );
        }
        break;
    }

    // Update transaction status
    transaction.status = 'completed';
    transaction.completedAt = new Date();
    await transaction.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('stock-update', { 
      transaction: transaction._id,
      type: transaction.type,
      warehouses: [transaction.fromWarehouse, transaction.toWarehouse].filter(Boolean)
    });

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel transaction
// @route   PUT /api/transactions/:id/cancel
exports.cancelTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return next(new ErrorResponse('Transaction not found', 404));
    }

    if (transaction.status === 'completed') {
      return next(new ErrorResponse('Cannot cancel completed transaction', 400));
    }

    transaction.status = 'cancelled';
    await transaction.save();

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};