const express = require('express');
const router = express.Router();
const {
  getAssetCategories,
  createAssetCategory,
  updateAssetCategory,
  deleteAssetCategory
} = require('../controllers/assetCategoryController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getAssetCategories)
  .post(protect, authorize('admin'), createAssetCategory);

router.route('/:id')
  .put(protect, authorize('admin'), updateAssetCategory)
  .delete(protect, authorize('admin'), deleteAssetCategory);

module.exports = router;
