const metadataRegistryService = require('../services/metadataRegistryService');
const metadataResolver = require('../services/metadataResolver');
const EntityDefinition = require('../models/EntityDefinition');
const RelationshipDefinition = require('../models/RelationshipDefinition');
const MetadataAudit = require('../models/MetadataAudit');

// ==========================================
// ENTITY API HANDLERS
// ==========================================

// @desc    Get all active entity definitions
// @route   GET /api/metadata/entities
// @access  Private (Admin/Staff)
const getEntities = async (req, res) => {
  try {
    const entities = await EntityDefinition.find().sort({ code: 1 }).lean();
    res.status(200).json({ success: true, data: entities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get complete schema of an entity (or single definition)
// @route   GET /api/metadata/entities/:code
// @access  Private
const getEntityByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const { full } = req.query; // Query parameter ?full=true gets the unified composite schema

    if (full === 'true') {
      const fullSchema = await metadataResolver.getFullSchema(code);
      if (!fullSchema) {
        return res.status(404).json({ success: false, message: `Entity schema not found for "${code}"` });
      }
      return res.status(200).json({ success: true, data: fullSchema });
    }

    const entity = await metadataResolver.getEntity(code);
    if (!entity) {
      return res.status(404).json({ success: false, message: `Entity "${code}" not found` });
    }
    res.status(200).json({ success: true, data: entity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new entity definition
// @route   POST /api/metadata/entities
// @access  Private (Admin only)
const createEntity = async (req, res) => {
  try {
    const actor = req.user ? req.user.name : 'System';
    const entity = await metadataRegistryService.createEntity(req.body, actor);
    res.status(201).json({ success: true, data: entity });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update entity definition
// @route   PUT /api/metadata/entities/:code
// @access  Private (Admin only)
const updateEntity = async (req, res) => {
  try {
    const actor = req.user ? req.user.name : 'System';
    const entity = await metadataRegistryService.updateEntity(req.params.code, req.body, actor);
    res.status(200).json({ success: true, data: entity });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete entity definition and all elements
// @route   DELETE /api/metadata/entities/:code
// @access  Private (Admin only)
const deleteEntity = async (req, res) => {
  try {
    const actor = req.user ? req.user.name : 'System';
    const result = await metadataRegistryService.deleteEntity(req.params.code, actor);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ==========================================
// FIELD API HANDLERS
// ==========================================

// @desc    Get all fields of an entity
// @route   GET /api/metadata/fields
// @access  Private
const getFields = async (req, res) => {
  try {
    const entityCode = req.query.entityCode;
    if (!entityCode) {
      return res.status(400).json({ success: false, message: 'Please specify an entityCode query parameter' });
    }
    const fields = await metadataResolver.getFields(entityCode);
    res.status(200).json({ success: true, data: fields });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new field definition
// @route   POST /api/metadata/fields
// @access  Private (Admin only)
const createField = async (req, res) => {
  try {
    const actor = req.user ? req.user.name : 'System';
    const field = await metadataRegistryService.createField(req.body, actor);
    res.status(201).json({ success: true, data: field });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update a field definition
// @route   PUT /api/metadata/fields/:entityCode/:fieldKey
// @access  Private (Admin only)
const updateField = async (req, res) => {
  try {
    const actor = req.user ? req.user.name : 'System';
    const { entityCode, fieldKey } = req.params;
    const field = await metadataRegistryService.updateField(entityCode, fieldKey, req.body, actor);
    res.status(200).json({ success: true, data: field });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete a field definition
// @route   DELETE /api/metadata/fields/:entityCode/:fieldKey
// @access  Private (Admin only)
const deleteField = async (req, res) => {
  try {
    const actor = req.user ? req.user.name : 'System';
    const { entityCode, fieldKey } = req.params;
    const result = await metadataRegistryService.deleteField(entityCode, fieldKey, actor);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ==========================================
// RELATIONSHIP API HANDLERS
// ==========================================

// @desc    Get relationship definitions
// @route   GET /api/metadata/relationships
// @access  Private
const getRelationships = async (req, res) => {
  try {
    const { entityCode } = req.query;
    if (entityCode) {
      const relationships = await metadataResolver.getRelationships(entityCode);
      return res.status(200).json({ success: true, data: relationships });
    }
    const relationships = await RelationshipDefinition.find().lean();
    res.status(200).json({ success: true, data: relationships });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a relationship definition
// @route   POST /api/metadata/relationships
// @access  Private (Admin only)
const createRelationship = async (req, res) => {
  try {
    const actor = req.user ? req.user.name : 'System';
    const relationship = await metadataRegistryService.createRelationship(req.body, actor);
    res.status(201).json({ success: true, data: relationship });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update a relationship definition
// @route   PUT /api/metadata/relationships/:id
// @access  Private (Admin only)
const updateRelationship = async (req, res) => {
  try {
    const actor = req.user ? req.user.name : 'System';
    const relationship = await metadataRegistryService.updateRelationship(req.params.id, req.body, actor);
    res.status(200).json({ success: true, data: relationship });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete a relationship definition
// @route   DELETE /api/metadata/relationships/:id
// @access  Private (Admin only)
const deleteRelationship = async (req, res) => {
  try {
    const actor = req.user ? req.user.name : 'System';
    const result = await metadataRegistryService.deleteRelationship(req.params.id, actor);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ==========================================
// AUDIT LOG HANDLERS
// ==========================================

// @desc    Get metadata registry audit logs
// @route   GET /api/metadata/audit
// @access  Private (Admin only)
const getAudits = async (req, res) => {
  try {
    const audits = await MetadataAudit.find().sort({ timestamp: -1 }).limit(100).lean();
    res.status(200).json({ success: true, data: audits });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getEntities,
  getEntityByCode,
  createEntity,
  updateEntity,
  deleteEntity,
  getFields,
  createField,
  updateField,
  deleteField,
  getRelationships,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  getAudits
};
