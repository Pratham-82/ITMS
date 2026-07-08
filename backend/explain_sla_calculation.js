const mongoose = require('mongoose');
const Complaint = require('./models/Ticket');
const BusinessCalendar = require('./models/BusinessCalendar');
const User = require('./models/User');
const Category = require('./models/Category');
const Department = require('./models/Department');

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/apexresolve');
    
    const ticket = await Complaint.findOne({ trackingId: 'CMS-1028' });
    if (!ticket) {
      console.log('Ticket CMS-1028 not found.');
      process.exit(0);
    }

    console.log(`Ticket trackingId  : ${ticket.trackingId}`);
    console.log(`Created At         : ${ticket.createdAt.toISOString()} (${ticket.createdAt.toString()})`);
    console.log(`Response Due At    : ${ticket.responseDueAt ? ticket.responseDueAt.toISOString() : 'None'}`);
    console.log(`Resolution Due At  : ${ticket.resolutionDueAt ? ticket.resolutionDueAt.toISOString() : 'None'}`);
    console.log(`Priority           : ${ticket.priority}`);

    // Fetch resolved calendar details
    const { resolveCalendarForComplaint } = require('./services/calendarService');
    const calendar = await resolveCalendarForComplaint(ticket);
    if (calendar) {
      console.log(`Resolved Calendar  : ${calendar.name}`);
      console.log(`Calendar Timezone  : ${calendar.timeZone}`);
      console.log(`Working Days       : ${calendar.workingDays.join(', ')}`);
      console.log(`Working Hours      : ${calendar.workingHours.start} - ${calendar.workingHours.end}`);
      console.log(`Holidays Count     : ${calendar.holidays.length}`);
      console.log(`Exceptions Count   : ${calendar.exceptions.length}`);
    } else {
      console.log('No calendar resolved.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
