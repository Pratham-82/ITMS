const JobQueue = require('../models/JobQueue');
const Complaint = require('../models/Ticket');
const EscalationRule = require('../models/EscalationRule');
const Notification = require('../models/Notification');
const { autoAssignComplaint } = require('./assignmentEngine');
const { sendEscalationNotifications } = require('./notificationService');
const { resolveCalendarForComplaint, isBlackoutPeriod, calculateDueDate } = require('./calendarService');
const tenantLocalStorage = require('../middleware/tenantContext');

/**
 * Schedule a job in the queue.
 * @param {String} jobType - Type of job ('SLA_BREACH_CHECK', 'AUTO_CLOSE_CHECK', etc.)
 * @param {Date} runAt - Scheduled time of execution
 * @param {Object} [payload] - Parameters/payload for the job
 * @param {Number} [maxAttempts] - Max retry attempts
 * @returns {Promise<Object>} Job document
 */
async function scheduleJob(jobType, runAt, payload = {}, maxAttempts = 3) {
  try {
    const tenantId = tenantLocalStorage.getStore() || 'default-tenant';
    const job = await JobQueue.create({
      tenantId,
      jobType,
      runAt,
      payload,
      maxAttempts
    });
    return job;
  } catch (error) {
    console.error(`[QueueService] Error scheduling job ${jobType}:`, error);
    throw error;
  }
}

/**
 * Processes a single job based on its type.
 */
async function executeJob(job) {
  const tenantId = job.tenantId || 'default-tenant';
  const tenantLocalStorage = require('../middleware/tenantContext');

  await tenantLocalStorage.run(tenantId, async () => {
    switch (job.jobType) {
      case 'SLA_BREACH_CHECK':
        await runSlaBreachCheck();
        break;
      case 'AUTO_CLOSE_CHECK':
        await runAutoCloseCheck();
        break;
      default:
        console.warn(`[QueueService] Unknown job type: ${job.jobType}`);
    }
  });
}

/**
 * Checks for warnings and breaches across all open complaints.
 */
/**
 * Checks for warnings and breaches across all open complaints.
 */
async function runSlaBreachCheck() {
  try {
    const EscalationWorker = require('./escalation/EscalationWorker');
    await EscalationWorker.runSlaBreachCheck();
  } catch (error) {
    console.error('[QueueService] Error in EscalationWorker.runSlaBreachCheck:', error);
    throw error;
  }
}

/**
 * Auto-closes resolved complaints awaiting feedback past 7 days.
 */
async function runAutoCloseCheck() {
  try {
    const EscalationWorker = require('./escalation/EscalationWorker');
    await EscalationWorker.runAutoCloseCheck();
  } catch (error) {
    console.error('[QueueService] Error in EscalationWorker.runAutoCloseCheck:', error);
    throw error;
  }
}

/**
 * Polls the JobQueue database table for due tasks.
 */
async function processQueue() {
  const now = new Date();
  
  // Find all queued jobs that are due (bypass tenant scoping to see all tenants)
  const jobs = await JobQueue.find({
    status: 'queued',
    runAt: { $lte: now }
  }).setOptions({ bypassTenant: true }).limit(10);

  for (const job of jobs) {
    const lockedJob = await JobQueue.findOneAndUpdate(
      { _id: job._id, status: 'queued' },
      { $set: { status: 'processing', lockedAt: now }, $inc: { attempts: 1 } },
      { new: true }
    ).setOptions({ bypassTenant: true });

    if (!lockedJob) continue;

    try {
      await executeJob(lockedJob);
      lockedJob.status = 'completed';
      lockedJob.lockedAt = null;
      await lockedJob.save();
    } catch (error) {
      console.error(`[QueueService] Job execution failed for job ID ${lockedJob._id}:`, error);
      lockedJob.lastError = error.message || String(error);
      lockedJob.lockedAt = null;

      if (lockedJob.attempts >= lockedJob.maxAttempts) {
        lockedJob.status = 'dlq';
      } else {
        lockedJob.status = 'queued';
        lockedJob.runAt = new Date(Date.now() + 2 * 60 * 1000); // retry in 2 mins
      }
      await lockedJob.save();
    }
  }
}

let queueWorkerInterval = null;

/**
 * Start the background worker polling loop.
 */
function startQueueWorker(intervalMs = 30000) {
  if (queueWorkerInterval) {
    clearInterval(queueWorkerInterval);
  }

  const ensureDefaultJobsScheduled = async () => {
    try {
      const Tenant = require('../models/Tenant');
      const tenantLocalStorage = require('../middleware/tenantContext');
      // Tenant queries are global because bypassTenantPlugin is true
      const tenants = await Tenant.find({ isActive: true });
      const tenantIds = ['default-tenant', ...tenants.map(t => t.subdomain)];

      const now = new Date();

      for (const tenantId of tenantIds) {
        await tenantLocalStorage.run(tenantId, async () => {
          const hasBreachJob = await JobQueue.findOne({
            tenantId,
            jobType: 'SLA_BREACH_CHECK',
            status: 'queued'
          });
          if (!hasBreachJob) {
            await scheduleJob('SLA_BREACH_CHECK', new Date(now.getTime() + 5000));
          }

          const hasAutoCloseJob = await JobQueue.findOne({
            tenantId,
            jobType: 'AUTO_CLOSE_CHECK',
            status: 'queued'
          });
          if (!hasAutoCloseJob) {
            await scheduleJob('AUTO_CLOSE_CHECK', new Date(now.getTime() + 30000));
          }
        });
      }
    } catch (err) {
      console.error('[QueueWorker] Error scheduling default jobs:', err);
    }
  };

  queueWorkerInterval = setInterval(async () => {
    await ensureDefaultJobsScheduled();
    await processQueue();
  }, intervalMs);

  console.log(`[QueueWorker] Resilient JobQueue worker started. Polling every ${intervalMs / 1000}s.`);
}

module.exports = {
  scheduleJob,
  processQueue,
  startQueueWorker,
  runSlaBreachCheck,
  runAutoCloseCheck
};
