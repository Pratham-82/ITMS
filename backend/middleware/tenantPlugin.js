const tenantLocalStorage = require('./tenantContext');

function tenantPlugin(schema) {
  // Check if model explicitly bypasses the tenant plugin
  if (schema.options.bypassTenantPlugin) {
    return;
  }

  // Add tenantId field if not already present
  if (!schema.paths.tenantId) {
    schema.add({
      tenantId: {
        type: String,
        default: 'default-tenant',
        index: true
      }
    });
  }

  // Iterate over schema paths to find unique fields (except email on User)
  schema.eachPath((pathname, schemaType) => {
    const isUnique = schemaType.options.unique || (schemaType._index && schemaType._index.unique);
    if (isUnique && pathname !== 'email') {
      // Disable the single-field unique index
      schemaType.options.unique = false;
      if (schemaType._index) {
        schemaType._index = null;
      }

      // Add a compound unique index with tenantId
      const compoundIndex = { tenantId: 1 };
      compoundIndex[pathname] = 1;
      
      schema.index(compoundIndex, { unique: true });
    }
  });

  // Query scoping helper
  const scopeQuery = function(next) {
    const tenantId = tenantLocalStorage.getStore();
    const options = this.getOptions() || {};

    if (options.bypassTenant) {
      return next();
    }

    // Apply tenant filter
    const activeTenant = tenantId || 'default-tenant';
    this.where({ tenantId: activeTenant });
    next();
  };

  // Register query pre-hooks
  schema.pre('find', scopeQuery);
  schema.pre('findOne', scopeQuery);
  schema.pre('findOneAndUpdate', scopeQuery);
  schema.pre('findOneAndDelete', scopeQuery);
  schema.pre('findOneAndReplace', scopeQuery);
  schema.pre('countDocuments', scopeQuery);
  schema.pre('updateOne', scopeQuery);
  schema.pre('updateMany', scopeQuery);
  schema.pre('deleteOne', scopeQuery);
  schema.pre('deleteMany', scopeQuery);

  // Document save pre-hook
  schema.pre('save', function(next) {
    const tenantId = tenantLocalStorage.getStore();
    if (!this.tenantId || this.tenantId === 'default-tenant') {
      this.tenantId = tenantId || 'default-tenant';
    }
    next();
  });

  // Bulk insert pre-hook
  schema.pre('insertMany', function(next, docs) {
    const tenantId = tenantLocalStorage.getStore();
    const activeTenant = tenantId || 'default-tenant';
    if (Array.isArray(docs)) {
      docs.forEach(doc => {
        if (!doc.tenantId || doc.tenantId === 'default-tenant') {
          doc.tenantId = activeTenant;
        }
      });
    } else if (docs) {
      if (!docs.tenantId || docs.tenantId === 'default-tenant') {
        docs.tenantId = activeTenant;
      }
    }
    next();
  });
}

module.exports = tenantPlugin;
