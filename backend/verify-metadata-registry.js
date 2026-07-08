const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const tenantLocalStorage = require('./middleware/tenantContext');

const MetadataType = require('./models/MetadataType');
const EntityDefinition = require('./models/EntityDefinition');
const FieldDefinition = require('./models/FieldDefinition');
const RelationshipDefinition = require('./models/RelationshipDefinition');
const MetadataAudit = require('./models/MetadataAudit');

const metadataRegistryService = require('./services/metadataRegistryService');
const metadataResolver = require('./services/metadataResolver');
const metadataCache = require('./services/metadataCache');

const runTests = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully.');

    const tenantId = 'default-tenant';
    
    // Execute all registry operations inside active tenant context
    await tenantLocalStorage.run(tenantId, async () => {
      console.log(`\n========================================`);
      console.log(`Testing under tenant context: ${tenantId}`);
      console.log(`========================================`);

      // 1. Verify seeded MetadataTypes (Global Model)
      console.log('\n[TEST 1] Verifying global MetadataTypes...');
      const types = await MetadataType.find().lean();
      console.log(`Found ${types.length} global metadata categories:`);
      types.forEach(t => console.log(` - ${t.code}: ${t.name}`));
      
      const hasEntity = types.some(t => t.code === 'ENTITY');
      if (!hasEntity) throw new Error('Seeded metadata types missing core categories.');
      console.log('✔ Global MetadataTypes verified successfully.');

      // 2. Verify seeded core system EntityDefinitions
      console.log('\n[TEST 2] Verifying seeded core system entities...');
      const entities = await EntityDefinition.find().lean();
      console.log(`Found ${entities.length} entities:`);
      entities.forEach(e => console.log(` - ${e.code} (${e.name}): System=${e.isSystem}, Version=${e.version}`));
      
      const ticketEntity = entities.find(e => e.code === 'TICKET');
      if (!ticketEntity || !ticketEntity.isSystem) {
        throw new Error('Core TICKET system entity not found or isSystem flag is false.');
      }
      console.log('✔ Core system entities verified.');

      // 3. Test System Entity Protection
      console.log('\n[TEST 3] Testing System Entity Protection...');
      try {
        console.log('Attempting to delete system entity TICKET...');
        await metadataRegistryService.deleteEntity('TICKET', 'TestActor');
        throw new Error('FAILED: Was able to delete a system entity!');
      } catch (err) {
        console.log(`Success (deletion blocked): ${err.message}`);
      }

      try {
        console.log('Attempting to delete system field TICKET.status...');
        await metadataRegistryService.deleteField('TICKET', 'status', 'TestActor');
        throw new Error('FAILED: Was able to delete a system field!');
      } catch (err) {
        console.log(`Success (field deletion blocked): ${err.message}`);
      }
      console.log('✔ System Entity Protection verified.');

      // 4. Create a custom entity (EMPLOYEE)
      console.log('\n[TEST 4] Creating custom entity "EMPLOYEE"...');
      const employee = await metadataRegistryService.createEntity({
        code: 'EMPLOYEE',
        name: 'Employee',
        pluralName: 'Employees',
        description: 'Organization employees directory.',
        category: 'Core',
        icon: 'User',
        color: '#ef4444'
      }, 'TestActor');
      console.log(`Created: ${employee.name} (${employee.code}), Version=${employee.version}`);

      // 5. Add custom fields (badgeNumber, status) with Reference and Display rules
      console.log('Adding custom field EMPLOYEE.badgeNumber...');
      const f1 = await metadataRegistryService.createField({
        entityCode: 'EMPLOYEE',
        fieldKey: 'badgeNumber',
        fieldLabel: 'Badge Number',
        fieldType: 'text',
        required: true,
        searchable: true,
        order: 1
      }, 'TestActor');
      console.log(`Created field: ${f1.fieldLabel} (${f1.fieldKey})`);

      console.log('Adding custom field EMPLOYEE.contractType...');
      const f2 = await metadataRegistryService.createField({
        entityCode: 'EMPLOYEE',
        fieldKey: 'contractType',
        fieldLabel: 'Contract Type',
        fieldType: 'select',
        defaultValue: 'Full-Time',
        uiConfig: { options: ['Full-Time', 'Part-Time', 'Contractor'] },
        order: 2
      }, 'TestActor');
      console.log(`Created field: ${f2.fieldLabel} (${f2.fieldKey})`);

      console.log('Adding custom display-rules field EMPLOYEE.agencyName (visible only for Contractors)...');
      const f3 = await metadataRegistryService.createField({
        entityCode: 'EMPLOYEE',
        fieldKey: 'agencyName',
        fieldLabel: 'Agency Name',
        fieldType: 'text',
        displayRules: [
          { dependsOnField: 'contractType', operator: 'eq', value: 'Contractor' }
        ],
        order: 3
      }, 'TestActor');
      console.log(`Created conditional field: ${f3.fieldLabel} with DisplayRules.`);

      // 6. Add Relationship (EMPLOYEE -> LOCATION)
      console.log('\n[TEST 5] Linking EMPLOYEE to LOCATION...');
      const rel = await metadataRegistryService.createRelationship({
        sourceEntity: 'EMPLOYEE',
        targetEntity: 'LOCATION',
        relationshipType: 'works_at',
        cardinality: 'many-to-one',
        label: 'Work Location'
      }, 'TestActor');
      console.log(`Created relationship: ${rel.sourceEntity} works_at ${rel.targetEntity}`);

      // 7. Verify Caching & Invalidation & Resolver getFullSchema
      console.log('\n[TEST 6] Testing MetadataResolver.getFullSchema()...');
      // Fetch schema (will cache it)
      const schemaV1 = await metadataResolver.getFullSchema('EMPLOYEE');
      console.log(`Retrieved schema from Resolver. Fields count: ${schemaV1.fields.length}`);
      
      const cachedSchema = await metadataCache.get('fullschema', 'EMPLOYEE');
      if (!cachedSchema) {
        throw new Error('Resolver results were not cached correctly.');
      }
      console.log('✔ Schema is successfully cached.');

      // Update Employee entity details (should invalidate cache)
      console.log('Updating EMPLOYEE definition description (this should invalidate cached schema)...');
      await metadataRegistryService.updateEntity('EMPLOYEE', { description: 'Updated directory for personnel.' }, 'TestActor');
      
      const cachedPostUpdate = await metadataCache.get('fullschema', 'EMPLOYEE');
      if (cachedPostUpdate) {
        throw new Error('Cache invalidation failed! Schema is still in cache after update.');
      }
      console.log('✔ Cache successfully invalidated upon entity mutation.');

      const schemaV2 = await metadataResolver.getFullSchema('EMPLOYEE');
      console.log(`Re-fetched schema. New Description: "${schemaV2.entity.description}", Version: ${schemaV2.entity.version}`);

      // 8. Verify MetadataAudit entries
      console.log('\n[TEST 7] Verifying audit trail logs...');
      const audits = await MetadataAudit.find({ targetCode: { $regex: 'EMPLOYEE' } }).lean();
      console.log(`Found ${audits.length} audit entries matching target code "EMPLOYEE":`);
      audits.forEach(a => {
        console.log(` - [${a.action}] Type=${a.targetType}, Summary="${a.changeSummary}", Actor=${a.actor}`);
      });
      if (audits.length === 0) {
        throw new Error('No audit log entries found for custom entity setup.');
      }
      console.log('✔ Audit logging verified.');

      // Clean up custom employee entity to leave db in clean state
      console.log('\n[TEST 8] Cleaning up custom employee definitions...');
      await metadataRegistryService.deleteEntity('EMPLOYEE', 'TestActor');
      console.log('Deleted EMPLOYEE entity.');

      const postDeleteEntity = await metadataResolver.getEntity('EMPLOYEE');
      const postDeleteFields = await metadataResolver.getFields('EMPLOYEE');
      const postDeleteRels = await metadataResolver.getRelationships('EMPLOYEE');
      if (postDeleteEntity || postDeleteFields.length > 0 || postDeleteRels.length > 0) {
        throw new Error('Referential integrity clean up failed during deletion.');
      }
      console.log('✔ Clean up and referential integrity checks passed.');
    });

    console.log('\n========================================');
    console.log('ALL METADATA REGISTRY TESTS PASSED!');
    console.log('========================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST RUN FAILED:', error);
    process.exit(1);
  }
};

runTests();
