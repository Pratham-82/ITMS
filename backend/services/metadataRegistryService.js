const EntityDefinition = require('../models/EntityDefinition');
const FieldDefinition = require('../models/FieldDefinition');
const RelationshipDefinition = require('../models/RelationshipDefinition');
const MetadataAudit = require('../models/MetadataAudit');
const metadataCache = require('./metadataCache');

class MetadataRegistryService {
  // ==========================================
  // ENTITY APIs
  // ==========================================

  async createEntity(data, actor) {
    const code = data.code.toUpperCase().trim();
    
    const existing = await EntityDefinition.findOne({ code });
    if (existing) {
      throw new Error(`Entity with code "${code}" already exists.`);
    }

    const entity = await EntityDefinition.create({
      code,
      name: data.name.trim(),
      pluralName: data.pluralName ? data.pluralName.trim() : `${data.name.trim()}s`,
      description: data.description,
      category: data.category || 'Core',
      version: data.version || 1,
      icon: data.icon,
      color: data.color,
      isSystem: data.isSystem || false,
      isActive: data.isActive !== undefined ? data.isActive : true,
      supportsWorkflow: data.supportsWorkflow || false,
      supportsApproval: data.supportsApproval || false,
      supportsComments: data.supportsComments || false,
      supportsAttachments: data.supportsAttachments || false,
      supportsAudit: data.supportsAudit || false,
      settings: data.settings || {}
    });

    await MetadataAudit.create({
      action: 'CREATE',
      targetType: 'Entity',
      targetCode: code,
      changeSummary: `Created entity "${code}"`,
      newValues: entity.toObject(),
      actor
    });

    await metadataCache.invalidate('entity', code);
    return entity;
  }

  async updateEntity(entityCode, updateData, actor) {
    const code = entityCode.toUpperCase();
    const entity = await EntityDefinition.findOne({ code });
    if (!entity) {
      throw new Error(`Entity "${code}" not found.`);
    }

    const oldValues = entity.toObject();

    // System entity protection locks
    if (entity.isSystem) {
      // Prevent changing structural identity keys
      if (updateData.code && updateData.code.toUpperCase() !== code) {
        throw new Error('System Entity Protection: Cannot modify the code identifier of a system entity.');
      }
      if (updateData.isSystem === false) {
        throw new Error('System Entity Protection: Cannot convert a system entity to custom.');
      }
    }

    // Apply allowed updates
    const fieldsToUpdate = [
      'name', 'pluralName', 'description', 'category', 'icon', 'color', 
      'isActive', 'supportsWorkflow', 'supportsApproval', 'supportsComments', 
      'supportsAttachments', 'supportsAudit', 'settings'
    ];

    fieldsToUpdate.forEach(field => {
      if (updateData[field] !== undefined) {
        entity[field] = updateData[field];
      }
    });

    // Auto-increment version on schema update
    entity.version = (entity.version || 1) + 1;

    await entity.save();

    await MetadataAudit.create({
      action: 'UPDATE',
      targetType: 'Entity',
      targetCode: code,
      changeSummary: `Updated entity "${code}" to version ${entity.version}`,
      oldValues,
      newValues: entity.toObject(),
      actor
    });

    await metadataCache.invalidate('entity', code);
    return entity;
  }

  async deleteEntity(entityCode, actor) {
    const code = entityCode.toUpperCase();
    const entity = await EntityDefinition.findOne({ code });
    if (!entity) {
      throw new Error(`Entity "${code}" not found.`);
    }

    // System entity protection
    if (entity.isSystem) {
      throw new Error('System Entity Protection: System entities cannot be deleted.');
    }

    const oldValues = entity.toObject();

    // Delete Entity Definition
    await EntityDefinition.deleteOne({ code });

    // Referential integrity cleanup: delete associated fields
    const fieldsDeleted = await FieldDefinition.deleteMany({ entityCode: code });

    // Referential integrity cleanup: delete relationships involving this entity
    const relationshipsDeleted = await RelationshipDefinition.deleteMany({
      $or: [
        { sourceEntity: code },
        { targetEntity: code }
      ]
    });

    await MetadataAudit.create({
      action: 'DELETE',
      targetType: 'Entity',
      targetCode: code,
      changeSummary: `Deleted entity "${code}". Cleaned up ${fieldsDeleted.deletedCount} fields and ${relationshipsDeleted.deletedCount} relationships.`,
      oldValues,
      actor
    });

    // Invalidate all related caches
    await metadataCache.invalidate('entity', code);
    await metadataCache.invalidate('fields', code);
    await metadataCache.invalidate('relationships', code);
    return { success: true, message: `Entity "${code}" deleted successfully.` };
  }

  // ==========================================
  // FIELD APIs
  // ==========================================

  async createField(data, actor) {
    const entityCode = data.entityCode.toUpperCase().trim();
    const fieldKey = data.fieldKey.trim();

    // Check parent entity exists
    const parentEntity = await EntityDefinition.findOne({ code: entityCode });
    if (!parentEntity) {
      throw new Error(`Parent entity "${entityCode}" not found.`);
    }

    const existing = await FieldDefinition.findOne({ entityCode, fieldKey });
    if (existing) {
      throw new Error(`Field key "${fieldKey}" already exists on entity "${entityCode}".`);
    }

    const field = await FieldDefinition.create({
      entityCode,
      fieldKey,
      fieldLabel: data.fieldLabel.trim(),
      fieldType: data.fieldType,
      required: data.required || false,
      unique: data.unique || false,
      defaultValue: data.defaultValue,
      searchable: data.searchable !== undefined ? data.searchable : true,
      sortable: data.sortable !== undefined ? data.sortable : true,
      filterable: data.filterable !== undefined ? data.filterable : true,
      referenceConfig: data.referenceConfig || null,
      displayRules: data.displayRules || [],
      validationRules: data.validationRules || [],
      uiConfig: data.uiConfig || {},
      order: data.order || 0,
      isSystem: data.isSystem || false
    });

    // Bump entity version on schema change
    parentEntity.version = (parentEntity.version || 1) + 1;
    await parentEntity.save();
    await metadataCache.invalidate('entity', entityCode);

    await MetadataAudit.create({
      action: 'CREATE',
      targetType: 'Field',
      targetCode: `${entityCode}.${fieldKey}`,
      changeSummary: `Created field "${fieldKey}" on entity "${entityCode}"`,
      newValues: field.toObject(),
      actor
    });

    await metadataCache.invalidate('fields', entityCode);
    return field;
  }

  async updateField(entityCode, fieldKey, updateData, actor) {
    const code = entityCode.toUpperCase();
    const field = await FieldDefinition.findOne({ entityCode: code, fieldKey });
    if (!field) {
      throw new Error(`Field "${fieldKey}" not found on entity "${code}".`);
    }

    const oldValues = field.toObject();

    // System Protection
    if (field.isSystem) {
      if (updateData.fieldKey && updateData.fieldKey !== fieldKey) {
        throw new Error('System Entity Protection: Cannot rename key of a system field.');
      }
      if (updateData.fieldType && updateData.fieldType !== field.fieldType) {
        throw new Error('System Entity Protection: Cannot alter type of a system field.');
      }
    }

    const fieldsToUpdate = [
      'fieldLabel', 'required', 'unique', 'defaultValue', 'searchable', 
      'sortable', 'filterable', 'referenceConfig', 'displayRules', 
      'validationRules', 'uiConfig', 'order'
    ];

    fieldsToUpdate.forEach(f => {
      if (updateData[f] !== undefined) {
        field[f] = updateData[f];
      }
    });

    await field.save();

    // Bump parent entity version
    const parentEntity = await EntityDefinition.findOne({ code });
    if (parentEntity) {
      parentEntity.version = (parentEntity.version || 1) + 1;
      await parentEntity.save();
      await metadataCache.invalidate('entity', code);
    }

    await MetadataAudit.create({
      action: 'UPDATE',
      targetType: 'Field',
      targetCode: `${code}.${fieldKey}`,
      changeSummary: `Updated field "${fieldKey}" on entity "${code}"`,
      oldValues,
      newValues: field.toObject(),
      actor
    });

    await metadataCache.invalidate('fields', code);
    return field;
  }

  async deleteField(entityCode, fieldKey, actor) {
    const code = entityCode.toUpperCase();
    const field = await FieldDefinition.findOne({ entityCode: code, fieldKey });
    if (!field) {
      throw new Error(`Field "${fieldKey}" not found on entity "${code}".`);
    }

    // System Protection
    if (field.isSystem) {
      throw new Error('System Entity Protection: System fields cannot be deleted.');
    }

    const oldValues = field.toObject();

    await FieldDefinition.deleteOne({ entityCode: code, fieldKey });

    // Bump parent entity version
    const parentEntity = await EntityDefinition.findOne({ code });
    if (parentEntity) {
      parentEntity.version = (parentEntity.version || 1) + 1;
      await parentEntity.save();
      await metadataCache.invalidate('entity', code);
    }

    await MetadataAudit.create({
      action: 'DELETE',
      targetType: 'Field',
      targetCode: `${code}.${fieldKey}`,
      changeSummary: `Deleted field "${fieldKey}" from entity "${code}"`,
      oldValues,
      actor
    });

    await metadataCache.invalidate('fields', code);
    return { success: true, message: `Field "${fieldKey}" deleted successfully.` };
  }

  // ==========================================
  // RELATIONSHIP APIs
  // ==========================================

  async createRelationship(data, actor) {
    const source = data.sourceEntity.toUpperCase().trim();
    const target = data.targetEntity.toUpperCase().trim();

    // Validate entities exist
    const [sourceEntity, targetEntity] = await Promise.all([
      EntityDefinition.findOne({ code: source }),
      EntityDefinition.findOne({ code: target })
    ]);

    if (!sourceEntity) {
      throw new Error(`Source entity "${source}" not found.`);
    }
    if (!targetEntity) {
      throw new Error(`Target entity "${target}" not found.`);
    }

    const relationship = await RelationshipDefinition.create({
      sourceEntity: source,
      targetEntity: target,
      relationshipType: data.relationshipType.trim(),
      cardinality: data.cardinality,
      label: data.label ? data.label.trim() : `${source} to ${target}`,
      isRequired: data.isRequired || false
    });

    await MetadataAudit.create({
      action: 'CREATE',
      targetType: 'Relationship',
      targetCode: relationship._id.toString(),
      changeSummary: `Created relationship: ${source} (${data.cardinality}) -> ${target}`,
      newValues: relationship.toObject(),
      actor
    });

    // Invalidate caches
    await metadataCache.invalidate('relationships', source);
    await metadataCache.invalidate('relationships', target);
    return relationship;
  }

  async updateRelationship(id, updateData, actor) {
    const relationship = await RelationshipDefinition.findById(id);
    if (!relationship) {
      throw new Error('Relationship not found.');
    }

    const oldValues = relationship.toObject();

    const fieldsToUpdate = ['relationshipType', 'cardinality', 'label', 'isRequired'];
    fieldsToUpdate.forEach(f => {
      if (updateData[f] !== undefined) {
        relationship[f] = updateData[f];
      }
    });

    await relationship.save();

    await MetadataAudit.create({
      action: 'UPDATE',
      targetType: 'Relationship',
      targetCode: id.toString(),
      changeSummary: `Updated relationship ${id}`,
      oldValues,
      newValues: relationship.toObject(),
      actor
    });

    // Invalidate caches for both endpoints
    await metadataCache.invalidate('relationships', oldValues.sourceEntity);
    await metadataCache.invalidate('relationships', oldValues.targetEntity);
    if (oldValues.sourceEntity !== relationship.sourceEntity) {
      await metadataCache.invalidate('relationships', relationship.sourceEntity);
    }
    if (oldValues.targetEntity !== relationship.targetEntity) {
      await metadataCache.invalidate('relationships', relationship.targetEntity);
    }

    return relationship;
  }

  async deleteRelationship(id, actor) {
    const relationship = await RelationshipDefinition.findById(id);
    if (!relationship) {
      throw new Error('Relationship not found.');
    }

    const oldValues = relationship.toObject();

    await RelationshipDefinition.deleteOne({ _id: id });

    await MetadataAudit.create({
      action: 'DELETE',
      targetType: 'Relationship',
      targetCode: id.toString(),
      changeSummary: `Deleted relationship between ${oldValues.sourceEntity} and ${oldValues.targetEntity}`,
      oldValues,
      actor
    });

    await metadataCache.invalidate('relationships', oldValues.sourceEntity);
    await metadataCache.invalidate('relationships', oldValues.targetEntity);
    return { success: true, message: 'Relationship deleted successfully.' };
  }
}

module.exports = new MetadataRegistryService();
