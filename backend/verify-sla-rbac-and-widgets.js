const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Compile models after plugin registration in db.js
const User = require('./models/User');
const Complaint = require('./models/Ticket');
const Category = require('./models/Category');
const Department = require('./models/Department');
const DepartmentCategory = require('./models/DepartmentCategory');
const EscalationRule = require('./models/EscalationRule'); // Ensure registration
const Workflow = require('./models/Workflow'); // Ensure registration
const { protect, authorize, checkSettingsPermission } = require('./middleware/authMiddleware');
const { getDashboardWidgets } = require('./controllers/analyticsController');

async function testRbacAndWidgets() {
  console.log('=== STARTING SLA RBAC AND WIDGETS INTEGRATION TESTS ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // 1. Setup mock users
    await User.deleteMany({ email: { $in: ['test_super_admin@apex.com', 'test_sla_admin@apex.com', 'test_regular_admin@apex.com', 'test_citizen_widget@apex.com'] } }).setOptions({ bypassTenant: true });
    await Category.deleteMany({ name: 'Test Widget Category' }).setOptions({ bypassTenant: true });
    await Department.deleteMany({ name: 'Test Widget Department' }).setOptions({ bypassTenant: true });
    await DepartmentCategory.deleteMany({}).setOptions({ bypassTenant: true });
    
    const superAdmin = await User.create({
      name: 'Super Admin Tester',
      email: 'test_super_admin@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'General Administration'
    });

    const slaAdmin = await User.create({
      name: 'SLA Admin Tester',
      email: 'test_sla_admin@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'Finance',
      settingsPermissions: {
        allowAll: true,
        slaSettings: true
      }
    });

    const regularAdmin = await User.create({
      name: 'Regular Admin Tester',
      email: 'test_regular_admin@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'Finance',
      settingsPermissions: {
        allowAll: true,
        slaSettings: false
      }
    });

    const citizen = await User.create({
      name: 'Citizen Tester',
      email: 'test_citizen_widget@apex.com',
      password: 'password123',
      role: 'citizen'
    });

    const department = await Department.create({
      name: 'Test Widget Department',
      description: 'Department for testing SLA widgets'
    });

    const category = await Category.create({
      name: 'Test Widget Category',
      fields: []
    });

    await DepartmentCategory.create({
      department: department._id,
      category: category._id,
      isActive: true
    });

    console.log('Mock users and support models created successfully.');

    // 2. Test RBAC middleware checkSettingsPermission('slaSettings')
    console.log('\nTesting checkSettingsPermission("slaSettings") middleware...');
    
    const middleware = checkSettingsPermission('slaSettings');
    
    const testCases = [
      { user: superAdmin, expectedAllowed: true, desc: 'Super Admin (General Administration)' },
      { user: slaAdmin, expectedAllowed: true, desc: 'SLA Admin (Finance with slaSettings: true)' },
      { user: regularAdmin, expectedAllowed: false, desc: 'Regular Admin (Finance with slaSettings: false)' }
    ];

    for (const tc of testCases) {
      let allowed = false;
      let nextCalled = false;
      const mockReq = { user: tc.user };
      const mockRes = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.data = data;
          return this;
        }
      };
      
      const mockNext = () => {
        allowed = true;
        nextCalled = true;
      };

      middleware(mockReq, mockRes, mockNext);

      if (tc.expectedAllowed) {
        if (allowed && nextCalled) {
          console.log(`✓ PASSED: ${tc.desc} allowed access.`);
        } else {
          console.error(`✗ FAILED: ${tc.desc} should be allowed but was blocked. Error message:`, mockRes.data);
          process.exit(1);
        }
      } else {
        if (!allowed && mockRes.statusCode === 403) {
          console.log(`✓ PASSED: ${tc.desc} correctly blocked with 403.`);
        } else {
          console.error(`✗ FAILED: ${tc.desc} should be blocked but was allowed. Next called: ${nextCalled}, Status: ${mockRes.statusCode}`);
          process.exit(1);
        }
      }
    }

    // 3. Test getDashboardWidgets Controller
    console.log('\nTesting getDashboardWidgets Controller...');
    
    // Seed some mock complaints for dashboard queries
    await Complaint.deleteMany({ title: { $regex: /^Test Widget/ } }).setOptions({ bypassTenant: true });
    
    await Complaint.create([
      {
        trackingId: 'CMS-W1',
        title: 'Test Widget Complaint 1',
        description: 'First test widget complaint',
        citizen: citizen._id,
        category: category._id,
        categoryName: category.name,
        department: department._id,
        assignedDepartment: department.name,
        priority: 'High',
        status: 'Assigned',
        responseSlaStatus: 'Breached',
        totalBreachCount: 1,
        riskScore: 30
      },
      {
        trackingId: 'CMS-W2',
        title: 'Test Widget Complaint 2',
        description: 'Second test widget complaint',
        citizen: citizen._id,
        category: category._id,
        categoryName: category.name,
        department: department._id,
        assignedDepartment: department.name,
        priority: 'Critical',
        status: 'Investigating',
        resolutionSlaStatus: 'Breached',
        totalBreachCount: 3,
        riskScore: 75,
        executiveEscalated: true,
        executiveEscalatedAt: new Date()
      }
    ]);

    const mockReqWidgets = {
      user: superAdmin // Super admin has global view
    };
    
    let resWidgetsData = null;
    const mockResWidgets = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        resWidgetsData = data;
        return this;
      }
    };

    await getDashboardWidgets(mockReqWidgets, mockResWidgets);

    if (resWidgetsData && resWidgetsData.success) {
      console.log('✓ PASSED: getDashboardWidgets returned successfully.');
      const summary = resWidgetsData.data.summary;
      console.log('Summary metrics:', summary);
      
      if (
        summary.responseSlaBreachedCount >= 1 &&
        summary.resolutionSlaBreachedCount >= 1 &&
        summary.repeatedBreachesCount >= 1 &&
        summary.criticalRiskCount >= 1 &&
        summary.executiveEscalationsCount >= 1
      ) {
        console.log('✓ PASSED: All widget SLA & risk counts calculated correctly.');
      } else {
        console.error('✗ FAILED: Counts not matching expected seeded values.');
        process.exit(1);
      }
    } else {
      console.error('✗ FAILED: getDashboardWidgets failed:', resWidgetsData);
      process.exit(1);
    }

    // Cleanup
    await User.deleteMany({ email: { $in: ['test_super_admin@apex.com', 'test_sla_admin@apex.com', 'test_regular_admin@apex.com', 'test_citizen_widget@apex.com'] } }).setOptions({ bypassTenant: true });
    await Category.deleteMany({ name: 'Test Widget Category' }).setOptions({ bypassTenant: true });
    await Department.deleteMany({ name: 'Test Widget Department' }).setOptions({ bypassTenant: true });
    await DepartmentCategory.deleteMany({}).setOptions({ bypassTenant: true });
    await Complaint.deleteMany({ title: { $regex: /^Test Widget/ } }).setOptions({ bypassTenant: true });
    
    console.log('\n=== ALL SLA RBAC AND WIDGETS INTEGRATION TESTS PASSED! ===');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error during testing:', err);
    process.exit(1);
  }
}

testRbacAndWidgets();
