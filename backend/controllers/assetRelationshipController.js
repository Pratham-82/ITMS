const AssetRelationship = require('../models/AssetRelationship');

// @desc    Get all asset relationships
// @route   GET /api/asset-relationships
// @access  Private
const getAssetRelationships = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const { assetId } = req.query;
    
    const filter = { tenantId };
    if (assetId) {
      filter.$or = [
        { sourceAssetId: assetId },
        { targetAssetId: assetId }
      ];
    }

    const relationships = await AssetRelationship.find(filter)
      .populate({
        path: 'sourceAssetId',
        select: 'name assetCode status location',
        populate: { path: 'assetTypeId', select: 'name' }
      })
      .populate({
        path: 'targetAssetId',
        select: 'name assetCode status location',
        populate: { path: 'assetTypeId', select: 'name' }
      })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: relationships.length,
      data: relationships
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new asset relationship
// @route   POST /api/asset-relationships
// @access  Private (Admin only)
const createAssetRelationship = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const { sourceAssetId, targetAssetId, relationshipType, description } = req.body;

    if (!sourceAssetId || !targetAssetId || !relationshipType) {
      return res.status(400).json({ success: false, message: 'Please specify source, target and relationship type' });
    }

    if (sourceAssetId === targetAssetId) {
      return res.status(400).json({ success: false, message: 'An asset cannot form a relationship with itself' });
    }

    // Check if relationship already exists
    const exists = await AssetRelationship.findOne({
      tenantId,
      sourceAssetId,
      targetAssetId,
      relationshipType
    });
    if (exists) {
      return res.status(400).json({ success: false, message: 'This relationship already exists' });
    }

    const relationship = await AssetRelationship.create({
      tenantId,
      sourceAssetId,
      targetAssetId,
      relationshipType,
      description: description || ''
    });

    res.status(201).json({
      success: true,
      data: relationship
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete asset relationship
// @route   DELETE /api/asset-relationships/:id
// @access  Private (Admin only)
const deleteAssetRelationship = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const relationship = await AssetRelationship.findOneAndDelete({ _id: req.params.id, tenantId });

    if (!relationship) {
      return res.status(404).json({ success: false, message: 'Relationship not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Relationship deleted successfully',
      data: relationship
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAssetRelationships,
  createAssetRelationship,
  deleteAssetRelationship
};
