const MaintenanceWindow = require('../models/MaintenanceWindow');

// @desc    Get all maintenance windows
// @route   GET /api/maintenance-windows
// @access  Private (Admin only)
const getMaintenanceWindows = async (req, res) => {
  try {
    const windows = await MaintenanceWindow.find().sort({ startDate: 1 });
    res.status(200).json({
      success: true,
      count: windows.length,
      data: windows
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create maintenance window
// @route   POST /api/maintenance-windows
// @access  Private (Admin only)
const createMaintenanceWindow = async (req, res) => {
  try {
    const { title, startDate, endDate, affectedDepartments } = req.body;

    const window = await MaintenanceWindow.create({
      title,
      startDate,
      endDate,
      affectedDepartments: affectedDepartments || []
    });

    res.status(201).json({
      success: true,
      data: window
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update maintenance window
// @route   PUT /api/maintenance-windows/:id
// @access  Private (Admin only)
const updateMaintenanceWindow = async (req, res) => {
  try {
    const { title, startDate, endDate, affectedDepartments } = req.body;

    let window = await MaintenanceWindow.findById(req.params.id);
    if (!window) {
      return res.status(404).json({ success: false, message: 'Maintenance window not found' });
    }

    if (title !== undefined) window.title = title;
    if (startDate !== undefined) window.startDate = startDate;
    if (endDate !== undefined) window.endDate = endDate;
    if (affectedDepartments !== undefined) window.affectedDepartments = affectedDepartments;

    const updatedWindow = await window.save();

    res.status(200).json({
      success: true,
      data: updatedWindow
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete maintenance window
// @route   DELETE /api/maintenance-windows/:id
// @access  Private (Admin only)
const deleteMaintenanceWindow = async (req, res) => {
  try {
    const window = await MaintenanceWindow.findById(req.params.id);
    if (!window) {
      return res.status(404).json({ success: false, message: 'Maintenance window not found' });
    }

    await MaintenanceWindow.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Maintenance window deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getMaintenanceWindows,
  createMaintenanceWindow,
  updateMaintenanceWindow,
  deleteMaintenanceWindow
};
