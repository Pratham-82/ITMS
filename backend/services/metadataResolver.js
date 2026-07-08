const EntityDefinition = require('../models/EntityDefinition');
const FieldDefinition = require('../models/FieldDefinition');
const RelationshipDefinition = require('../models/RelationshipDefinition');
const metadataCache = require('./metadataCache');

class MetadataResolver {
  /**
   * Fetch single Entity Definition by code, using cache when available.
   * @param {string} entityCode
   */
  async getEntity(entityCode) {
    if (!entityCode) return null;
    const code = entityCode.toUpperCase();

    // Try cache
    const cached = await metadataCache.get('entity', code);
    if (cached) return cached;

    // Fetch from database
    const entity = await EntityDefinition.findOne({ code, isActive: true }).lean();
    if (entity) {
      await metadataCache.set('entity', code, entity);
    }
    return entity;
  }

  /**
   * Fetch all Field Definitions for a specific entity code, sorted by order.
   * @param {string} entityCode
   */
  async getFields(entityCode) {
    if (!entityCode) return [];
    const code = entityCode.toUpperCase();

    const cached = await metadataCache.get('fields', code);
    if (cached) return cached;

    const fields = await FieldDefinition.find({ entityCode: code })
      .sort({ order: 1 })
      .lean();

    await metadataCache.set('fields', code, fields);
    return fields;
  }

  /**
   * Fetch all Relationship Definitions involving the entity code.
   * @param {string} entityCode
   */
  async getRelationships(entityCode) {
    if (!entityCode) return [];
    const code = entityCode.toUpperCase();

    const cached = await metadataCache.get('relationships', code);
    if (cached) return cached;

    const relationships = await RelationshipDefinition.find({
      $or: [
        { sourceEntity: code },
        { targetEntity: code }
      ]
    }).lean();

    await metadataCache.set('relationships', code, relationships);
    return relationships;
  }

  /**
   * Fetch complete schema composite of an entity (definition, fields, relationships).
   * @param {string} entityCode
   */
  async getFullSchema(entityCode) {
    if (!entityCode) return null;
    const code = entityCode.toUpperCase();

    const cached = await metadataCache.get('fullschema', code);
    if (cached) return cached;

    const [entity, fields, relationships] = await Promise.all([
      this.getEntity(code),
      this.getFields(code),
      this.getRelationships(code)
    ]);

    if (!entity) return null;

    const fullSchema = {
      entity,
      fields,
      relationships
    };

    await metadataCache.set('fullschema', code, fullSchema);
    return fullSchema;
  }
}

module.exports = new MetadataResolver();
