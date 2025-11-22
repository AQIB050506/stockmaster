const express = require('express');
const router = express.Router();
const seedData = require('../utils/seedData');

// @route   POST /api/seed
// @desc    Seed database with sample data
// @access  Public (for development only)
router.post('/', async (req, res) => {
  try {
    // Only allow seeding in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Seeding is not allowed in production'
      });
    }

    // Run seeder in background
    seedData().catch(err => {
      console.error('Seeder error:', err);
    });

    res.status(200).json({
      success: true,
      message: 'Database seeding started. Check server logs for progress.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;

