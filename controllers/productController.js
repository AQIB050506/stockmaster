const Product = require('../models/Product');
const Stock = require('../models/Stock');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get all products
// @route   GET /api/products
exports.getProducts = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    
    let query = { isActive: true };
    
    if (category) {
      query.category = new RegExp(category, 'i');
    }
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { sku: new RegExp(search, 'i') },
        { category: new RegExp(search, 'i') }
      ];
    }

    const products = await Product.find(query)
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      pagination: {
        page: Number(page),
        pages: Math.ceil(total / limit)
      },
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new ErrorResponse('Product not found', 404));
    }

    // Get stock levels across warehouses
    const stockLevels = await Stock.find({ product: req.params.id })
      .populate('warehouse', 'name code location');

    res.status(200).json({
      success: true,
      data: {
        product,
        stockLevels
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product
// @route   POST /api/products
exports.createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return next(new ErrorResponse('Product not found', 404));
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return next(new ErrorResponse('Product not found', 404));
    }

    // Check if product has stock
    const existingStock = await Stock.findOne({ product: req.params.id });
    if (existingStock && existingStock.quantity > 0) {
      return next(new ErrorResponse('Cannot delete product with existing stock', 400));
    }

    // Soft delete by setting isActive to false
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product categories
// @route   GET /api/products/categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};