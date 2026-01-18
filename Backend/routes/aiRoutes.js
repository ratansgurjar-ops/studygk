const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { generateQuestions } = require('../controllers/aiController');

// Helper wrapper for async handlers
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Route: /api/admin/ai/generate
router.post('/generate', authMiddleware, asyncHandler(generateQuestions));

module.exports = router;