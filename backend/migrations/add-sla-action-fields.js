const mongoose = require('mongoose');
const Complaint = require('../models/Ticket');

async function runMigration() {
  console.log('=== STARTING SLA ACTION FIELDS INITIALIZATION MIGRATION ===');
  
  // Connect to DB
  const dbUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexresolve';
  await mongoose.connect(dbUrl);
  console.log(`Connected to database at ${dbUrl}.`);

  const migrationReport = {
    updatedComplaints: 0,
    totalComplaints: 0
  };

  // Find all complaints
  const allComplaints = await Complaint.find();
  migrationReport.totalComplaints = allComplaints.length;
  console.log(`Found ${allComplaints.length} complaint records in DB.`);

  // Update fields on each complaint if they are not already set
  for (const comp of allComplaints) {
    let updated = false;

    if (comp.responseBreachCount === undefined) {
      comp.responseBreachCount = 0;
      updated = true;
    }
    if (comp.resolutionBreachCount === undefined) {
      comp.resolutionBreachCount = 0;
      updated = true;
    }
    if (comp.totalBreachCount === undefined) {
      comp.totalBreachCount = 0;
      updated = true;
    }
    if (comp.executiveEscalated === undefined) {
      comp.executiveEscalated = false;
      updated = true;
    }
    if (comp.riskScore === undefined) {
      comp.riskScore = 0;
      updated = true;
    }
    if (comp.attentionRequired === undefined) {
      comp.attentionRequired = false;
      updated = true;
    }
    if (comp.priorityEscalationHistory === undefined) {
      comp.priorityEscalationHistory = [];
      updated = true;
    }

    if (updated) {
      await comp.save();
      migrationReport.updatedComplaints++;
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
