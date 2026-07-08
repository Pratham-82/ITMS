const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Compile models after plugin registration in db.js
const User = require('./models/User');
const Category = require('./models/Category');
const Complaint = require('./models/Ticket');
const DuplicateGroup = require('./models/DuplicateGroup');
const DuplicateAuditLog = require('./models/DuplicateAuditLog');
const Department = require('./models/Department');
const DepartmentCategory = require('./models/DepartmentCategory');

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== STARTING AI DUPLICATE ENGINE INTEGRATION TESTS ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // 1. Cleanup old test data (bypass tenant scoping to clear records from previous failed runs under other subdomains/tenants)
    console.log('\n[1] Cleaning up old test data...');
    await User.deleteMany({ email: { $regex: /^test_dup_/ } }).setOptions({ bypassTenant: true });
    const testCatForCleanup = await Category.findOne({ name: 'Test Duplicate Category' }).setOptions({ bypassTenant: true });
    if (testCatForCleanup) {
      await DepartmentCategory.deleteMany({ category: testCatForCleanup._id }).setOptions({ bypassTenant: true });
      await Category.deleteOne({ _id: testCatForCleanup._id }).setOptions({ bypassTenant: true });
    }
    await Complaint.deleteMany({ title: { $regex: /^Test Dup Master/ } }).setOptions({ bypassTenant: true });
    await Complaint.deleteMany({ title: { $regex: /^Test Dup Slave/ } }).setOptions({ bypassTenant: true });
    await DuplicateGroup.deleteMany({}).setOptions({ bypassTenant: true });
    await DuplicateAuditLog.deleteMany({}).setOptions({ bypassTenant: true });
    console.log('Cleanup complete.');

    // 2. Seed test citizens and admin
    console.log('\n[2] Seeding test users and category...');
    const citizenMain = await User.create({
      name: 'Test Dup Citizen Main',
      email: 'test_dup_cit_main@apex.com',
      password: 'password123',
      role: 'citizen'
    });

    const citizenOther = await User.create({
      name: 'Test Dup Citizen Other',
      email: 'test_dup_cit_other@apex.com',
      password: 'password123',
      role: 'citizen'
    });

    const admin = await User.create({
      name: 'Test Dup Admin',
      email: 'test_dup_admin@apex.com',
      password: 'password123',
      role: 'admin'
    });

    let dept = await Department.findOne({ name: 'General Administration' });
    if (!dept) {
      dept = await Department.create({
        name: 'General Administration',
        description: 'General Administration Department'
      });
    }

    const category = await Category.create({
      name: 'Test Duplicate Category',
      description: 'Used for testing duplicate detection'
    });

    await DepartmentCategory.create({
      department: dept._id,
      category: category._id,
      isActive: true
    });
    console.log('Seed complete.');

    // 3. Login to retrieve tokens
    console.log('\n[3] Logging in to retrieve tokens...');
    const citMainLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_dup_cit_main@apex.com', password: 'password123' })
    });
    const citMainLoginData = await citMainLogin.json();
    const tokenCitMain = citMainLoginData.data.token;

    const citOtherLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_dup_cit_other@apex.com', password: 'password123' })
    });
    const citOtherLoginData = await citOtherLogin.json();
    const tokenCitOther = citOtherLoginData.data.token;

    const admLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_dup_admin@apex.com', password: 'password123' })
    });
    const admLoginData = await admLogin.json();
    const tokenAdmin = admLoginData.data.token;
    console.log('Tokens retrieved successfully.');

    // 4. Test Case 1: Create Master Complaint
    console.log('\n[4] TEST CASE 1: Creating Master Complaint...');
    const ticketRes1 = await fetch(`${API_BASE}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCitMain}`
      },
      body: JSON.stringify({
        title: 'Test Dup Master: AC Broken in Room 301',
        description: 'The air conditioning unit in Block B Room 301 is blowing hot air and making noise.',
        department: dept._id,
        category: category._id,
        priority: 'Low'
      })
    });
    const ticketData1 = await ticketRes1.json();
    const masterId = ticketData1.data._id;
    console.log(`Created Master Ticket: ${ticketData1.data.trackingId} (ID: ${masterId})`);

    const dbTicket = await Complaint.findById(masterId);
    console.log('Master Ticket in DB:', {
      _id: dbTicket._id,
      status: dbTicket.status,
      assignedDepartment: dbTicket.assignedDepartment,
      isDuplicate: dbTicket.isDuplicate
    });

    // Wait a brief moment to allow background embedding to finish (if active)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 5. Test Case 2: Live Duplicate Check
    console.log('\n[5] TEST CASE 2: Verifying Live Duplicate Search...');
    const checkRes = await fetch(`${API_BASE}/duplicates/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCitOther}`
      },
      body: JSON.stringify({
        title: 'Test Dup Master: AC Broken in Room 301',
        description: 'The air conditioning unit in Block B Room 301 is blowing hot air and making noise.',
        categoryId: category._id,
        departmentName: 'General Administration'
      })
    });
    const checkData = await checkRes.json();
    console.log('Duplicate check results:');
    checkData.data.forEach(match => {
      console.log(`- Match: ${match.trackingId} "${match.title}" | Similarity: ${(match.similarityScore * 100).toFixed(1)}% | Level: ${match.matchLevel}`);
    });
    
    const matchedMaster = checkData.data.find(m => m.complaintId.toString() === masterId.toString());
    if (matchedMaster) {
      console.log('PASS: Found the master ticket in similarity check results.');
    } else {
      throw new Error('FAIL: Master ticket was not matched in similarity check.');
    }

    // 6. Test Case 3: Join Complaint
    console.log('\n[6] TEST CASE 3: Joining Master Ticket as Supporter...');
    const joinRes = await fetch(`${API_BASE}/duplicates/${masterId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCitOther}`
      },
      body: JSON.stringify({
        remarks: 'My desk is next to this unit and it is extremely uncomfortable.'
      })
    });
    const joinData = await joinRes.json();
    console.log('Join Response:', joinData.message);
    if (joinData.success && joinData.data.supportersCount === 1) {
      console.log('PASS: Supporter successfully joined and count is 1.');
    } else {
      throw new Error('FAIL: Supporter joining failed.');
    }

    // 7. Test Case 4: Priority Auto-Escalation Thresholds
    console.log('\n[7] TEST CASE 4: Testing Priority Auto-Escalation Thresholds...');
    // We will directly manipulate database arrays to test the thresholds 10, 25, and 50
    // so we don't have to create dozens of accounts.
    const masterTicket = await Complaint.findById(masterId);
    
    // Threshold 10: Set supporters count to 9 and trigger a join
    console.log('Mocks: Injecting 9 supporters into the database...');
    masterTicket.supporters = Array.from({ length: 9 }, (_, i) => ({
      userId: new mongoose.Types.ObjectId(),
      userName: `Mock Supporter ${i}`,
      joinDate: new Date(),
      remarks: 'Mock remark'
    }));
    await masterTicket.save();

    console.log('Action: Performing 10th citizen join to trigger Medium priority escalation...');
    const citizen10 = await User.create({
      name: 'Test Dup Citizen 10',
      email: 'test_dup_cit_10@apex.com',
      password: 'password123',
      role: 'citizen'
    });
    const login10 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_dup_cit_10@apex.com', password: 'password123' })
    });
    const loginData10 = await login10.json();
    
    const join10Res = await fetch(`${API_BASE}/duplicates/${masterId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData10.data.token}`
      },
      body: JSON.stringify({ remarks: 'Need this fixed ASAP.' })
    });
    const join10Data = await join10Res.json();
    console.log(`Result: Count = ${join10Data.data.supportersCount}, Priority = ${join10Data.data.priority}`);
    if (join10Data.data.priority === 'Medium') {
      console.log('PASS: Ticket escalated to Medium priority at 10 supporters.');
    } else {
      throw new Error('FAIL: Priority escalation to Medium failed.');
    }

    // Threshold 25: Set supporters count to 24 and trigger a join
    console.log('Mocks: Injecting 24 supporters into the database...');
    const updatedTicket = await Complaint.findById(masterId);
    updatedTicket.supporters = Array.from({ length: 24 }, (_, i) => ({
      userId: new mongoose.Types.ObjectId(),
      userName: `Mock Supporter ${i}`,
      joinDate: new Date(),
      remarks: 'Mock remark'
    }));
    await updatedTicket.save();

    console.log('Action: Performing 25th citizen join to trigger High priority escalation...');
    const citizen25 = await User.create({
      name: 'Test Dup Citizen 25',
      email: 'test_dup_cit_25@apex.com',
      password: 'password123',
      role: 'citizen'
    });
    const login25 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_dup_cit_25@apex.com', password: 'password123' })
    });
    const loginData25 = await login25.json();
    
    const join25Res = await fetch(`${API_BASE}/duplicates/${masterId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData25.data.token}`
      },
      body: JSON.stringify({ remarks: 'Office temperature is 80 degrees.' })
    });
    const join25Data = await join25Res.json();
    console.log(`Result: Count = ${join25Data.data.supportersCount}, Priority = ${join25Data.data.priority}`);
    if (join25Data.data.priority === 'High') {
      console.log('PASS: Ticket escalated to High priority at 25 supporters.');
    } else {
      throw new Error('FAIL: Priority escalation to High failed.');
    }

    // Threshold 50: Set supporters count to 49 and trigger a join
    console.log('Mocks: Injecting 49 supporters into the database...');
    const updatedTicket2 = await Complaint.findById(masterId);
    updatedTicket2.supporters = Array.from({ length: 49 }, (_, i) => ({
      userId: new mongoose.Types.ObjectId(),
      userName: `Mock Supporter ${i}`,
      joinDate: new Date(),
      remarks: 'Mock remark'
    }));
    await updatedTicket2.save();

    console.log('Action: Performing 50th citizen join to trigger Critical priority escalation...');
    const citizen50 = await User.create({
      name: 'Test Dup Citizen 50',
      email: 'test_dup_cit_50@apex.com',
      password: 'password123',
      role: 'citizen'
    });
    const login50 = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_dup_cit_50@apex.com', password: 'password123' })
    });
    const loginData50 = await login50.json();
    
    const join50Res = await fetch(`${API_BASE}/duplicates/${masterId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData50.data.token}`
      },
      body: JSON.stringify({ remarks: 'Critical server rooms overheating!' })
    });
    const join50Data = await join50Res.json();
    console.log(`Result: Count = ${join50Data.data.supportersCount}, Priority = ${join50Data.data.priority}`);
    if (join50Data.data.priority === 'Critical') {
      console.log('PASS: Ticket escalated to Critical priority at 50 supporters.');
    } else {
      throw new Error('FAIL: Priority escalation to Critical failed.');
    }

    // 8. Test Case 5: Merge Duplicate Tickets
    console.log('\n[8] TEST CASE 5: Merging Duplicate Tickets (Admin)...');
    // Create a duplicate/slave ticket
    const ticketRes2 = await fetch(`${API_BASE}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCitOther}`
      },
      body: JSON.stringify({
        title: 'Test Dup Slave: AC not working',
        description: 'AC unit is dead, please fix.',
        department: dept._id,
        category: category._id,
        priority: 'Low'
      })
    });
    const ticketData2 = await ticketRes2.json();
    const slaveId = ticketData2.data._id;
    console.log(`Created Slave Ticket: ${ticketData2.data.trackingId} (ID: ${slaveId})`);

    // Call Merge endpoint
    const mergeRes = await fetch(`${API_BASE}/duplicates/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        masterComplaintId: masterId,
        duplicateComplaintIds: [slaveId],
        reason: 'Consolidating duplicated complaints.'
      })
    });
    const mergeData = await mergeRes.json();
    console.log('Merge Response:', mergeData.message);
    if (mergeData.success) {
      console.log('PASS: Merge execution completed successfully.');
    } else {
      throw new Error('FAIL: Merging tickets failed.');
    }

    // Validate in database
    const mergedSlave = await Complaint.findById(slaveId);
    if (mergedSlave.isDuplicate && mergedSlave.status === 'Closed' && mergedSlave.parentTicketId.toString() === masterId.toString()) {
      console.log('PASS: Slave ticket marked correctly as closed duplicate in Database.');
    } else {
      throw new Error('FAIL: Slave ticket status after merge is incorrect.');
    }

    const mergedMasterDoc = await Complaint.findById(masterId);
    if (mergedMasterDoc.mergedTickets.some(m => m.ticketId.toString() === slaveId.toString())) {
      console.log('PASS: Master ticket references the merged duplicate slave ID.');
    } else {
      throw new Error('FAIL: Master ticket does not reference slave ID.');
    }

    // 9. Test Case 6: Audit Logs
    console.log('\n[9] TEST CASE 6: Verifying Audit Log Entries...');
    const auditRes = await fetch(`${API_BASE}/duplicates/audits`, {
      headers: {
        Authorization: `Bearer ${tokenAdmin}`
      }
    });
    const auditData = await auditRes.json();
    console.log(`Found ${auditData.data.length} audit logs.`);
    const actions = auditData.data.map(l => l.action);
    console.log('Audit actions found:', actions);
    if (actions.includes('COMPLAINT_JOINED') && actions.includes('COMPLAINT_MERGED') && actions.includes('PRIORITY_CHANGED')) {
      console.log('PASS: Audit logs contain joining, merging, and priority escalation events.');
    } else {
      throw new Error('FAIL: Auditing is incomplete.');
    }

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY ===');
  } catch (err) {
    console.error('\n!!! TEST RUN FAILED !!!');
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

runTests();
