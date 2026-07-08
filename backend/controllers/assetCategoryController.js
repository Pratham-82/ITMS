const AssetCategory = require('../models/AssetCategory');

// @desc    Get all asset categories
// @route   GET /api/asset-categories
// @access  Private
const getAssetCategories = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const categories = await AssetCategory.find({ tenantId }).sort({ name: 1 }).lean();
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create asset category
// @route   POST /api/asset-categories
// @access  Private (Admin only)
const createAssetCategory = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const { name, description, icon, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please specify a category name' });
    }

    const exists = await AssetCategory.findOne({ tenantId, name: name.trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    const category = await AssetCategory.create({
      tenantId,
      name: name.trim(),
      description: description ? description.trim() : '',
      icon: icon || 'box',
      color: color || '#6366f1',
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update asset category
// @route   PUT /api/asset-categories/:id
// @access  Private (Admin only)
const updateAssetCategory = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const { name, description, icon, color, isActive } = req.body;

    let category = await AssetCategory.findOne({ _id: req.params.id, tenantId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (name !== undefined && name.trim()) {
      const exists = await AssetCategory.findOne({ tenantId, name: name.trim(), _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Category name already exists' });
      }
      category.name = name.trim();
    }
    if (description !== undefined) category.description = description.trim();
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (isActive !== undefined) category.isActive = isActive;
    category.updatedBy = req.user.id;

    await category.save();

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete/Deactivate asset category
// @route   DELETE /api/asset-categories/:id
// @access  Private (Admin only)
const deleteAssetCategory = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || 'default-tenant';
    const category = await AssetCategory.findOne({ _id: req.params.id, tenantId });

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    category.isActive = false;
    category.updatedBy = req.user.id;
    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category deactivated successfully',
      data: category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAssetCategories,
  createAssetCategory,
  updateAssetCategory,
  deleteAssetCategory
};
