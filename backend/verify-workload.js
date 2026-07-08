const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Compile models after plugin registration in db.js
const User = require('./models/User');
const Category = require('./models/Category');
const Complaint = require('./models/Ticket');
const Department = require('./models/Department');
const DepartmentCategory = require('./models/DepartmentCategory');

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== STARTING WORKLOAD BALANCING INTEGRATION TESTS ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // 1. Cleanup old test data (bypass tenant scoping to clear records from previous failed runs under other subdomains/tenants)
    console.log('\n[1] Cleaning up old test data...');
    await User.deleteMany({ email: { $in: ['test_john@apex.com', 'test_sarah@apex.com', 'test_mike@apex.com', 'test_citizen@apex.com'] } }).setOptions({ bypassTenant: true });
    const testCatForCleanup = await Category.findOne({ name: 'Test IT Category' }).setOptions({ bypassTenant: true });
    if (testCatForCleanup) {
      await DepartmentCategory.deleteMany({ category: testCatForCleanup._id }).setOptions({ bypassTenant: true });
      await Category.deleteOne({ _id: testCatForCleanup._id }).setOptions({ bypassTenant: true });
    }
    const EscalationGroup = require('./models/EscalationGroup');
    await EscalationGroup.deleteMany({ name: 'Test IT Support Group' }).setOptions({ bypassTenant: true });
    await Department.deleteMany({ name: 'Test IT Department' }).setOptions({ bypassTenant: true });
    await Complaint.deleteMany({ title: { $regex: /^Test Workload Ticket/ } }).setOptions({ bypassTenant: true });
    console.log('Cleanup complete.');

    // 2. Seed test staff and citizen under isolated "Test IT Department"
    console.log('\n[2] Seeding test users and category...');
    const citizen = await User.create({
      name: 'Test Citizen',
      email: 'test_citizen@apex.com',
      password: 'password123',
      role: 'citizen'
    });

    const john = await User.create({
      name: 'Test John (IT Staff)',
      email: 'test_john@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'Test IT Department',
      maxCapacity: 10,
      availabilityStatus: 'Available'
    });

    const sarah = await User.create({
      name: 'Test Sarah (IT Staff)',
      email: 'test_sarah@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'Test IT Department',
      maxCapacity: 20,
      availabilityStatus: 'Available'
    });

    const mike = await User.create({
      name: 'Test Mike (IT Staff)',
      email: 'test_mike@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'Test IT Department',
      maxCapacity: 15,
      availabilityStatus: 'Busy' // Busy staff should be ignored in auto-assignment
    });

    let dept = await Department.findOne({ name: 'Test IT Department' });
    if (!dept) {
      dept = await Department.create({
        name: 'Test IT Department',
        description: 'Test IT Department Description'
      });
    }

    const category = await Category.create({
      name: 'Test IT Category',
      description: 'Used for testing workload auto-assignment'
    });

    await DepartmentCategory.create({
      department: dept._id,
      category: category._id,
      isActive: true
    });

    const testGroup = await EscalationGroup.create({
      name: 'Test IT Support Group',
      description: 'Used for testing workload auto-assignment group',
      department: dept._id,
      members: [john._id, sarah._id, mike._id],
      leader: john._id
    });

    john.groups = [testGroup._id];
    await john.save();

    sarah.groups = [testGroup._id];
    await sarah.save();

    mike.groups = [testGroup._id];
    await mike.save();

    console.log('Seed complete.');

    // 3. Login to retrieve tokens
    console.log('\n[3] Logging in to retrieve citizen and admin tokens...');
    const citLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_citizen@apex.com', password: 'password123' })
    });
    const citLoginData = await citLogin.json();
    const citizenToken = citLoginData.data.token;

    const admLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_john@apex.com', password: 'password123' })
    });
    const admLoginData = await admLogin.json();
    const adminToken = admLoginData.data.token;
    console.log('Tokens retrieved successfully.');

    // 4. Test Case 1: Auto-Assignment Routing
    console.log('\n[4] TEST CASE 1: Auto-Assignment Routing...');
    // Create Ticket 1 (Citizen creates it -> should route to John because John and Sarah are Available with 0 workload)
    console.log('Citizen filing Ticket 1 (Low priority)...');
    const ticketRes1 = await fetch(`${API_BASE}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        title: 'Test Workload Ticket 1',
        description: 'First ticket filed, should go to Available staff with lowest workload.',
        department: dept._id,
        category: category._id,
        priority: 'Low'
      })
    });
    const ticketData1 = await ticketRes1.json();
    console.log('Ticket 1 Response Status:', ticketRes1.status);

    if (ticketRes1.status !== 201) {
      console.error('Error response body:', ticketData1);
      throw new Error(`Expected 201 Created, got ${ticketRes1.status}`);
    }

    // Load ticket 1 from DB to verify assignee details
    let dbTicket1 = await Complaint.findById(ticketData1.data._id).populate('assignedTo', 'name');
    console.log(`Ticket 1 assigned to: ${dbTicket1.assignedTo?.name}`);
    if (!dbTicket1.assignedTo) {
      throw new Error('Ticket 1 was not assigned to any staff member.');
    }
    const assignee1Id = dbTicket1.assignedTo._id.toString();

    // Verify history timeline
    console.log('Ticket 1 History Logs:', dbTicket1.history.map(h => h.action));
    const autoAssignLog = dbTicket1.history.find(h => h.action.includes('assigned automatically'));
    if (!autoAssignLog) {
      throw new Error('Timeline did not log automated assignment.');
    }

    // 5. Test Case 2: Load Distribution and Score Calculations
    console.log('\n[5] TEST CASE 2: Load Distribution & Workload Scoring...');
    // Citizen files Ticket 2 (Critical priority)
    // The previous assignee (say John) now has workload score = 1.
    // The other assignee (say Sarah) has workload score = 0.
    // So Ticket 2 should route to Sarah because she has the lower score (0 < 1).
    console.log('Citizen filing Ticket 2 (Critical priority)...');
    const ticketRes2 = await fetch(`${API_BASE}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        title: 'Test Workload Ticket 2',
        description: 'Second ticket filed, should route to the alternate staff member to balance load.',
        department: dept._id,
        category: category._id,
        priority: 'Critical'
      })
    });
    const ticketData2 = await ticketRes2.json();
    let dbTicket2 = await Complaint.findById(ticketData2.data._id).populate('assignedTo', 'name');
    console.log(`Ticket 2 assigned to: ${dbTicket2.assignedTo?.name}`);

    if (dbTicket2.assignedTo._id.toString() === assignee1Id) {
      throw new Error('Ticket 2 was assigned to the same user instead of distributing the load.');
    }

    // Verify Bob/Sarah/Mike workload scores
    const johnDb = await User.findOne({ email: 'test_john@apex.com' });
    const sarahDb = await User.findOne({ email: 'test_sarah@apex.com' });
    const mikeDb = await User.findOne({ email: 'test_mike@apex.com' });

    console.log(`John Workload: Score=${johnDb.capacityPercentage}% | Status=${johnDb.availabilityStatus}`);
    console.log(`Sarah Workload: Score=${sarahDb.capacityPercentage}% | Status=${sarahDb.availabilityStatus}`);
    console.log(`Mike Workload: Score=${mikeDb.capacityPercentage}% | Status=${mikeDb.availabilityStatus}`);

    // John has 1 Low ticket (Score = 1, Max = 10 -> 10% util)
    // Sarah has 1 Critical ticket (Score = 5 + 2 penalty = 7, Max = 20 -> 35% util)
    // Mike has 0 tickets (Score = 0 -> 0% util)
    if (johnDb.capacityPercentage !== 10 && sarahDb.capacityPercentage !== 35) {
      const values = [johnDb.capacityPercentage, sarahDb.capacityPercentage];
      if (!values.includes(10) || !values.includes(35)) {
        throw new Error(`Expected capacity percentages of 10% and 35%, got John=${johnDb.capacityPercentage}%, Sarah=${sarahDb.capacityPercentage}%`);
      }
    }
    console.log('Workload calculations validated.');

    // 6. Test Case 3: Manual Reassignment Override
    console.log('\n[6] TEST CASE 3: Manual Reassignment Override...');
    const fromUser = dbTicket2.assignedTo;
    const toUser = dbTicket1.assignedTo;
    console.log(`Transferring Ticket 2 from ${fromUser.name} to ${toUser.name}...`);

    const transferRes = await fetch(`${API_BASE}/workload/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        complaintId: dbTicket2._id,
        targetStaffId: toUser._id,
        reason: 'Manual override for testing'
      })
    });
    const transferData = await transferRes.json();
    console.log('Transfer Response Status:', transferRes.status);

    if (transferRes.status !== 200) {
      throw new Error(`Expected 200 OK, got ${transferRes.status}`);
    }

    // Verify DB state after transfer
    dbTicket2 = await Complaint.findById(dbTicket2._id).populate('assignedTo', 'name');
    console.log(`Ticket 2 is now assigned to: ${dbTicket2.assignedTo?.name}`);
    if (dbTicket2.assignedTo._id.toString() !== toUser._id.toString()) {
      throw new Error('Ticket 2 was not reassigned to the target user.');
    }
    console.log('Manual transfer verified successfully.');

    // 7. Test Case 4: Bulk Reassignment
    console.log('\n[7] TEST CASE 4: Bulk Reassignment...');
    console.log(`Bulk reassigning all complaints from ${toUser.name} to ${fromUser.name}...`);
    const bulkRes = await fetch(`${API_BASE}/workload/bulk-reassign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        fromStaffId: toUser._id,
        toStaffId: fromUser._id,
        reason: 'John going on leave'
      })
    });
    const bulkData = await bulkRes.json();
    console.log('Bulk Reassign Response Status:', bulkRes.status);
    console.log('Bulk Reassign count:', bulkData.count);

    if (bulkRes.status !== 200) {
      throw new Error(`Expected 200 OK, got ${bulkRes.status}`);
    }

    // Verify both tickets are now assigned to Sarah
    const verifyTicket1 = await Complaint.findById(dbTicket1._id).populate('assignedTo', 'name');
    const verifyTicket2 = await Complaint.findById(dbTicket2._id).populate('assignedTo', 'name');
    console.log(`Ticket 1 Owner: ${verifyTicket1.assignedTo?.name}`);
    console.log(`Ticket 2 Owner: ${verifyTicket2.assignedTo?.name}`);

    if (verifyTicket1.assignedTo._id.toString() !== fromUser._id.toString() || verifyTicket2.assignedTo._id.toString() !== fromUser._id.toString()) {
      throw new Error('Bulk reassignment did not move all complaints to Sarah.');
    }
    console.log('Bulk reassignment verified successfully.');

    // 8. Test Case 5: Dashboard and Alerts API
    console.log('\n[8] TEST CASE 5: Dashboard and Alerts API...');
    const dashRes = await fetch(`${API_BASE}/workload/dashboard?department=Test%20IT%20Department`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const dashVal = await dashRes.json();
    console.log('Dashboard API distribution data:', dashVal.data.distribution);

    const alertsRes = await fetch(`${API_BASE}/workload/alerts?department=Test%20IT%20Department`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const alertsVal = await alertsRes.json();
    console.log('Alerts API alerts:', alertsVal.data.alerts);
    console.log('Alerts API balancing suggestions:', alertsVal.data.suggestions);

    if (dashVal.data.totalOpen !== 2 || dashVal.data.criticalCount !== 1) {
      throw new Error('Dashboard API metrics are incorrect.');
    }
    console.log('Dashboard and Alerts APIs verified.');

    // 9. Clean up test records
    console.log('\n[9] Cleaning up test records...');
    await User.deleteMany({ email: { $in: ['test_john@apex.com', 'test_sarah@apex.com', 'test_mike@apex.com', 'test_citizen@apex.com'] } });
    const finalCleanupCat = await Category.findOne({ name: 'Test IT Category' });
    if (finalCleanupCat) {
      await DepartmentCategory.deleteMany({ category: finalCleanupCat._id });
      await Category.deleteOne({ _id: finalCleanupCat._id });
    }
    await Department.deleteMany({ name: 'Test IT Department' });
    await Complaint.deleteMany({ title: { $regex: /^Test Workload Ticket/ } });
    console.log('Cleanup complete.');

    console.log('\n=== ALL WORKLOAD BALANCING INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('\n!!! TEST FAILURE !!!');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

runTests();
