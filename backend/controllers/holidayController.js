const Holiday = require('../models/Holiday');

// @desc    Get all holidays
// @route   GET /api/holidays
// @access  Private (Admin only)
const getHolidays = async (req, res) => {
  try {
    const filter = {};
    if (req.query.calendarId) {
      if (req.query.calendarId === 'null') {
        filter.calendarId = null;
      } else {
        filter.calendarId = req.query.calendarId;
      }
    }
    const holidays = await Holiday.find(filter).sort({ date: 1 });
    res.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create holiday
// @route   POST /api/holidays
// @access  Private (Admin only)
const createHoliday = async (req, res) => {
  try {
    const { name, date, type, recurring, calendarId } = req.body;

    const holiday = await Holiday.create({
      name,
      date,
      type,
      recurring: recurring !== undefined ? recurring : false,
      calendarId: calendarId || null
    });

    res.status(201).json({
      success: true,
      data: holiday
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update holiday
// @route   PUT /api/holidays/:id
// @access  Private (Admin only)
const updateHoliday = async (req, res) => {
  try {
    const { name, date, type, recurring, calendarId } = req.body;

    let holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }

    if (name !== undefined) holiday.name = name;
    if (date !== undefined) holiday.date = date;
    if (type !== undefined) holiday.type = type;
    if (recurring !== undefined) holiday.recurring = recurring;
    if (calendarId !== undefined) holiday.calendarId = calendarId || null;

    const updatedHoliday = await holiday.save();

    res.status(200).json({
      success: true,
      data: updatedHoliday
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete holiday
// @route   DELETE /api/holidays/:id
// @access  Private (Admin only)
const deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }

    await Holiday.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Holiday deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday
};
