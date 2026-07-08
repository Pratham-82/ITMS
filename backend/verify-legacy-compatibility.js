const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Compile models
const User = require('./models/User');
const Ticket = require('./models/Ticket');
const Category = require('./models/Category');
const Department = require('./models/Department');
const DepartmentCategory = require('./models/DepartmentCategory');
const TicketType = require('./models/TicketType');

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== STARTING LEGACY COMPLAINT COMPATIBILITY INTEGRATION TESTS ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // 1. Cleanup old test data
    console.log('\n[1] Cleaning up old test data and re-seeding clean defaults...');
    await User.deleteMany({ email: { $regex: /^test_compat_/ } }).setOptions({ bypassTenant: true });
    await Ticket.deleteMany({ title: { $regex: /^Test Compat/ } }).setOptions({ bypassTenant: true });
    await Category.deleteMany({}).setOptions({ bypassTenant: true });
    await Department.deleteMany({}).setOptions({ bypassTenant: true });
    await DepartmentCategory.deleteMany({}).setOptions({ bypassTenant: true });
    
    const { seedTenantDefaults } = require('./services/tenantDefaults');
    await seedTenantDefaults('default-tenant');

    const cat = await Category.findOne({ name: 'General Inquiry' });
    const dept = await Department.findOne({ name: 'IT Support' });
    console.log('Cleanup and seeding complete.');

    if (!cat || !dept) {
      throw new Error('Could not find General Inquiry or IT Support after re-seeding.');
    }

    // 2. Seed test citizen and admin
    console.log('\n[2] Seeding test citizen and admin...');
    const citizen = await User.create({
      name: 'Test Compat Citizen',
      email: 'test_compat_cit@apex.com',
      password: 'password123',
      role: 'citizen'
    });

    const admin = await User.create({
      name: 'Test Compat Admin',
      email: 'test_compat_adm@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'General Administration'
    });

    console.log('Seed complete.');

    // 3. Login to retrieve tokens
    console.log('\n[3] Logging in to retrieve tokens...');
    const citLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_compat_cit@apex.com', password: 'password123' })
    });
    const citLoginData = await citLogin.json();
    if (!citLoginData.success) throw new Error('Citizen login failed: ' + citLoginData.message);
    const tokenCit = citLoginData.data.token;

    const admLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_compat_adm@apex.com', password: 'password123' })
    });
    const admLoginData = await admLogin.json();
    if (!admLoginData.success) throw new Error('Admin login failed: ' + admLoginData.message);
    const tokenAdm = admLoginData.data.token;

    console.log('Login complete.');

    // 4. Test Route: POST /api/complaints (Create Complaint)
    console.log('\n[4] Testing POST /api/complaints (Legacy Create Route)...');
    const createRes = await fetch(`${API_BASE}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenCit}`
      },
      body: JSON.stringify({
        title: 'Test Compat Complaint',
        description: 'Testing if legacy endpoint creates a ticket',
        category: cat._id.toString(),
        department: dept._id.toString(),
        priority: 'Medium'
      })
    });
    const createData = await createRes.json();
    if (!createData.success) throw new Error('Create complaint failed: ' + createData.message);
    const complaintId = createData.data._id;
    console.log(`Successfully created complaint with ID: ${complaintId} and trackingId: ${createData.data.trackingId}`);

    // Verify it is saved in the tickets collection and has ticketType 'Complaint'
    const ticketInDb = await Ticket.findById(complaintId).populate('ticketType');
    if (!ticketInDb) throw new Error('Ticket not found in DB!');
    if (ticketInDb.ticketType.name !== 'Complaint') throw new Error('Ticket does not have the Complaint type!');
    console.log('Verified database record matches Ticket schema and type "Complaint".');

    // 5. Test Route: GET /api/complaints (List complaints)
    console.log('\n[5] Testing GET /api/complaints (List legacy complaints)...');
    const listRes = await fetch(`${API_BASE}/complaints`, {
      headers: { 'Authorization': `Bearer ${tokenCit}` }
    });
    const listData = await listRes.json();
    if (!listData.success) throw new Error('List complaints failed: ' + listData.message);
    const found = listData.data.find(c => c._id === complaintId);
    if (!found) throw new Error('Created complaint not returned in list!');
    console.log('Successfully listed complaints and verified existence of the created ticket.');

    // 6. Test Route: GET /api/complaints/:id (Get detail)
    console.log('\n[6] Testing GET /api/complaints/:id (Get legacy complaint detail)...');
    const detailRes = await fetch(`${API_BASE}/complaints/${complaintId}`, {
      headers: { 'Authorization': `Bearer ${tokenCit}` }
    });
    const detailData = await detailRes.json();
    if (!detailData.success) throw new Error('Get detail failed: ' + detailData.message);
    if (detailData.data._id !== complaintId) throw new Error('Returned detail ID mismatch!');
    console.log('Successfully retrieved detail for ID: ' + complaintId);

    // 7. Test Route: POST /api/complaints/:id/comments (Add comment)
    console.log('\n[7] Testing POST /api/complaints/:id/comments (Add comment)...');
    const commentRes = await fetch(`${API_BASE}/complaints/${complaintId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenCit}`
      },
      body: JSON.stringify({ message: 'Legacy comment message' })
    });
    const commentData = await commentRes.json();
    if (!commentData.success) throw new Error('Add comment failed: ' + commentData.message);
    const lastComment = commentData.data[commentData.data.length - 1];
    if (lastComment.message !== 'Legacy comment message') throw new Error('Comment message mismatch!');
    console.log('Successfully added comment: ' + lastComment.message);

    // 8. Test Route: PUT /api/complaints/:id/escalate (Citizen escalate)
    console.log('\n[8] Testing PUT /api/complaints/:id/escalate (Citizen escalate)...');
    const escRes = await fetch(`${API_BASE}/complaints/${complaintId}/escalate`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenCit}`
      },
      body: JSON.stringify({ reason: 'Escalation compat reason' })
    });
    const escData = await escRes.json();
    if (!escData.success) throw new Error('Escalate failed: ' + escData.message);
    if (escData.data.status !== 'Escalated') throw new Error('Status not updated to Escalated!');
    console.log('Successfully escalated complaint.');

    // 9. Update status to resolved (admin route)
    console.log('\n[9] Resolving ticket via admin PUT /api/tickets/:id/status...');
    const statusRes = await fetch(`${API_BASE}/tickets/${complaintId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAdm}`
      },
      body: JSON.stringify({ status: 'Resolved' })
    });
    const statusData = await statusRes.json();
    if (!statusData.success) throw new Error('Resolve failed: ' + statusData.message);
    // Note: status will auto-transition to "Awaiting Feedback"
    console.log(`Successfully transitioned status. Current status: ${statusData.data.status}`);

    // 10. Test Route: POST /api/complaints/:id/feedback (Submit feedback)
    console.log('\n[10] Testing POST /api/complaints/:id/feedback (Submit feedback)...');
    const feedbackRes = await fetch(`${API_BASE}/complaints/${complaintId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenCit}`
      },
      body: JSON.stringify({
        overallRating: 5,
        comment: 'Great compat feedback!'
      })
    });
    const feedbackData = await feedbackRes.json();
    if (!feedbackData.success) throw new Error('Submit feedback failed: ' + feedbackData.message);
    if (feedbackData.data.status !== 'Resolved') throw new Error('Feedback submission did not set status to Resolved!');
    console.log('Successfully submitted feedback.');

    // 11. Test Route: POST /api/complaints/:id/reopen (Reopen request)
    console.log('\n[11] Testing POST /api/complaints/:id/reopen (Reopen request)...');
    const reopenRes = await fetch(`${API_BASE}/complaints/${complaintId}/reopen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenCit}`
      },
      body: JSON.stringify({ reason: 'Need to reopen' })
    });
    const reopenData = await reopenRes.json();
    if (!reopenData.success) throw new Error('Reopen failed: ' + reopenData.message);
    if (reopenData.data.status !== 'Reopen Requested') throw new Error('Status not set to Reopen Requested!');
    console.log('Successfully requested reopen.');

    // 12. Test Route: POST /api/complaints/:id/reopen/review (Approve reopen)
    console.log('\n[12] Testing POST /api/complaints/:id/reopen/review (Approve reopen)...');
    const reviewRes = await fetch(`${API_BASE}/complaints/${complaintId}/reopen/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAdm}`
      },
      body: JSON.stringify({ action: 'approve', comment: 'Reopening approved' })
    });
    const reviewData = await reviewRes.json();
    if (!reviewData.success) throw new Error('Reopen review failed: ' + reviewData.message);
    console.log(`Reopen review successful. New status: ${reviewData.data.status}`);

    // Cleanup mock users
    console.log('\n[Cleanup] Cleaning up test users...');
    await User.deleteMany({ email: { $regex: /^test_compat_/ } }).setOptions({ bypassTenant: true });
    console.log('Cleanup complete.');

    console.log('\n=== ALL LEGACY COMPLAINT COMPATIBILITY TESTS PASSED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('\n!!! TEST FAILURE:', err.message);
    // Cleanup mock users even on failure
    try {
      await User.deleteMany({ email: { $regex: /^test_compat_/ } }).setOptions({ bypassTenant: true });
    } catch (_) {}
    process.exit(1);
  }
}

runTests();
