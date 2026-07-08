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
const EscalationGroup = require('./models/EscalationGroup');
const SlaConfiguration = require('./models/SlaConfiguration');
const BusinessCalendar = require('./models/BusinessCalendar');
const EscalationAudit = require('./models/EscalationAudit');

// Engines
const CalendarEngine = require('./services/escalation/CalendarEngine');
const SlaEngine = require('./services/escalation/SlaEngine');
const AssignmentEngine = require('./services/escalation/AssignmentEngine');
const NotificationEngine = require('./services/escalation/NotificationEngine');
const EscalationEngine = require('./services/escalation/EscalationEngine');
const AuditEngine = require('./services/escalation/AuditEngine');
const EscalationAnalytics = require('./services/escalation/EscalationAnalytics');
const EscalationProcessor = require('./services/escalation/EscalationProcessor');

async function runTests() {
  console.log('=== STARTING UNIFIED ESCALATION ENGINE INTEGRATION TESTS ===');
  
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // Cleanup old test records
    console.log('\n[1] Cleaning up old test data...');
    await User.deleteMany({ email: { $in: ['test_unified_agent1@apex.com', 'test_unified_agent2@apex.com', 'test_unified_citizen@apex.com'] } }).setOptions({ bypassTenant: true });
    await EscalationGroup.deleteMany({ name: 'Test Unified Group' }).setOptions({ bypassTenant: true });
    await BusinessCalendar.deleteMany({ name: 'Test Unified Calendar' }).setOptions({ bypassTenant: true });
    await SlaConfiguration.deleteMany({ name: 'Test Unified SLA Matrix' }).setOptions({ bypassTenant: true });
    await Complaint.deleteMany({ title: { $regex: /^Test Unified Ticket/ } }).setOptions({ bypassTenant: true });
    await Department.deleteMany({ name: 'Test Unified Department' }).setOptions({ bypassTenant: true });
    await EscalationAudit.deleteMany({}).setOptions({ bypassTenant: true });
    
    const testCatForCleanup = await Category.findOne({ name: 'Test Unified Category' }).setOptions({ bypassTenant: true });
    if (testCatForCleanup) {
      await DepartmentCategory.deleteMany({ category: testCatForCleanup._id }).setOptions({ bypassTenant: true });
      await Category.deleteOne({ _id: testCatForCleanup._id }).setOptions({ bypassTenant: true });
    }
    console.log('Cleanup complete.');

    // Seed Calendar
    console.log('\n[2] Seeding default Business Calendar...');
    const calendar = await BusinessCalendar.create({
      name: 'Test Unified Calendar',
      workingDays: [1, 2, 3, 4, 5],
      workingHours: { start: '09:00', end: '17:00' },
      isDefault: true
    });

    // Seed Department & Category
    const dept = await Department.create({
      name: 'Test Unified Department',
      description: 'Department for testing unified engine'
    });

    const cat = await Category.create({
      name: 'Test Unified Category',
      fields: []
    });

    await DepartmentCategory.create({
      department: dept._id,
      category: cat._id,
      isActive: true
    });

    // Seed Users
    const citizen = await User.create({
      name: 'Test Unified Citizen',
      email: 'test_unified_citizen@apex.com',
      password: 'password123',
      role: 'citizen'
    });

    const agent1 = await User.create({
      name: 'Test Unified Agent 1',
      email: 'test_unified_agent1@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'Test Unified Department',
      maxCapacity: 10,
      availabilityStatus: 'Available',
      skills: ['Test Unified Category']
    });

    const agent2 = await User.create({
      name: 'Test Unified Agent 2',
      email: 'test_unified_agent2@apex.com',
      password: 'password123',
      role: 'admin',
      department: 'Test Unified Department',
      maxCapacity: 10,
      availabilityStatus: 'Available',
      skills: ['Other Category']
    });

    // Seed SLA configurations
    await SlaConfiguration.create({
      name: 'Test Unified SLA Matrix',
      isDefault: true,
      priorities: {
        Critical: { responseSlaMinutes: 15, resolutionSlaMinutes: 240 },
        High: { responseSlaMinutes: 60, resolutionSlaMinutes: 480 },
        Medium: { responseSlaMinutes: 240, resolutionSlaMinutes: 1440 },
        Low: { responseSlaMinutes: 480, resolutionSlaMinutes: 4320 }
      }
    });

    console.log('Seed completed successfully.');

    // 1. CalendarEngine Calculations Test
    console.log('\n[3] Testing CalendarEngine due date math (Friday 18:00 -> Monday 17:00 UTC)...');
    const startFriday = new Date('2026-06-19T18:00:00Z');
    const expectedDue = new Date('2026-06-22T17:00:00Z'); // Monday 17:00 UTC
    const computedDue = await CalendarEngine.calculateDueDate(startFriday, 480, calendar); // 8 hours in minutes

    console.log(`Start Friday: ${startFriday.toISOString()}`);
    console.log(`Expected Due (Monday 17:00): ${expectedDue.toISOString()}`);
    console.log(`Computed Due: ${computedDue.toISOString()}`);

    if (computedDue.getTime() === expectedDue.getTime()) {
      console.log('✓ CalendarEngine due date math PASSED.');
    } else {
      throw new Error(`CalendarEngine due date math FAILED! Got: ${computedDue.toISOString()}`);
    }

    // 2. SLA Engine Calculations
    console.log('\n[4] Testing SlaEngine calculations on mock complaint...');
    const mockComplaint = {
      title: 'Test Unified Ticket 1',
      description: 'First test ticket description',
      department: dept._id,
      category: cat._id,
      priority: 'High',
      assignedDepartment: dept.name,
      createdAt: new Date()
    };

    const responseDue = await SlaEngine.calculateResponseDueDate(mockComplaint, calendar);
    const resolutionDue = await SlaEngine.calculateResolutionDueDate(mockComplaint, calendar);

    console.log(`Response SLA Target: ${responseDue.toISOString()}`);
    console.log(`Resolution SLA Target: ${resolutionDue.toISOString()}`);

    if (responseDue && resolutionDue) {
      console.log('✓ SlaEngine due date calculations PASSED.');
    } else {
      throw new Error('SlaEngine due date calculations FAILED!');
    }

    // 3. AssignmentEngine strategies
    console.log('\n[5] Testing AssignmentEngine strategy-based assignment...');
    const complaintObj = new Complaint({
      title: 'Test Unified Ticket 2',
      description: 'Second test ticket description',
      department: dept._id,
      category: cat._id,
      categoryName: cat.name,
      priority: 'High',
      citizen: citizen._id,
      assignedDepartment: dept.name
    });

    const assignResult = await AssignmentEngine.assignComplaint(complaintObj, 'skill-based');
    console.log(`Assigned Agent: ${assignResult ? assignResult.assignedUser.name : 'None'}`);

    if (assignResult && assignResult.assignedUser._id.toString() === agent1._id.toString()) {
      console.log('✓ Skill-Based Auto Assignment PASSED.');
    } else {
      throw new Error('Skill-Based Auto Assignment FAILED!');
    }

    // 4. Single Processor Pipeline Run (Create)
    console.log('\n[6] Testing single processing pipeline (CREATE)...');
    const pipelineComplaint = new Complaint({
      title: 'Test Unified Ticket 3',
      description: 'Pipeline CREATE test ticket',
      department: dept._id,
      category: cat._id,
      categoryName: cat.name,
      priority: 'Critical',
      citizen: citizen._id,
      assignedDepartment: dept.name
    });

    await EscalationProcessor.processLifecycle(pipelineComplaint, 'CREATE', {
      actorName: 'Citizen Tester',
      actorId: citizen._id
    });

    await pipelineComplaint.save();

    console.log(`Created Complaint trackingId: ${pipelineComplaint.trackingId}`);
    console.log(`Assigned To: ${pipelineComplaint.assignedTo}`);
    console.log(`Response Due: ${pipelineComplaint.responseDueAt.toISOString()}`);
    console.log(`Resolution Due: ${pipelineComplaint.resolutionDueAt.toISOString()}`);
    
    if (pipelineComplaint.trackingId && pipelineComplaint.assignedTo && pipelineComplaint.responseDueAt) {
      console.log('✓ EscalationProcessor CREATE pipeline run PASSED.');
    } else {
      throw new Error('EscalationProcessor CREATE pipeline run FAILED!');
    }

    // 5. Audit Logging Verification
    console.log('\n[7] Verifying Audit Logging logs in database...');
    const auditLogs = await EscalationAudit.find({ complaintId: pipelineComplaint._id });
    console.log(`Found ${auditLogs.length} audit logs in DB.`);
    auditLogs.forEach(log => {
      console.log(` - Action: ${log.action} | Actor: ${log.actor} | Timestamp: ${log.timestamp}`);
    });

    if (auditLogs.length > 0 && auditLogs[0].action === 'CREATED') {
      console.log('✓ Audit Logging database verification PASSED.');
    } else {
      throw new Error('Audit Logging database verification FAILED!');
    }

    // 5.5. Test SLA Action Engine Breaches, Priority Upgrades, Risk Score, and Executive Escalation
    console.log('\n[7.5] Testing SlaActionEngine Breaches...');
    const SlaActionEngine = require('./services/escalation/SlaActionEngine');
    
    // Set initial test values
    pipelineComplaint.priority = 'Medium';
    pipelineComplaint.responseBreachCount = 0;
    pipelineComplaint.resolutionBreachCount = 0;
    pipelineComplaint.totalBreachCount = 0;
    pipelineComplaint.riskScore = 0;
    pipelineComplaint.executiveEscalated = false;
    await pipelineComplaint.save();

    console.log('Triggering Response SLA Breach #1...');
    await SlaActionEngine.processResponseSlaBreach(pipelineComplaint, new Date());
    console.log(`Updated Priority after breach #1: ${pipelineComplaint.priority}`); // should be Medium -> High
    console.log(`Risk Score: ${pipelineComplaint.riskScore}`); // should increase
    console.log(`Total Breach Count: ${pipelineComplaint.totalBreachCount}`); // should be 1
    
    if (pipelineComplaint.priority !== 'High') {
      throw new Error(`Priority upgrade failed! Expected High, got: ${pipelineComplaint.priority}`);
    }

    console.log('Triggering Response SLA Breach #2...');
    await SlaActionEngine.processResponseSlaBreach(pipelineComplaint, new Date());
    console.log(`Updated Priority after breach #2: ${pipelineComplaint.priority}`); // should be High -> Critical
    console.log(`Risk Score: ${pipelineComplaint.riskScore}`); 
    console.log(`Total Breach Count: ${pipelineComplaint.totalBreachCount}`); // should be 2

    if (pipelineComplaint.priority !== 'Critical') {
      throw new Error(`Priority upgrade failed! Expected Critical, got: ${pipelineComplaint.priority}`);
    }

    console.log('Triggering Response SLA Breach #3...');
    await SlaActionEngine.processResponseSlaBreach(pipelineComplaint, new Date());
    console.log(`Total Breach Count: ${pipelineComplaint.totalBreachCount}`); // should be 3

    console.log('Triggering Response SLA Breach #4 (Threshold for Executive Escalation)...');
    await SlaActionEngine.processResponseSlaBreach(pipelineComplaint, new Date());
    console.log(`Executive Escalated: ${pipelineComplaint.executiveEscalated}`); // should be true
    console.log(`Executive Escalation Reason: ${pipelineComplaint.executiveEscalationReason}`);

    if (!pipelineComplaint.executiveEscalated) {
      throw new Error('Executive Escalation failed! Expected true.');
    }

    // Verify Audit Trail contains SLA_BREACH
    const breachAudits = await EscalationAudit.find({ action: 'SLA_BREACH', complaintId: pipelineComplaint._id });
    console.log(`Found ${breachAudits.length} SLA breach audit logs in DB.`);
    if (breachAudits.length === 0) {
      throw new Error('No SLA Breach audits created in EscalationAudit collection!');
    }

    console.log('✓ SlaActionEngine integration tests PASSED.');

    // 6. Analytics calculation validation
    console.log('\n[8] Verifying EscalationAnalytics engine calculations...');
    const metrics = await EscalationAnalytics.getMetricsSummary();
    console.log('Computed metrics summary:', metrics);
    
    if (metrics.slaComplianceRate !== undefined && metrics.escalationRate !== undefined) {
      console.log('✓ EscalationAnalytics calculations PASSED.');
    } else {
      throw new Error('EscalationAnalytics calculations FAILED!');
    }

    // 7. Cleanup after test runs
    console.log('\n[9] Cleaning up test database documents...');
    await User.deleteMany({ email: { $in: ['test_unified_agent1@apex.com', 'test_unified_agent2@apex.com', 'test_unified_citizen@apex.com'] } }).setOptions({ bypassTenant: true });
    await EscalationGroup.deleteMany({ name: 'Test Unified Group' }).setOptions({ bypassTenant: true });
    await BusinessCalendar.deleteMany({ name: 'Test Unified Calendar' }).setOptions({ bypassTenant: true });
    await SlaConfiguration.deleteMany({ name: 'Test Unified SLA Matrix' }).setOptions({ bypassTenant: true });
    await Complaint.deleteMany({ title: { $regex: /^Test Unified Ticket/ } }).setOptions({ bypassTenant: true });
    await Department.deleteMany({ name: 'Test Unified Department' }).setOptions({ bypassTenant: true });
    await EscalationAudit.deleteMany({}).setOptions({ bypassTenant: true });
    await Category.deleteOne({ _id: cat._id }).setOptions({ bypassTenant: true });
    await DepartmentCategory.deleteMany({ department: dept._id }).setOptions({ bypassTenant: true });

    console.log('\n=== ALL UNIFIED ESCALATION ENGINE INTEGRATION TESTS PASSED! ===');
    process.exit(0);

  } catch (err) {
    console.error('Test run failed with error:', err);
    process.exit(1);
  }
}

runTests();
