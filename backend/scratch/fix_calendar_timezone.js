const mongoose = require('mongoose');
const calendarService = require('../services/calendarService');
const SlaEngine = require('../services/escalation/SlaEngine');
const EscalationRuleResolver = require('../services/escalation/EscalationRuleResolver');

async function run() {
  try {
    await mongoose.connect('mongodb://localhost:27017/apexresolve_mega-corp');
    console.log('Connected to mega-corp DB.');

    // 1. Update timezone of Standard Working Hours calendar
    const calendarCol = mongoose.connection.db.collection('businesscalendars');
    const calendar = await calendarCol.findOne({ isDefault: true });
    if (!calendar) {
      console.log('Default calendar not found.');
      return;
    }
    
    console.log(`Current Calendar Timezone: ${calendar.timeZone}`);
    await calendarCol.updateOne({ _id: calendar._id }, { $set: { timeZone: 'Asia/Kolkata' } });
    console.log('Updated calendar timezone to Asia/Kolkata.');

    // Fetch updated calendar
    const updatedCalendar = await calendarCol.findOne({ _id: calendar._id });

    // 2. Fetch all tickets and recalculate deadlines
    const Ticket = require('../models/Ticket');
    const tickets = await Ticket.find({});
    console.log(`Recalculating deadlines for ${tickets.length} tickets...`);

    const SlaConfiguration = require('../models/SlaConfiguration');
    const slaConfig = await SlaConfiguration.findOne({ isDefault: true });

    for (const ticket of tickets) {
      if (ticket.status === 'Resolved' || ticket.status === 'Closed' || ticket.status === 'Rejected') {
        continue;
      }

      // Resolve priority SLA configs
      const prioConfig = slaConfig.priorities[ticket.priority] || { responseSlaMinutes: 240, resolutionSlaMinutes: 1440 };

      // Recalculate response and resolution due dates
      ticket.responseDueAt = await calendarService.calculateDueDate(ticket.createdAt, prioConfig.responseSlaMinutes, updatedCalendar);
      ticket.resolutionDueAt = await calendarService.calculateDueDate(ticket.createdAt, prioConfig.resolutionSlaMinutes, updatedCalendar);

      // Recalculate next escalation due date
      const rule = await EscalationRuleResolver.resolveRule(ticket);
      if (rule && rule.levels && rule.levels.length > 0) {
        const level1 = rule.levels.find(l => l.level === 1);
        if (level1) {
          const hours = level1.durationHours || 24;
          ticket.nextEscalationDueAt = await calendarService.calculateDueDate(ticket.createdAt, hours * 60, updatedCalendar, ticket.assignedDepartment);
        }
      }

      await ticket.save();
      console.log(`- Ticket ${ticket.trackingId} recalculated: CreatedAt=${ticket.createdAt.toISOString()} -> nextEscalationDueAt=${ticket.nextEscalationDueAt ? ticket.nextEscalationDueAt.toISOString() : 'none'}`);
    }

    console.log('Recalculation complete.');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.connection.close();
  }
}

run();
