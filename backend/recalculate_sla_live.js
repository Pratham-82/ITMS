const mongoose = require('mongoose');
const Complaint = require('./models/Ticket');
const User = require('./models/User');
const Category = require('./models/Category');
const Department = require('./models/Department');
const DepartmentCategory = require('./models/DepartmentCategory');
const EscalationRule = require('./models/EscalationRule');
const { resolveCalendarForComplaint, calculateDueDate } = require('./services/calendarService');
const SlaConfiguration = require('./models/SlaConfiguration');

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/apexresolve');
    console.log('Connected to MongoDB.');

    const ticket = await Complaint.findOne({ trackingId: 'CMS-1028' });
    if (!ticket) {
      console.log('Ticket CMS-1028 not found.');
      process.exit(1);
    }

    const calendar = await resolveCalendarForComplaint(ticket);
    const slaConfig = await SlaConfiguration.findOne({ isDefault: true }) || {
      priorities: {
        Low: { responseSlaMinutes: 10, resolutionSlaMinutes: 20 }
      }
    };
    
    const prioConfig = slaConfig.priorities[ticket.priority] || { responseSlaMinutes: 10, resolutionSlaMinutes: 20 };

    console.log(`Original Response Due  : ${ticket.responseDueAt.toString()}`);
    console.log(`Original Resolution Due: ${ticket.resolutionDueAt.toString()}`);

    // Recalculate SLA due dates based on new calendar settings and ticket creation date
    ticket.responseDueAt = await calculateDueDate(ticket.createdAt, prioConfig.responseSlaMinutes, calendar);
    ticket.resolutionDueAt = await calculateDueDate(ticket.createdAt, prioConfig.resolutionSlaMinutes, calendar);
    ticket.calendar = calendar ? calendar._id : null;

    await ticket.save();

    console.log('\nRecalculation Complete:');
    console.log(`New Response Due       : ${ticket.responseDueAt.toString()}`);
    console.log(`New Resolution Due     : ${ticket.resolutionDueAt.toString()}`);

    process.exit(0);
  } catch (err) {
    console.error('Error during recalculation:', err);
    process.exit(1);
  }
}

run();
