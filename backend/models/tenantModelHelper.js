const mongoose = require('mongoose');
const tenantLocalStorage = require('../middleware/tenantContext');

// Global registry of all tenant-specific schemas to ensure populated refs resolve correctly on dynamic connections
const tenantSchemas = {};

/**
 * Creates a Mongoose model proxy that routes queries and instance creations
 * dynamically to tenant-specific databases based on active tenant context.
 *
 * @param {string} modelName - The name of the Mongoose model (e.g. 'Ticket')
 * @param {mongoose.Schema} schema - The schema of the model
 */
function createTenantModelProxy(modelName, schema) {
  // Register schema in the global registry
  tenantSchemas[modelName] = schema;

  // 1. Check if the model is global (not tenant-specific, stored in default db)
  const isGlobal = schema.options.globalModel;
  const BaseModel = mongoose.model(modelName, schema);

  if (isGlobal) {
    return BaseModel;
  }

  // Helper to ensure all registered tenant models exist on the connection
  const ensureTenantModels = (tenantDb) => {
    for (const [name, sch] of Object.entries(tenantSchemas)) {
      if (!tenantDb.models[name]) {
        tenantDb.model(name, sch);
      }
    }
  };

  // 2. Return a Proxy that wraps BaseModel
  return new Proxy(BaseModel, {
    get(target, prop, receiver) {
      // Handle instanceof checks dynamically across connections
      if (prop === Symbol.hasInstance) {
        return (instance) => {
          return instance && (instance.constructor.modelName === modelName || instance instanceof target);
        };
      }

      const tenantId = tenantLocalStorage.getStore();
      if (tenantId && tenantId !== 'default-tenant') {
        const dbName = `apexresolve_${tenantId}`;
        const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
        ensureTenantModels(tenantDb);
        const tenantModel = tenantDb.models[modelName];
        const value = Reflect.get(tenantModel, prop, receiver);
        if (typeof value === 'function') {
          return value.bind(tenantModel);
        }
        return value;
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
    construct(target, args) {
      const tenantId = tenantLocalStorage.getStore();
      if (tenantId && tenantId !== 'default-tenant') {
        const dbName = `apexresolve_${tenantId}`;
        const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
        ensureTenantModels(tenantDb);
        const tenantModel = tenantDb.models[modelName];
        return Reflect.construct(tenantModel, args);
      }
      return Reflect.construct(target, args);
    }
  });
}

module.exports = createTenantModelProxy;
