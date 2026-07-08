const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Compile models after plugin registration in db.js
const Complaint = require('./models/Ticket');
const Category = require('./models/Category');
const Department = require('./models/Department');
const BusinessCalendar = require('./models/BusinessCalendar');
const BlackoutPeriod = require('./models/BlackoutPeriod');
const Holiday = require('./models/Holiday');
const User = require('./models/User');
const DepartmentCategory = require('./models/DepartmentCategory');
const EscalationRule = require('./models/EscalationRule');
const Counter = require('./models/Counter');
const SlaConfiguration = require('./models/SlaConfiguration');

const { calculateDueDate, resolveCalendarForComplaint, isBlackoutPeriod } = require('./services/calendarService');
const { runSlaBreachCheck } = require('./services/queueService');

async function runTests() {
  console.log('=== STARTING BUSINESS CALENDAR ENGINE TESTS ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // Cleanup previous test data
    console.log('Cleaning up previous test data...');
    await SlaConfiguration.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await SlaConfiguration.create({
      name: 'Test Business Calendar SLA Configuration',
      isDefault: true,
      breachActions: {
        responseSla: ['AUDIT_LOG', 'HISTORY_LOG'],
        resolutionSla: ['AUDIT_LOG', 'HISTORY_LOG']
      },
      priorities: {
        Critical: { responseSlaMinutes: 15, resolutionSlaMinutes: 240 },
        High: { responseSlaMinutes: 60, resolutionSlaMinutes: 480 },
        Medium: { responseSlaMinutes: 240, resolutionSlaMinutes: 1440 },
        Low: { responseSlaMinutes: 480, resolutionSlaMinutes: 4320 }
      }
    });
    await BusinessCalendar.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await BlackoutPeriod.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await Holiday.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await Complaint.deleteMany({ title: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await Category.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await Department.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await User.deleteMany({ email: { $regex: /^test_citizen_cal/ } }).setOptions({ bypassTenant: true });
    await DepartmentCategory.deleteMany({}).setOptions({ bypassTenant: true }); // Delete mapping for tests if clean up is needed

    // Seed test citizen
    const citizen = await User.create({
      name: 'Test Citizen',
      email: 'test_citizen_cal@apex.com',
      password: 'password123',
      role: 'citizen'
    });

    // 1. Test Calendar Exceptions (Saturday working exception)
    console.log('\n[1] Testing Saturday Exception override...');
    const cal = await BusinessCalendar.create({
      name: 'Test Calendar with Exceptions',
      workingDays: [1, 2, 3, 4, 5], // Mon-Fri
      workingHours: { start: '09:00', end: '17:00' },
      exceptions: [
        {
          date: new Date('2026-06-27T00:00:00Z'), // Saturday
          startTime: '09:00',
          endTime: '17:00',
          reason: 'Special working Saturday'
        }
      ],
      timeZone: 'UTC',
      isDefault: false
    });

    // Start Friday June 26, 2026 at 16:00 UTC. 
    // Usually, 8 working hours would land on Monday June 29, 2026 at 16:00 UTC (since Sat/Sun are weekends).
    // With Saturday working exception, 8 working hours should land on Saturday June 27, 2026 at 16:00 UTC!
    const start = new Date('2026-06-26T16:00:00Z');
    const computedDue = await calculateDueDate(start, 480, cal._id); // 480 mins = 8 hours

    console.log(`Start Friday: ${start.toISOString()}`);
    console.log(`Computed Due: ${computedDue.toISOString()}`);
    
    const expectedDue = new Date('2026-06-27T16:00:00Z');
    if (computedDue.getTime() === expectedDue.getTime()) {
      console.log('✓ Saturday Working Exception PASSED!');
    } else {
      throw new Error(`Saturday Working Exception FAILED! Expected ${expectedDue.toISOString()}, got ${computedDue.toISOString()}`);
    }

    // 2. Test Blackout Periods (skip SLA breach triggers during blackout)
    console.log('\n[2] Testing Blackout Period freeze...');
    const blackoutCalendar = await BusinessCalendar.create({
      name: 'Test Blackout Calendar',
      workingDays: [1, 2, 3, 4, 5],
      workingHours: { start: '09:00', end: '17:00' },
      timeZone: 'UTC'
    });

    const now = new Date();
    // Seed blackout period active right now
    const blackout = await BlackoutPeriod.create({
      name: 'Test Active Blackout',
      startDate: new Date(now.getTime() - 10 * 60 * 1000), // 10 mins ago
      endDate: new Date(now.getTime() + 10 * 60 * 1000),  // 10 mins from now
      calendarId: blackoutCalendar._id
    });

    const isBlackoutActive = await isBlackoutPeriod(now, blackoutCalendar._id);
    console.log(`Is Blackout Active: ${isBlackoutActive}`);
    if (!isBlackoutActive) {
      throw new Error('Blackout Period should be active but was detected as inactive');
    }

    // Create a mock department and category, and link them
    const dept = await Department.create({ name: 'Test Dept SLA', calendar: blackoutCalendar._id });
    const cat = await Category.create({ name: 'Test Cat SLA', calendar: blackoutCalendar._id });
    await DepartmentCategory.create({ department: dept._id, category: cat._id, isActive: true });

    // Create a mock complaint that resolved to the blackout calendar
    // And is breached (due date in past)
    const complaint = await Complaint.create({
      title: 'Test Blackout Ticket',
      description: 'Test ticket during blackout',
      department: dept._id,
      category: cat._id,
      categoryName: cat.name,
      assignedDepartment: dept.name,
      responseDueAt: new Date(now.getTime() - 5 * 60 * 1000), // 5 mins ago
      responseSlaStatus: 'Within SLA',
      calendar: blackoutCalendar._id,
      citizen: citizen._id
    });

    // Run SLA breach check. Since there is a blackout period, the breach should NOT fire!
    console.log('Running runSlaBreachCheck() during active blackout...');
    await runSlaBreachCheck();

    const checkedComplaint = await Complaint.findById(complaint._id);
    console.log(`Complaint status after check: ${checkedComplaint.responseSlaStatus}`);
    if (checkedComplaint.responseSlaStatus === 'Within SLA') {
      console.log('✓ SLA Breach bypassed during Blackout PASSED!');
    } else {
      throw new Error(`SLA Breach check should have been bypassed. Status got modified to: ${checkedComplaint.responseSlaStatus}`);
    }

    // Remove blackout period and re-run check
    await BlackoutPeriod.deleteMany({ _id: blackout._id }).setOptions({ bypassTenant: true });
    console.log('Running runSlaBreachCheck() after blackout removed...');
    await runSlaBreachCheck();

    const checkedBreachedComplaint = await Complaint.findById(complaint._id);
    console.log(`Complaint status after check (no blackout): ${checkedBreachedComplaint.responseSlaStatus}`);
    if (checkedBreachedComplaint.responseSlaStatus === 'Breached') {
      console.log('✓ SLA Breach fired after Blackout removed PASSED!');
    } else {
      throw new Error(`SLA Breach check should have been breached. Status got: ${checkedBreachedComplaint.responseSlaStatus}`);
    }

    // 3. Test SLA Pausing & Resuming
    console.log('\n[3] Testing SLA Pausing and Resuming...');
    // Create complaint
    const pauseComplaint = await Complaint.create({
      title: 'Test Pause Resume SLA Ticket',
      description: 'Test ticket pause/resume',
      department: dept._id,
      category: cat._id,
      categoryName: cat.name,
      assignedDepartment: dept.name,
      status: 'Investigating',
      responseDueAt: new Date(now.getTime() + 10 * 60 * 1000), // 10 mins from now
      resolutionDueAt: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
      calendar: blackoutCalendar._id,
      citizen: citizen._id
    });

    const origResponseDue = pauseComplaint.responseDueAt.getTime();
    
    // Change status to Awaiting Feedback (pausing status)
    pauseComplaint.status = 'Awaiting Feedback';
    await pauseComplaint.save();

    console.log(`Paused status updated. Is SLA paused: ${pauseComplaint.slaPaused}. PausedAt: ${pauseComplaint.slaPausedAt}`);
    if (!pauseComplaint.slaPaused || !pauseComplaint.slaPausedAt) {
      throw new Error('SLA timer should have paused on Awaiting Feedback status update.');
    }

    // Wait 2 seconds (simulate pause duration)
    console.log('Simulating 2 second pause...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Reload document from database to get fresh original state loaded
    const pauseComplaintReloaded = await Complaint.findById(pauseComplaint._id);
    console.log(`Reloaded complaint: status=${pauseComplaintReloaded.status}, slaPaused=${pauseComplaintReloaded.slaPaused}`);

    // Change status back to Investigating
    pauseComplaintReloaded.status = 'Investigating';
    await pauseComplaintReloaded.save();

    console.log(`Resumed status updated. Is SLA paused: ${pauseComplaintReloaded.slaPaused}. PauseTime: ${pauseComplaintReloaded.slaAccumulatedPauseTime}ms`);
    if (pauseComplaintReloaded.slaPaused) {
      throw new Error('SLA timer should have resumed.');
    }

    const newResponseDue = pauseComplaintReloaded.responseDueAt.getTime();
    const shiftedTime = newResponseDue - origResponseDue;
    console.log(`Shifted time: ${shiftedTime}ms`);

    if (shiftedTime >= 2000 && shiftedTime < 10000) {
      console.log('✓ SLA Pausing & Resuming PASSED!');
    } else {
      throw new Error(`SLA Pausing & Resuming FAILED! Expected ~2000ms shift, got ${shiftedTime}ms`);
    }

    // 4. Test Calendar Priority Resolution
    console.log('\n[4] Testing Calendar Priority Resolution...');
    // Hierarchy: Complaint -> Escalation Rule -> Category -> Department -> Default
    const defaultCal = await BusinessCalendar.create({ name: 'Test Default Cal', isDefault: true });
    const deptCal = await BusinessCalendar.create({ name: 'Test Dept Cal' });
    const catCal = await BusinessCalendar.create({ name: 'Test Cat Cal' });
    const compCal = await BusinessCalendar.create({ name: 'Test Comp Cal' });

    const testDept = await Department.create({ name: 'Test Hierarchy Dept', calendar: deptCal._id });
    const testCat = await Category.create({ name: 'Test Hierarchy Cat', calendar: catCal._id });
    await DepartmentCategory.create({ department: testDept._id, category: testCat._id, isActive: true });

    // Test default resolution (no calendar assigned anywhere)
    const cleanDept = await Department.create({ name: 'Test Clean Dept' });
    const cleanCat = await Category.create({ name: 'Test Clean Cat' });
    await DepartmentCategory.create({ department: cleanDept._id, category: cleanCat._id, isActive: true });
    
    const compClean = { department: cleanDept._id, category: cleanCat._id };

    let resolved = await resolveCalendarForComplaint(compClean);
    console.log(`Resolved (default expected): ${resolved ? resolved.name : 'None'}`);
    if (resolved && resolved.name === 'Test Default Cal') {
      console.log('✓ Priority resolution - Default calendar PASSED!');
    } else {
      throw new Error('Expected Test Default Cal');
    }

    // Test department resolution
    const compDept = { department: testDept._id, category: cleanCat._id };
    resolved = await resolveCalendarForComplaint(compDept);
    console.log(`Resolved (dept expected): ${resolved ? resolved.name : 'None'}`);
    if (resolved && resolved.name === 'Test Dept Cal') {
      console.log('✓ Priority resolution - Department calendar PASSED!');
    } else {
      throw new Error('Expected Test Dept Cal');
    }

    // Test category resolution
    const compCatObj = { department: testDept._id, category: testCat._id };
    resolved = await resolveCalendarForComplaint(compCatObj);
    console.log(`Resolved (cat expected): ${resolved ? resolved.name : 'None'}`);
    if (resolved && resolved.name === 'Test Cat Cal') {
      console.log('✓ Priority resolution - Category calendar PASSED!');
    } else {
      throw new Error('Expected Test Cat Cal');
    }

    // Test complaint level resolution
    const compDirect = { department: testDept._id, category: testCat._id, calendar: compCal._id };
    resolved = await resolveCalendarForComplaint(compDirect);
    console.log(`Resolved (comp expected): ${resolved ? resolved.name : 'None'}`);
    if (resolved && resolved.name === 'Test Comp Cal') {
      console.log('✓ Priority resolution - Complaint direct calendar PASSED!');
    } else {
      throw new Error('Expected Test Comp Cal');
    }

    // Cleanup
    console.log('\nCleaning up integration test documents...');
    await SlaConfiguration.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await BusinessCalendar.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await BlackoutPeriod.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await Holiday.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await Complaint.deleteMany({ title: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await Category.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await Department.deleteMany({ name: { $regex: /^Test/ } }).setOptions({ bypassTenant: true });
    await User.deleteMany({ email: { $regex: /^test_citizen_cal/ } }).setOptions({ bypassTenant: true });
    await DepartmentCategory.deleteMany({ department: { $in: [dept._id, testDept._id, cleanDept._id] } }).setOptions({ bypassTenant: true });

    console.log('\n=== ALL BUSINESS CALENDAR ENGINE TESTS PASSED! ===');
    process.exit(0);

  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  }
}

runTests();
