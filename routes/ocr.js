const express = require('express');
const { protect } = require('../middleware/auth');
const { processDocument, upload } = require('../controllers/ocrController');

const router = express.Router();

router.route('/process')
  .post(protect, upload, processDocument);

module.exports = router;
