const Service = require('../models/Service');

// @desc    Get all services
// @route   GET /api/services
// @access  Private
const getServices = async (req, res) => {
  try {
    const { catalog } = req.query;
    const filter = {};
    if (req.user.role === 'citizen') {
      filter.isActive = true;
    }
    if (catalog) {
      filter.catalog = catalog;
    }

    const services = await Service.find(filter)
      .populate('catalog', 'name icon color')
      .populate('assignment.department', 'name')
      .populate('assignment.group', 'name')
      .populate('assignment.staff', 'name email')
      .populate('workflow', 'workflowName states transitions')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single service by ID
// @route   GET /api/services/:id
// @access  Private
const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('catalog', 'name icon color')
      .populate('assignment.department', 'name')
      .populate('assignment.group', 'name')
      .populate('assignment.staff', 'name email')
      .populate('workflow', 'workflowName states transitions')
      .lean();

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create service
// @route   POST /api/services
// @access  Private (Admin only)
const createService = async (req, res) => {
  try {
    const { catalog, name, description, fields, assignment, workflow } = req.body;

    if (!catalog) {
      return res.status(400).json({ success: false, message: 'Please specify a service catalog' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please specify a service name' });
    }

    const service = await Service.create({
      catalog,
      name: name.trim(),
      description: description ? description.trim() : '',
      fields: fields || [],
      assignment: {
        department: assignment?.department || null,
        group: assignment?.group || null,
        staff: assignment?.staff || null
      },
      workflow: workflow || null
    });

    res.status(201).json({
      success: true,
      data: service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private (Admin only)
const updateService = async (req, res) => {
  try {
    const { catalog, name, description, fields, assignment, workflow, isActive } = req.body;

    let service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (catalog !== undefined) service.catalog = catalog;
    if (name !== undefined) service.name = name.trim();
    if (description !== undefined) service.description = description.trim();
    if (fields !== undefined) service.fields = fields;
    if (workflow !== undefined) service.workflow = workflow || null;
    if (isActive !== undefined) service.isActive = isActive;

    if (assignment) {
      service.assignment = {
        department: assignment.department !== undefined ? assignment.department : service.assignment.department,
        group: assignment.group !== undefined ? assignment.group : service.assignment.group,
        staff: assignment.staff !== undefined ? assignment.staff : service.assignment.staff
      };
    }

    await service.save();

    res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete service (Soft delete)
// @route   DELETE /api/services/:id
// @access  Private (Admin only)
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    service.isActive = false;
    await service.save();

    res.status(200).json({
      success: true,
      message: 'Service deactivated successfully',
      data: service
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService
};
