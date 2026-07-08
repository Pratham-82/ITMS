const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Creates in-app notifications for citizens, department admins, and super admins.
 * @param {Object} params
 * @param {string} params.complaintId - The ID of the complaint.
 * @param {string} params.citizenId - The ID of the citizen user.
 * @param {string} params.title - The title of the notification.
 * @param {string} params.message - The message body.
 * @param {string} [params.previousDepartment] - The name of the previous department.
 * @param {string} [params.newDepartment] - The name of the new department.
 */
const sendEscalationNotifications = async ({
  complaintId,
  citizenId,
  title,
  message,
  previousDepartment,
  newDepartment
}) => {
  try {
    const recipients = new Set();

    // 1. Add Citizen (always notify the citizen of changes to their ticket)
    if (citizenId) {
      recipients.add(citizenId.toString());
    }

    // 2. Load complaint to check group-level routing
    const Complaint = require('../models/Ticket');
    const EscalationGroup = require('../models/EscalationGroup');
    const complaint = await Complaint.findById(complaintId);

    if (complaint && complaint.assignedGroup) {
      const groupDoc = await EscalationGroup.findById(complaint.assignedGroup);
      if (groupDoc) {
        if (groupDoc.leader) {
          recipients.add(groupDoc.leader.toString());
        }
        if (groupDoc.members && groupDoc.members.length > 0) {
          groupDoc.members.forEach(memberId => {
            recipients.add(memberId.toString());
          });
        }
      }
    }

    // Find admin users
    const query = { role: 'admin' };
    const admins = await User.find(query).populate({
      path: 'groups',
      populate: { path: 'department' }
    });

    // Helper to evaluate superadmin status robustly
    const evaluateSuperAdmin = (admin) => {
      return admin.role === 'admin' && (
        (admin.groups && admin.groups.length > 0 && admin.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
        ((!admin.groups || admin.groups.length === 0) && (!admin.department || admin.department === 'General Administration'))
      );
    };

    admins.forEach(admin => {
      // 3. Add Super Admins
      if (evaluateSuperAdmin(admin)) {
        recipients.add(admin._id.toString());
      }
      // 4. Add Previous Department Admins (legacy compatibility)
      if (previousDepartment && admin.department === previousDepartment) {
        recipients.add(admin._id.toString());
      }
      // 5. Add New Department Admins (legacy compatibility)
      if (newDepartment && admin.department === newDepartment) {
        recipients.add(admin._id.toString());
      }
    });

    // Create notifications for all unique recipients
    const notificationPromises = Array.from(recipients).map(recipientId => {
      return Notification.create({
        recipient: recipientId,
        title,
        message,
        complaint: complaintId
      });
    });

    await Promise.all(notificationPromises);
    console.log(`Dispatched ${notificationPromises.length} optimized escalation notifications for complaint ${complaintId}`);
  } catch (error) {
    console.error('Error sending escalation notifications:', error);
  }
};

module.exports = {
  sendEscalationNotifications
};
