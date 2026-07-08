const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/apexresolve';
  console.log(`Connecting to MongoDB at: ${mongoUri}`);
  
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  // Collections that must stay global in the default platform database
  const globalCollections = ['tenants', 'jobqueues', 'globalusers'];

  console.log('\nScanning collections for multi-tenant data split...');

  // Track users globally for registry seeding
  const allUsers = [];

  for (const colInfo of collections) {
    const colName = colInfo.name;
    if (globalCollections.includes(colName)) {
      console.log(`- Skipping global collection: "${colName}"`);
      continue;
    }

    if (colName.startsWith('system.')) {
      continue;
    }

    console.log(`- Scanning collection: "${colName}"`);
    const collection = db.collection(colName);
    
    // Find all documents in the collection
    const documents = await collection.find({}).toArray();
    if (documents.length === 0) {
      continue;
    }

    // Group documents by tenantId
    const tenantGroups = {};
    documents.forEach(doc => {
      // Special case: for Counter, parse tenantId from _id (e.g. ticketTrackingId_hughes_cms)
      let docTenantId = doc.tenantId;
      if (colName === 'counters' && typeof doc._id === 'string') {
        const parts = doc._id.split('_');
        if (parts.length > 1) {
          docTenantId = parts[1];
        }
      }

      const activeTenant = docTenantId || 'default-tenant';
      if (!tenantGroups[activeTenant]) {
        tenantGroups[activeTenant] = [];
      }
      tenantGroups[activeTenant].push(doc);

      // Track users for global registry
      if (colName === 'users') {
        allUsers.push({
          _id: doc._id,
          email: doc.email,
          tenantId: activeTenant
        });
      }
    });

    // Write tenant-specific documents to their respective databases
    for (const [tenantId, docs] of Object.entries(tenantGroups)) {
      if (tenantId === 'default-tenant') {
        // Keep in main database
        continue;
      }

      const tenantDbName = `apexresolve_${tenantId}`;
      console.log(`  -> Moving ${docs.length} documents from "${colName}" to tenant database: "${tenantDbName}"`);

      // Use a separate connection to the tenant database
      const tenantConn = await mongoose.createConnection(`${mongoUri.substring(0, mongoUri.lastIndexOf('/'))}/${tenantDbName}`);
      const tenantCol = tenantConn.collection(colName);

      // Insert documents (with duplicate prevention using upsert or delete-insert)
      for (const doc of docs) {
        await tenantCol.replaceOne({ _id: doc._id }, doc, { upsert: true });
      }
      
      await tenantConn.close();

      // Delete migrated documents from the main database
      const docIds = docs.map(d => d._id);
      if (colName === 'counters') {
        await collection.deleteMany({ _id: { $in: docIds } });
      } else {
        await collection.deleteMany({ _id: { $in: docIds } });
      }
    }
  }

  // Seed GlobalUser Registry centrally
  console.log('\nSeeding central GlobalUser Registry...');
  const GlobalUser = require('../models/GlobalUser');
  let seededCount = 0;
  for (const user of allUsers) {
    if (!user.email) continue;
    const emailLower = user.email.toLowerCase();
    
    // Find or create GlobalUser registry entry
    await GlobalUser.findOneAndUpdate(
      { userId: user._id },
      { email: emailLower, tenantId: user.tenantId, userId: user._id },
      { upsert: true, new: true }
    );
    seededCount++;
  }
  console.log(`GlobalUser Registry seeded: ${seededCount} users.`);

  console.log('\nDatabase split migration complete.');
  await mongoose.disconnect();
  console.log('Disconnected.');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
