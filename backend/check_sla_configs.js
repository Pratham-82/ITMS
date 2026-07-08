const mongoose = require('mongoose');

async function main() {
  const uri = 'mongodb://localhost:27017';
  try {
    const dbName = 'apexresolve_krm';
    const conn = await mongoose.createConnection(`${uri}/${dbName}`).asPromise();
    
    const slaConfigs = await conn.collection('slaconfigurations').find({}).toArray();
    console.log(`SLA Configurations (${slaConfigs.length}):`);
    slaConfigs.forEach(c => {
      console.log(` - ID: ${c._id}, isDefault: ${c.isDefault}, tenantId: ${c.tenantId}`);
      console.log(`   breachActions:`, JSON.stringify(c.breachActions));
    });

    await conn.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
