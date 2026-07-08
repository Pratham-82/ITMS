const mongoose = require('mongoose');
const { runSlaBreachCheck } = require('./services/queueService');
const User = require('./models/User');
const Category = require('./models/Category');
const Department = require('./models/Department');
const DepartmentCategory = require('./models/DepartmentCategory');
const EscalationRule = require('./models/EscalationRule');
const Complaint = require('./models/Ticket');

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/apexresolve');
    console.log('Connected to MongoDB. Running SLA breach processor manually...');
    
    await runSlaBreachCheck();
    
    console.log('SLA Breach processor complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error running breach check:', err);
    process.exit(1);
  }
}

run();
