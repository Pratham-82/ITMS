const mongoose = require('c:/Users/gamer/Downloads/CMS/backend/node_modules/mongoose');
const Department = require('../models/Department');
const Category = require('../models/Category');
const Complaint = require('../models/Ticket');
const EscalationRule = require('../models/EscalationRule');
const Workflow = require('../models/Workflow');
const DepartmentCategory = require('../models/DepartmentCategory');
const AiRoutingLog = require('../models/AiRoutingLog');

async function runMigration() {
  console.log('=== STARTING CATEGORY DECOUPLING MIGRATION ===');
  
  // Connect to DB
  await mongoose.connect('mongodb://localhost:27017/apexresolve');
  console.log('Connected to database apexresolve.');

  // Step 1: Find all categories
  const allCategories = await Category.find().lean();
  console.log(`Found ${allCategories.length} category records in DB.`);

  // Group by category name (case-sensitive)
  const groups = {};
  for (const cat of allCategories) {
    const key = cat.name.trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push(cat);
  }

  const migrationReport = {
    processedGroups: 0,
    createdMasterCategories: 0,
    createdMappings: 0,
    updatedComplaints: 0,
    updatedEscalationRules: 0,
    updatedWorkflows: 0,
    deletedDuplicates: 0
  };

  // Step 2: Process each group
  for (const name of Object.keys(groups)) {
    const duplicates = groups[name];
    console.log(`Processing group "${name}" with ${duplicates.length} records.`);
    migrationReport.processedGroups++;

    // Pick the first one as master (preferring one with fields if possible, or just the first)
    const masterInfo = duplicates.find(d => d.fields && d.fields.length > 0) || duplicates[0];
    
    // Create or update the master category to have clean schema (no department details)
    let masterDoc = await Category.findById(masterInfo._id);
    if (!masterDoc) {
      console.error(`Master category doc not found for ID: ${masterInfo._id}`);
      continue;
    }

    masterDoc.name = name; // set trimmed name
    await masterDoc.save();
    migrationReport.createdMasterCategories++;
    console.log(`Master Category created/updated: "${name}" [ID: ${masterDoc._id}]`);

    // Create DepartmentCategory mappings for each duplicate's department
    for (const dup of duplicates) {
      if (dup.department) {
        const mappingExists = await DepartmentCategory.findOne({
          department: dup.department,
          category: masterDoc._id
        });

        if (!mappingExists) {
          await DepartmentCategory.create({
            department: dup.department,
            category: masterDoc._id,
            isActive: dup.isActive
          });
          migrationReport.createdMappings++;
          console.log(`Created DepartmentCategory mapping: Dept ID ${dup.department} <-> Cat ID ${masterDoc._id}`);
        }
      }

      // Update references if this duplicate is NOT the master doc
      if (dup._id.toString() !== masterDoc._id.toString()) {
        // First ensure DepartmentCategory mapping exists for the duplicate's department
        if (dup.department) {
          const mappingExists = await DepartmentCategory.findOne({
            department: dup.department,
            category: masterDoc._id
          });
          if (!mappingExists) {
            await DepartmentCategory.create({
              department: dup.department,
              category: masterDoc._id,
              isActive: dup.isActive
            });
            migrationReport.createdMappings++;
          }
        }

        // Update Complaints (we can update directly in Mongo using updateMany to avoid running validation hooks if they are already valid, but we'll set both fields)
        const compResult = await Complaint.updateMany(
          { category: dup._id },
          { $set: { category: masterDoc._id, department: dup.department } }
        );
        migrationReport.updatedComplaints += compResult.modifiedCount;

        // Update EscalationRules
        const existingRule = await EscalationRule.findOne({
          departmentId: dup.department,
          categoryId: masterDoc._id
        });
        if (existingRule) {
          await EscalationRule.deleteMany({ categoryId: dup._id });
        } else {
          const escResult = await EscalationRule.updateMany(
            { categoryId: dup._id },
            { $set: { categoryId: masterDoc._id, departmentId: dup.department } }
          );
          migrationReport.updatedEscalationRules += escResult.modifiedCount;
        }

        // Update Workflows
        const existingWorkflow = await Workflow.findOne({ categoryId: masterDoc._id });
        if (existingWorkflow) {
          await Workflow.deleteMany({ categoryId: dup._id });
        } else {
          const wfResult = await Workflow.updateMany(
            { categoryId: dup._id },
            { $set: { categoryId: masterDoc._id } }
          );
          migrationReport.updatedWorkflows += wfResult.modifiedCount;
        }

        // Update AI Routing Logs
        await AiRoutingLog.updateMany(
          { suggestedCategory: dup._id },
          { $set: { suggestedCategory: masterDoc._id } }
        );

        // Delete duplicate category document
        await Category.deleteOne({ _id: dup._id });
        migrationReport.deletedDuplicates++;
        console.log(`Deleted duplicate category record: "${name}" [ID: ${dup._id}]`);
      } else {
        // If it is the master doc, update its references as well to set the department field on complaints/escalation rules
        if (dup.department) {
          // Ensure mapping exists
          const mappingExists = await DepartmentCategory.findOne({
            department: dup.department,
            category: masterDoc._id
          });
          if (!mappingExists) {
            await DepartmentCategory.create({
              department: dup.department,
              category: masterDoc._id,
              isActive: dup.isActive
            });
            migrationReport.createdMappings++;
          }

          const compResult = await Complaint.updateMany(
            { category: masterDoc._id, department: { $exists: false } },
            { $set: { department: dup.department } }
          );
          migrationReport.updatedComplaints += compResult.modifiedCount;

          const escResult = await EscalationRule.updateMany(
            { categoryId: masterDoc._id, departmentId: { $exists: false } },
            { $set: { departmentId: dup.department } }
          );
          migrationReport.updatedEscalationRules += escResult.modifiedCount;
        }
      }
    }
  }

  // Step 3: Populate department field for any complaints that didn't have it set
  console.log('Populating department ObjectId for remaining complaints based on assignedDepartment name...');
  const complaintsWithoutDept = await Complaint.find({ department: { $exists: false } });
  console.log(`Found ${complaintsWithoutDept.length} complaints without department field.`);

  for (const comp of complaintsWithoutDept) {
    const deptDoc = await Department.findOne({ name: comp.assignedDepartment });
    if (deptDoc) {
      // Ensure DepartmentCategory mapping exists first
      const mappingExists = await DepartmentCategory.findOne({
        department: deptDoc._id,
        category: comp.category
      });
      if (!mappingExists) {
        await DepartmentCategory.create({
          department: deptDoc._id,
          category: comp.category,
          isActive: true
        });
        migrationReport.createdMappings++;
        console.log(`Created recovery mapping for history: Dept "${deptDoc.name}" <-> Cat "${comp.categoryName}"`);
      }

      comp.department = deptDoc._id;
      await comp.save();
      migrationReport.updatedComplaints++;
    } else {
      console.warn(`Could not find department named "${comp.assignedDepartment}" for complaint tracking ID ${comp.trackingId}`);
    }
  }

  // Step 4: Populate departmentId field for remaining EscalationRules
  console.log('Populating departmentId for remaining EscalationRules...');
  const rulesWithoutDept = await EscalationRule.find({ departmentId: { $exists: false } });
  for (const rule of rulesWithoutDept) {
    const mapping = await DepartmentCategory.findOne({ category: rule.categoryId });
    if (mapping) {
      rule.departmentId = mapping.department;
      await rule.save();
      migrationReport.updatedEscalationRules++;
    } else {
      const firstDept = await Department.findOne();
      if (firstDept) {
        rule.departmentId = firstDept._id;
        await rule.save();
        migrationReport.updatedEscalationRules++;
      }
    }
  }

  console.log('\n=== MIGRATION COMPLETED SUCCESSFULLY ===');
  console.log('Migration Report:', JSON.stringify(migrationReport, null, 2));

  await mongoose.disconnect();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
