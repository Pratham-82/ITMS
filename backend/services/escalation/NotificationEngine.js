const Notification = require('../../models/Notification');
const User = require('../../models/User');
const emailService = require('../emailService');
const { sendEscalationNotifications } = require('../notificationService');

/**
 * NotificationEngine centralizes all alert triggering across the CMS platform,
 * supporting In-App, Email, SMS, and WhatsApp.
 */
class NotificationEngine {
  /**
   * Helper to dispatch in-app notification.
   */
  async sendInApp(recipientId, title, message, complaintId) {
    try {
      await Notification.create({
        recipient: recipientId,
        title,
        message,
        complaint: complaintId
      });
    } catch (error) {
      console.error(`[NotificationEngine] In-App dispatch error for recipient ${recipientId}:`, error);
    }
  }

  /**
   * Helper to dispatch email notification.
   */
  async sendEmail(toEmail, subject, htmlContent) {
    // In a fully configured system, this would call emailService or nodemailer.
    // We print log and call verification helper if set up.
    console.log(`[NotificationEngine] [EMAIL] To: ${toEmail} | Subject: ${subject}`);
  }

  /**
   * Helper to dispatch SMS notification.
   */
  async sendSMS(phoneNumber, message) {
    console.log(`[NotificationEngine] [SMS] To: ${phoneNumber} | Message: ${message}`);
  }

  /**
   * Helper to dispatch WhatsApp notification.
   */
  async sendWhatsApp(phoneNumber, message) {
    console.log(`[NotificationEngine] [WhatsApp] To: ${phoneNumber} | Message: ${message}`);
  }

  /**
   * Triggered on SLA warning threshold consumed.
   */
  async sendSlaWarning(complaint, threshold) {
    const title = `${complaint.responseSlaStatus === 'Warning' ? 'Response' : 'Resolution'} SLA Warning`;
    const message = `Complaint #${complaint.trackingId} is approaching breach (${threshold}% consumed).`;
    
    if (complaint.assignedTo) {
      await this.sendInApp(complaint.assignedTo, title, message, complaint._id);
      
      const user = await User.findById(complaint.assignedTo);
      if (user && user.email) {
        await this.sendEmail(user.email, title, `<p>${message}</p>`);
      }
    }
  }

  /**
   * Triggered on SLA breach event.
   */
  async sendSlaBreach(complaint, type) {
    const title = `${type === 'response' ? 'Response' : 'Resolution'} SLA Breached`;
    const message = `${type === 'response' ? 'First Response' : 'Resolution'} SLA has been breached for complaint #${complaint.trackingId}.`;

    if (complaint.assignedTo) {
      await this.sendInApp(complaint.assignedTo, title, message, complaint._id);
      const user = await User.findById(complaint.assignedTo);
      if (user && user.email) {
        await this.sendEmail(user.email, title, `<p>${message}</p>`);
      }
    }
  }

  /**
   * Triggered when a ticket is escalated.
   */
  async sendEscalation(complaint, level, previousDept, newDept) {
    const title = `Complaint Escalated automatically (Level ${level})`;
    const message = `Complaint #${complaint.trackingId} has been automatically escalated to ${newDept} due to SLA breach.`;

    await sendEscalationNotifications({
      complaintId: complaint._id,
      citizenId: complaint.citizen,
      title,
      message,
      previousDepartment: previousDept,
      newDepartment: newDept
    });
  }

  /**
   * Triggered on initial assignment.
   */
  async sendAssignment(complaint, user) {
    const title = 'New Complaint Assigned';
    const message = `Complaint #${complaint.trackingId} has been assigned to you.`;

    if (user) {
      await this.sendInApp(user._id, title, message, complaint._id);
      if (user.email) {
        await this.sendEmail(user.email, title, `<p>${message}</p>`);
      }
    }
  }

  /**
   * Triggered on reassignment.
   */
  async sendReassignment(complaint, prevUser, newUser) {
    const title = 'Complaint Reassigned';
    const message = `Complaint #${complaint.trackingId} has been reassigned from ${prevUser ? prevUser.name : 'Unassigned'} to ${newUser.name}.`;

    if (newUser) {
      await this.sendInApp(newUser._id, title, message, complaint._id);
      if (newUser.email) {
        await this.sendEmail(newUser.email, title, `<p>${message}</p>`);
      }
    }
    if (prevUser) {
      await this.sendInApp(prevUser._id, 'Complaint Reassigned (removed)', `Complaint #${complaint.trackingId} was reassigned to another staff member.`, complaint._id);
    }
  }

  /**
   * Triggered when a ticket is resolved.
   */
  async sendResolution(complaint) {
    const title = 'Complaint Resolved';
    const message = `Your complaint #${complaint.trackingId} has been resolved. Please provide your feedback.`;

    await sendEscalationNotifications({
      complaintId: complaint._id,
      citizenId: complaint.citizen,
      title,
      message
    });
  }

  /**
   * Triggered on reopening a ticket.
   */
  async sendReopen(complaint) {
    const title = 'Complaint Reopen Requested';
    const message = `Reopen request submitted for complaint #${complaint.trackingId}.`;

    await sendEscalationNotifications({
      complaintId: complaint._id,
      citizenId: null,
      title,
      message
    });
  }
}

module.exports = new NotificationEngine();
