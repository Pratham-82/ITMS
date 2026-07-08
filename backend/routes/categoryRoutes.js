const express = require('express');
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { protect, authorize, checkSettingsPermission } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getCategories)
  .post(protect, authorize('admin'), checkSettingsPermission('manageFields'), createCategory);

router.route('/:id')
  .get(protect, getCategoryById)
  .put(protect, authorize('admin'), checkSettingsPermission('manageFields'), updateCategory)
  .delete(protect, authorize('admin'), checkSettingsPermission('manageFields'), deleteCategory);

module.exports = router;
