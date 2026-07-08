const ServiceCatalog = require('../models/ServiceCatalog');

// @desc    Get all service catalogs
// @route   GET /api/service-catalogs
// @access  Private
const getServiceCatalogs = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'citizen') {
      filter.isActive = true;
    }
    const catalogs = await ServiceCatalog.find(filter).sort({ name: 1 }).lean();
    res.status(200).json({
      success: true,
      count: catalogs.length,
      data: catalogs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single service catalog by ID
// @route   GET /api/service-catalogs/:id
// @access  Private
const getServiceCatalogById = async (req, res) => {
  try {
    const catalog = await ServiceCatalog.findById(req.params.id).lean();
    if (!catalog) {
      return res.status(404).json({ success: false, message: 'Service catalog not found' });
    }
    res.status(200).json({
      success: true,
      data: catalog
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create service catalog
// @route   POST /api/service-catalogs
// @access  Private (Admin only)
const createServiceCatalog = async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please specify a catalog name' });
    }

    const exists = await ServiceCatalog.findOne({ name: name.trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Service catalog with this name already exists' });
    }

    const catalog = await ServiceCatalog.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      icon: icon || 'Folder',
      color: color || '#6366f1'
    });

    res.status(201).json({
      success: true,
      data: catalog
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update service catalog
// @route   PUT /api/service-catalogs/:id
// @access  Private (Admin only)
const updateServiceCatalog = async (req, res) => {
  try {
    const { name, description, icon, color, isActive } = req.body;
    let catalog = await ServiceCatalog.findById(req.params.id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: 'Service catalog not found' });
    }

    if (name && name.trim() !== catalog.name) {
      const exists = await ServiceCatalog.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Service catalog with this name already exists' });
      }
      catalog.name = name.trim();
    }

    if (description !== undefined) catalog.description = description.trim();
    if (icon !== undefined) catalog.icon = icon;
    if (color !== undefined) catalog.color = color;
    if (isActive !== undefined) catalog.isActive = isActive;

    await catalog.save();

    res.status(200).json({
      success: true,
      data: catalog
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete service catalog (Soft delete)
// @route   DELETE /api/service-catalogs/:id
// @access  Private (Admin only)
const deleteServiceCatalog = async (req, res) => {
  try {
    const catalog = await ServiceCatalog.findById(req.params.id);
    if (!catalog) {
      return res.status(404).json({ success: false, message: 'Service catalog not found' });
    }

    catalog.isActive = false;
    await catalog.save();

    res.status(200).json({
      success: true,
      message: 'Service catalog deactivated successfully',
      data: catalog
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getServiceCatalogs,
  getServiceCatalogById,
  createServiceCatalog,
  updateServiceCatalog,
  deleteServiceCatalog
};
