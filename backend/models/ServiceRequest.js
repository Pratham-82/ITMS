const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');
const Counter = require('./Counter');

const CommentSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const HistorySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  actor: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ServiceRequestSchema = new mongoose.Schema({
  trackingId: {
    type: String,
    unique: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  citizen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    required: true,
    default: 'Pending'
  },
  assignedDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  assignedGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscalationGroup',
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    default: null
  },
  comments: [CommentSchema],
  history: [HistorySchema]
}, { timestamps: true });

// Pre-save to generate sequential trackingId
ServiceRequestSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'serviceRequestTrackingId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.trackingId = `SR-${counter.seq}`;
      
      if (this.history.length === 0) {
        this.history.push({
          action: 'Service request submitted successfully',
          actor: 'System'
        });
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = createTenantModelProxy('ServiceRequest', ServiceRequestSchema);
