const mongoose = require('mongoose');
const calendarService = require('../services/calendarService');
const EscalationRuleResolver = require('../services/escalation/EscalationRuleResolver');
const tenantLocalStorage = require('../middleware/tenantContext');

async function run() {
  try {
    await mongoose.connect('mongodb://localhost:27017/apexresolve');
    console.log('Connected to default database.');

    const db = mongoose.connection.db;
    const tenants = await db.collection('tenants').find({}).toArray();

    // Databases list: central DB + all tenant DBs
    const dbNames = [{ dbName: 'apexresolve', tenantId: 'default-tenant' }];
    for (const t of tenants) {
      if (t.subdomain) {
        dbNames.push({
          dbName: `apexresolve_${t.subdomain}`,
          tenantId: t.subdomain
        });
      }
    }

    const uniqueDbNames = [];
    const seen = new Set();
    for (const entry of dbNames) {
      if (!seen.has(entry.dbName)) {
        seen.add(entry.dbName);
        uniqueDbNames.push(entry);
      }
    }

    const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    console.log(`System Timezone resolved to: ${systemTimeZone}`);

    for (const entry of uniqueDbNames) {
      const { dbName, tenantId } = entry;
      console.log(`\n========================================`);
      console.log(`MIGRATING DATABASE: ${dbName} (Tenant: ${tenantId})`);
      console.log(`========================================`);

      const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
      const collections = await tenantDb.db.listCollections().toArray();

      // Find the business calendar collection
      const calendarCol = collections.find(c => c.name === 'businesscalendars');
      if (!calendarCol) {
        console.log('No business calendars found in this database. Skipping.');
        continue;
      }

      // Update the default calendar timezone
      const calCollection = tenantDb.db.collection('businesscalendars');
      const defaultCal = await calCollection.findOne({ isDefault: true }) || await calCollection.findOne({});
      if (!defaultCal) {
        console.log('No calendar document found to update.');
        continue;
      }

      console.log(`Original calendar timezone: "${defaultCal.timeZone}"`);
      await calCollection.updateOne({ _id: defaultCal._id }, { $set: { timeZone: systemTimeZone } });
      console.log(`Updated calendar "${defaultCal.name}" timezone to: "${systemTimeZone}"`);

      // Fetch the updated calendar document
      const updatedCalendar = await calCollection.findOne({ _id: defaultCal._id });

      // Check if complaints or tickets collection exists and recalculate
      const ticketCol = collections.find(c => c.name === 'tickets');
      const complaintCol = collections.find(c => c.name === 'complaints');

      // Compile Mongoose models for this connection
      const TicketSchema = require('../models/Ticket').schema;
      const ComplaintSchema = require('../models/Complaint').schema;
      const SlaConfigurationSchema = require('../models/SlaConfiguration').schema;

      const TenantTicketModel = tenantDb.model('Ticket', TicketSchema);
      const TenantComplaintModel = tenantDb.model('Complaint', ComplaintSchema);
      const TenantSlaConfigModel = tenantDb.model('SlaConfiguration', SlaConfigurationSchema);

      const slaConfig = await TenantSlaConfigModel.findOne({ isDefault: true }) || {
        priorities: {
          Critical: { responseSlaMinutes: 15, resolutionSlaMinutes: 240 },
          High: { responseSlaMinutes: 60, resolutionSlaMinutes: 480 },
          Medium: { responseSlaMinutes: 240, resolutionSlaMinutes: 1440 },
          Low: { responseSlaMinutes: 480, resolutionSlaMinutes: 4320 }
        }
      };

      const processRecalculation = async (model, name) => {
        const activeDocs = await model.find({
          status: { $nin: ['Resolved', 'Closed', 'Rejected'] }
        });

        console.log(`Found ${activeDocs.length} active ${name} documents to recalculate.`);
        for (const doc of activeDocs) {
          await tenantLocalStorage.run(tenantId, async () => {
            const prioConfig = slaConfig.priorities[doc.priority] || { responseSlaMinutes: 240, resolutionSlaMinutes: 1440 };

            const responseDueAt = await calendarService.calculateDueDate(doc.createdAt, prioConfig.responseSlaMinutes, updatedCalendar);
            const resolutionDueAt = await calendarService.calculateDueDate(doc.createdAt, prioConfig.resolutionSlaMinutes, updatedCalendar);

            let nextEscalationDueAt = null;
            const rule = await EscalationRuleResolver.resolveRule(doc);
            if (rule && rule.levels && rule.levels.length > 0) {
              const level1 = rule.levels.find(l => l.level === 1);
              if (level1) {
                const hours = level1.durationHours || 24;
                nextEscalationDueAt = await calendarService.calculateDueDate(doc.createdAt, hours * 60, updatedCalendar, doc.assignedDepartment);
              }
            }

            // Use updateOne to bypass pre-save hook validation
            await model.updateOne({ _id: doc._id }, {
              $set: {
                responseDueAt,
                resolutionDueAt,
                nextEscalationDueAt
              }
            });
            
            console.log(`  - Recalculated ${name} ${doc.trackingId || doc._id}: nextEscalationDueAt=${nextEscalationDueAt ? nextEscalationDueAt.toISOString() : 'none'}`);
          });
        }
      };

      if (ticketCol) {
        await processRecalculation(TenantTicketModel, 'Ticket');
      }
      if (complaintCol) {
        await processRecalculation(TenantComplaintModel, 'Complaint');
      }
    }

    console.log('\n=== MIGRATION AND RECALCULATION SUCCESSFULLY COMPLETE! ===');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.connection.close();
  }
}

run();
