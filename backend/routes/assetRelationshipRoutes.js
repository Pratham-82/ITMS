const express = require('express');
const router = express.Router();
const {
  getAssetRelationships,
  createAssetRelationship,
  deleteAssetRelationship
} = require('../controllers/assetRelationshipController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getAssetRelationships)
  .post(protect, authorize('admin'), createAssetRelationship);

router.route('/:id')
  .delete(protect, authorize('admin'), deleteAssetRelationship);

module.exports = router;
