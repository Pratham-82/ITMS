const cron = require('node-cron');
const Complaint = require('../models/Ticket');
const EscalationRule = require('../models/EscalationRule');
const { sendEscalationNotifications } = require('./notificationService');

const formatDuration = (hours) => {
  const seconds = Math.round(hours * 3600);
  if (seconds > 0 && seconds < 60) return `${seconds}s`;
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${Number(hours.toFixed(4))}h`;
};

// Main logic to check and process overdue complaints
const checkEscalations = async () => {
  console.log('[Scheduler] Delegating checkEscalations to EscalationWorker...');
  try {
    const EscalationWorker = require('./escalation/EscalationWorker');
    await EscalationWorker.runSlaBreachCheck();
  } catch (error) {
    console.error('[Scheduler] Error running EscalationWorker.runSlaBreachCheck:', error);
  }
};

// Check resolved complaints awaiting feedback past 7 days and close them
const checkAutoClose = async () => {
  console.log('[Scheduler] Delegating checkAutoClose to EscalationWorker...');
  try {
    const EscalationWorker = require('./escalation/EscalationWorker');
    await EscalationWorker.runAutoCloseCheck();
  } catch (error) {
    console.error('[Scheduler] Error running EscalationWorker.runAutoCloseCheck:', error);
  }
};

// Initialize the cron scheduler / Job Queue worker
const initScheduler = () => {
  try {
    const { startQueueWorker } = require('./queueService');
    startQueueWorker(15000); // Poll every 15 seconds
    console.log('[Scheduler] Upgraded JobQueue worker initialized.');
  } catch (error) {
    console.error('[Scheduler] Error starting JobQueue worker:', error);
  }
};

module.exports = {
  initScheduler,
  checkEscalations,
  checkAutoClose
};
