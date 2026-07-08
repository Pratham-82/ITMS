const BlackoutPeriod = require('../models/BlackoutPeriod');

// @desc    Get all blackout periods
// @route   GET /api/blackout-periods
// @access  Private (Admin only)
const getBlackoutPeriods = async (req, res) => {
  try {
    const filter = {};
    if (req.query.calendarId) {
      if (req.query.calendarId === 'null') {
        filter.calendarId = null;
      } else {
        filter.calendarId = req.query.calendarId;
      }
    }
    const periods = await BlackoutPeriod.find(filter).sort({ startDate: 1 });
    res.status(200).json({
      success: true,
      count: periods.length,
      data: periods
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create blackout period
// @route   POST /api/blackout-periods
// @access  Private (Admin only)
const createBlackoutPeriod = async (req, res) => {
  try {
    const { name, startDate, endDate, description, calendarId } = req.body;

    const period = await BlackoutPeriod.create({
      name,
      startDate,
      endDate,
      description,
      calendarId: calendarId || null
    });

    res.status(201).json({
      success: true,
      data: period
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update blackout period
// @route   PUT /api/blackout-periods/:id
// @access  Private (Admin only)
const updateBlackoutPeriod = async (req, res) => {
  try {
    const { name, startDate, endDate, description, calendarId } = req.body;

    let period = await BlackoutPeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json({ success: false, message: 'Blackout period not found' });
    }

    if (name !== undefined) period.name = name;
    if (startDate !== undefined) period.startDate = startDate;
    if (endDate !== undefined) period.endDate = endDate;
    if (description !== undefined) period.description = description;
    if (calendarId !== undefined) period.calendarId = calendarId || null;

    const updatedPeriod = await period.save();

    res.status(200).json({
      success: true,
      data: updatedPeriod
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete blackout period
// @route   DELETE /api/blackout-periods/:id
// @access  Private (Admin only)
const deleteBlackoutPeriod = async (req, res) => {
  try {
    const period = await BlackoutPeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json({ success: false, message: 'Blackout period not found' });
    }

    await BlackoutPeriod.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Blackout period deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBlackoutPeriods,
  createBlackoutPeriod,
  updateBlackoutPeriod,
  deleteBlackoutPeriod
};
