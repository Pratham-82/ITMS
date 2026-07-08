const createTenantModelProxy = require('./tenantModelHelper');
const mongoose = require('mongoose');

const RelationshipDefinitionSchema = new mongoose.Schema({
  sourceEntity: {
    type: String,
    required: [true, 'Please specify the source entity code'],
    uppercase: true,
    trim: true
  },
  targetEntity: {
    type: String,
    required: [true, 'Please specify the target entity code'],
    uppercase: true,
    trim: true
  },
  relationshipType: {
    type: String,
    required: [true, 'Please specify the relationship type (e.g. owns, links)'],
    trim: true
  },
  cardinality: {
    type: String,
    required: [true, 'Please specify relationship cardinality'],
    enum: ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'],
    default: 'many-to-one'
  },
  label: {
    type: String,
    trim: true
  },
  isRequired: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

RelationshipDefinitionSchema.index({ sourceEntity: 1 });
RelationshipDefinitionSchema.index({ targetEntity: 1 });

module.exports = createTenantModelProxy('RelationshipDefinition', RelationshipDefinitionSchema);
