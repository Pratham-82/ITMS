const mongoose = require('mongoose');
const TicketType = require('../models/TicketType');
const Ticket = require('../models/Ticket');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const defaultTypes = [
  {
    name: 'Complaint',
    code: 'CMS',
    description: 'Citizen complaints and feedback regarding public services',
    icon: 'MessageSquare',
    color: '#f59e0b',
    allowedRoles: ['citizen', 'admin'],
    settings: {
      enableSla: true,
      enableEscalation: true,
      enableAiRouting: true,
      enableDuplicateDetection: true
    }
  },
  {
    name: 'Incident',
    code: 'INC',
    description: 'Unplanned interruption or reduction in quality of a service',
    icon: 'AlertTriangle',
    color: '#ef4444',
    allowedRoles: ['citizen', 'admin'],
    settings: {
      enableSla: true,
      enableEscalation: true,
      enableAiRouting: true,
      enableDuplicateDetection: true
    }
  },
  {
    name: 'Service Request',
    code: 'REQ',
    description: 'Formal request from a user for something to be provided',
    icon: 'ClipboardList',
    color: '#3b82f6',
    allowedRoles: ['citizen', 'admin'],
    settings: {
      enableSla: true,
      enableEscalation: true,
      enableAiRouting: true,
      enableDuplicateDetection: false
    }
  },
  {
    name: 'Problem',
    code: 'PRB',
    description: 'Cause of one or more incidents',
    icon: 'LifeBuoy',
    color: '#8b5cf6',
    allowedRoles: ['admin'],
    settings: {
      enableSla: true,
      enableEscalation: true,
      enableAiRouting: false,
      enableDuplicateDetection: false
    }
  },
  {
    name: 'Change',
    code: 'CHG',
    description: 'Addition, modification, or removal of anything that could affect IT services',
    icon: 'RefreshCw',
    color: '#10b981',
    allowedRoles: ['admin'],
    settings: {
      enableSla: true,
      enableEscalation: true,
      enableAiRouting: false,
      enableDuplicateDetection: false
    }
  },
  {
    name: 'Task',
    code: 'TSK',
    description: 'Activity assigned to a group or individual to complete',
    icon: 'CheckSquare',
    color: '#6b7280',
    allowedRoles: ['admin'],
    settings: {
      enableSla: false,
      enableEscalation: false,
      enableAiRouting: false,
      enableDuplicateDetection: false
    }
  }
];

async function runMigration() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/apexresolve';
  console.log(`Connecting to MongoDB at: ${mongoUri}`);
  
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  // 1. Seed Ticket Types
  console.log('\n[1] Seeding default Ticket Types...');
  const seededTypes = [];
  for (const typeData of defaultTypes) {
    let existing = await TicketType.findOne({ name: typeData.name });
    if (!existing) {
      existing = await TicketType.create(typeData);
      console.log(`Created Ticket Type: ${typeData.name} (${typeData.code})`);
    } else {
      console.log(`Ticket Type: ${typeData.name} already exists.`);
    }
    seededTypes.push(existing);
  }

  const complaintType = seededTypes.find(t => t.name === 'Complaint');
  if (!complaintType) {
    throw new Error('Could not find or seed "Complaint" Ticket Type.');
  }

  // 2. Map existing category-to-ticketType relationships
  console.log('\n[2] Linking existing Categories to Ticket Types...');
  const Category = require('../models/Category');
  const categories = await Category.find({});
  for (const cat of categories) {
    if (!cat.ticketTypes || cat.ticketTypes.length === 0) {
      const citizenTypeIds = seededTypes
        .filter(t => t.allowedRoles.includes('citizen'))
        .map(t => t._id);
      
      cat.ticketTypes = citizenTypeIds;
      await cat.save();
      console.log(`Linked Category "${cat.name}" to ticket types: ${citizenTypeIds.length} types`);
    }
  }

  // 3. Migrate complaints to tickets
  console.log('\n[3] Migrating complaints to tickets collection...');
  const db = mongoose.connection.db;
  
  const collections = await db.listCollections().toArray();
  const complaintsExists = collections.some(col => col.name === 'complaints');
  
  if (!complaintsExists) {
    console.log('No "complaints" collection found. Nothing to migrate.');
    process.exit(0);
  }

  const legacyComplaints = await db.collection('complaints').find({}).toArray();
  console.log(`Found ${legacyComplaints.length} legacy complaints to migrate.`);

  let migratedCount = 0;
  for (const doc of legacyComplaints) {
    const existingTicket = await Ticket.findOne({ _id: doc._id });
    if (!existingTicket) {
      const ticketDoc = {
        ...doc,
        tenantId: doc.tenantId || 'default-tenant',
        ticketType: complaintType._id,
      };
      
      await db.collection('tickets').insertOne(ticketDoc);
      migratedCount++;
    }
  }

  console.log(`\nMigration completed. Migrated ${migratedCount} complaints to tickets.`);
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
