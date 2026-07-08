const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const ReferenceConfigSchema = new mongoose.Schema({
  referencedEntity: {
    type: String,
    uppercase: true,
    trim: true,
    default: null
  },
  displayField: {
    type: String,
    trim: true,
    default: null
  }
}, { _id: false });

const DisplayRuleSchema = new mongoose.Schema({
  dependsOnField: {
    type: String,
    required: true,
    trim: true
  },
  operator: {
    type: String,
    enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'],
    default: 'eq'
  },
  value: {
    type: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

const ValidationRuleSchema = new mongoose.Schema({
  ruleType: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed
  },
  errorMessage: {
    type: String,
    trim: true
  }
}, { _id: false });

const FieldDefinitionSchema = new mongoose.Schema({
  entityCode: {
    type: String,
    required: [true, 'Please specify the parent entity code'],
    uppercase: true,
    trim: true
  },
  fieldKey: {
    type: String,
    required: [true, 'Please add a field key'],
    trim: true
  },
  fieldLabel: {
    type: String,
    required: [true, 'Please add a field label'],
    trim: true
  },
  fieldType: {
    type: String,
    required: [true, 'Please specify the field type'],
    enum: [
      'text', 'textarea', 'number', 'currency', 'boolean', 'date', 'datetime',
      'email', 'phone', 'url', 'select', 'multiselect', 'user', 'group',
      'reference', 'json', 'richtext', 'attachment', 'formula'
    ],
    default: 'text'
  },
  required: {
    type: Boolean,
    default: false
  },
  unique: {
    type: Boolean,
    default: false
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  searchable: {
    type: Boolean,
    default: true
  },
  sortable: {
    type: Boolean,
    default: true
  },
  filterable: {
    type: Boolean,
    default: true
  },
  referenceConfig: {
    type: ReferenceConfigSchema,
    default: null
  },
  displayRules: [DisplayRuleSchema],
  validationRules: [ValidationRuleSchema],
  uiConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  order: {
    type: Number,
    default: 0
  },
  isSystem: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

FieldDefinitionSchema.index({ entityCode: 1, fieldKey: 1 }, { unique: true });

module.exports = createTenantModelProxy('FieldDefinition', FieldDefinitionSchema);
