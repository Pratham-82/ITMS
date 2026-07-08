const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('./config/db');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const User = require('./models/User');
const Category = require('./models/Category');
const Counter = require('./models/Counter');
const Settings = require('./models/Settings');
const Department = require('./models/Department');
const DepartmentCategory = require('./models/DepartmentCategory');
const EscalationGroup = require('./models/EscalationGroup');
const EscalationRule = require('./models/EscalationRule');
const Asset = require('./models/Asset');
const AssetCategory = require('./models/AssetCategory');
const AssetType = require('./models/AssetType');
const Ticket = require('./models/Ticket');
const TicketType = require('./models/TicketType');
const GlobalUser = require('./models/GlobalUser');
const Tenant = require('./models/Tenant');

const tenantLocalStorage = require('./middleware/tenantContext');
const { seedTenantDefaults } = require('./services/tenantDefaults');
const { calculateWorkloadScore } = require('./services/assignmentService');

const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Paul', 'Ashley', 'Steven', 'Dorothy', 'Andrew', 'Kimberly', 'Kenneth', 'Emily', 'Joshua', 'Donna'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'];

const getRandomName = () => {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${first} ${last}`;
};

const parseCsvLine = (text) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const runSeeding = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB for mega-corp seeding...');

    const tenantId = 'mega-corp';

    // 1. Create or clear Tenant document
    await Tenant.deleteOne({ subdomain: tenantId });
    const tenant = await Tenant.create({
      name: "Mega Corporation",
      subdomain: tenantId,
      branding: {
        websiteName: "MegaCorp Portal",
        websiteDescription: "Enterprise Citizen Incident and Asset Portal",
        primaryColor: "#0f766e", // Teal
        secondaryColor: "#111827"
      }
    });
    console.log('Tenant "mega-corp" created successfully.');

    // Run remaining steps inside AsyncLocalStorage context
    await new Promise((resolve, reject) => {
      tenantLocalStorage.run(tenantId, async () => {
        try {
          // 2. Clear existing records for this tenant only
          console.log('Clearing old tenant records for mega-corp...');
          await User.deleteMany({});
          await Category.deleteMany({});
          await DepartmentCategory.deleteMany({});
          await Department.deleteMany({});
          await EscalationGroup.deleteMany({});
          await EscalationRule.deleteMany({});
          await Asset.deleteMany({});
          await AssetCategory.deleteMany({});
          await AssetType.deleteMany({});
          await Ticket.deleteMany({});
          await GlobalUser.deleteMany({ tenantId });
          // Clear tenant-scoped counters
          await Counter.deleteMany({ _id: { $regex: new RegExp(`.*_${tenantId}.*`) } });
          await Counter.deleteOne({ _id: `complaintTrackingId_${tenantId}` });
          console.log('Cleaned up previous mega-corp data.');

          // 3. Seed tenant defaults (roles, metadata, calendar, SLA, default categories)
          await seedTenantDefaults(tenantId);
          console.log('Seeded tenant defaults.');

          // 4. Create custom Departments
          const deptIT = await Department.create({
            name: 'IT & Technical Services',
            description: 'Handles hardware deployments, software issues, access management, and infrastructure outages.'
          });
          const deptFacilities = await Department.create({
            name: 'Facilities & Operations',
            description: 'Responsible for office management, desk allocation, hardware repairs, plumbing, HVAC, and cleaning.'
          });
          const deptFinance = await Department.create({
            name: 'Customer Billings & Finance',
            description: 'Processes invoices, billing queries, transaction issues, and refund requests.'
          });
          const deptSecurity = await Department.create({
            name: 'Corporate Safety & Security',
            description: 'Manages physical security, building access badges, tailgating incidents, and security audits.'
          });
          const deptAdmin = await Department.create({
            name: 'General Administration',
            description: 'Coordinates organizational policies, system configurations, and general administrative inquiries.'
          });
          console.log('Custom departments created.');

          // Retrieve category templates
          const catHardware = await Category.findOne({ name: 'IT Hardware' });
          const catSoftware = await Category.findOne({ name: 'IT Software' });
          const catFacilities = await Category.findOne({ name: 'Facilities & Maintenance' });
          const catInquiry = await Category.findOne({ name: 'General Inquiry' });

          const reqType = await TicketType.findOne({ name: 'Service Request' });
          const incType = await TicketType.findOne({ name: 'Incident' });
          const cmsType = await TicketType.findOne({ name: 'Complaint' });
          const defaultTypes = [reqType?._id, incType?._id, cmsType?._id].filter(Boolean);

          // Create new custom category
          const catBilling = await Category.create({
            name: 'Billing & Refunds',
            description: 'Billing disputes, double charges, incorrect line items, or tax disputes on invoices.',
            ticketTypes: defaultTypes
          });

          // Link categories to custom departments
          await DepartmentCategory.create([
            { department: deptIT._id, category: catHardware._id },
            { department: deptIT._id, category: catSoftware._id },
            { department: deptFacilities._id, category: catFacilities._id },
            { department: deptFinance._id, category: catBilling._id },
            { department: deptAdmin._id, category: catInquiry._id }
          ]);
          console.log('Categories linked to custom departments.');

          // 5. Pre-hash password for quick user creation
          console.log('Generating pre-hashed password for seeding users...');
          const hashedPassword = await bcrypt.hash('password', 10);

          // 6. Create Super Admin
          const superAdminId = new mongoose.Types.ObjectId();
          const superAdmin = {
            _id: superAdminId,
            name: 'Alex Mercer (Super Admin)',
            email: 'superadmin@megacorp.com',
            password: hashedPassword,
            role: 'admin',
            department: 'General Administration',
            maxCapacity: 30,
            availabilityStatus: 'Available',
            isVerified: true,
            tenantId
          };

          // 7. Generate 50 Staff users
          const staffDocs = [];
          const l1StaffIds = [];
          const l2StaffIds = [];
          const l3StaffIds = [];

          // Generate 25 L1 staff
          for (let i = 1; i <= 25; i++) {
            const id = new mongoose.Types.ObjectId();
            l1StaffIds.push(id);
            staffDocs.push({
              _id: id,
              name: `${getRandomName()} (L1 Agent)`,
              email: `staff.l1.${i}@megacorp.com`,
              password: hashedPassword,
              role: 'admin',
              department: i <= 15 ? 'IT & Technical Services' : i <= 20 ? 'Facilities & Operations' : 'Customer Billings & Finance',
              maxCapacity: 20,
              availabilityStatus: 'Available',
              isVerified: true,
              tenantId
            });
          }

          // Generate 15 L2 staff
          for (let i = 1; i <= 15; i++) {
            const id = new mongoose.Types.ObjectId();
            l2StaffIds.push(id);
            staffDocs.push({
              _id: id,
              name: `${getRandomName()} (L2 Specialist)`,
              email: `staff.l2.${i}@megacorp.com`,
              password: hashedPassword,
              role: 'admin',
              department: i <= 10 ? 'IT & Technical Services' : i <= 13 ? 'Facilities & Operations' : 'Customer Billings & Finance',
              maxCapacity: 15,
              availabilityStatus: 'Available',
              isVerified: true,
              tenantId
            });
          }

          // Generate 10 L3 staff
          for (let i = 1; i <= 10; i++) {
            const id = new mongoose.Types.ObjectId();
            l3StaffIds.push(id);
            staffDocs.push({
              _id: id,
              name: `${getRandomName()} (L3 Engineer)`,
              email: `staff.l3.${i}@megacorp.com`,
              password: hashedPassword,
              role: 'admin',
              department: i <= 7 ? 'IT & Technical Services' : i <= 9 ? 'Facilities & Operations' : 'Corporate Safety & Security',
              maxCapacity: 10,
              availabilityStatus: 'Available',
              isVerified: true,
              tenantId
            });
          }

          // Insert staff and super admin
          const allStaffToInsert = [superAdmin, ...staffDocs];
          await User.insertMany(allStaffToInsert);
          console.log(`Inserted 1 Super Admin and 50 Staff users.`);

          // Register in Central GlobalUser collection
          const globalStaffDocs = allStaffToInsert.map(s => ({
            email: s.email.toLowerCase(),
            tenantId,
            userId: s._id
          }));
          await GlobalUser.insertMany(globalStaffDocs);

          // 8. Create Escalation Groups
          const groupL1 = await EscalationGroup.create({
            name: 'L1 Support Group',
            description: 'First-line support agents handling triage, basic hardware diagnostics, and general software issues.',
            leader: l1StaffIds[0],
            members: l1StaffIds,
            department: deptIT._id
          });

          const groupL2 = await EscalationGroup.create({
            name: 'L2 Support Group',
            description: 'Second-line specialists resolving complex hardware configuration, network problems, and billing reviews.',
            leader: l2StaffIds[0],
            members: l2StaffIds,
            department: deptIT._id
          });

          const groupL3 = await EscalationGroup.create({
            name: 'L3 Support Group',
            description: 'Third-line engineering team handling critical server deployments, codebase bugs, security breaches, and vendor relations.',
            leader: l3StaffIds[0],
            members: l3StaffIds,
            department: deptIT._id
          });

          const groupAdmin = await EscalationGroup.create({
            name: 'General Administration Team',
            description: 'General system configuration, workspace settings, and corporate policies.',
            leader: superAdminId,
            members: [superAdminId],
            department: deptAdmin._id
          });

          console.log('Escalation Groups (L1, L2, L3, Admin) created successfully.');

          // Link groups back to staff users
          await User.updateMany({ _id: { $in: l1StaffIds } }, { $set: { groups: [groupL1._id] } });
          await User.updateMany({ _id: { $in: l2StaffIds } }, { $set: { groups: [groupL2._id] } });
          await User.updateMany({ _id: { $in: l3StaffIds } }, { $set: { groups: [groupL3._id] } });
          await User.updateOne({ _id: superAdminId }, { $set: { groups: [groupAdmin._id] } });

          // 9. Create Escalation Rules mapping categories to L1 -> L2 -> L3 tiers
          const createRule = async (cat, dept, name) => {
            await EscalationRule.create({
              ticketTypeId: incType?._id, // incident type
              departmentId: dept._id,
              categoryId: cat._id,
              categoryName: cat.name,
              workflowName: name,
              levels: [
                {
                  level: 1,
                  durationHours: 4,
                  targetType: 'group',
                  targetId: groupL1._id.toString(),
                  responseSlaMinutes: 30,
                  resolutionSlaMinutes: 240,
                  description: 'First line triage by L1 Group'
                },
                {
                  level: 2,
                  durationHours: 8,
                  targetType: 'group',
                  targetId: groupL2._id.toString(),
                  responseSlaMinutes: 15,
                  resolutionSlaMinutes: 120,
                  description: 'Technical troubleshooting by L2 Group'
                },
                {
                  level: 3,
                  durationHours: 24,
                  targetType: 'group',
                  targetId: groupL3._id.toString(),
                  responseSlaMinutes: 5,
                  resolutionSlaMinutes: 60,
                  description: 'Engineering resolution by L3 Group'
                }
              ],
              isActive: true
            });
          };

          await createRule(catHardware, deptIT, 'Hardware Multi-Tier SLA Escalation');
          await createRule(catSoftware, deptIT, 'Software Access SLA Escalation');
          await createRule(catFacilities, deptFacilities, 'Facilities Maintenance Escalation Workflow');
          await createRule(catBilling, deptFinance, 'Finance & Refunds Escalation Workflow');
          console.log('Escalation rules seeded for categories.');

          // 10. Generate 330 Citizen Users
          const citizenDocs = [];
          const citizenIds = [];
          for (let i = 1; i <= 330; i++) {
            const id = new mongoose.Types.ObjectId();
            citizenIds.push(id);
            citizenDocs.push({
              _id: id,
              name: getRandomName(),
              email: `citizen.${i}@megacorp.com`,
              password: hashedPassword,
              role: 'citizen',
              department: ['IT & Technical Services', 'Facilities & Operations', 'Customer Billings & Finance', 'General Administration'][Math.floor(Math.random() * 4)],
              maxCapacity: 20,
              availabilityStatus: 'Available',
              isVerified: true,
              tenantId
            });
          }
          await User.insertMany(citizenDocs);
          console.log('Inserted 330 citizen users.');

          // Sync Citizens to Central GlobalUser
          const globalCitizenDocs = citizenDocs.map(c => ({
            email: c.email.toLowerCase(),
            tenantId,
            userId: c._id
          }));
          await GlobalUser.insertMany(globalCitizenDocs);

          // 11. Seed 550 Assets from laptops.csv
          console.log('Seeding 550 assets...');
          const astCatLaptops = await AssetCategory.create({
            name: 'Laptops',
            description: 'Corporate client computing workstations',
            icon: 'Laptop',
            color: '#0f766e'
          });

          const astTypeDevLaptop = await AssetType.create({
            categoryId: astCatLaptops._id,
            name: 'Developer Laptop',
            description: 'Standard developer workstation laptop',
            assetPrefix: 'LAP',
            lifecycleStatuses: ['Active', 'In Store', 'Retired', 'Under Repair'],
            dynamicFields: [
              { fieldKey: 'ram_gb', label: 'RAM (GB)', type: 'number', required: true },
              { fieldKey: 'storage_gb', label: 'Storage (GB)', type: 'number', required: true },
              { fieldKey: 'os', label: 'Operating System', type: 'select', required: true, options: ['Windows 11 Pro', 'macOS Sequoia', 'Ubuntu Linux'] }
            ]
          });

          const csvPath = path.join(__dirname, '../laptops.csv');
          let assetsInserted = 0;
          const assetDocs = [];

          if (fs.existsSync(csvPath)) {
            const csvData = fs.readFileSync(csvPath, 'utf8');
            const csvLines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');

            // We need 550 assets. Loop through csv multiple times if necessary, or just extract first 550 rows.
            for (let i = 1; i <= 550; i++) {
              // Wrap lines if index exceeds csv length
              const lineIdx = ((i - 1) % (csvLines.length - 1)) + 1;
              const line = csvLines[lineIdx];
              const cols = parseCsvLine(line);

              if (cols.length < 22) continue;
              const brand = cols[1];
              const model = cols[2];
              const ram = parseInt(cols[9]) || 16;
              const storage = parseInt(cols[11]) || 512;
              const rawOs = cols[20] ? cols[20].toLowerCase() : 'windows';

              let os = 'Windows 11 Pro';
              if (rawOs.includes('mac')) os = 'macOS Sequoia';
              else if (rawOs.includes('ubuntu') || rawOs.includes('linux')) os = 'Ubuntu Linux';

              // 250 assets owned by generated users, 300 owned by random emails
              let ownerEmail = '';
              let ownerUserId = null;
              if (i <= 250) {
                // Pick a citizen or staff user
                const userObj = i <= 200 ? citizenDocs[i - 1] : staffDocs[i - 201];
                ownerEmail = userObj.email;
                ownerUserId = userObj._id;
              } else {
                ownerEmail = `external.employee.${i - 250}@randomcorp.com`;
              }

              const purchaseDate = new Date();
              purchaseDate.setMonth(purchaseDate.getMonth() - Math.floor(Math.random() * 24));
              const warrantyExpiry = new Date(purchaseDate);
              warrantyExpiry.setFullYear(warrantyExpiry.getFullYear() + 3);

              assetDocs.push({
                _id: new mongoose.Types.ObjectId(),
                tenantId,
                assetCode: `LAP-${String(i).padStart(6, '0')}`,
                name: model,
                description: `${brand.toUpperCase()} workstation from inventory index ${i}`,
                categoryId: astCatLaptops._id,
                assetTypeId: astTypeDevLaptop._id,
                departmentId: deptIT._id,
                ownerUserId,
                ownerEmail,
                custodianUserId: ownerUserId,
                custodianEmail: ownerEmail,
                status: i % 15 === 0 ? 'Under Repair' : i % 25 === 0 ? 'In Store' : 'Active',
                purchaseDate,
                warrantyExpiry,
                location: `HQ Office Building ${String.fromCharCode(65 + (i % 6))}, Floor ${1 + (i % 5)} Desk ${i % 100}`,
                serialNumber: `SN-${brand.toUpperCase()}-${i}-${Math.floor(100000 + Math.random() * 900000)}`,
                dynamicValues: {
                  ram_gb: ram,
                  storage_gb: storage,
                  os
                }
              });
            }

            await Asset.insertMany(assetDocs);
            assetsInserted = assetDocs.length;
            console.log(`Successfully seeded ${assetsInserted} assets.`);

            // Initialize counter for future assets
            await Counter.create({
              _id: `assetCode_${tenantId}_lap`,
              seq: assetsInserted
            });
          } else {
            console.error('laptops.csv not found!');
            reject(new Error('laptops.csv not found'));
            return;
          }

          // 12. Skip seeding tickets per user request (Only initialize counters)
          console.log('Initializing counters for tickets at 1000...');
          await Counter.create([
            { _id: `ticketTrackingId_${tenantId}_inc`, seq: 1000 },
            { _id: `ticketTrackingId_${tenantId}_req`, seq: 1000 },
            { _id: `complaintTrackingId_${tenantId}`, seq: 1000 }
          ]);
          console.log('Seeded counters for tickets.');

          // 13. Recalculate workloads for all staff members
          console.log('Calculating workload scores for all staff users...');
          const adminUsers = await User.find({ role: 'admin' });
          for (const staff of adminUsers) {
            await calculateWorkloadScore(staff);
          }
          console.log('Workload scores calculated successfully.');

          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });

    console.log('=== MEGA-CORP TENANT DATA SEEDED COMPLETED SUCCESSFULLY! ===');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

runSeeding();
