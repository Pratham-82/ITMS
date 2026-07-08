const BusinessCalendar = require('../models/BusinessCalendar');

// @desc    Get all business calendars
// @route   GET /api/calendars
// @access  Private (Admin only)
const getCalendars = async (req, res) => {
  try {
    const calendars = await BusinessCalendar.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: calendars.length,
      data: calendars
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get default calendar
// @route   GET /api/calendars/default
// @access  Private (Admin only)
const getDefaultCalendar = async (req, res) => {
  try {
    let calendar = await BusinessCalendar.findOne({ isDefault: true });
    if (!calendar) {
      // Create a default one if none exists yet
      calendar = await BusinessCalendar.create({
        name: 'Standard Business Calendar',
        workingDays: [1, 2, 3, 4, 5],
        workingHours: { start: '09:00', end: '17:00' },
        isDefault: true
      });
    }
    res.status(200).json({
      success: true,
      data: calendar
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get calendar by ID
// @route   GET /api/calendars/:id
// @access  Private (Admin only)
const getCalendarById = async (req, res) => {
  try {
    const calendar = await BusinessCalendar.findById(req.params.id);
    if (!calendar) {
      return res.status(404).json({ success: false, message: 'Calendar not found' });
    }
    res.status(200).json({
      success: true,
      data: calendar
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create business calendar
// @route   POST /api/calendars
// @access  Private (Admin only)
const createCalendar = async (req, res) => {
  try {
    const { name, description, timeZone, workingDays, workingHours, holidays, maintenanceWindows, exceptions, isActive, isDefault } = req.body;

    const existingCalendar = await BusinessCalendar.findOne({ name });
    if (existingCalendar) {
      return res.status(400).json({ success: false, message: 'Calendar name already exists' });
    }

    const calendar = await BusinessCalendar.create({
      name,
      description,
      timeZone,
      workingDays,
      workingHours,
      holidays,
      maintenanceWindows,
      exceptions,
      isActive: isActive !== undefined ? isActive : true,
      isDefault: isDefault !== undefined ? isDefault : false,
      createdBy: req.user ? req.user.id : null,
      updatedBy: req.user ? req.user.id : null
    });

    res.status(201).json({
      success: true,
      data: calendar
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update business calendar
// @route   PUT /api/calendars/:id
// @access  Private (Admin only)
const updateCalendar = async (req, res) => {
  try {
    const { name, description, timeZone, workingDays, workingHours, holidays, maintenanceWindows, exceptions, isActive, isDefault } = req.body;

    let calendar = await BusinessCalendar.findById(req.params.id);
    if (!calendar) {
      return res.status(404).json({ success: false, message: 'Calendar not found' });
    }

    if (name !== undefined) calendar.name = name;
    if (description !== undefined) calendar.description = description;
    if (timeZone !== undefined) calendar.timeZone = timeZone;
    if (workingDays !== undefined) calendar.workingDays = workingDays;
    if (workingHours !== undefined) calendar.workingHours = workingHours;
    if (holidays !== undefined) calendar.holidays = holidays;
    if (maintenanceWindows !== undefined) calendar.maintenanceWindows = maintenanceWindows;
    if (exceptions !== undefined) calendar.exceptions = exceptions;
    if (isActive !== undefined) calendar.isActive = isActive;
    if (isDefault !== undefined) calendar.isDefault = isDefault;
    if (req.user) calendar.updatedBy = req.user.id;

    const updatedCalendar = await calendar.save();

    res.status(200).json({
      success: true,
      data: updatedCalendar
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete business calendar
// @route   DELETE /api/calendars/:id
// @access  Private (Admin only)
const deleteCalendar = async (req, res) => {
  try {
    const calendar = await BusinessCalendar.findById(req.params.id);
    if (!calendar) {
      return res.status(404).json({ success: false, message: 'Calendar not found' });
    }

    if (calendar.isDefault) {
      return res.status(400).json({ success: false, message: 'Cannot delete the default calendar' });
    }

    await BusinessCalendar.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Calendar deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCalendars,
  getDefaultCalendar,
  getCalendarById,
  createCalendar,
  updateCalendar,
  deleteCalendar
};
