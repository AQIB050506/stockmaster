const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.route('/').get(protect, getDashboard);

module.exports = router;