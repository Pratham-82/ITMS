const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['citizen', 'admin'],
    default: 'citizen'
  },
  department: {
    type: String,
    default: ''
  },
  dashboardConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      showPriorityStats: true,
      widgets: [
        {
          id: 'widget-status-breakdown',
          title: 'Status Breakdown',
          type: 'chart',
          chartType: 'bar',
          dataSource: 'tickets',
          groupBy: 'status',
          width: '6',
          respectGlobalFilters: true
        },
        {
          id: 'widget-category-volume',
          title: 'Category Volume',
          type: 'chart',
          chartType: 'doughnut',
          dataSource: 'tickets',
          groupBy: 'categoryName',
          width: '6',
          respectGlobalFilters: true
        }
      ]
    }
  },
  settingsPermissions: {
    allowAll: { type: Boolean, default: true },
    systemSettings: { type: Boolean, default: false },
    slaSettings: { type: Boolean, default: false },
    escalationRules: { type: Boolean, default: false },
    escalationAnalytics: { type: Boolean, default: true },
    manageFields: { type: Boolean, default: true },
    manageStaff: { type: Boolean, default: false },
    manageDepartments: { type: Boolean, default: true }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpire: {
    type: Date
  },
  isVerified: { type: Boolean, default: true },
  verificationToken: { type: String },
  maxCapacity: {
    type: Number,
    default: 20
  },
  capacityPercentage: {
    type: Number,
    default: 0
  },
  availabilityStatus: {
    type: String,
    enum: ['Available', 'Busy', 'On Leave', 'Unavailable'],
    default: 'Available'
  },
  skills: {
    type: [String],
    default: []
  },
  escalationRole: {
    type: String,
    enum: ['agent', 'lead', 'manager', 'director'],
    default: 'agent'
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscalationGroup'
  }]
});

const createTenantModelProxy = require('./tenantModelHelper');
require('./GlobalUser');

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sync user email registration to central GlobalUser registry
UserSchema.pre('save', async function (next) {
  if (this.isModified('email') || this.isNew) {
    try {
      const GlobalUser = require('./GlobalUser');
      const tenantLocalStorage = require('../middleware/tenantContext');
      const tenantId = tenantLocalStorage.getStore() || this.tenantId || 'default-tenant';
      const emailLower = this.email.toLowerCase();

      // Check if email already exists globally for a different user
      const existing = await GlobalUser.findOne({ email: emailLower });
      if (existing && existing.userId.toString() !== this._id.toString()) {
        return next(new Error('Email already registered globally in another organization workspace.'));
      }

      // Upsert global user registration
      await GlobalUser.findOneAndUpdate(
        { userId: this._id },
        { email: emailLower, tenantId, userId: this._id },
        { upsert: true, new: true }
      );
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Clean up central GlobalUser registry upon user removal
UserSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const GlobalUser = require('./GlobalUser');
    await GlobalUser.deleteOne({ userId: this._id });
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.pre('deleteOne', { document: false, query: true }, async function(next) {
  try {
    const GlobalUser = require('./GlobalUser');
    const docs = await this.model.find(this.getFilter());
    const userIds = docs.map(d => d._id);
    await GlobalUser.deleteMany({ userId: { $in: userIds } });
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.pre('deleteMany', async function(next) {
  try {
    const GlobalUser = require('./GlobalUser');
    const docs = await this.model.find(this.getFilter());
    const userIds = docs.map(d => d._id);
    await GlobalUser.deleteMany({ userId: { $in: userIds } });
    next();
  } catch (err) {
    next(err);
  }
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = createTenantModelProxy('User', UserSchema);
