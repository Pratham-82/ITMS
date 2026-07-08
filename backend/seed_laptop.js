const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('./config/db');
const mongoose = require('mongoose');
const User = require('./models/User');
const Category = require('./models/Category');
const Counter = require('./models/Counter');
const Settings = require('./models/Settings');
const Department = require('./models/Department');
const DepartmentCategory = require('./models/DepartmentCategory');
const EscalationGroup = require('./models/EscalationGroup');
const Asset = require('./models/Asset');
const AssetCategory = require('./models/AssetCategory');
const AssetType = require('./models/AssetType');
const ServiceCatalog = require('./models/ServiceCatalog');
const Service = require('./models/Service');
const tenantLocalStorage = require('./middleware/tenantContext');
const { seedTenantDefaults } = require('./services/tenantDefaults');
const Ticket = require('./models/Ticket');
const TicketType = require('./models/TicketType');

const parseCsvLine = (line) => {
  const matches = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      matches.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  matches.push(current.trim());
  return matches;
};

const seedLaptopTenant = async () => {
  try {
    await connectDB();
    console.log('Database connected. Starting laptop tenant seeding...');

    // Run inside tenantLocalStorage context for 'laptop'
    await new Promise((resolve, reject) => {
      tenantLocalStorage.run('laptop', async () => {
        try {
          // 1. Clear any existing laptop tenant scoped collections
          await User.deleteMany({});
          await Category.deleteMany({});
          await DepartmentCategory.deleteMany({});
          await Department.deleteMany({});
          await EscalationGroup.deleteMany({});
          await Asset.deleteMany({});
          await AssetCategory.deleteMany({});
          await AssetType.deleteMany({});
          await ServiceCatalog.deleteMany({});
          await Service.deleteMany({});
          await Ticket.deleteMany({});
          
          console.log('Existing laptop tenant records cleared.');

          // 2. Seed basic tenant defaults (TicketTypes, Categories, Calendars, SLA, Metadata Definitions)
          await seedTenantDefaults('laptop');
          console.log('Laptop tenant defaults seeded.');

          // 3. Create specific core departments for the Laptop Organization
          const deptProcurement = await Department.create({
            name: 'Laptop Procurement & IT',
            description: 'Responsible for laptop asset procurement, inventory levels, and laptop provisioning.'
          });

          const deptRepairs = await Department.create({
            name: 'Hardware Repairs & Lifecycle',
            description: 'Handles physical damage repair, battery degradation, keyboard fixes, and warranty returns.'
          });

          const deptDiagnostics = await Department.create({
            name: 'System Diagnostics & OS',
            description: 'Troubleshoots operating system crashes, software licensing, and access credentials.'
          });

          const deptAdmin = await Department.create({
            name: 'General Administration',
            description: 'General administration, organization-wide coordination, system configuration settings.'
          });

          console.log('Laptop organization departments created.');

          // 4. Create custom categories and map them to departments
          const catBrokenScreen = await Category.create({
            name: 'Broken Laptop Display',
            description: 'Cracked laptop screen, flickering display, or display backlights not working.',
            fields: [
              { label: 'Screen Size (Inches)', type: 'select', required: true, options: ['13"', '14"', '15"', '16"'] },
              { label: 'Asset Code', type: 'text', required: true }
            ]
          });

          const catBattery = await Category.create({
            name: 'Battery Replacement Request',
            description: 'Fast battery draining, battery swollen, or laptop not charging.',
            fields: [
              { label: 'Current Battery Health %', type: 'number', required: true },
              { label: 'Laptop Serial Number', type: 'text', required: true }
            ]
          });

          const catKeyboard = await Category.create({
            name: 'Keyboard / Trackpad Issue',
            description: 'Keys not responding, trackpad unresponsive, or physical key caps missing.',
            fields: [
              { label: 'Faulty Keys Description', type: 'text', required: false }
            ]
          });

          const catBootFailure = await Category.create({
            name: 'Laptop Boot Failure',
            description: 'Blue Screen of Death (BSOD), kernel panic, folder question mark icon, or device stuck on boot loop.',
            fields: [
              { label: 'OS Installed', type: 'select', required: true, options: ['macOS Sequoia', 'Windows 11 Pro', 'Ubuntu Linux'] },
              { label: 'Error message shown on screen', type: 'text', required: false }
            ]
          });

          const catReplacement = await Category.create({
            name: 'Laptop Upgrade Request',
            description: 'Request additional RAM or larger storage SSD capacity for development requirements.',
            fields: [
              { label: 'RAM Required (GB)', type: 'select', required: true, options: ['32', '64', '96'] },
              { label: 'Storage Required (GB)', type: 'select', required: true, options: ['512', '1024', '2048'] },
              { label: 'Manager Approval Code', type: 'text', required: true }
            ]
          });

          // Link categories to departments
          await DepartmentCategory.create([
            { department: deptProcurement._id, category: catReplacement._id },
            { department: deptRepairs._id, category: catBrokenScreen._id },
            { department: deptRepairs._id, category: catBattery._id },
            { department: deptRepairs._id, category: catKeyboard._id },
            { department: deptDiagnostics._id, category: catBootFailure._id }
          ]);

          console.log('Categories created and mapped.');

          // 5. Create Staff/Admins users
          const admin = await User.create({
            name: 'Sarah Jenkins (Procurement Super Admin)',
            email: 'admin@laptop.com',
            password: 'password',
            role: 'admin',
            department: 'General Administration',
            maxCapacity: 20,
            availabilityStatus: 'Available'
          });

          const techBob = await User.create({
            name: 'Bob Miller (Hardware Specialist)',
            email: 'bob@laptop.com',
            password: 'password',
            role: 'admin',
            maxCapacity: 15,
            availabilityStatus: 'Available'
          });

          const techJohn = await User.create({
            name: 'John Davis (Junior Repair Tech)',
            email: 'john@laptop.com',
            password: 'password',
            role: 'admin',
            maxCapacity: 12,
            availabilityStatus: 'Available'
          });

          const techMike = await User.create({
            name: 'Mike Vance (OS Systems Engineer)',
            email: 'mike@laptop.com',
            password: 'password',
            role: 'admin',
            maxCapacity: 18,
            availabilityStatus: 'Available'
          });

          console.log('Staff users created.');

          // 6. Create Support Groups/Teams (independent of departments, but linked for default routing)
          const groupProcurement = await EscalationGroup.create({
            name: 'IT Procurement Team',
            description: 'Coordinates orders, manages laptop inventory, and handles upgrades.',
            leader: admin._id,
            members: [admin._id],
            department: deptProcurement._id
          });

          const groupRepairs = await EscalationGroup.create({
            name: 'Hardware L1 Support',
            description: 'Primary team for diagnosing keyboard issues, swollen batteries, and display damages.',
            leader: techBob._id,
            members: [techBob._id, techJohn._id],
            department: deptRepairs._id
          });

          const groupDiagnostics = await EscalationGroup.create({
            name: 'OS Diagnostics Team',
            description: 'Advanced systems diagnostic team handling OS corruptions, kernel failures, and software errors.',
            leader: techMike._id,
            members: [techMike._id],
            department: deptDiagnostics._id
          });

          const groupAdmin = await EscalationGroup.create({
            name: 'General Administration Team',
            description: 'System configuration, SLA policies, and administrative operations.',
            leader: admin._id,
            members: [admin._id],
            department: deptAdmin._id
          });

          // Link users to their groups
          admin.groups = [groupProcurement._id, groupAdmin._id];
          await admin.save();

          techBob.groups = [groupRepairs._id];
          await techBob.save();

          techJohn.groups = [groupRepairs._id];
          await techJohn.save();

          techMike.groups = [groupDiagnostics._id];
          await techMike.save();

          // Set default department routing groups
          deptProcurement.routingGroup = groupProcurement._id;
          await deptProcurement.save();

          deptRepairs.routingGroup = groupRepairs._id;
          await deptRepairs.save();

          deptDiagnostics.routingGroup = groupDiagnostics._id;
          await deptDiagnostics.save();

          deptAdmin.routingGroup = groupAdmin._id;
          await deptAdmin.save();

          console.log('Support groups created and linked to departments.');

          // 7. Seed CMDB Asset Category, Types and Assets
          const astCatLaptops = await AssetCategory.create({
            name: 'Laptops',
            description: 'Corporate client computing machines',
            icon: 'Laptop',
            color: '#6366f1'
          });

          const astTypeDevLaptop = await AssetType.create({
            categoryId: astCatLaptops._id,
            name: 'Developer Laptop',
            description: 'High-end developer workstation',
            assetPrefix: 'LAP',
            lifecycleStatuses: ['Active', 'In Store', 'Retired', 'Under Repair'],
            dynamicFields: [
              { fieldKey: 'ram_gb', label: 'RAM (GB)', type: 'number', required: true },
              { fieldKey: 'storage_gb', label: 'Storage (GB)', type: 'number', required: true },
              { fieldKey: 'os', label: 'Operating System', type: 'select', required: true, options: ['Windows 11 Pro', 'macOS Sequoia', 'Ubuntu Linux'] }
            ]
          });

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

          console.log('Asset categories and types seeded.');

          // Parse and seed assets from laptops.csv
          console.log('Reading and parsing laptops.csv...');
          const fs = require('fs');
          const path = require('path');
          
          const csvPath = path.join(__dirname, '../laptops.csv');
          if (fs.existsSync(csvPath)) {
            const csvData = fs.readFileSync(csvPath, 'utf8');
            const csvLines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
            
            const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
            const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
            
            const depts = [deptProcurement._id, deptRepairs._id, deptDiagnostics._id];
            const assetsToInsert = [];
            
            for (let i = 1; i < csvLines.length; i++) {
              const line = csvLines[i];
              const cols = parseCsvLine(line);
              if (cols.length < 22) continue;
              
              const idx = cols[0];
              const brand = cols[1];
              const model = cols[2];
              const ram = parseInt(cols[9]) || 8;
              const storage = parseInt(cols[11]) || 512;
              const rawOs = cols[20] ? cols[20].toLowerCase() : 'windows';
              const warrantyYears = parseInt(cols[21]) || 1;
              
              let os = 'Windows 11 Pro';
              if (rawOs.includes('mac')) {
                os = 'macOS Sequoia';
              } else if (rawOs.includes('ubuntu') || rawOs.includes('linux')) {
                os = 'Ubuntu Linux';
              }
              
              const randomEmail = `${firstNames[Math.floor(Math.random() * firstNames.length)].toLowerCase()}.${lastNames[Math.floor(Math.random() * lastNames.length)].toLowerCase()}${idx}@laptop.com`;
              
              const purchaseDate = new Date();
              purchaseDate.setMonth(purchaseDate.getMonth() - Math.floor(Math.random() * 24)); // purchased in last 24 months
              
              const warrantyExpiry = new Date(purchaseDate);
              warrantyExpiry.setFullYear(warrantyExpiry.getFullYear() + warrantyYears);
              
              const serialNum = `SN-${brand.toUpperCase()}-${idx}-${Math.floor(100000 + Math.random() * 900000)}`;
              
              assetsToInsert.push({
                tenantId: 'laptop',
                assetCode: `LAP-${String(idx).padStart(6, '0')}`,
                name: model,
                description: `${brand.toUpperCase()} laptop from database index ${idx}`,
                categoryId: astCatLaptops._id,
                assetTypeId: astTypeDevLaptop._id,
                departmentId: depts[Math.floor(Math.random() * depts.length)],
                ownerEmail: randomEmail,
                custodianEmail: randomEmail,
                status: 'Active',
                purchaseDate,
                warrantyExpiry,
                location: `HQ Block ${String.fromCharCode(65 + Math.floor(Math.random() * 6))}, Floor ${Math.floor(1 + Math.random() * 5)}`,
                serialNumber: serialNum,
                dynamicValues: {
                  ram_gb: ram,
                  storage_gb: storage,
                  os
                }
              });
            }
            
            console.log(`Prepared ${assetsToInsert.length} laptop assets to seed.`);
            await Asset.insertMany(assetsToInsert);
            console.log('Seeded assets in bulk successfully.');
            
            // Find 3 assets and assign them to Alice, Charlie, David for ticket dependency
            const loadedAssets = await Asset.find({ tenantId: 'laptop' }).limit(3);
            if (loadedAssets.length >= 3) {
              loadedAssets[0].ownerEmail = 'alice@laptop.com';
              loadedAssets[0].custodianEmail = 'alice@laptop.com';
              loadedAssets[0].name = 'MacBook Pro 16" (Alice)';
              await loadedAssets[0].save();

              loadedAssets[1].ownerEmail = 'charlie@laptop.com';
              loadedAssets[1].custodianEmail = 'charlie@laptop.com';
              loadedAssets[1].name = 'ThinkPad T14 Gen 4 (Charlie)';
              await loadedAssets[1].save();

              loadedAssets[2].ownerEmail = 'david@laptop.com';
              loadedAssets[2].custodianEmail = 'david@laptop.com';
              loadedAssets[2].name = 'Dell XPS 15 (David)';
              await loadedAssets[2].save();
            }
          } else {
            console.error('laptops.csv not found at:', csvPath);
          }

          // 8. Create Service Catalog and Services
          const catalog = await ServiceCatalog.create({
            name: 'Laptop Lifecycle Catalog',
            description: 'Request new laptops, upgrades, repairs and disposals.',
            icon: 'Laptop',
            color: '#6366f1'
          });

          const srvReplacement = await Service.create({
            catalog: catalog._id,
            name: 'Request Laptop Replacement',
            description: 'Order a replacement laptop if your current device is slow, damaged, or reaches lifecycle end.',
            fields: [
              { label: 'Reason for Replacement', type: 'textarea', required: true },
              { label: 'Model Preference', type: 'select', required: true, options: ['MacBook Pro 16"', 'ThinkPad T14', 'Dell XPS 15'] }
            ],
            assignment: {
              department: deptProcurement._id,
              group: groupProcurement._id,
              staff: admin._id
            }
          });

          const srvUpgrade = await Service.create({
            catalog: catalog._id,
            name: 'RAM & Storage Upgrade',
            description: 'Request an hardware upgrade to increase RAM or storage space on your assigned workstation.',
            fields: [
              { label: 'RAM Target Size', type: 'select', required: true, options: ['16GB', '32GB', '64GB'] },
              { label: 'Storage Target Size', type: 'select', required: true, options: ['512GB SSD', '1TB SSD', '2TB SSD'] }
            ],
            assignment: {
              department: deptRepairs._id,
              group: groupRepairs._id,
              staff: techBob._id
            }
          });

          console.log('Service catalogs and IT services seeded.');

          // 9. Recalculate workloads
          const { calculateWorkloadScore } = require('./services/assignmentService');
          await calculateWorkloadScore(admin);
          await calculateWorkloadScore(techBob);
          await calculateWorkloadScore(techJohn);
          await calculateWorkloadScore(techMike);
          console.log('Workload scores calculated.');

          // 10. Seed Citizen Users
          const citizenAlice = await User.create({
            name: 'Alice Cooper',
            email: 'alice@laptop.com',
            password: 'password',
            role: 'citizen',
            department: 'Laptop Procurement & IT'
          });

          const citizenCharlie = await User.create({
            name: 'Charlie Brown',
            email: 'charlie@laptop.com',
            password: 'password',
            role: 'citizen',
            department: 'Hardware Repairs & Lifecycle'
          });

          const citizenDavid = await User.create({
            name: 'David Beckham',
            email: 'david@laptop.com',
            password: 'password',
            role: 'citizen',
            department: 'System Diagnostics & OS'
          });
          console.log('Citizen users seeded.');

          // 11. Retrieve TicketTypes
          const typeIncident = await TicketType.findOne({ code: 'INC' });
          const typeServiceRequest = await TicketType.findOne({ code: 'REQ' });
          const typeComplaint = await TicketType.findOne({ code: 'CMS' });

          // Retrieve Assets
          const assetAlice = await Asset.findOne({ ownerEmail: 'alice@laptop.com' });
          const assetCharlie = await Asset.findOne({ ownerEmail: 'charlie@laptop.com' });
          const assetDavid = await Asset.findOne({ ownerEmail: 'david@laptop.com' });

          // 12. Seed Support Tickets/Complaints
          await Ticket.create({
            tenantId: 'laptop',
            ticketType: typeIncident._id,
            title: 'Flickering Display & Cracked Glass',
            description: 'My MacBook screen is flickering constantly, and there is a hairline crack near the top edge. It makes it very hard to see anything.',
            department: deptRepairs._id,
            category: catBrokenScreen._id,
            categoryName: 'Broken Laptop Display',
            priority: 'High',
            status: 'Assigned',
            citizen: citizenAlice._id,
            assignedTo: techBob._id,
            assignedGroup: groupRepairs._id,
            assignedDepartment: deptRepairs.name,
            customFields: {
              'Screen Size (Inches)': '16"',
              'Asset Code': assetAlice ? assetAlice.serialNumber : 'SN-APPLE-M3MAX-9871'
            },
            relatedAssets: assetAlice ? [assetAlice._id] : [],
            responseSlaStatus: 'Within SLA',
            resolutionSlaStatus: 'Within SLA'
          });

          await Ticket.create({
            tenantId: 'laptop',
            ticketType: typeIncident._id,
            title: 'Stuck on Windows Boot Loop',
            description: 'My Dell laptop restarted after an update and now gets stuck on the loading circle or shows a blue screen error INACCESSIBLE_BOOT_DEVICE.',
            department: deptDiagnostics._id,
            category: catBootFailure._id,
            categoryName: 'Laptop Boot Failure',
            priority: 'Critical',
            status: 'Pending',
            citizen: citizenDavid._id,
            assignedTo: techMike._id,
            assignedGroup: groupDiagnostics._id,
            assignedDepartment: deptDiagnostics.name,
            customFields: {
              'OS Installed': 'Windows 11 Pro',
              'Error message shown on screen': 'INACCESSIBLE_BOOT_DEVICE Blue Screen'
            },
            relatedAssets: assetDavid ? [assetDavid._id] : [],
            responseSlaStatus: 'Within SLA',
            resolutionSlaStatus: 'Within SLA'
          });

          await Ticket.create({
            tenantId: 'laptop',
            ticketType: typeComplaint._id,
            title: 'Spacebar and Enter key completely unresponsive',
            description: 'The spacebar key got stuck and now does not click. The enter key also requires high pressure to register.',
            department: deptRepairs._id,
            category: catKeyboard._id,
            categoryName: 'Keyboard / Trackpad Issue',
            priority: 'Medium',
            status: 'Pending',
            citizen: citizenCharlie._id,
            assignedTo: techJohn._id,
            assignedGroup: groupRepairs._id,
            assignedDepartment: deptRepairs.name,
            customFields: {
              'Faulty Keys Description': 'Spacebar key is physically sticky, Enter key requires extreme force.'
            },
            relatedAssets: assetCharlie ? [assetCharlie._id] : [],
            responseSlaStatus: 'Within SLA',
            resolutionSlaStatus: 'Within SLA'
          });

          await Ticket.create({
            tenantId: 'laptop',
            ticketType: typeServiceRequest._id,
            title: 'Request for RAM/Storage Upgrade for Dev Environment',
            description: 'I need to run multiple docker containers and need 64GB RAM. My manager CHARLIE has approved this.',
            department: deptProcurement._id,
            category: catReplacement._id,
            categoryName: 'Laptop Upgrade Request',
            priority: 'Low',
            status: 'Assigned',
            citizen: citizenAlice._id,
            assignedTo: admin._id,
            assignedGroup: groupProcurement._id,
            assignedDepartment: deptProcurement.name,
            customFields: {
              'RAM Required (GB)': '64',
              'Storage Required (GB)': '1024',
              'Manager Approval Code': 'MGR-APP-CHARLIE-99'
            },
            relatedAssets: assetAlice ? [assetAlice._id] : [],
            responseSlaStatus: 'Within SLA',
            resolutionSlaStatus: 'Within SLA'
          });

          console.log('Sample tickets/complaints seeded.');
          
          // Re-calculate workloads after assigning tickets
          await calculateWorkloadScore(admin);
          await calculateWorkloadScore(techBob);
          await calculateWorkloadScore(techJohn);
          await calculateWorkloadScore(techMike);
          console.log('Final workloads updated.');

          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });

    console.log('=== LAPTOP TENANT DEMO DATA SEEDED SUCCESSFULLY! ===');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding laptop tenant:', error);
    process.exit(1);
  }
};

seedLaptopTenant();
