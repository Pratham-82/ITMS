const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a holiday name'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Please specify the holiday date']
  },
  type: {
    type: String,
    enum: ['National', 'Regional', 'Organization'],
    default: 'National'
  },
  recurring: {
    type: Boolean,
    default: false
  },
  calendarId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessCalendar',
    default: null // null means global holiday
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

HolidaySchema.index({ date: 1, calendarId: 1 });

module.exports = createTenantModelProxy('Holiday', HolidaySchema);
