const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Asset = require('../models/Asset');
const AssetCategory = require('../models/AssetCategory');
const AssetType = require('../models/AssetType');
const Ticket = require('../models/Ticket');
const Department = require('../models/Department');

const Category = require('../models/Category');
const DepartmentCategory = require('../models/DepartmentCategory');
const GlobalUser = require('../models/GlobalUser');

const { updateAsset, getAssets } = require('../controllers/assetController');

async function run() {
  console.log('=== STARTING EDIT RESTRICTIONS VERIFICATION ===');
  try {
    await connectDB();
    console.log('Connected to MongoDB database.');

    const tenantId = 'test-edit-restrict';
    const tenantLocalStorage = require('../middleware/tenantContext');

    await tenantLocalStorage.run(tenantId, async () => {
      // Clean up previous data
      await Asset.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await AssetCategory.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await AssetType.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await Ticket.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await Department.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await Category.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await DepartmentCategory.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await User.deleteMany({ email: 'citizen@test.com' }).setOptions({ bypassTenant: true });
      await GlobalUser.deleteMany({ email: 'citizen@test.com' });

      // 1. Create a category and asset type
      const category = await AssetCategory.create({ name: 'Laptops', tenantId });
      const assetType = await AssetType.create({
        name: 'Laptops',
        assetPrefix: 'LAP',
        categoryId: category._id,
        tenantId
      });

      // 2. Create two assets
      // Asset A: has a ticket filed against it
      // Asset B: has no ticket filed against it
      const assetA = await Asset.create({
        name: 'Asset A (Has Ticket)',
        categoryId: category._id,
        assetTypeId: assetType._id,
        tenantId
      });

      const assetB = await Asset.create({
        name: 'Asset B (No Ticket)',
        categoryId: category._id,
        assetTypeId: assetType._id,
        tenantId
      });

      // Create a department and ticket referencing Asset A
      const department = await Department.create({ name: 'IT Department', tenantId });
      const standardCategory = await Category.create({ name: 'Hardware Issue', tenantId });
      await DepartmentCategory.create({
        department: department._id,
        category: standardCategory._id,
        tenantId
      });
      
      // Simulate User
      const citizen = await User.create({
        name: 'Citizen User',
        email: 'citizen@test.com',
        password: 'password123',
        role: 'citizen',
        tenantId
      });

      const ticket = await Ticket.create({
        title: 'Broken Screen',
        description: 'Screen is cracked on Asset A',
        department: department._id,
        category: standardCategory._id,
        categoryName: 'Hardware Issue',
        priority: 'High',
        status: 'Pending',
        citizen: citizen._id,
        relatedAssets: [assetA._id],
        tenantId
      });

      console.log('Created test assets, categories, department, and ticket.');

      // Test Case 1: Fetch assets and verify hasTickets boolean
      console.log('\n--- Test Case 1: Get Assets List ---');
      const reqGet = {
        query: {},
        user: { role: 'admin', tenantId }
      };
      let resGetJson = null;
      const resGet = {
        status: () => ({
          json: (data) => { resGetJson = data; }
        })
      };

      await getAssets(reqGet, resGet);
      const fetchedAssetA = resGetJson.data.find(a => a._id.toString() === assetA._id.toString());
      const fetchedAssetB = resGetJson.data.find(a => a._id.toString() === assetB._id.toString());

      console.log(`Asset A fetched 'hasTickets': ${fetchedAssetA?.hasTickets}`);
      console.log(`Asset B fetched 'hasTickets': ${fetchedAssetB?.hasTickets}`);

      if (fetchedAssetA?.hasTickets !== true) throw new Error('Asset A should have hasTickets: true');
      if (fetchedAssetB?.hasTickets !== false) throw new Error('Asset B should have hasTickets: false');
      console.log('Test Case 1 Passed!');

      // Test Case 1b: Fetch assets with hasTickets filter
      console.log('\n--- Test Case 1b: Get Assets with hasTickets=true filter ---');
      const reqGetWithTickets = {
        query: { hasTickets: 'true' },
        user: { role: 'admin', tenantId }
      };
      let resGetWithTicketsJson = null;
      const resGetWithTickets = {
        status: () => ({
          json: (data) => { resGetWithTicketsJson = data; }
        })
      };
      await getAssets(reqGetWithTickets, resGetWithTickets);
      console.log(`Assets returned with hasTickets=true filter: ${resGetWithTicketsJson.data.length}`);
      if (resGetWithTicketsJson.data.length !== 1) throw new Error('Expected exactly 1 asset with tickets');
      if (resGetWithTicketsJson.data[0]._id.toString() !== assetA._id.toString()) throw new Error('Expected Asset A to be returned');

      console.log('\n--- Test Case 1c: Get Assets with hasTickets=false filter ---');
      const reqGetWithoutTickets = {
        query: { hasTickets: 'false' },
        user: { role: 'admin', tenantId }
      };
      let resGetWithoutTicketsJson = null;
      const resGetWithoutTickets = {
        status: () => ({
          json: (data) => { resGetWithoutTicketsJson = data; }
        })
      };
      await getAssets(reqGetWithoutTickets, resGetWithoutTickets);
      console.log(`Assets returned with hasTickets=false filter: ${resGetWithoutTicketsJson.data.length}`);
      if (resGetWithoutTicketsJson.data.length !== 1) throw new Error('Expected exactly 1 asset without tickets');
      if (resGetWithoutTicketsJson.data[0]._id.toString() !== assetB._id.toString()) throw new Error('Expected Asset B to be returned');
      console.log('Test Case 1b & 1c Passed!');

      // Test Case 2: Attempt to update Asset B (should fail)
      console.log('\n--- Test Case 2: Update Asset B (No Ticket) ---');
      const reqUpdateB = {
        params: { id: assetB._id },
        body: { name: 'Asset B Updated Name' },
        user: { role: 'admin', tenantId }
      };
      let resUpdateBStatus = 0;
      let resUpdateBJson = null;
      const resUpdateB = {
        status: (code) => {
          resUpdateBStatus = code;
          return {
            json: (data) => { resUpdateBJson = data; }
          };
        }
      };

      await updateAsset(reqUpdateB, resUpdateB);
      console.log(`Update Asset B response status: ${resUpdateBStatus}`);
      console.log(`Update Asset B response message: ${resUpdateBJson?.message}`);

      if (resUpdateBStatus !== 400) throw new Error('Expected updateAsset for Asset B to fail with 400');
      if (!resUpdateBJson?.message.includes('Cannot edit this asset')) {
        throw new Error('Expected restriction error message');
      }
      console.log('Test Case 2 Passed!');

      // Test Case 3: Attempt to update Asset A (should succeed)
      console.log('\n--- Test Case 3: Update Asset A (Has Ticket) ---');
      const reqUpdateA = {
        params: { id: assetA._id },
        body: { name: 'Asset A Updated Name' },
        user: { role: 'admin', tenantId }
      };
      let resUpdateAStatus = 0;
      let resUpdateAJson = null;
      const resUpdateA = {
        status: (code) => {
          resUpdateAStatus = code;
          return {
            json: (data) => { resUpdateAJson = data; }
          };
        }
      };

      await updateAsset(reqUpdateA, resUpdateA);
      console.log(`Update Asset A response status: ${resUpdateAStatus}`);

      if (resUpdateAStatus !== 200) throw new Error('Expected updateAsset for Asset A to succeed with 200');
      
      const updatedAssetA = await Asset.findById(assetA._id);
      console.log(`Asset A new name in DB: ${updatedAssetA.name}`);
      if (updatedAssetA.name !== 'Asset A Updated Name') throw new Error('Asset A name was not updated');
      console.log('Test Case 3 Passed!');

      // Cleanup
      await Asset.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await AssetCategory.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await AssetType.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await Ticket.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await Department.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await Category.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await DepartmentCategory.deleteMany({ tenantId }).setOptions({ bypassTenant: true });
      await User.deleteMany({ email: 'citizen@test.com' }).setOptions({ bypassTenant: true });
      await GlobalUser.deleteMany({ email: 'citizen@test.com' });
    });

    console.log('\nAll edit restriction tests passed successfully!');
  } catch (error) {
    console.error('\n*** TEST ERROR ***', error);
    process.exit(1);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

run();
