const mongoose = require('mongoose');
const Complaint = require('./models/Ticket');
const User = require('./models/User');
const Category = require('./models/Category');
const Department = require('./models/Department');

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/apexresolve');
    console.log('Connected to MongoDB.');

    const openTickets = await Complaint.find({
      status: { $nin: ['Resolved', 'Rejected', 'Closed'] }
    }).populate('assignedTo', 'name email');

    console.log(`\nFound ${openTickets.length} open/active tickets:`);
    
    for (const ticket of openTickets) {
      console.log(`\n--------------------------------------------`);
      console.log(`Tracking ID      : ${ticket.trackingId}`);
      console.log(`Title            : ${ticket.title}`);
      console.log(`Status           : ${ticket.status}`);
      console.log(`Response Due At  : ${ticket.responseDueAt ? ticket.responseDueAt.toLocaleString() : 'None'}`);
      console.log(`Response SLA     : ${ticket.responseSlaStatus}`);
      console.log(`Resolution Due At: ${ticket.resolutionDueAt ? ticket.resolutionDueAt.toLocaleString() : 'None'}`);
      console.log(`Resolution SLA   : ${ticket.resolutionSlaStatus}`);
      console.log(`Assigned To      : ${ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned'}`);
      console.log(`First Response At: ${ticket.firstResponseAt ? ticket.firstResponseAt.toLocaleString() : 'None'}`);
      console.log(`Is SLA Paused    : ${ticket.slaPaused}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error running check:', err);
    process.exit(1);
  }
}

run();
