const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Ticket = require('./models/Ticket');
const EscalationEngine = require('./services/escalation/EscalationEngine');
const EscalationRuleResolver = require('./services/escalation/EscalationRuleResolver');

async function run() {
  await connectDB();
  console.log('Connected.');

  const tenantId = 'krm';
  const tenantLocalStorage = require('./middleware/tenantContext');

  await tenantLocalStorage.run(tenantId, async () => {
    try {
      const ticketId = '6a3baee1c674bdbc9ccaa8d2';
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        console.log('Ticket not found:', ticketId);
        return;
      }

      console.log('Ticket Info:', {
        id: ticket._id,
        trackingId: ticket.trackingId,
        title: ticket.title,
        status: ticket.status,
        department: ticket.department,
        category: ticket.category,
        currentEscalationLevel: ticket.currentEscalationLevel,
        nextEscalationDueAt: ticket.nextEscalationDueAt,
        escalationStatus: ticket.escalationStatus
      });

      const rule = await EscalationRuleResolver.resolveRule(ticket);
      console.log('Escalation Rule resolved:', rule ? {
        id: rule._id,
        name: rule.workflowName,
        levels: rule.levels
      } : 'null');

      const currentLevel = ticket.currentEscalationLevel || 0;
      const nextLevelNum = currentLevel + 1;
      const nextLevelDetails = rule ? rule.levels.find(l => l.level === nextLevelNum) : null;
      console.log('Next Level details:', nextLevelDetails);

      console.log('Running processSlaBreach...');
      const escalated = await EscalationEngine.processSlaBreach(ticket, 'response', new Date());
      console.log('Process SLA Breach result:', escalated);
      console.log('Ticket after escalation:', {
        status: ticket.status,
        currentEscalationLevel: ticket.currentEscalationLevel,
        assignedDepartment: ticket.assignedDepartment,
        assignedTo: ticket.assignedTo,
        nextEscalationDueAt: ticket.nextEscalationDueAt
      });
      
      // Save changes if escalated
      if (escalated) {
        await ticket.save();
        console.log('Ticket saved successfully!');
      }

    } catch (err) {
      console.error('Error during test:', err);
    } finally {
      await mongoose.connection.close();
    }
  });
}

run();
