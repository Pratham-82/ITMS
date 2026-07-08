const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://localhost:27017/apexresolve');
    const db = mongoose.connection.db;
    const tenants = await db.collection('tenants').find({}).toArray();

    const dbNames = ['apexresolve'];
    for (const t of tenants) {
      if (t.subdomain) dbNames.push(`apexresolve_${t.subdomain}`);
    }

    const uniqueDbNames = [...new Set(dbNames)];
    for (const dbName of uniqueDbNames) {
      console.log(`\nDB: ${dbName}`);
      const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
      try {
        const calendars = await tenantDb.db.collection('businesscalendars').find({}).toArray();
        for (const c of calendars) {
          console.log(`  - Calendar: "${c.name}", Timezone: "${c.timeZone}", Default: ${c.isDefault}`);
        }
      } catch (err) {
        console.log(`  No businesscalendars collection found or error.`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}

run();
