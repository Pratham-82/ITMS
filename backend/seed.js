const dotenv = require('dotenv');
dotenv.config();

// Load db config first to ensure global multi-tenant Mongoose plugin is registered BEFORE model compilation
const connectDB = require('./config/db');

const mongoose = require('mongoose');
const User = require('./models/User');
const Category = require('./models/Category');
const Complaint = require('./models/Ticket');
const Counter = require('./models/Counter');
const Settings = require('./models/Settings');
const Department = require('./models/Department');
const EscalationRule = require('./models/EscalationRule');
const MetadataType = require('./models/MetadataType');

const seedData = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to MongoDB for seeding decoupled system with real-life data...');


    // Clear existing data (bypassing tenant scoping to clear completely)
    await User.deleteMany().setOptions({ bypassTenant: true });
    await Category.deleteMany().setOptions({ bypassTenant: true });
    const DepartmentCategory = require('./models/DepartmentCategory');
    await DepartmentCategory.deleteMany().setOptions({ bypassTenant: true });
    await Complaint.deleteMany().setOptions({ bypassTenant: true });
    await Counter.deleteMany().setOptions({ bypassTenant: true });
    await Settings.deleteMany().setOptions({ bypassTenant: true });
    await Department.deleteMany().setOptions({ bypassTenant: true });
    await EscalationRule.deleteMany().setOptions({ bypassTenant: true });
    const EscalationGroup = require('./models/EscalationGroup');
    await EscalationGroup.deleteMany().setOptions({ bypassTenant: true });
    const Workflow = require('./models/Workflow');
    await Workflow.deleteMany().setOptions({ bypassTenant: true });
    await MetadataType.deleteMany().setOptions({ bypassTenant: true });
    
    // Clear tenant-scoped metadata definitions as well
    const EntityDefinition = require('./models/EntityDefinition');
    const FieldDefinition = require('./models/FieldDefinition');
    const RelationshipDefinition = require('./models/RelationshipDefinition');
    const MetadataAudit = require('./models/MetadataAudit');
    await EntityDefinition.deleteMany().setOptions({ bypassTenant: true });
    await FieldDefinition.deleteMany().setOptions({ bypassTenant: true });
    await RelationshipDefinition.deleteMany().setOptions({ bypassTenant: true });
    await MetadataAudit.deleteMany().setOptions({ bypassTenant: true });

    // Clear CMDB assets, types, and service requests
    const Asset = require('./models/Asset');
    const AssetCategory = require('./models/AssetCategory');
    const AssetType = require('./models/AssetType');
    const AssetRelationship = require('./models/AssetRelationship');
    const ServiceRequest = require('./models/ServiceRequest');
    await Asset.deleteMany().setOptions({ bypassTenant: true });
    await AssetCategory.deleteMany().setOptions({ bypassTenant: true });
    await AssetType.deleteMany().setOptions({ bypassTenant: true });
    await AssetRelationship.deleteMany().setOptions({ bypassTenant: true });
    await ServiceRequest.deleteMany().setOptions({ bypassTenant: true });

    console.log('Existing collections cleared.');

    // Seed global MetadataTypes
    await MetadataType.create([
      { code: 'ENTITY', name: 'Entity Definition' },
      { code: 'FIELD', name: 'Field Definition' },
      { code: 'RELATIONSHIP', name: 'Relationship Definition' },
      { code: 'FORM', name: 'Form Definition' },
      { code: 'VIEW', name: 'View Definition' },
      { code: 'WORKFLOW', name: 'Workflow Definition' },
      { code: 'AUTOMATION', name: 'Automation Definition' },
      { code: 'RULE', name: 'Validation Rule' },
      { code: 'DASHBOARD', name: 'Dashboard Definition' },
      { code: 'REPORT', name: 'Report Definition' }
    ]);
    console.log('Global MetadataTypes seeded.');

    // Seed default tenant defaults first
    const { seedTenantDefaults } = require('./services/tenantDefaults');
    await seedTenantDefaults('default-tenant');
    console.log('Default tenant defaults seeded successfully.');

    // Initialize complaint ID counter
    await Counter.create({ _id: 'complaintTrackingId', seq: 1000 });
    
    // Seed persistent system settings (update if already seeded by defaults)
    await Settings.findOneAndUpdate(
      { key: 'system_branding' },
      { 
        websiteName: 'ApexResolve',
        websiteDescription: 'Enterprise Citizen Support & Complaint Resolution Portal',
        primaryColor: '#6366f1',
        allowCitizenRegistration: true,
        contactEmail: 'support@apex.com'
      },
      { upsert: true, new: true }
    );
    console.log('Counter and settings initialized.');

    // 1. Seed Core Departments
    const deptTech = await Department.create({
      name: 'IT & Technical Services',
      description: 'IT systems, hardware assets, software applications, corporate network, and API integrations.'
    });

    const deptBilling = await Department.create({
      name: 'Finance & Accounts',
      description: 'Customer invoices, payment collection, supplier ledger accounts, and refund claims.'
    });

    const deptFacilities = await Department.create({
      name: 'Facilities & Maintenance',
      description: 'Office workspaces, plumbing leakage, lighting replacement, electrical distribution, HVAC, and cleaning.'
    });

    const deptSecurity = await Department.create({
      name: 'Safety & Security',
      description: 'Access cards, identity badge verification, physical tailgating incidents, lock repairs, and intruder reporting.'
    });

    const deptAdmin = await Department.create({
      name: 'General Administration',
      description: 'General administration, organization-wide coordination, system configuration settings, and public portal feedback.'
    });

    console.log('Core Departments seeded successfully.');

    // 2. Seed Master Category Templates
    const catHardware = await Category.create({
      name: 'Hardware Failure',
      description: 'Device damage, malfunctioning monitors, laptop issues, or printer breakdowns.',
      fields: [
        { label: 'Device Type', type: 'select', required: true, options: ['Laptop', 'Desktop Monitor', 'Corporate Printer', 'Work Phone'] },
        { label: 'Asset Tag Number', type: 'text', required: true }
      ]
    });

    const catSoftware = await Category.create({
      name: 'Software & Access Outage',
      description: 'Application crashes, active directory login errors, or password reset problems.',
      fields: [
        { label: 'Application Name', type: 'text', required: true },
        { label: 'Operating System', type: 'select', required: true, options: ['Windows 11', 'macOS Sequoia', 'Ubuntu Linux', 'iOS', 'Android'] },
        { label: 'Error Code or Message', type: 'text', required: false }
      ]
    });

    const catInvoice = await Category.create({
      name: 'Invoice Discrepancy',
      description: 'Billing disputes, double charges, incorrect line items, or tax disputes on invoices.',
      fields: [
        { label: 'Invoice Reference ID', type: 'text', required: true },
        { label: 'Disputed Amount ($)', type: 'number', required: true },
        { label: 'Payment Method Used', type: 'select', required: false, options: ['Credit Card', 'Bank Wire', 'Corporate ACH'] }
      ]
    });

    const catRefund = await Category.create({
      name: 'Refund Request',
      description: 'File a refund claim for credit charges, canceled subscriptions, or duplicate deposits.',
      fields: [
        { label: 'Original Transaction ID', type: 'text', required: true },
        { label: 'Reason for Refund', type: 'text', required: true }
      ]
    });

    const catPlumbing = await Category.create({
      name: 'Plumbing & Leakage',
      description: 'Active water pipe leaks, flooded areas, clogged sinks, or bathroom repair requests.',
      fields: [
        { label: 'Floor Number', type: 'number', required: true },
        { label: 'Specific Room / Cubicle', type: 'text', required: true }
      ]
    });

    const catElectrical = await Category.create({
      name: 'HVAC & Electrical Repair',
      description: 'Broken lights, flickering office light tubes, thermostat modifications, or blown fuses.',
      fields: [
        { label: 'Floor / Section', type: 'number', required: true },
        { label: 'Issue Type', type: 'select', required: true, options: ['HVAC Outage / Airflow Room Hot', 'Lights completely out', 'Flickering bulbs', 'Dead power sockets'] }
      ]
    });

    const catBadge = await Category.create({
      name: 'Lost Access Badge',
      description: 'Deactivate and lock entry credentials for a misplaced building access card.',
      fields: [
        { label: 'Employee/Visitor ID', type: 'text', required: true },
        { label: 'Misplaced Location Description', type: 'text', required: false }
      ]
    });

    const catBreach = await Category.create({
      name: 'Security Incident Report',
      description: 'Tailgating observation, suspicious items, unlocked fire doors, or unauthorized office visitors.',
      fields: [
        { label: 'Incident Spot Location', type: 'text', required: true },
        { label: 'Time Observed', type: 'text', required: true }
      ]
    });

    const catPayroll = await Category.create({
      name: 'Payroll Inquiries',
      description: 'Deduction issues, direct deposit changes, salary mismatch, or pay stub copies.',
      fields: [
        { label: 'Pay Cycle Range', type: 'text', required: true }
      ]
    });

    const catFeedback = await Category.create({
      name: 'General Feedback',
      description: 'General feedback, administrative issues, cafeteria comments, and community notes.',
      fields: []
    });

    console.log('Master Category Templates seeded successfully.');

    // 3. Seed Department Category assignments (Mappings)
    const DeptCategory = require('./models/DepartmentCategory');
    await DeptCategory.create([
      { department: deptTech._id, category: catHardware._id },
      { department: deptTech._id, category: catSoftware._id },
      { department: deptBilling._id, category: catInvoice._id },
      { department: deptBilling._id, category: catRefund._id },
      { department: deptFacilities._id, departmentName: deptFacilities.name, category: catPlumbing._id },
      { department: deptFacilities._id, departmentName: deptFacilities.name, category: catElectrical._id },
      { department: deptSecurity._id, category: catBadge._id },
      { department: deptSecurity._id, category: catBreach._id },
      { department: deptAdmin._id, category: catPayroll._id },
      { department: deptAdmin._id, category: catFeedback._id }
    ]);

    console.log('Department Category assignments mapped successfully.');

    // 4. Create Staff & Admin Users linked to the core departments
    const admin = await User.create({
      name: 'Sarah Jenkins (Super Admin)',
      email: 'admin@apex.com',
      password: 'password', // Hashed in schema pre-save hook
      role: 'admin',
      department: 'General Administration',
      maxCapacity: 20,
      availabilityStatus: 'Available',
      dashboardConfig: {
        showStatusChart: true,
        showCategoryChart: true,
        showPriorityStats: true,
        widgetsOrder: ['stats', 'charts', 'queue']
      }
    });

    const adminTech = await User.create({
      name: 'Bob Miller (IT Service)',
      email: 'bob@apex.com',
      password: 'password',
      role: 'admin',
      department: 'IT & Technical Services',
      maxCapacity: 10,
      availabilityStatus: 'Available',
      dashboardConfig: {
        showStatusChart: true,
        showCategoryChart: true,
        showPriorityStats: true,
        widgetsOrder: ['stats', 'charts', 'queue']
      }
    });

    const adminTech2 = await User.create({
      name: 'John Davis (IT Service)',
      email: 'john@apex.com',
      password: 'password',
      role: 'admin',
      department: 'IT & Technical Services',
      maxCapacity: 15,
      availabilityStatus: 'Available',
      dashboardConfig: {
        showStatusChart: true,
        showCategoryChart: true,
        showPriorityStats: true,
        widgetsOrder: ['stats', 'charts', 'queue']
      }
    });

    const adminTech3 = await User.create({
      name: 'Mike Vance (IT Service)',
      email: 'mike@apex.com',
      password: 'password',
      role: 'admin',
      department: 'IT & Technical Services',
      maxCapacity: 20,
      availabilityStatus: 'Busy',
      dashboardConfig: {
        showStatusChart: true,
        showCategoryChart: true,
        showPriorityStats: true,
        widgetsOrder: ['stats', 'charts', 'queue']
      }
    });

    const adminBilling = await User.create({
      name: 'Mary Clark (Billing Officer)',
      email: 'mary@apex.com',
      password: 'password',
      role: 'admin',
      department: 'Finance & Accounts',
      maxCapacity: 15,
      availabilityStatus: 'Available',
      dashboardConfig: {
        showStatusChart: true,
        showCategoryChart: true,
        showPriorityStats: true,
        widgetsOrder: ['stats', 'charts', 'queue']
      }
    });

    const adminSecurity = await User.create({
      name: 'Officer Aark',
      email: 'aark@gmail.com',
      password: 'password',
      role: 'admin',
      department: 'Safety & Security',
      maxCapacity: 15,
      availabilityStatus: 'Available',
      dashboardConfig: {
        showStatusChart: true,
        showCategoryChart: true,
        showPriorityStats: true,
        widgetsOrder: ['stats', 'charts', 'queue']
      }
    });

    const adminFacilities = await User.create({
      name: 'David Evans (Facilities)',
      email: 'david@apex.com',
      password: 'password',
      role: 'admin',
      department: 'Facilities & Maintenance',
      maxCapacity: 15,
      availabilityStatus: 'Available',
      dashboardConfig: {
        showStatusChart: true,
        showCategoryChart: true,
        showPriorityStats: true,
        widgetsOrder: ['stats', 'charts', 'queue']
      }
    });

    const adminSuper = await User.create({
      name: 'Super Administrator',
      email: 'superadmin@apex.com',
      password: 'password',
      role: 'admin',
      department: 'General Administration',
      maxCapacity: 20,
      availabilityStatus: 'Available',
      dashboardConfig: {
        showStatusChart: true,
        showCategoryChart: true,
        showPriorityStats: true,
        widgetsOrder: ['stats', 'charts', 'queue']
      }
    });

    // 5. Create Escalation Groups and add members
    const groupAdmin = await EscalationGroup.create({
      name: 'General Administration Team',
      description: 'System configuration, SLA policies, and administrative operations.',
      leader: adminSuper._id,
      members: [admin._id, adminSuper._id],
      department: deptAdmin._id
    });

    const groupTech = await EscalationGroup.create({
      name: 'IT Support Team',
      description: 'Handles hardware failure, software access issues, and core technical outages.',
      leader: adminTech._id,
      members: [adminTech._id, adminTech2._id, adminTech3._id],
      department: deptTech._id
    });

    const groupBilling = await EscalationGroup.create({
      name: 'Finance & Billing Team',
      description: 'Handles invoice discrepancies, double charges, and refund requests.',
      leader: adminBilling._id,
      members: [adminBilling._id],
      department: deptBilling._id
    });

    const groupSecurity = await EscalationGroup.create({
      name: 'Physical Security Team',
      description: 'Handles access badge replacement, tailgating events, and intruder alerts.',
      leader: adminSecurity._id,
      members: [adminSecurity._id],
      department: deptSecurity._id
    });

    const groupFacilities = await EscalationGroup.create({
      name: 'Facilities Maintenance Team',
      description: 'Handles HVAC repair, light bulb replacement, and active water pipe leakage.',
      leader: adminFacilities._id,
      members: [adminFacilities._id],
      department: deptFacilities._id
    });

    // Update the User documents to reference their Escalation Groups
    admin.groups = [groupAdmin._id];
    await admin.save();

    adminTech.groups = [groupTech._id];
    await adminTech.save();

    adminTech2.groups = [groupTech._id];
    await adminTech2.save();

    adminTech3.groups = [groupTech._id];
    await adminTech3.save();

    adminBilling.groups = [groupBilling._id];
    await adminBilling.save();

    adminSecurity.groups = [groupSecurity._id];
    await adminSecurity.save();

    adminFacilities.groups = [groupFacilities._id];
    await adminFacilities.save();

    adminSuper.groups = [groupAdmin._id];
    await adminSuper.save();

    console.log('Escalation Groups seeded and members linked successfully.');

    // Seed Asset Categories
    const astCatLaptops = await AssetCategory.create({
      name: 'Laptops',
      description: 'Corporate client computing machines',
      icon: 'Laptop',
      color: '#6366f1'
    });

    const astCatNetworking = await AssetCategory.create({
      name: 'Networking Devices',
      description: 'Switches, routers, firewalls, and access points',
      icon: 'Network',
      color: '#3b82f6'
    });

    console.log('Asset Categories seeded successfully.');

    // Seed Asset Types
    const astTypeDeveloperLaptop = await AssetType.create({
      categoryId: astCatLaptops._id,
      name: 'Developer Laptop',
      description: 'High-end developer workstation',
      assetPrefix: 'LAP',
      lifecycleStatuses: ['Active', 'In Store', 'Retired', 'Under Repair'],
      dynamicFields: [
        { fieldKey: 'ram_gb', label: 'RAM (GB)', type: 'number', required: true, searchable: true },
        { fieldKey: 'storage_gb', label: 'Storage (GB)', type: 'number', required: true, searchable: true },
        { fieldKey: 'os', label: 'Operating System', type: 'select', required: true, options: ['Windows 11 Pro', 'macOS Sequoia', 'Ubuntu Linux'], searchable: true }
      ]
    });

    const astTypeCoreRouter = await AssetType.create({
      categoryId: astCatNetworking._id,
      name: 'Core Router',
      description: 'Corporate core router infrastructure',
      assetPrefix: 'RTR',
      lifecycleStatuses: ['Active', 'In Store', 'Retired', 'Under Repair'],
      dynamicFields: [
        { fieldKey: 'ports_count', label: 'Ports Count', type: 'number', required: true, searchable: true },
        { fieldKey: 'firmware_version', label: 'Firmware Version', type: 'text', required: false, searchable: true }
      ]
    });

    console.log('Asset Types seeded successfully.');

    // Seed Assets (Registered only with emails, no pre-created User IDs)
    await Asset.create({
      name: 'MacBook Pro 16" (Alice)',
      description: 'M3 Max 64GB Developer Workstation',
      categoryId: astCatLaptops._id,
      assetTypeId: astTypeDeveloperLaptop._id,
      departmentId: deptTech._id,
      ownerEmail: 'alice@apex.com',
      custodianEmail: 'alice@apex.com',
      status: 'Active',
      purchaseDate: new Date('2025-01-15'),
      warrantyExpiry: new Date('2028-01-15'),
      location: 'HQ Bangalore, Floor 3 Desk 45',
      serialNumber: 'SN-APPLE-M3MAX-9871',
      dynamicValues: {
        ram_gb: 64,
        storage_gb: 1024,
        os: 'macOS Sequoia'
      }
    });

    await Asset.create({
      name: 'ThinkPad P16 (John)',
      description: 'Intel i9 64GB Developer Workstation',
      categoryId: astCatLaptops._id,
      assetTypeId: astTypeDeveloperLaptop._id,
      departmentId: deptTech._id,
      ownerEmail: 'citizen@apex.com',
      custodianEmail: 'citizen@apex.com',
      status: 'Active',
      purchaseDate: new Date('2025-02-10'),
      warrantyExpiry: new Date('2028-02-10'),
      location: 'HQ Delhi, Floor 1 Desk 12',
      serialNumber: 'SN-LENOVO-P16-10492',
      dynamicValues: {
        ram_gb: 64,
        storage_gb: 2048,
        os: 'Windows 11 Pro'
      }
    });

    await Asset.create({
      name: 'Cisco Catalyst 9300',
      description: 'IT Network Backbone Switch',
      categoryId: astCatNetworking._id,
      assetTypeId: astTypeCoreRouter._id,
      departmentId: deptTech._id,
      ownerEmail: 'bob@apex.com',
      custodianEmail: 'bob@apex.com',
      status: 'Active',
      purchaseDate: new Date('2024-05-20'),
      warrantyExpiry: new Date('2027-05-20'),
      location: 'HQ Server Room Rack A3',
      serialNumber: 'SN-CISCO-CAT9300-8812',
      dynamicValues: {
        ports_count: 48,
        firmware_version: 'IOS-XE 17.9.4a'
      }
    });

    console.log('Sample assets registered with owner/custodian emails successfully.');
    
    // Recalculate workloads
    const { calculateWorkloadScore } = require('./services/assignmentService');
    await calculateWorkloadScore(admin);
    await calculateWorkloadScore(adminTech);
    await calculateWorkloadScore(adminTech2);
    await calculateWorkloadScore(adminTech3);
    await calculateWorkloadScore(adminBilling);
    await calculateWorkloadScore(adminSecurity);
    await calculateWorkloadScore(adminFacilities);
    await calculateWorkloadScore(adminSuper);
    console.log('Workload scores calculated for all staff members.');

    console.log('Database Seeding Completed Successfully.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedData();
