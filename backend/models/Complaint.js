/**
 * @deprecated Legacy Complaint model.
 * @description This model is frozen. All active complaint behavior is migrated
 * to the unified Ticket/TicketService system. Do not add new features here.
 */

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

const ComplaintSchema = new mongoose.Schema({
  trackingId: {
    type: String,
    unique: true
  },
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Please specify a department']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Please specify a category']
  },
  categoryName: {
    type: String,
    required: true
  },
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  priority: {
    type: String,
    required: [true, 'Please specify a priority level'],
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Low'
  },
  status: {
    type: String,
    required: [true, 'Please specify status'],
    default: 'Pending'
  },
  citizen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedDepartment: {
    type: String,
    default: 'General Administration'
  },
  assignedAt: {
    type: Date
  },
  assignmentReason: {
    type: String
  },
  lastTransferredAt: {
    type: Date
  },
  attachments: [
    {
      type: String
    }
  ],
  comments: [CommentSchema],
  history: [HistorySchema],
  isEscalated: {
    type: Boolean,
    default: false
  },
  escalationReason: {
    type: String
  },
  escalatedAt: {
    type: Date
  },
  currentEscalationLevel: {
    type: Number,
    default: 0
  },
  escalationStartedAt: {
    type: Date
  },
  lastEscalatedAt: {
    type: Date
  },
  nextEscalationDueAt: {
    type: Date
  },
  responseDueAt: {
    type: Date
  },
  firstResponseAt: {
    type: Date
  },
  responseSlaStatus: {
    type: String,
    enum: ['Within SLA', 'Warning', 'Breached', 'Met', 'none'],
    default: 'none'
  },
  resolutionDueAt: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  resolutionSlaStatus: {
    type: String,
    enum: ['Within SLA', 'Warning', 'Breached', 'Met', 'none'],
    default: 'none'
  },
  assignedGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscalationGroup',
    default: null
  },
  escalationRole: {
    type: String,
    default: null
  },
  parallelEscalations: [{
    level: Number,
    targetType: {
      type: String,
      enum: ['department', 'group', 'role', 'user']
    },
    targetId: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'warning', 'breached'],
      default: 'pending'
    },
    dueAt: Date,
    escalatedAt: Date
  }],
  firedSlaWarnings: {
    type: [Number],
    default: []
  },
  escalationStatus: {
    type: String,
    enum: ['none', 'pending', 'completed'],
    default: 'none'
  },
  escalationWorkflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscalationRule',
    default: null
  },
  isAutoEscalated: {
    type: Boolean,
    default: false
  },
  escalationPath: [
    {
      level: Number,
      department: String,
      escalatedAt: {
        type: Date,
        default: Date.now
      },
      escalatedBy: String,
      reason: String
    }
  ],
  feedback: {
    overallRating: { type: Number },
    responseTimeRating: { type: Number },
    communicationRating: { type: Number },
    resolutionQualityRating: { type: Number },
    resolvedCompletely: { type: String }, // 'Yes', 'Partially', 'No'
    recommendation: { type: Boolean }, // true = Yes, false = No
    comment: { type: String },
    submittedAt: { type: Date },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    responses: [
      {
        questionId: { type: String },
        label: { type: String },
        type: { type: String },
        value: { type: mongoose.Schema.Types.Mixed }
      }
    ]
  },
  feedbackRequested: { type: Boolean, default: false },
  feedbackRequestedAt: { type: Date },
  feedbackSubmitted: { type: Boolean, default: false },
  feedbackSubmittedAt: { type: Date },
  reopenedCount: { type: Number, default: 0 },
  reopenedReason: { type: String },
  reopenedAt: { type: Date },
  closureType: { type: String, enum: ['Citizen Closed', 'Auto Closed', 'Citizen Resolved', 'Auto Resolved', null], default: null },
  reopenRequest: {
    reason: { type: String, default: null },
    requestedAt: { type: Date, default: null },
    status: { type: String, enum: ['pending', 'approved', 'rejected', null], default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewComment: { type: String, default: null }
  },
  aiRouting: {
    suggestedDepartment: { type: String, default: null },
    suggestedCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    suggestedCategoryName: { type: String, default: null },
    confidence: { type: Number, default: 0 },
    reasoning: { type: String, default: null },
    userOverride: { type: Boolean, default: false },
    overrideReason: { type: String, default: null },
    acceptedRecommendation: { type: Boolean, default: false }
  },
  duplicateGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DuplicateGroup',
    default: null
  },
  parentComplaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    default: null
  },
  relatedAssets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset'
  }],
  isDuplicate: {
    type: Boolean,
    default: false
  },
  duplicateCount: {
    type: Number,
    default: 0
  },
  supporters: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      userName: { type: String },
      joinDate: { type: Date, default: Date.now },
      remarks: { type: String }
    }
  ],
  mergedComplaints: [
    {
      complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
      trackingId: { type: String },
      mergedAt: { type: Date, default: Date.now },
      mergedBy: { type: String },
      reason: { type: String }
    }
  ],
  impactScore: {
    type: Number,
    default: 0
  },
  similarityScore: {
    type: Number,
    default: 0
  },
  embeddingVector: {
    type: [Number],
    default: []
  },
  recurringIssue: {
    type: Boolean,
    default: false
  },
  aiConfidenceScore: {
    type: Number,
    default: 0
  },
  calendar: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessCalendar',
    default: null
  },
  slaPaused: {
    type: Boolean,
    default: false
  },
  slaPausedAt: {
    type: Date,
    default: null
  },
  slaResumedAt: {
    type: Date,
    default: null
  },
  slaAccumulatedPauseTime: {
    type: Number,
    default: 0
  },
  holdUntil: {
    type: Date,
    default: null
  },
  holdDuration: {
    type: String,
    default: null
  },
  previousStatusBeforeHold: {
    type: String,
    default: null
  },
  priorityEscalatedAt: {
    type: Date,
    default: null
  },
  priorityEscalationReason: {
    type: String,
    default: null
  },
  priorityEscalationHistory: [{
    fromPriority: { type: String },
    toPriority: { type: String },
    reason: { type: String },
    timestamp: { type: Date, default: Date.now },
    actor: { type: String, default: 'System' }
  }],
  responseBreachCount: {
    type: Number,
    default: 0
  },
  resolutionBreachCount: {
    type: Number,
    default: 0
  },
  totalBreachCount: {
    type: Number,
    default: 0
  },
  executiveEscalated: {
    type: Boolean,
    default: false
  },
  executiveEscalatedAt: {
    type: Date,
    default: null
  },
  executiveEscalationReason: {
    type: String,
    default: null
  },
  riskScore: {
    type: Number,
    default: 0
  },
  attentionRequired: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to generate sequential trackingId and initialize escalation
ComplaintSchema.pre('save', async function (next) {
  // Validate department-category link
  try {
    if (!this.isEscalated && this.status !== 'Escalated') {
      const DepartmentCategory = require('./DepartmentCategory');
      const mappingExists = await DepartmentCategory.exists({
        department: this.department,
        category: this.category,
        isActive: true
      });
      if (!mappingExists) {
        return next(new Error('Selected category is not linked to the selected department.'));
      }
    }

    // Populate cache fields
    const Department = require('./Department');
    const Category = require('./Category');
    const deptDoc = await Department.findById(this.department);
    const catDoc = await Category.findById(this.category);
    if (deptDoc && (this.isNew || this.isModified('department') || !this.assignedDepartment)) {
      this.assignedDepartment = deptDoc.name;
    }
    if (catDoc && (this.isNew || this.isModified('category') || !this.categoryName)) {
      this.categoryName = catDoc.name;
    }
  } catch (error) {
    return next(error);
  }

  if (this.isNew) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'complaintTrackingId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.trackingId = `CMS-${counter.seq}`;
      
      // Auto push first history log if history array is empty
      if (this.history.length === 0) {
        this.history.push({
          action: 'Complaint filed successfully',
          actor: 'System'
        });
      }

      // Initialize escalation if not already set (e.g. direct save in tests/seeding)
      if (this.escalationStatus === 'none') {
        const EscalationRule = require('./EscalationRule');
        const rule = await EscalationRule.findOne({ 
          departmentId: this.department,
          categoryId: this.category, 
          isActive: true 
        });
        if (rule && rule.levels && rule.levels.length > 0) {
          const level1 = rule.levels.find(l => l.level === 1);
          if (level1) {
            this.currentEscalationLevel = 0;
            this.escalationStatus = 'pending';
            this.escalationWorkflowId = rule._id;
            
            const CalendarEngine = require('../services/escalation/CalendarEngine');
            const calendar = await CalendarEngine.resolveCalendarForComplaint(this);
            const hours = level1.durationHours || 24;
            this.nextEscalationDueAt = await CalendarEngine.calculateDueDate(new Date(), hours * 60, calendar, this.assignedDepartment);
          }
        }
      }
      
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Post-init hook to capture original status and pause state
ComplaintSchema.post('init', function (doc) {
  doc._originalStatus = doc.status;
  doc._originalSlaPaused = doc.slaPaused;
});

// Pre-save hook to handle SLA Pausing and Resuming based on status updates
ComplaintSchema.pre('save', async function (next) {
  const isPausingStatus = (status) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes('awaiting') || 
           s.includes('pending customer') || 
           s.includes('pending citizen') || 
           s.includes('vendor') || 
           s.includes('third party') || 
           s.includes('waiting') ||
           s.includes('hold');
  };

  if (!this.isNew && this.isModified('status')) {
    const oldStatus = this._originalStatus;
    const newStatus = this.status;

    const wasPausing = isPausingStatus(oldStatus);
    const isNowPausing = isPausingStatus(newStatus);

    if (!wasPausing && isNowPausing) {
      // Transition to pausing state -> pause SLA
      this.slaPaused = true;
      this.slaPausedAt = new Date();
      this.history.push({
        action: `SLA timer paused automatically (Status changed from "${oldStatus}" to "${newStatus}")`,
        actor: 'System SLA Engine'
      });
    } else if (wasPausing && !isNowPausing) {
      // Transition out of pausing state -> resume SLA
      if (this.slaPaused && this.slaPausedAt) {
        const resumeTime = new Date();
        const pauseDuration = resumeTime.getTime() - this.slaPausedAt.getTime();
        
        this.slaPaused = false;
        this.slaResumedAt = resumeTime;
        this.slaPausedAt = null;
        this.slaAccumulatedPauseTime = (this.slaAccumulatedPauseTime || 0) + pauseDuration;

        // Shift all SLA dates forward by the exact paused duration
        if (this.responseDueAt) {
          this.responseDueAt = new Date(this.responseDueAt.getTime() + pauseDuration);
        }
        if (this.resolutionDueAt) {
          this.resolutionDueAt = new Date(this.resolutionDueAt.getTime() + pauseDuration);
        }
        if (this.nextEscalationDueAt) {
          this.nextEscalationDueAt = new Date(this.nextEscalationDueAt.getTime() + pauseDuration);
        }
        if (this.parallelEscalations && this.parallelEscalations.length > 0) {
          this.parallelEscalations.forEach(pe => {
            if (pe.dueAt) {
              pe.dueAt = new Date(pe.dueAt.getTime() + pauseDuration);
            }
          });
        }

        this.history.push({
          action: `SLA timer resumed (Status: "${newStatus}"). Deadlines extended by ${Math.round(pauseDuration / 60000)} minutes.`,
          actor: 'System SLA Engine'
        });
      }
    }

    // Intercept status transition to Resolved and redirect to Awaiting Feedback for customer CSAT
    if (newStatus === 'Resolved') {
      if (!this.feedbackRequested) {
        this.status = 'Awaiting Feedback';
        this.feedbackRequested = true;
        this.feedbackRequestedAt = new Date();
      }
    } else if (newStatus === 'Awaiting Feedback') {
      if (!this.feedbackRequested) {
        this.feedbackRequested = true;
        this.feedbackRequestedAt = new Date();
      }
    }
  } else if (this.isNew) {
    if (this.status === 'Resolved') {
      this.status = 'Awaiting Feedback';
      this.feedbackRequested = true;
      this.feedbackRequestedAt = new Date();
    } else if (this.status === 'Awaiting Feedback') {
      this.feedbackRequested = true;
      this.feedbackRequestedAt = new Date();
    }
  }
  next();
});

// Indexes for common queries and filters
ComplaintSchema.index({ citizen: 1 });
ComplaintSchema.index({ assignedTo: 1 });
ComplaintSchema.index({ department: 1 });
ComplaintSchema.index({ category: 1 });
ComplaintSchema.index({ assignedDepartment: 1 });
ComplaintSchema.index({ status: 1 });
ComplaintSchema.index({ priority: 1 });
ComplaintSchema.index({ currentEscalationLevel: 1 });
ComplaintSchema.index({ responseDueAt: 1 });
ComplaintSchema.index({ resolutionDueAt: 1 });
ComplaintSchema.index({ nextEscalationDueAt: 1 });
ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ duplicateGroupId: 1 });
ComplaintSchema.index({ parentComplaintId: 1 });

module.exports = createTenantModelProxy('Complaint', ComplaintSchema);
