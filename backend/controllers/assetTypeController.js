const AssetType = require('../models/AssetType');

// @desc    Get all asset types
// @route   GET /api/asset-types
// @access  Private
const getAssetTypes = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const { categoryId } = req.query;
    const filter = { tenantId };
    if (categoryId) {
      filter.categoryId = categoryId;
    }
    const types = await AssetType.find(filter).populate('categoryId', 'name').sort({ name: 1 }).lean();
    res.status(200).json({
      success: true,
      count: types.length,
      data: types
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create asset type
// @route   POST /api/asset-types
// @access  Private (Admin only)
const createAssetType = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const { categoryId, name, description, assetPrefix, lifecycleStatuses, dynamicFields } = req.body;

    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Please specify a category' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please specify an asset type name' });
    }
    if (!assetPrefix || !assetPrefix.trim()) {
      return res.status(400).json({ success: false, message: 'Please specify an asset prefix' });
    }

    const exists = await AssetType.findOne({ tenantId, name: name.trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Asset type name already exists' });
    }

    const type = await AssetType.create({
      tenantId,
      categoryId,
      name: name.trim(),
      description: description ? description.trim() : '',
      assetPrefix: assetPrefix.trim().toUpperCase(),
      lifecycleStatuses: lifecycleStatuses || ['Active', 'In Maintenance', 'Retired'],
      dynamicFields: dynamicFields || []
    });

    res.status(201).json({
      success: true,
      data: type
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update asset type
// @route   PUT /api/asset-types/:id
// @access  Private (Admin only)
const updateAssetType = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const { categoryId, name, description, assetPrefix, lifecycleStatuses, dynamicFields, isActive } = req.body;

    let type = await AssetType.findOne({ _id: req.params.id, tenantId });
    if (!type) {
      return res.status(404).json({ success: false, message: 'Asset type not found' });
    }

    if (categoryId !== undefined) type.categoryId = categoryId;
    if (name !== undefined && name.trim()) {
      const exists = await AssetType.findOne({ tenantId, name: name.trim(), _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Asset type name already exists' });
      }
      type.name = name.trim();
    }
    if (description !== undefined) type.description = description.trim();
    if (assetPrefix !== undefined && assetPrefix.trim()) type.assetPrefix = assetPrefix.trim().toUpperCase();
    if (lifecycleStatuses !== undefined) type.lifecycleStatuses = lifecycleStatuses;
    if (dynamicFields !== undefined) type.dynamicFields = dynamicFields;
    if (isActive !== undefined) type.isActive = isActive;

    await type.save();

    res.status(200).json({
      success: true,
      data: type
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete/Deactivate asset type
// @route   DELETE /api/asset-types/:id
// @access  Private (Admin only)
const deleteAssetType = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const type = await AssetType.findOne({ _id: req.params.id, tenantId });

    if (!type) {
      return res.status(404).json({ success: false, message: 'Asset type not found' });
    }

    type.isActive = false;
    await type.save();

    res.status(200).json({
      success: true,
      message: 'Asset type deactivated successfully',
      data: type
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAssetTypes,
  createAssetType,
  updateAssetType,
  deleteAssetType
};
