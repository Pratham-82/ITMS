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

async function verifySalesMapping() {
  console.log('=== STARTING AUTOMATED INBOUND SALES WEBHOOK CUSTOM FIELD MAPPING VERIFICATION ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB database.');

    const tenantId = 'test-tenant';
    const tenantLocalStorage = require('./middleware/tenantContext');

    await tenantLocalStorage.run(tenantId, async () => {
      // 1. Cleanup old test items
      await User.deleteMany({ email: 'wh_cust_map@apex.com' }).setOptions({ bypassTenant: true });
      await Asset.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await AssetCategory.deleteMany({ name: 'Laptops', tenantId }).setOptions({ bypassTenant: true });
      await AssetType.deleteMany({ name: 'Laptops', tenantId }).setOptions({ bypassTenant: true });

      console.log('Cleaned up old test data.');

      // 2. Pre-create customer profile
      const citizen = await User.create({
        name: 'Alice Maple',
        email: 'wh_cust_map@apex.com',
        password: 'password123',
        role: 'citizen',
        tenantId
      });
      console.log(`Pre-created user ID: ${citizen._id} for email wh_cust_map@apex.com`);

      // 3. Pre-create Category & AssetType with Inbound Mapping Keys
      const category = await AssetCategory.create({
        name: 'Laptops',
        description: 'Computer inventory',
        tenantId
      });

      const assetType = await AssetType.create({
        name: 'Laptops',
        assetPrefix: 'LAP',
        categoryId: category._id,
        tenantId,
        dynamicFields: [
          {
            fieldKey: 'processor',
            label: 'Processor Model',
            type: 'text',
            required: true,
            inboundMappingKey: 'cpu'
          },
          {
            fieldKey: 'ram',
            label: 'RAM Size',
            type: 'text',
            required: true,
            inboundMappingKey: 'ram_size'
          },
          {
            fieldKey: 'storage',
            label: 'Storage Capacity',
            type: 'text',
            required: false,
            inboundMappingKey: '' // empty means fallback to fieldKey 'storage'
          }
        ]
      });

      console.log(`Configured Category "Laptops" and AssetType "Laptops" with custom mapping keys:`);
      console.log(` - fieldKey "processor" mapped to payload key "cpu"`);
      console.log(` - fieldKey "ram" mapped to payload key "ram_size"`);
      console.log(` - fieldKey "storage" mapped to fallback key "storage"`);

      // 4. Trigger purchase webhook calling purchaseAsset controller
      console.log('\n--- Testing Purchase Webhook with Dynamic Mapping ---');
      const req = {
        params: { typeName: 'Laptops' }, // specified in URL
        user: { name: 'Billing Service', role: 'admin', tenantId },
        body: {
          customerName: 'Alice Maple',
          customerEmail: 'wh_cust_map@apex.com',
          productName: 'MacBook Pro M3 Max',
          productSku: 'MBP-M3-MAX-48G',
          serialNumber: 'SN-MAC-M3MAX',
          warrantyMonths: 36,
          location: 'Remote WFH',
          
          // E-commerce fields matching dynamic keys & mappings
          cpu: 'Apple M3 Max 16-Core',
          ram_size: '48GB Unified Memory',
          storage: '1TB SSD'
        }
      };

      let responseStatus = 0;
      let responseJson = {};
      const res = {
        status: (code) => {
          responseStatus = code;
          return {
            json: (data) => {
              responseJson = data;
            }
          };
        }
      };

      await purchaseAsset(req, res);

      console.log(`Response Status: ${responseStatus}`);
      console.log(`Response JSON Message: "${responseJson.message}"`);
      console.log(`Registered Asset Code: ${responseJson.data?.assetCode}`);
      console.log(`Mapped Dynamic Values:`, JSON.stringify(responseJson.data?.dynamicValues, null, 2));

      // Assertions
      if (responseStatus !== 201) {
        throw new Error(`Expected status 201, got ${responseStatus}`);
      }
      const dyn = responseJson.data?.dynamicValues || {};
      if (dyn.processor !== 'Apple M3 Max 16-Core') {
        throw new Error(`Expected dyn.processor to be "Apple M3 Max 16-Core", got "${dyn.processor}"`);
      }
      if (dyn.ram !== '48GB Unified Memory') {
        throw new Error(`Expected dyn.ram to be "48GB Unified Memory", got "${dyn.ram}"`);
      }
      if (dyn.storage !== '1TB SSD') {
        throw new Error(`Expected dyn.storage to be "1TB SSD", got "${dyn.storage}"`);
      }
      console.log('\nAll custom fields mapped perfectly based on mapping keys and fallbacks!');

      // 5. Cleanup database data
      await User.deleteMany({ email: 'wh_cust_map@apex.com' }).setOptions({ bypassTenant: true });
      await Asset.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await AssetCategory.deleteMany({ name: 'Laptops', tenantId }).setOptions({ bypassTenant: true });
      await AssetType.deleteMany({ name: 'Laptops', tenantId }).setOptions({ bypassTenant: true });
      console.log('Cleanup completed successfully.');
    });

    console.log('\nAll custom field mapping integration tests completed successfully!');
  } catch (error) {
    console.error('\n*** TEST ERROR ***', error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
    console.log('=== ENDING SALES MAPPING VERIFICATION ===');
  }
}

verifySalesMapping();
