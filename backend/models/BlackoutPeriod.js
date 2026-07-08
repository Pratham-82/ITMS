const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const BlackoutPeriodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a blackout period name'],
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Please specify the start date']
  },
  endDate: {
    type: Date,
    required: [true, 'Please specify the end date']
  },
  description: {
    type: String,
    trim: true
  },
  calendarId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessCalendar',
    default: null // null means global blackout period
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

BlackoutPeriodSchema.index({ startDate: 1, endDate: 1, calendarId: 1 });

module.exports = createTenantModelProxy('BlackoutPeriod', BlackoutPeriodSchema);
