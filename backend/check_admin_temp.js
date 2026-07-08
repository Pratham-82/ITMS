const connectDB = require('./config/db');
const mongoose = require('mongoose');
const User = require('./models/User');
const EscalationGroup = require('./models/EscalationGroup');
const Department = require('./models/Department');
const tenantLocalStorage = require('./middleware/tenantContext');

const checkAdmin = async () => {
  try {
    await connectDB();
    
    // Check in default-tenant
    await new Promise((resolve) => {
      tenantLocalStorage.run('default-tenant', async () => {
        const users = await User.find({});
        console.log(`=== DEFAULT-TENANT DATABASE (apexresolve) ===`);
        console.log(`Found ${users.length} users:`);
        users.forEach(u => {
          console.log(`- ${u.name} | ${u.email} | Role: ${u.role}`);
        });
        resolve();
      });
    });

    // Check in laptop tenant
    await new Promise((resolve) => {
      tenantLocalStorage.run('laptop', async () => {
        // Touch proxies to force schema compilation on the active tenant connection
        const _eg = EscalationGroup.find;
        const _d = Department.find;

        console.log(`\n=== LAPTOP TENANT DATABASE (apexresolve_laptop) ===`);
        const users = await User.find({}).populate({
          path: 'groups',
          populate: {
            path: 'department'
          }
        });
        console.log(`Found ${users.length} users:`);
        users.forEach(u => {
          console.log(`- ${u.name} | ${u.email} | Role: ${u.role}`);
          if (u.groups && u.groups.length > 0) {
            u.groups.forEach(g => {
              console.log(`  Group: ${g.name} (Dept: ${g.department ? g.department.name : 'None'})`);
            });
          }
        });

        const laptopAdmin = await User.findOne({ email: 'admin@laptop.com' }).populate({
          path: 'groups',
          populate: {
            path: 'department'
          }
        });

        if (laptopAdmin) {
          console.log('\nEvaluating superadmin status for admin@laptop.com:');
          const isSuperAdmin = laptopAdmin.role === 'admin' && (
            (laptopAdmin.groups && laptopAdmin.groups.length > 0 && laptopAdmin.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
            ((!laptopAdmin.groups || laptopAdmin.groups.length === 0) && (!laptopAdmin.department || laptopAdmin.department === 'General Administration'))
          );
          console.log('Is Superadmin:', isSuperAdmin);
        } else {
          console.log('\nUser admin@laptop.com was not found in laptop tenant.');
        }
        resolve();
      });
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error checking users:', error);
    process.exit(1);
  }
};

checkAdmin();
