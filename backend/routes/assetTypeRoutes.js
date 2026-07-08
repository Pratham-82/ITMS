const express = require('express');
const router = Router = express.Router();
const {
  getAssetTypes,
  createAssetType,
  updateAssetType,
  deleteAssetType
} = require('../controllers/assetTypeController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getAssetTypes)
  .post(protect, authorize('admin'), createAssetType);

router.route('/:id')
  .put(protect, authorize('admin'), updateAssetType)
  .delete(protect, authorize('admin'), deleteAssetType);

module.exports = router;
