const Complaint = require('../../models/Ticket');
const CalendarEngine = require('./CalendarEngine');
const SlaEngine = require('./SlaEngine');
const EscalationEngine = require('./EscalationEngine');
const NotificationEngine = require('./NotificationEngine');
const AuditEngine = require('./AuditEngine');

/**
 * EscalationWorker handles periodic background SLA and Escalation checks.
 */
class EscalationWorker {
  /**
   * Main SLA Warning and Breach checking runner.
   */
  async runSlaBreachCheck() {
    const now = new Date();
    
    // Find all active (not resolved/rejected/closed) complaints
    const openComplaints = await Complaint.find({
      status: { $nin: ['Resolved', 'Rejected', 'Closed'] }
    });

    console.log(`[EscalationWorker] Evaluating ${openComplaints.length} open complaints...`);

    for (const complaint of openComplaints) {
      try {
        // Auto-resume complaint if hold duration has expired
        if (complaint.status === 'On Hold' && complaint.holdUntil && complaint.holdUntil <= now) {
          console.log(`[EscalationWorker] Hold expired for complaint #${complaint.trackingId}. Auto-resuming...`);
          complaint.status = complaint.previousStatusBeforeHold || 'Investigating';
          complaint.holdUntil = null;
          complaint.holdDuration = null;
          complaint.previousStatusBeforeHold = null;
          await complaint.save();
        }

        if (complaint.slaPaused) {
          console.log(`[EscalationWorker] Complaint #${complaint.trackingId} is SLA Paused/On Hold. Skipping.`);
          continue;
        }

        const calendar = await CalendarEngine.resolveCalendarForComplaint(complaint);
        const isBlackout = calendar ? await CalendarEngine.isBlackoutPeriod(now, calendar._id) : false;
        
        if (isBlackout) {
          // Skip SLA processing during blackout period for this calendar
          console.log(`[EscalationWorker] Calendar "${calendar.name}" is in Blackout. Skipping SLA processing for complaint #${complaint.trackingId}`);
          continue;
        }

        let isUpdated = false;

        // 1. Check Legacy Escalation Breach (due date on levels)
        if (complaint.escalationStatus === 'pending' && complaint.nextEscalationDueAt && complaint.nextEscalationDueAt <= now) {
          const escalated = await EscalationEngine.processComplaint(complaint, now);
          if (escalated) {
            isUpdated = true;
          }
        }

        // 2. Evaluate SLA Warnings and Breaches using SlaEngine
        const slaResult = await SlaEngine.evaluateComplaint(complaint, now);
        if (slaResult.isUpdated) {
          isUpdated = true;
        }

        // 3. Process SLA Breach and Warning events using SlaActionEngine
        const webhookService = require('../webhookService');
        for (const event of slaResult.events) {
          if (event.type === 'RESPONSE_SLA_BREACH') {
            const SlaActionEngine = require('./SlaActionEngine');
            await SlaActionEngine.processResponseSlaBreach(complaint, now);
            isUpdated = true;
            webhookService.triggerWebhook('sla.breached', {
              ticket: complaint.toObject ? complaint.toObject() : complaint,
              slaEvent: { type: event.type, breachedAt: now }
            }, complaint.tenantId || 'default-tenant').catch(() => {});
          } 
          
          else if (event.type === 'RESOLUTION_SLA_BREACH') {
            const SlaActionEngine = require('./SlaActionEngine');
            await SlaActionEngine.processResolutionSlaBreach(complaint, now);
            isUpdated = true;
            webhookService.triggerWebhook('sla.breached', {
              ticket: complaint.toObject ? complaint.toObject() : complaint,
              slaEvent: { type: event.type, breachedAt: now }
            }, complaint.tenantId || 'default-tenant').catch(() => {});
          } 
          
          else if (event.type === 'RESPONSE_SLA_WARNING') {
            await NotificationEngine.sendSlaWarning(complaint, event.threshold);
            webhookService.triggerWebhook('sla.warning', {
              ticket: complaint.toObject ? complaint.toObject() : complaint,
              slaEvent: { type: event.type, threshold: event.threshold }
            }, complaint.tenantId || 'default-tenant').catch(() => {});
          } 
          
          else if (event.type === 'RESOLUTION_SLA_WARNING') {
            await NotificationEngine.sendSlaWarning(complaint, event.threshold);
            webhookService.triggerWebhook('sla.warning', {
              ticket: complaint.toObject ? complaint.toObject() : complaint,
              slaEvent: { type: event.type, threshold: event.threshold }
            }, complaint.tenantId || 'default-tenant').catch(() => {});
          }
        }

        if (isUpdated) {
          await complaint.save();
        }
      } catch (err) {
        console.error(`[EscalationWorker] Error checking SLA for complaint #${complaint.trackingId}:`, err);
      }
    }
  }

  /**
   * Auto-resolves resolved complaints awaiting feedback past configured expiry days.
   */
  async runAutoCloseCheck() {
    const now = new Date();
    
    // Load config from settings
    const Settings = require('../../models/Settings');
    const settings = await Settings.findOne({ key: 'system_branding' });
    const expiryDays = settings && settings.feedbackExpiryDays !== undefined ? settings.feedbackExpiryDays : 3;
    
    const thresholdDate = new Date(now.getTime() - expiryDays * 24 * 60 * 60 * 1000);

    const inactiveResolvedComplaints = await Complaint.find({
      status: 'Awaiting Feedback',
      feedbackRequested: true,
      feedbackRequestedAt: { $lte: thresholdDate }
    });

    console.log(`[EscalationWorker] Found ${inactiveResolvedComplaints.length} complaint(s) needing auto-resolution.`);

    for (const complaint of inactiveResolvedComplaints) {
      try {
        complaint.status = 'Resolved';
        complaint.closureType = 'Auto Resolved';
        complaint.nextEscalationDueAt = null;
        complaint.escalationStatus = 'completed';
        
        complaint.history.push({
          action: `Complaint automatically marked resolved after ${expiryDays} days of citizen inactivity`,
          actor: 'System'
        });

        await complaint.save();

        // Notify auto-close
        await NotificationEngine.sendInApp(
          complaint.citizen,
          'Complaint Marked Resolved',
          `Your complaint #${complaint.trackingId} has been automatically marked resolved due to ${expiryDays} days of inactivity.`,
          complaint._id
        );

        await AuditEngine.logEscalationAction({
          action: 'AUTO_RESOLVED',
          complaintId: complaint._id,
          reason: `${expiryDays} days of citizen inactivity`,
          actor: 'System'
        });

        console.log(`[EscalationWorker] Successfully auto-resolved complaint #${complaint.trackingId}.`);
      } catch (err) {
        console.error(`[EscalationWorker] Failed to auto-resolve complaint #${complaint.trackingId}:`, err);
      }
    }
  }
}

module.exports = new EscalationWorker();
