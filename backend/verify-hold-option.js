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
const TicketService = require('./services/ticketService');
const EscalationWorker = require('./services/escalation/EscalationWorker');

async function testHoldOption() {
  console.log('=== STARTING HOLD OPTION INTEGRATION TESTS ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // 1. Setup mock data
    await User.deleteMany({ email: 'test_citizen_hold@apex.com' }).setOptions({ bypassTenant: true });
    await Category.deleteMany({ name: 'Test Hold Category' }).setOptions({ bypassTenant: true });
    await Department.deleteMany({ name: 'Test Hold Department' }).setOptions({ bypassTenant: true });
    await DepartmentCategory.deleteMany({}).setOptions({ bypassTenant: true });
    
    const citizen = await User.create({
      name: 'Citizen Hold Tester',
      email: 'test_citizen_hold@apex.com',
      password: 'password123',
      role: 'citizen'
    });

    const admin = await User.create({
      name: 'Admin Hold Tester',
      email: 'test_admin_hold@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'General Administration'
    });

    const category = await Category.create({ name: 'Test Hold Category', tenantId: 'default-tenant' });
    const department = await Department.create({ name: 'Test Hold Department', tenantId: 'default-tenant', isActive: true });
    
    // Link category to department
    await DepartmentCategory.create({
      department: department._id,
      category: category._id,
      isActive: true,
      tenantId: 'default-tenant'
    });

    // Create a ticket
    let ticket = await Ticket.create({
      title: 'Hold Test Ticket',
      description: 'Testing hold functionality',
      department: department._id,
      assignedDepartment: department.name,
      category: category._id,
      categoryName: category.name,
      priority: 'Low',
      status: 'Investigating',
      citizen: citizen._id,
      tenantId: 'default-tenant'
    });

    // Initialize mock original status and pause state (simulate loading from DB)
    ticket = await Ticket.findById(ticket._id);
    console.log(`Initial Ticket Status: ${ticket.status}, SLA Paused: ${ticket.slaPaused}`);

    // 2. Put ticket On Hold for 2 hours
    console.log('\n--- Transitioning Ticket to "On Hold" for 2 hours ---');
    ticket = await TicketService.updateTicketStatus(
      ticket._id,
      {
        status: 'On Hold',
        holdDuration: '2'
      },
      admin
    );

    console.log(`Updated Ticket Status: ${ticket.status}`);
    console.log(`SLA Paused: ${ticket.slaPaused}`);
    console.log(`Hold Until: ${ticket.holdUntil}`);
    console.log(`Hold Duration: ${ticket.holdDuration}`);
    console.log(`Previous Status Before Hold: ${ticket.previousStatusBeforeHold}`);
    
    // Assertions
    if (ticket.status !== 'On Hold') throw new Error('Ticket status should be "On Hold"');
    if (!ticket.slaPaused) throw new Error('SLA should be paused when ticket is On Hold');
    if (!ticket.holdUntil) throw new Error('holdUntil should be set');
    if (ticket.holdDuration !== '2') throw new Error('holdDuration should be "2"');
    if (ticket.previousStatusBeforeHold !== 'Investigating') throw new Error('previousStatusBeforeHold should be "Investigating"');

    // 3. Manually Resume Ticket
    console.log('\n--- Manually Resuming Ticket ---');
    ticket = await TicketService.updateTicketStatus(
      ticket._id,
      {
        status: 'Investigating'
      },
      admin
    );

    console.log(`Resumed Ticket Status: ${ticket.status}`);
    console.log(`SLA Paused: ${ticket.slaPaused}`);
    console.log(`Hold Until (Should be null): ${ticket.holdUntil}`);
    console.log(`Hold Duration (Should be null): ${ticket.holdDuration}`);
    console.log(`Previous Status Before Hold (Should be null): ${ticket.previousStatusBeforeHold}`);

    // Assertions
    if (ticket.status !== 'Investigating') throw new Error('Ticket status should be "Investigating"');
    if (ticket.slaPaused) throw new Error('SLA should NOT be paused after manual resumption');
    if (ticket.holdUntil !== null) throw new Error('holdUntil should be null');
    if (ticket.holdDuration !== null) throw new Error('holdDuration should be null');
    if (ticket.previousStatusBeforeHold !== null) throw new Error('previousStatusBeforeHold should be null');

    // 4. Put ticket On Hold and simulate hold expiration
    console.log('\n--- Transitioning Ticket back to "On Hold" ---');
    ticket = await TicketService.updateTicketStatus(
      ticket._id,
      {
        status: 'On Hold',
        holdDuration: '1'
      },
      admin
    );

    // Manually set holdUntil in the past to simulate expiration
    console.log('Simulating hold expiration...');
    ticket.holdUntil = new Date(Date.now() - 5000); // 5 seconds ago
    await ticket.save();

    console.log('Running background SLA breach check / worker...');
    await EscalationWorker.runSlaBreachCheck();

    // Reload ticket
    ticket = await Ticket.findById(ticket._id);
    console.log(`Reloaded Ticket Status (Should auto-resume): ${ticket.status}`);
    console.log(`SLA Paused: ${ticket.slaPaused}`);
    console.log(`Hold Until (Should be null): ${ticket.holdUntil}`);

    // Assertions
    if (ticket.status !== 'Investigating') throw new Error('Ticket status should have automatically reverted to "Investigating"');
    if (ticket.slaPaused) throw new Error('SLA should have automatically unpaused');
    if (ticket.holdUntil !== null) throw new Error('holdUntil should have been cleared');

    // 5. Clean up
    console.log('\nCleaning up mock data...');
    await User.deleteMany({ email: { $in: ['test_citizen_hold@apex.com', 'test_admin_hold@apex.com'] } }).setOptions({ bypassTenant: true });
    await Category.deleteMany({ name: 'Test Hold Category' }).setOptions({ bypassTenant: true });
    await Department.deleteMany({ name: 'Test Hold Department' }).setOptions({ bypassTenant: true });
    await DepartmentCategory.deleteMany({}).setOptions({ bypassTenant: true });
    await Ticket.findByIdAndDelete(ticket._id).setOptions({ bypassTenant: true });

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n!!! TEST FAILED !!!');
    console.error(error);
    process.exit(1);
  }
}

testHoldOption();
