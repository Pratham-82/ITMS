const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const ServiceWorkflowSchema = new mongoose.Schema({
  workflowName: {
    type: String,
    required: [true, 'Please add a workflow name'],
    trim: true,
    unique: true
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
        }
      }
    }
  ]
}, { timestamps: true });

module.exports = createTenantModelProxy('ServiceWorkflow', ServiceWorkflowSchema);
