const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const WorkflowSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    default: 'default-tenant',
    index: true
  },
  ticketTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketType',
    default: null
  },
  workflowName: {
    type: String,
    required: [true, 'Please add a workflow name'],
    trim: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Please specify a category']
  },
  categoryName: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  states: [
    {
      name: {
        type: String,
        required: [true, 'State name is required'],
        trim: true
      },
      description: {
        type: String,
        default: ''
      },
      isReserved: {
        type: Boolean,
        default: false
      }
    }
  ],
  transitions: [
    {
      fromState: {
        type: String,
        required: [true, 'Source state is required']
      },
      toState: {
        type: String,
        required: [true, 'Target state is required']
      },
      label: {
        type: String,
        required: [true, 'Transition label is required'],
        trim: true
      },
      allowedRole: {
        type: String,
        enum: ['citizen', 'admin', 'any'],
        default: 'admin'
      },
      actions: {
        autoRouteToDepartment: {
          type: String,
          default: null
        },
        escalationDurationHours: {
          type: Number,
          default: null
        }
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

WorkflowSchema.index({ tenantId: 1, categoryId: 1, ticketTypeId: 1 }, { unique: true });

module.exports = createTenantModelProxy('Workflow', WorkflowSchema);
