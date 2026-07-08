const express = require('express');
const router = express.Router();
const {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  purchaseAsset
} = require('../controllers/assetController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getAssets)
  .post(protect, authorize('admin'), createAsset);

router.route('/purchase')
  .post(protect, authorize('admin'), purchaseAsset);

router.route('/purchase/:typeName')
  .post(protect, authorize('admin'), purchaseAsset);

router.route('/:id')
  .get(protect, getAssetById)
  .put(protect, authorize('admin'), updateAsset)
  .delete(protect, authorize('admin'), deleteAsset);

module.exports = router;
