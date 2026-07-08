const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Compile models after plugin registration in db.js
const User = require('./models/User');
const Category = require('./models/Category');
const Complaint = require('./models/Ticket');
const Workflow = require('./models/Workflow');
const Department = require('./models/Department');
const DepartmentCategory = require('./models/DepartmentCategory');

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== STARTING CUSTOM WORKFLOW INTEGRATION TESTS ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // 1. Cleanup old test data (bypass tenant scoping to clear records from previous failed runs under other subdomains/tenants)
    console.log('\n[1] Cleaning up old test data...');
    await User.deleteMany({ email: { $in: ['wf_citizen@apex.com', 'wf_admin@apex.com'] } }).setOptions({ bypassTenant: true });
    const testCatForCleanup = await Category.findOne({ name: 'Test Workflow Category' }).setOptions({ bypassTenant: true });
    if (testCatForCleanup) {
      await DepartmentCategory.deleteMany({ category: testCatForCleanup._id }).setOptions({ bypassTenant: true });
      await Category.deleteOne({ _id: testCatForCleanup._id }).setOptions({ bypassTenant: true });
    }
    await Complaint.deleteMany({ title: { $regex: /^Test Workflow Ticket/ } }).setOptions({ bypassTenant: true });
    await Workflow.deleteMany({ workflowName: 'Test Workflow Category Workflow' }).setOptions({ bypassTenant: true });
    console.log('Cleanup complete.');

    // Get valid departments
    const itDept = await Department.findOne({ name: 'IT & Technical Services' }) || await Department.create({ name: 'IT & Technical Services', description: 'IT Dept' });
    const billingDept = await Department.findOne({ name: 'Billing & Payments' }) || await Department.create({ name: 'Billing & Payments', description: 'Billing Dept' });

    // 2. Seed test staff, citizen and category
    console.log('\n[2] Seeding test users and category...');
    const citizen = await User.create({
      name: 'Workflow Citizen',
      email: 'wf_citizen@apex.com',
      password: 'password123',
      role: 'citizen'
    });

    const admin = await User.create({
      name: 'Workflow Admin',
      email: 'wf_admin@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'General Administration',
      settingsPermissions: {
        allowAll: true,
        escalationRules: true,
        systemSettings: true,
        escalationAnalytics: true,
        manageFields: true,
        manageStaff: true,
        manageDepartments: true
      }
    });

    const category = await Category.create({
      name: 'Test Workflow Category',
      description: 'Used for testing custom state machines'
    });

    await DepartmentCategory.create({
      department: itDept._id,
      category: category._id,
      isActive: true
    });

    await DepartmentCategory.create({
      department: billingDept._id,
      category: category._id,
      isActive: true
    });
    console.log('Seed complete.');

    // 3. Login to retrieve tokens
    console.log('\n[3] Logging in to retrieve tokens...');
    const citLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wf_citizen@apex.com', password: 'password123' })
    });
    const citLoginData = await citLogin.json();
    const citizenToken = citLoginData.data.token;

    const admLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wf_admin@apex.com', password: 'password123' })
    });
    const admLoginData = await admLogin.json();
    const adminToken = admLoginData.data.token;
    console.log('Tokens retrieved successfully.');

    // 4. Create Custom Workflow with transitions
    console.log('\n[4] Creating custom workflow with transitions for the test category...');
    const workflowPayload = {
      workflowName: 'Test Workflow Category Workflow',
      categoryId: category._id,
      states: [
        { name: 'Pending', description: 'Newly filed complaint', isReserved: true },
        { name: 'Diagnostic', description: 'Under active diagnosis', isReserved: false },
        { name: 'Awaiting Feedback', description: 'Awaiting feedback', isReserved: true },
        { name: 'Closed', description: 'Ticket is closed', isReserved: true },
        { name: 'Reopen Requested', description: 'Reopen requested by citizen', isReserved: true }
      ],
      transitions: [
        { 
          fromState: 'Pending', 
          toState: 'Diagnostic', 
          label: 'Start Diagnostic Scan', 
          allowedRole: 'admin', 
          actions: {} 
        },
        { 
          fromState: 'Diagnostic', 
          toState: 'Awaiting Feedback', 
          label: 'Resolve Issue', 
          allowedRole: 'admin', 
          actions: {
            autoRouteToDepartment: 'Billing & Payments',
            escalationDurationHours: 24
          } 
        },
        { 
          fromState: 'Awaiting Feedback', 
          toState: 'Closed', 
          label: 'Accept & Close', 
          allowedRole: 'citizen', 
          actions: {} 
        }
      ]
    };

    const wfRes = await fetch(`${API_BASE}/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(workflowPayload)
    });
    const wfData = await wfRes.json();
    console.log('Workflow Creation status:', wfRes.status);
    if (wfRes.status !== 201) {
      throw new Error(`Failed to create custom workflow: ${wfData.message}`);
    }
    console.log('Custom workflow created successfully.');

    // 5. File a complaint under the Category
    console.log('\n[5] Citizen filing ticket under custom category...');
    const compRes = await fetch(`${API_BASE}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        title: 'Test Workflow Ticket 1',
        description: 'Testing the state machine rules.',
        department: itDept._id,
        category: category._id,
        priority: 'Medium'
      })
    });
    const compData = await compRes.json();
    console.log('Ticket creation status:', compRes.status);
    if (compRes.status !== 201) {
      throw new Error(`Failed to create ticket: ${compData.message}`);
    }
    const ticketId = compData.data._id;
    console.log(`Ticket filed. Status: ${compData.data.status} | Department: ${compData.data.assignedDepartment}`);

    // Verify initial status is Pending
    if (compData.data.status !== 'Pending') {
      throw new Error(`Expected initial status to be "Pending", got "${compData.data.status}"`);
    }

    // 6. Test invalid status transition (straight to Closed)
    console.log('\n[6] Testing invalid transition (Pending -> Closed)...');
    const invalidRes = await fetch(`${API_BASE}/complaints/${ticketId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Closed' })
    });
    const invalidData = await invalidRes.json();
    console.log('Invalid transition status (should fail):', invalidRes.status);
    console.log('Response message:', invalidData.message);
    if (invalidRes.status === 200) {
      throw new Error('Allowed an invalid transition that was not defined.');
    }

    // 7. Perform valid status transition (Pending -> Diagnostic) as Admin
    console.log('\n[7] Executing status transition (Pending -> Diagnostic) by Admin...');
    const transRes1 = await fetch(`${API_BASE}/complaints/${ticketId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Diagnostic' })
    });
    const transData1 = await transRes1.json();
    console.log('Transition status:', transRes1.status);
    if (transRes1.status !== 200) {
      throw new Error(`Failed valid transition: ${transData1.message}`);
    }
    console.log('Complaint status updated to:', transData1.data.status);
    if (transData1.data.status !== 'Diagnostic') {
      throw new Error(`Expected status to change to "Diagnostic", got "${transData1.data.status}"`);
    }

    // 8. Test role restriction (Diagnostic -> Awaiting Feedback by Citizen - should fail)
    console.log('\n[8] Testing role restriction (Diagnostic -> Awaiting Feedback as Citizen)...');
    const unauthorizedRes = await fetch(`${API_BASE}/complaints/${ticketId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`
      },
      body: JSON.stringify({ status: 'Awaiting Feedback' })
    });
    const unauthorizedData = await unauthorizedRes.json();
    console.log('Unauthorized transition status (should fail):', unauthorizedRes.status);
    console.log('Response message:', unauthorizedData.message);
    if (unauthorizedRes.status === 200) {
      throw new Error('Allowed an unauthorized role to execute transition.');
    }

    // 9. Execute valid transition with auto-actions (Diagnostic -> Awaiting Feedback as Admin)
    console.log('\n[9] Executing transition with auto-routing & SLA reset (Diagnostic -> Awaiting Feedback as Admin)...');
    const transRes2 = await fetch(`${API_BASE}/complaints/${ticketId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Awaiting Feedback' })
    });
    const transData2 = await transRes2.json();
    console.log('Transition status:', transRes2.status);
    if (transRes2.status !== 200) {
      throw new Error(`Failed transition with auto-actions: ${transData2.message}`);
    }

    // Load ticket from DB to verify status, assignment routing, and SLA
    const dbTicket = await Complaint.findById(ticketId);
    console.log(`DB Verification: Status: ${dbTicket.status} | AssignedDepartment: ${dbTicket.assignedDepartment} | nextEscalationDueAt: ${dbTicket.nextEscalationDueAt}`);
    
    // Status should be Awaiting Feedback
    if (dbTicket.status !== 'Awaiting Feedback') {
      throw new Error(`Expected status to change to "Awaiting Feedback", got "${dbTicket.status}"`);
    }
    // Department should be "Billing & Payments"
    if (dbTicket.assignedDepartment !== 'Billing & Payments') {
      throw new Error(`Expected department to be auto-routed to "Billing & Payments", got "${dbTicket.assignedDepartment}"`);
    }
    // nextEscalationDueAt should be set
    if (!dbTicket.nextEscalationDueAt) {
      throw new Error(`Expected SLA nextEscalationDueAt to be reset, but it is null/undefined`);
    }

    console.log('Auto-actions verified successfully.');

    // 9.5 Test General Manual Escalation with direct assignment (assigned to anyone)
    console.log('\n[9.5] Testing General Manual Escalation with direct assignment...');
    const compRes2 = await fetch(`${API_BASE}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        title: 'Test Workflow Ticket 2',
        description: 'Testing general manual escalation.',
        department: itDept._id,
        category: category._id,
        priority: 'Medium'
      })
    });
    const compData2 = await compRes2.json();
    const ticketId2 = compData2.data._id;
    console.log(`Second ticket filed. Status: ${compData2.data.status}`);

    const escRes = await fetch(`${API_BASE}/complaints/${ticketId2}/escalate-manual`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ 
        reason: 'Manually Escalated to Admin for test',
        assigneeId: admin._id
      })
    });
    const escData = await escRes.json();
    console.log('Manual Escalation API status:', escRes.status);
    if (escRes.status !== 200) {
      throw new Error(`Failed manual escalation: ${escData.message}`);
    }

    const dbTicket2 = await Complaint.findById(ticketId2);
    console.log(`DB Verification: Status: ${dbTicket2.status} | AssignedTo: ${dbTicket2.assignedTo} | Priority: ${dbTicket2.priority} | isEscalated: ${dbTicket2.isEscalated}`);
    if (dbTicket2.status !== 'Escalated') {
      throw new Error(`Expected status to be "Escalated", got "${dbTicket2.status}"`);
    }
    if (dbTicket2.priority !== 'High') {
      throw new Error(`Expected priority to be "High", got "${dbTicket2.priority}"`);
    }
    if (dbTicket2.isEscalated !== true) {
      throw new Error(`Expected isEscalated to be true, got "${dbTicket2.isEscalated}"`);
    }
    if (dbTicket2.assignedTo.toString() !== admin._id.toString()) {
      throw new Error(`Expected assignee to be admin ID ${admin._id}, got "${dbTicket2.assignedTo}"`);
    }
    console.log('General manual escalation verified successfully.');

    // 10. Clean up test records
    console.log('\n[10] Cleaning up test records...');
    await User.deleteMany({ email: { $in: ['wf_citizen@apex.com', 'wf_admin@apex.com'] } });
    const finalWfCleanupCat = await Category.findOne({ name: 'Test Workflow Category' });
    if (finalWfCleanupCat) {
      await DepartmentCategory.deleteMany({ category: finalWfCleanupCat._id });
      await Category.deleteOne({ _id: finalWfCleanupCat._id });
    }
    await Complaint.deleteMany({ title: { $regex: /^Test Workflow Ticket/ } });
    await Workflow.deleteMany({ workflowName: 'Test Workflow Category Workflow' });
    console.log('Cleanup complete.');

    console.log('\n=== ALL CUSTOM WORKFLOW INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
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
