const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Compile models
const User = require('./models/User');
const Asset = require('./models/Asset');
const AssetCategory = require('./models/AssetCategory');
const AssetType = require('./models/AssetType');
const { purchaseAsset } = require('./controllers/assetController');

async function verifySalesWebhook() {
  console.log('=== STARTING AUTOMATED INBOUND SALES WEBHOOK VERIFICATION ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB database.');

    const tenantId = 'test-tenant';
    const tenantLocalStorage = require('./middleware/tenantContext');

    await tenantLocalStorage.run(tenantId, async () => {
      // 1. Cleanup old test items
      await User.deleteMany({ email: 'wh_cust@apex.com' }).setOptions({ bypassTenant: true });
      await Asset.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await AssetCategory.deleteMany({ name: 'Gadgets', tenantId }).setOptions({ bypassTenant: true });
      await AssetType.deleteMany({ name: 'Gadgets', tenantId }).setOptions({ bypassTenant: true });

      console.log('Cleaned up old test data.');

      // ==============================================================
      // TEST CASE 1: Customer DOES NOT exist (Should not create user, set ownerEmail)
      // ==============================================================
      console.log('\n--- Test Case 1: Customer does not exist ---');
      
      const req1 = {
        user: { name: 'Billing Service', role: 'admin', tenantId },
        body: {
          customerName: 'Buyer Without Profile',
          customerEmail: 'wh_cust@apex.com',
          productName: 'Mock Tablet X',
          productSku: 'TAB-SKU-999',
          productCategory: 'Gadgets',
          serialNumber: 'SN-TABLET-112233',
          warrantyMonths: 24,
          location: 'HQ Office'
        }
      };

      let responseStatus1 = 0;
      let responseJson1 = {};
      const res1 = {
        status: (code) => {
          responseStatus1 = code;
          return {
            json: (data) => {
              responseJson1 = data;
            }
          };
        }
      };

      await purchaseAsset(req1, res1);

      console.log(`Response Status: ${responseStatus1}`);
      console.log(`Response JSON Message: "${responseJson1.message}"`);
      console.log(`Registered Asset Code: ${responseJson1.data?.assetCode}`);
      console.log(`Linked Owner ID: ${responseJson1.data?.owner?.id} (Expected: null)`);
      console.log(`Linked Owner Email: ${responseJson1.data?.owner?.email} (Expected: wh_cust@apex.com)`);

      // Assertions
      if (responseStatus1 !== 201) {
        throw new Error(`Expected status 201, got ${responseStatus1}`);
      }
      if (responseJson1.data?.owner?.id !== null) {
        throw new Error('Customer should not have been created, ownerId should be null');
      }

      // Check if user was accidentally created
      const checkedUser1 = await User.findOne({ email: 'wh_cust@apex.com' });
      if (checkedUser1) {
        throw new Error('User was incorrectly auto-created in database!');
      }
      console.log('Verified: No user document was auto-created.');

      // Check if Category & Type were auto-seeded
      const category = await AssetCategory.findOne({ name: 'Gadgets', tenantId });
      const assetType = await AssetType.findOne({ name: 'Gadgets', tenantId });
      if (!category || !assetType) {
        throw new Error('Category or AssetType was not auto-seeded!');
      }
      console.log('Verified: Category & AssetType were auto-seeded successfully.');

      // ==============================================================
      // TEST CASE 2: Customer DOES exist (Should link ownerId to user)
      // ==============================================================
      console.log('\n--- Test Case 2: Customer already exists ---');

      // Create the user profile first
      const citizen = await User.create({
        name: 'Citizen Buyer With Profile',
        email: 'wh_cust@apex.com',
        password: 'password123',
        role: 'citizen',
        tenantId
      });
      console.log(`Pre-created user ID: ${citizen._id} for email wh_cust@apex.com`);

      const req2 = {
        user: { name: 'Billing Service', role: 'admin', tenantId },
        body: {
          customerName: 'Citizen Buyer With Profile',
          customerEmail: 'wh_cust@apex.com',
          productName: 'Mock Phone Y',
          productSku: 'PHN-SKU-888',
          productCategory: 'Gadgets',
          serialNumber: 'SN-PHONE-445566',
          warrantyMonths: 12,
          location: 'Field Operations'
        }
      };

      let responseStatus2 = 0;
      let responseJson2 = {};
      const res2 = {
        status: (code) => {
          responseStatus2 = code;
          return {
            json: (data) => {
              responseJson2 = data;
            }
          };
        }
      };

      await purchaseAsset(req2, res2);

      console.log(`Response Status: ${responseStatus2}`);
      console.log(`Response JSON Message: "${responseJson2.message}"`);
      console.log(`Registered Asset Code: ${responseJson2.data?.assetCode}`);
      console.log(`Linked Owner ID: ${responseJson2.data?.owner?.id} (Expected: ${citizen._id})`);
      console.log(`Linked Owner Email: ${responseJson2.data?.owner?.email} (Expected: wh_cust@apex.com)`);

      // Assertions
      if (responseStatus2 !== 201) {
        throw new Error(`Expected status 201, got ${responseStatus2}`);
      }
      if (responseJson2.data?.owner?.id?.toString() !== citizen._id.toString()) {
        throw new Error(`Expected ownerId to be linked to ${citizen._id}, got ${responseJson2.data?.owner?.id}`);
      }
      console.log('Verified: Asset linked successfully to the existing user ID.');

      // 3. Cleanup database data
      await User.deleteMany({ email: 'wh_cust@apex.com' }).setOptions({ bypassTenant: true });
      await Asset.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await AssetCategory.deleteMany({ name: 'Gadgets', tenantId }).setOptions({ bypassTenant: true });
      await AssetType.deleteMany({ name: 'Gadgets', tenantId }).setOptions({ bypassTenant: true });
      console.log('\nAll test data cleaned up successfully.');
    });

    console.log('\nAll sales webhook integration tests completed successfully!');
  } catch (error) {
    console.error('\n*** TEST ERROR ***', error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
    console.log('=== ENDING SALES WEBHOOK VERIFICATION ===');
  }
}

verifySalesWebhook();
