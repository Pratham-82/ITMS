const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const FieldSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'number', 'select', 'textarea', 'checkbox'],
    default: 'text'
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [
    {
      type: String,
      trim: true
    }
  ]
});

const ServiceSchema = new mongoose.Schema({
  catalog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCatalog',
    required: [true, 'Please specify a service catalog']
  },
  name: {
    type: String,
    required: [true, 'Please add a service name'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  fields: [FieldSchema],
  assignment: {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EscalationGroup',
      default: null
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  workflow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceWorkflow',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = createTenantModelProxy('Service', ServiceSchema);
