const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  isRecurring: {
    type: Boolean,
    default: false // if true, ignores the year portion of date
  }
});

const MaintenanceWindowSchema = new mongoose.Schema({
  start: {
    type: Date,
    required: true
  },
  end: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    trim: true
  }
});

const CalendarExceptionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true,
    default: '09:00' // HH:MM
  },
  endTime: {
    type: String,
    required: true,
    default: '17:00' // HH:MM
  },
  reason: {
    type: String,
    trim: true
  }
});

const BusinessCalendarSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a calendar name'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  timeZone: {
    type: String,
    default: 'UTC'
  },
  workingDays: {
    type: [Number],
    default: [1, 2, 3, 4, 5] // 1 = Monday, 5 = Friday. 0 = Sunday, 6 = Saturday
  },
  workingHours: {
    start: {
      type: String,
      default: '09:00' // HH:MM
    },
    end: {
      type: String,
      default: '17:00' // HH:MM
    }
  },
  holidays: [HolidaySchema],
  maintenanceWindows: [MaintenanceWindowSchema],
  exceptions: [CalendarExceptionSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to ensure only one default calendar exists
BusinessCalendarSchema.pre('save', async function (next) {
  if (this.isDefault) {
    try {
      await this.constructor.updateMany({ _id: { $ne: this._id } }, { isDefault: false });
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = createTenantModelProxy('BusinessCalendar', BusinessCalendarSchema);
