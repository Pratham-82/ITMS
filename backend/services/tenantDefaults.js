const tenantLocalStorage = require('../middleware/tenantContext');
const TicketType = require('../models/TicketType');
const Category = require('../models/Category');
const BusinessCalendar = require('../models/BusinessCalendar');
const SlaConfiguration = require('../models/SlaConfiguration');
const Settings = require('../models/Settings');
const Department = require('../models/Department');
const DepartmentCategory = require('../models/DepartmentCategory');

const seedTenantDefaults = async (tenantId) => {
  return new Promise((resolve, reject) => {
    tenantLocalStorage.run(tenantId, async () => {
      try {
        console.log(`Seeding defaults for tenant: ${tenantId}`);

        // 1. Seed Ticket Types
        const ticketTypesCount = await TicketType.countDocuments({});
        if (ticketTypesCount === 0) {
          await TicketType.insertMany([
            {
              name: 'Incident',
              code: 'INC',
              description: 'An unplanned interruption to a service or reduction in service quality.',
              isActive: true,
              icon: 'ShieldAlert',
              color: '#ef4444',
              allowedRoles: ['citizen', 'admin'],
              settings: { enableSla: true, enableEscalation: true, enableAiRouting: true, enableDuplicateDetection: true }
            },
            {
              name: 'Service Request',
              code: 'REQ',
              description: 'A formal request from a user for something to be provided.',
              isActive: true,
              icon: 'FilePlus',
              color: '#3b82f6',
              allowedRoles: ['citizen', 'admin'],
              settings: { enableSla: true, enableEscalation: false, enableAiRouting: false, enableDuplicateDetection: false }
            },
            {
              name: 'Problem',
              code: 'PRB',
              description: 'The underlying cause of one or more incidents.',
              isActive: true,
              icon: 'AlertTriangle',
              color: '#f59e0b',
              allowedRoles: ['admin'],
              settings: { enableSla: false, enableEscalation: true, enableAiRouting: false, enableDuplicateDetection: false }
            },
            {
              name: 'Change',
              code: 'CHG',
              description: 'Addition, modification, or removal of anything that could affect IT services.',
              isActive: true,
              icon: 'SlidersHorizontal',
              color: '#10b981',
              allowedRoles: ['admin'],
              settings: { enableSla: false, enableEscalation: false, enableAiRouting: false, enableDuplicateDetection: false }
            },
            {
              name: 'Complaint',
              code: 'CMS',
              description: 'General feedback, complaint, or operational grievance from a citizen.',
              isActive: true,
              icon: 'FileText',
              color: '#f97316',
              allowedRoles: ['citizen', 'admin'],
              settings: { enableSla: true, enableEscalation: true, enableAiRouting: true, enableDuplicateDetection: true }
            },
            {
              name: 'Task',
              code: 'TSK',
              description: 'Operational task spawned internally or assigned to support agents.',
              isActive: true,
              icon: 'CheckCircle',
              color: '#8b5cf6',
              allowedRoles: ['admin'],
              settings: { enableSla: true, enableEscalation: false, enableAiRouting: false, enableDuplicateDetection: false }
            }
          ].map(type => ({ ...type, tenantId })));
        }

        // 2. Seed Default Categories
        const categoriesCount = await Category.countDocuments({});
        if (categoriesCount === 0) {
          // Find standard ticket types to link
          const reqType = await TicketType.findOne({ name: 'Service Request' });
          const incType = await TicketType.findOne({ name: 'Incident' });
          const cmsType = await TicketType.findOne({ name: 'Complaint' });
          
          const defaultTypes = [reqType?._id, incType?._id, cmsType?._id].filter(Boolean);

          await Category.insertMany([
            { name: 'IT Hardware', description: 'Computers, laptops, keyboards, mice, and other physical peripherals.', isActive: true, ticketTypes: defaultTypes },
            { name: 'IT Software', description: 'Software installs, licensing, operating systems, and access credentials.', isActive: true, ticketTypes: defaultTypes },
            { name: 'Facilities & Maintenance', description: 'Office environment, desks, chairs, lighting, and workspace support.', isActive: true, ticketTypes: defaultTypes },
            { name: 'General Inquiry', description: 'General questions or feedback unrelated to system incidents.', isActive: true, ticketTypes: defaultTypes }
          ].map(cat => ({ ...cat, tenantId })));
        }

        // 2b. Seed Default Department & Link Categories
        const departmentCount = await Department.countDocuments({});
        if (departmentCount === 0) {
          const defaultDept = await Department.create({
            name: 'IT Support',
            description: 'Default IT support department handling all technical and operational issues.',
            isActive: true
          });

          // Fetch all categories seeded for this tenant
          const seededCategories = await Category.find({});
          const mappings = seededCategories.map(cat => ({
            department: defaultDept._id,
            category: cat._id,
            isActive: true,
            tenantId
          }));
          await DepartmentCategory.insertMany(mappings);
        }

        // 3. Seed Default Business Calendar
        const calendarsCount = await BusinessCalendar.countDocuments({});
        if (calendarsCount === 0) {
          await BusinessCalendar.create({
            name: 'Standard Working Hours',
            description: 'Standard 9 AM to 5 PM Monday through Friday working hours.',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            workingDays: [1, 2, 3, 4, 5],
            workingHours: { start: '09:00', end: '17:00' },
            isActive: true,
            isDefault: true
          });
        }

        // 4. Seed Default SLA Configuration
        const slasCount = await SlaConfiguration.countDocuments({});
        if (slasCount === 0) {
          await SlaConfiguration.create({
            name: 'Standard Enterprise SLA',
            isDefault: true,
            priorities: {
              Critical: { responseSlaMinutes: 15, resolutionSlaMinutes: 240 },
              High: { responseSlaMinutes: 60, resolutionSlaMinutes: 480 },
              Medium: { responseSlaMinutes: 240, resolutionSlaMinutes: 1440 },
              Low: { responseSlaMinutes: 480, resolutionSlaMinutes: 4320 }
            }
          });
        }

        // 5. Seed Branding Settings
        const settingsCount = await Settings.countDocuments({ key: 'system_branding' });
        if (settingsCount === 0) {
          await Settings.create({
            key: 'system_branding',
            websiteName: 'ApexResolve Service Desk',
            websiteDescription: 'Enterprise ITSM & CMDB Asset Management Portal',
            primaryColor: '#6366f1',
            contactEmail: `support@${tenantId}.com`,
            allowCitizenRegistration: true
          });
        }

        // 6. Seed Metadata core entity definitions
        const EntityDefinition = require('../models/EntityDefinition');
        const FieldDefinition = require('../models/FieldDefinition');
        const RelationshipDefinition = require('../models/RelationshipDefinition');

        const entityCount = await EntityDefinition.countDocuments({});
        if (entityCount === 0) {
          console.log(`Seeding core metadata definitions for tenant: ${tenantId}`);
          
          const coreEntities = [
            {
              code: 'TICKET',
              name: 'Ticket',
              pluralName: 'Tickets',
              description: 'Standard support tickets, incidents, and service requests.',
              category: 'Core',
              version: 1,
              icon: 'LifeBuoy',
              color: '#3b82f6',
              isSystem: true,
              isActive: true,
              supportsWorkflow: true,
              supportsApproval: true,
              supportsComments: true,
              supportsAttachments: true,
              supportsAudit: true
            },
            {
              code: 'ASSET',
              name: 'Asset',
              pluralName: 'Assets',
              description: 'Configuration items (CI), hardware units, and IT assets.',
              category: 'CMDB',
              version: 1,
              icon: 'Laptop',
              color: '#10b981',
              isSystem: true,
              isActive: true,
              supportsWorkflow: false,
              supportsApproval: false,
              supportsComments: true,
              supportsAttachments: true,
              supportsAudit: true
            },
            {
              code: 'LOCATION',
              name: 'Location',
              pluralName: 'Locations',
              description: 'Physical sites, office complexes, or data centers.',
              category: 'Core',
              version: 1,
              icon: 'MapPin',
              color: '#f59e0b',
              isSystem: true,
              isActive: true,
              supportsWorkflow: false,
              supportsApproval: false,
              supportsComments: false,
              supportsAttachments: false,
              supportsAudit: true
            },
            {
              code: 'PROBLEM',
              name: 'Problem',
              pluralName: 'Problems',
              description: 'Root cause investigations for multiple underlying incidents.',
              category: 'ITSM',
              version: 1,
              icon: 'AlertTriangle',
              color: '#ef4444',
              isSystem: true,
              isActive: true,
              supportsWorkflow: true,
              supportsApproval: false,
              supportsComments: true,
              supportsAttachments: false,
              supportsAudit: true
            },
            {
              code: 'CHANGE',
              name: 'Change Request',
              pluralName: 'Change Requests',
              description: 'System changes, maintenance tracking, and CAB approvals.',
              category: 'ITSM',
              version: 1,
              icon: 'SlidersHorizontal',
              color: '#8b5cf6',
              isSystem: true,
              isActive: true,
              supportsWorkflow: true,
              supportsApproval: true,
              supportsComments: true,
              supportsAttachments: true,
              supportsAudit: true
            }
          ];

          await EntityDefinition.insertMany(coreEntities);

          const coreFields = [
            // TICKET fields
            { entityCode: 'TICKET', fieldKey: 'title', fieldLabel: 'Title', fieldType: 'text', required: true, searchable: true, sortable: true, filterable: false, isSystem: true, order: 1 },
            { entityCode: 'TICKET', fieldKey: 'description', fieldLabel: 'Description', fieldType: 'textarea', required: false, searchable: true, sortable: false, filterable: false, isSystem: true, order: 2 },
            { entityCode: 'TICKET', fieldKey: 'status', fieldLabel: 'Status', fieldType: 'select', required: true, searchable: false, sortable: true, filterable: true, isSystem: true, order: 3 },
            
            // ASSET fields
            { entityCode: 'ASSET', fieldKey: 'name', fieldLabel: 'Asset Name', fieldType: 'text', required: true, searchable: true, sortable: true, filterable: false, isSystem: true, order: 1 },
            { entityCode: 'ASSET', fieldKey: 'assetTag', fieldLabel: 'Asset Tag', fieldType: 'text', required: true, unique: true, searchable: true, sortable: true, filterable: true, isSystem: true, order: 2 },
            { entityCode: 'ASSET', fieldKey: 'serialNumber', fieldLabel: 'Serial Number', fieldType: 'text', required: false, searchable: true, sortable: false, filterable: true, isSystem: true, order: 3 },
            
            // LOCATION fields
            { entityCode: 'LOCATION', fieldKey: 'name', fieldLabel: 'Location Name', fieldType: 'text', required: true, searchable: true, sortable: true, filterable: false, isSystem: true, order: 1 },
            { entityCode: 'LOCATION', fieldKey: 'code', fieldLabel: 'Location Code', fieldType: 'text', required: true, unique: true, searchable: true, sortable: true, filterable: true, isSystem: true, order: 2 }
          ];

          await FieldDefinition.insertMany(coreFields);

          const coreRelationships = [
            { sourceEntity: 'TICKET', targetEntity: 'LOCATION', relationshipType: 'located_at', cardinality: 'many-to-one', label: 'Ticket Location', isRequired: false },
            { sourceEntity: 'ASSET', targetEntity: 'LOCATION', relationshipType: 'deployed_at', cardinality: 'many-to-one', label: 'Asset Location', isRequired: false }
          ];

          await RelationshipDefinition.insertMany(coreRelationships);
          console.log(`Core metadata definitions seeded for tenant: ${tenantId}`);
        }

        console.log(`Seeding defaults complete for tenant: ${tenantId}`);
        resolve(true);
      } catch (err) {
        console.error(`Seeding failed for tenant: ${tenantId}`, err);
        reject(err);
      }
    });
  });
};

module.exports = { seedTenantDefaults };
