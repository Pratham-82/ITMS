const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Register global multi-tenant Mongoose plugin
const tenantPlugin = require('../middleware/tenantPlugin');
mongoose.plugin(tenantPlugin);

const preloadModels = () => {
  const modelsPath = path.join(__dirname, '../models');
  fs.readdirSync(modelsPath).forEach(file => {
    if (file.endsWith('.js') && file !== 'tenantModelHelper.js') {
      try {
        require(path.join(modelsPath, file));
      } catch (err) {
        console.error(`[Model Autoload] Failed to load model "${file}":`, err.message);
      }
    }
  });
};

const cleanSingleFieldUniqueIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    // Skip collections that must have global uniqueness and shouldn't be touched
    const skipCollections = ['tenants', 'users', 'counters'];

    for (const colInfo of collections) {
      const colName = colInfo.name;
      if (skipCollections.includes(colName)) {
        continue;
      }

      const collection = db.collection(colName);
      let indexes;
      try {
        indexes = await collection.indexes();
      } catch (err) {
        // Collection might not exist yet
        continue;
      }

      // Find compound unique indexes that include tenantId
      const tenantCompoundUniqueIndexes = indexes.filter(idx => {
        const keys = Object.keys(idx.key);
        return idx.unique && keys.length > 1 && keys.includes('tenantId');
      });

      if (tenantCompoundUniqueIndexes.length === 0) {
        continue;
      }

      // Find all unique fields in those compound indexes (excluding tenantId itself)
      const compoundFields = new Set();
      tenantCompoundUniqueIndexes.forEach(idx => {
        Object.keys(idx.key).forEach(k => {
          if (k !== 'tenantId') {
            compoundFields.add(k);
          }
        });
      });

      // Find single-field unique indexes on any of those compoundFields
      const indexesToDrop = indexes.filter(idx => {
        const keys = Object.keys(idx.key);
        if (keys.length === 1 && idx.unique) {
          const field = keys[0];
          return compoundFields.has(field);
        }
        return false;
      });

      for (const idx of indexesToDrop) {
        console.log(`[DB Index Migration] Dropping global unique index "${idx.name}" on collection "${colName}" in favor of tenant-scoped compound index.`);
        try {
          await collection.dropIndex(idx.name);
        } catch (err) {
          console.error(`[DB Index Migration] Failed to drop index "${idx.name}":`, err.message);
        }
      }
    }
  } catch (error) {
    console.error('[DB Index Migration] Error during index cleanup:', error);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/apexresolve');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Autoload all schemas to register them globally in tenantModelHelper
    preloadModels();
    console.log('All tenant schemas autoloaded successfully.');

    // Run automated unique index migration
    await cleanSingleFieldUniqueIndexes();

    // Auto-seed default tenant defaults on startup
    const { seedTenantDefaults } = require('../services/tenantDefaults');
    await seedTenantDefaults('default-tenant');
    console.log('Default tenant defaults verified/seeded successfully.');
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

