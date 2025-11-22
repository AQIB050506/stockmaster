let processDocument, upload;

try {
  const multer = require('multer');
  const { processDocument: processDoc } = require('../utils/ocrProcessor');
  const Product = require('../models/Product');
  const ErrorResponse = require('../utils/errorResponse');

  // Configure multer for file uploads
  const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    }
  });

  // @desc    Process document with OCR
  // @route   POST /api/ocr/process
  processDocument = async (req, res, next) => {
    try {
      if (!req.file) {
        return next(new ErrorResponse('No image file provided', 400));
      }

      const imageBuffer = req.file.buffer;
      const result = await processDoc(imageBuffer);

      // Try to match products with database
      const matchedItems = await Promise.all(
        result.items.map(async (item) => {
          // Search for product by name or SKU
          const product = await Product.findOne({
            $or: [
              { name: { $regex: item.productName.substring(0, 20), $options: 'i' } },
              { sku: { $regex: item.productName.substring(0, 10), $options: 'i' } }
            ],
            isActive: true
          }).limit(1);

          return {
            ...item,
            matchedProduct: product ? {
              _id: product._id,
              name: product.name,
              sku: product.sku,
              unitOfMeasure: product.unitOfMeasure
            } : null,
            confidence: product ? 'high' : 'low'
          };
        })
      );

      res.status(200).json({
        success: true,
        data: {
          ...result,
          items: matchedItems
        }
      });
    } catch (error) {
      next(error);
    }
  };

  upload = uploadMiddleware.single('image');
} catch (error) {
  console.error('OCR Controller initialization error:', error.message);
  // Export placeholder functions that return errors
  processDocument = (req, res, next) => {
    return next(new Error('OCR functionality not available. Please install tesseract.js: npm install'));
  };
  upload = (req, res, next) => next();
}

exports.processDocument = processDocument;
exports.upload = upload;