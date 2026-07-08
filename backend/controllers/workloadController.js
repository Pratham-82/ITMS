const User = require('../models/User');
const Complaint = require('../models/Ticket');
const Notification = require('../models/Notification');
const { calculateWorkloadScore, getBalancingSuggestions } = require('../services/assignmentService');

const isSuperAdmin = (user) => (
  user.role === 'admin' && (
    (user.groups && user.groups.length > 0 && user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
    ((!user.groups || user.groups.length === 0) && (!user.department || user.department === 'General Administration'))
  )
);

// @desc    Get staff workloads for a department
// @route   GET /api/workload/staff
// @access  Private (Admin only)
const getStaffWorkloads = async (req, res) => {
  try {
    let staff;
    if (req.query.all === 'true') {
      staff = await User.find({ role: 'admin' }).populate({
        path: 'groups',
        populate: { path: 'department' }
      });
    } else {
      const EscalationGroup = require('../models/EscalationGroup');
      let memberIds = [];

      if (req.query.group) {
        const groupDoc = await EscalationGroup.findById(req.query.group);
        if (groupDoc) {
          memberIds = groupDoc.members || [];
        }
      } else {
        let deptDoc = null;
        const Department = require('../models/Department');

        if (isSuperAdmin(req.user)) {
          if (req.query.department) {
            deptDoc = await Department.findOne({ name: req.query.department });
          } else {
            deptDoc = await Department.findOne({ name: 'General Administration' });
          }
        } else {
          const userDeptIds = (req.user.groups || []).map(g => (g.department && g.department._id) || g.department).filter(Boolean);
          if (userDeptIds.length > 0) {
            deptDoc = await Department.findById(userDeptIds[0]);
          }
        }

        if (deptDoc) {
          const groups = await EscalationGroup.find({ department: deptDoc._id });
          memberIds = groups.reduce((acc, g) => acc.concat(g.members || []), []);
        }
      }

      staff = await User.find({ role: 'admin', _id: { $in: memberIds } }).populate({
        path: 'groups',
        populate: { path: 'department' }
      });
    }
    const staffData = [];

    for (const member of staff) {
      const metrics = await calculateWorkloadScore(member);
      staffData.push({
        _id: member._id,
        name: member.name,
        email: member.email,
        department: member.department,
        maxCapacity: member.maxCapacity,
        capacityPercentage: member.capacityPercentage,
        availabilityStatus: member.availabilityStatus,
        workloadScore: metrics.score,
        openCount: metrics.openCount,
        criticalCount: metrics.criticalCount,
        slaRiskCount: metrics.slaRiskCount,
        escalationRiskCount: metrics.escalationRiskCount
      });
    }

    res.status(200).json({
      success: true,
      data: staffData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get aggregate workload dashboard metrics
// @route   GET /api/workload/dashboard
// @access  Private (Admin only)
const getWorkloadDashboard = async (req, res) => {
  try {
    const Department = require('../models/Department');
    const EscalationGroup = require('../models/EscalationGroup');
    
    let deptDoc = null;
    let groupDoc = null;
    let isGeneral = false;
    
    if (req.query.group) {
      groupDoc = await EscalationGroup.findById(req.query.group);
    } else {
      if (isSuperAdmin(req.user)) {
        if (req.query.department) {
          deptDoc = await Department.findOne({ name: req.query.department });
          isGeneral = req.query.department === 'General Administration';
        } else {
          isGeneral = true;
        }
      } else {
        const userDeptIds = (req.user.groups || []).map(g => (g.department && g.department._id) || g.department).filter(Boolean);
        if (userDeptIds.length > 0) {
          deptDoc = await Department.findById(userDeptIds[0]);
        }
      }
    }

    const filter = {
      status: { $nin: ['Resolved', 'Rejected', 'Awaiting Feedback', 'Closed'] }
    };

    if (groupDoc) {
      filter.assignedGroup = groupDoc._id;
    } else if (deptDoc && !isGeneral) {
      filter.department = deptDoc._id;
    }

    const openTickets = await Complaint.find(filter).populate('assignedTo', 'name');

    // Aggregate counts
    const totalOpen = openTickets.length;
    const criticalCount = openTickets.filter(t => t.priority === 'Critical').length;
    
    const now = new Date();
    const nearSlaBreachCount = openTickets.filter(t => {
      if (!t.nextEscalationDueAt) return false;
      const hours = (new Date(t.nextEscalationDueAt).getTime() - now.getTime()) / (3600 * 1000);
      return hours > 0 && hours < 24;
    }).length;

    // Distribution data
    let staffQuery = { role: 'admin' };
    if (groupDoc) {
      staffQuery._id = { $in: groupDoc.members || [] };
    } else if (deptDoc && !isGeneral) {
      const groups = await EscalationGroup.find({ department: deptDoc._id });
      const memberIds = groups.reduce((acc, g) => acc.concat(g.members || []), []);
      staffQuery._id = { $in: memberIds };
    }
    const staffList = await User.find(staffQuery);
    
    const distribution = [];
    let totalScore = 0;

    for (const member of staffList) {
      const metrics = await calculateWorkloadScore(member);
      distribution.push({
        _id: member._id,
        name: member.name,
        score: metrics.score,
        openCount: metrics.openCount,
        utilization: member.capacityPercentage,
        status: member.availabilityStatus
      });
      totalScore += metrics.score;
    }

    res.status(200).json({
      success: true,
      data: {
        totalOpen,
        criticalCount,
        nearSlaBreachCount,
        averageWorkload: staffList.length > 0 ? Number((totalScore / staffList.length).toFixed(1)) : 0,
        distribution
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get active workload alerts and balancing suggestions
// @route   GET /api/workload/alerts
// @access  Private (Admin only)
const getWorkloadAlerts = async (req, res) => {
  try {
    const Department = require('../models/Department');
    const EscalationGroup = require('../models/EscalationGroup');

    let deptDoc = null;
    let deptName = null;
    let groupDoc = null;
    let memberIds = [];

    if (req.query.group) {
      groupDoc = await EscalationGroup.findById(req.query.group).populate('department');
      if (groupDoc) {
        memberIds = groupDoc.members || [];
        if (groupDoc.department) {
          deptDoc = groupDoc.department;
          deptName = groupDoc.department.name;
        }
      }
    } else {
      if (isSuperAdmin(req.user)) {
        deptName = req.query.department || 'General Administration';
        deptDoc = await Department.findOne({ name: deptName });
      } else {
        const userDeptIds = (req.user.groups || []).map(g => (g.department && g.department._id) || g.department).filter(Boolean);
        if (userDeptIds.length > 0) {
          deptDoc = await Department.findById(userDeptIds[0]);
          deptName = deptDoc ? deptDoc.name : null;
        }
      }
      
      if (deptDoc) {
        const groups = await EscalationGroup.find({ department: deptDoc._id });
        memberIds = groups.reduce((acc, g) => acc.concat(g.members || []), []);
      }
    }

    if (!deptDoc && !groupDoc) {
      return res.status(400).json({ success: false, message: 'Please specify a valid group or department' });
    }

    // Get suggestions
    let suggestions = [];
    if (groupDoc) {
      suggestions = await getBalancingSuggestions(null, groupDoc._id);
    } else {
      suggestions = await getBalancingSuggestions(deptName);
    }

    // Get alerts for staff
    const staff = await User.find({ role: 'admin', _id: { $in: memberIds } });
    const alerts = [];

    for (const member of staff) {
      const metrics = await calculateWorkloadScore(member);
      if (member.capacityPercentage > 90) {
        alerts.push({
          type: 'danger',
          message: `${member.name} is overloaded (Capacity Utilization: ${member.capacityPercentage}% | Workload Score: ${metrics.score})`,
          recommendation: 'Recommend reassigning high-priority tickets to available colleagues.'
        });
      }
      if (metrics.criticalCount >= 3) {
        alerts.push({
          type: 'warning',
          message: `${member.name} has ${metrics.criticalCount} Critical complaints assigned`,
          recommendation: 'Recommend delegating some critical complaints to distribute SLA pressure.'
        });
      }
      if (metrics.slaRiskCount >= 2) {
        alerts.push({
          type: 'warning',
          message: `${member.name} has ${metrics.slaRiskCount} tickets approaching immediate SLA breach (<24h)`,
          recommendation: 'Recommend manual override or transfer to prevent automatic escalation.'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        alerts,
        suggestions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Manually transfer complaint to another staff member
// @route   POST /api/workload/transfer
// @access  Private (Admin only)
const transferComplaint = async (req, res) => {
  try {
    const { complaintId, targetStaffId, reason } = req.body;

    if (!complaintId) {
      return res.status(400).json({ success: false, message: 'Complaint ID is required' });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Security check: restrict department admins to their own groups' departments
    if (!isSuperAdmin(req.user)) {
      const userDeptIds = (req.user.groups || []).map(g => ((g.department && g.department._id) || g.department || '').toString()).filter(Boolean);
      const complaintDeptId = (complaint.department || '').toString();
      if (!userDeptIds.includes(complaintDeptId)) {
        return res.status(403).json({ success: false, message: 'Not authorized: You can only transfer complaints inside your assigned groups\' departments' });
      }
    }

    const previousAssigneeId = complaint.assignedTo;
    let previousAssigneeName = 'Unassigned';
    let previousAssignee = null;

    if (previousAssigneeId) {
      previousAssignee = await User.findById(previousAssigneeId);
      if (previousAssignee) {
        previousAssigneeName = previousAssignee.name;
      }
    }

    let targetStaffName = 'Unassigned Queue';
    let targetStaff = null;

    if (targetStaffId) {
      targetStaff = await User.findById(targetStaffId);
      if (!targetStaff) {
        return res.status(404).json({ success: false, message: 'Target staff member not found' });
      }
      const targetStaffGroups = await require('../models/EscalationGroup').find({
        _id: { $in: targetStaff.groups || [] }
      });
      const targetStaffDeptIds = targetStaffGroups.map(g => (g.department || '').toString());
      const complaintDeptId = (complaint.department || '').toString();
      if (!targetStaffDeptIds.includes(complaintDeptId)) {
        return res.status(400).json({ success: false, message: 'Target staff must belong to a group in the same department as the complaint' });
      }
      targetStaffName = targetStaff.name;
    }

    const actionText = previousAssigneeId
      ? `Transferred from ${previousAssigneeName} to ${targetStaffName}. Reason: ${reason || 'Manual override'}`
      : `Assigned to ${targetStaffName} from unassigned queue. Reason: ${reason || 'Manual override'}`;

    // Update complaint ownership
    complaint.assignedTo = targetStaffId || null;
    complaint.assignedAt = new Date();
    complaint.lastTransferredAt = new Date();
    complaint.assignmentReason = reason || 'Manual Transfer Override';
    
    complaint.history.push({
      action: actionText,
      actor: req.user.name
    });

    await complaint.save();

    // Recalculate workloads
    if (previousAssignee) {
      await calculateWorkloadScore(previousAssignee);
    }
    if (targetStaff) {
      await calculateWorkloadScore(targetStaff);
    }

    // Notifications
    const notifPromises = [];

    // Notify old assignee
    if (previousAssignee) {
      notifPromises.push(Notification.create({
        recipient: previousAssignee._id,
        title: 'Complaint Unassigned / Transferred',
        message: `Complaint #${complaint.trackingId} has been transferred from you to ${targetStaffName}.`,
        complaint: complaint._id
      }));
    }

    // Notify new assignee
    if (targetStaff) {
      notifPromises.push(Notification.create({
        recipient: targetStaff._id,
        title: 'Complaint Assigned (Transfer)',
        message: `Complaint #${complaint.trackingId} has been transferred and assigned to you by ${req.user.name}.`,
        complaint: complaint._id
      }));
    }

    await Promise.all(notifPromises);

    res.status(200).json({
      success: true,
      message: 'Complaint transferred successfully',
      data: complaint
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk reassign all open complaints from one staff member to another
// @route   POST /api/workload/bulk-reassign
// @access  Private (Admin only)
const bulkReassign = async (req, res) => {
  try {
    const { fromStaffId, toStaffId, reason } = req.body;

    if (!fromStaffId) {
      return res.status(400).json({ success: false, message: 'Source staff ID is required' });
    }

    const fromStaff = await User.findById(fromStaffId);
    if (!fromStaff) {
      return res.status(404).json({ success: false, message: 'Source staff member not found' });
    }

    // Security check
    if (!isSuperAdmin(req.user)) {
      const userDeptIds = (req.user.groups || []).map(g => ((g.department && g.department._id) || g.department || '').toString()).filter(Boolean);
      const fromStaffGroups = await require('../models/EscalationGroup').find({
        _id: { $in: fromStaff.groups || [] }
      });
      const fromStaffDeptIds = fromStaffGroups.map(g => (g.department || '').toString());
      const sharedDept = userDeptIds.some(id => fromStaffDeptIds.includes(id));
      if (!sharedDept) {
        return res.status(403).json({ success: false, message: 'Not authorized: You can only reassign staff in your assigned groups\' departments' });
      }
    }

    let toStaff = null;
    let toStaffName = 'Unassigned Queue';

    if (toStaffId) {
      toStaff = await User.findById(toStaffId);
      if (!toStaff) {
        return res.status(404).json({ success: false, message: 'Target staff member not found' });
      }
      const fromStaffGroups = await require('../models/EscalationGroup').find({
        _id: { $in: fromStaff.groups || [] }
      });
      const fromStaffDeptIds = fromStaffGroups.map(g => (g.department || '').toString());
      
      const toStaffGroups = await require('../models/EscalationGroup').find({
        _id: { $in: toStaff.groups || [] }
      });
      const toStaffDeptIds = toStaffGroups.map(g => (g.department || '').toString());
      
      const sharedDept = fromStaffDeptIds.some(id => toStaffDeptIds.includes(id));
      if (!sharedDept) {
        return res.status(400).json({ success: false, message: 'Target staff must share at least one department of their groups' });
      }
      toStaffName = toStaff.name;
    }

    // Query open complaints assigned to fromStaff
    const openComplaints = await Complaint.find({
      assignedTo: fromStaff._id,
      status: { $nin: ['Resolved', 'Rejected', 'Awaiting Feedback', 'Closed'] }
    });

    if (openComplaints.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No open complaints found to reassign',
        count: 0
      });
    }

    const now = new Date();

    for (const c of openComplaints) {
      c.assignedTo = toStaffId || null;
      c.assignedAt = now;
      c.lastTransferredAt = now;
      c.assignmentReason = reason || 'Bulk Reassignment';

      c.history.push({
        action: `Bulk Reassigned from ${fromStaff.name} to ${toStaffName}. Reason: ${reason || 'Staff leave/re-balancing'}`,
        actor: req.user.name
      });

      await c.save();
    }

    // Recalculate workloads
    await calculateWorkloadScore(fromStaff);
    if (toStaff) {
      await calculateWorkloadScore(toStaff);
    }

    // Dispatch batch notifications
    const notifications = [];
    
    // Notify source staff
    notifications.push(Notification.create({
      recipient: fromStaff._id,
      title: 'Bulk Reassignment Completed',
      message: `All ${openComplaints.length} of your open complaints have been bulk-reassigned to ${toStaffName}.`,
      complaint: openComplaints[0]._id
    }));

    // Notify target staff
    if (toStaff) {
      notifications.push(Notification.create({
        recipient: toStaff._id,
        title: 'Bulk Reassignment Received',
        message: `You have been bulk-assigned ${openComplaints.length} complaints from ${fromStaff.name}.`,
        complaint: openComplaints[0]._id
      }));
    }

    await Promise.all(notifications);

    res.status(200).json({
      success: true,
      message: `Successfully bulk-reassigned ${openComplaints.length} complaints from ${fromStaff.name} to ${toStaffName}`,
      count: openComplaints.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a staff member's availability status or capacity (Admin/Manager only)
// @route   PUT /api/workload/staff/:id
// @access  Private (Admin only)
const updateStaffConfig = async (req, res) => {
  try {
    const { maxCapacity, availabilityStatus } = req.body;
    const staff = await User.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    // Security check: must be super admin OR in the same department
    if (!isSuperAdmin(req.user)) {
      const userDeptIds = (req.user.groups || []).map(g => ((g.department && g.department._id) || g.department || '').toString()).filter(Boolean);
      const staffGroups = await require('../models/EscalationGroup').find({
        _id: { $in: staff.groups || [] }
      });
      const staffDeptIds = staffGroups.map(g => (g.department || '').toString());
      const sharedDept = userDeptIds.some(id => staffDeptIds.includes(id));
      if (!sharedDept) {
        return res.status(403).json({ success: false, message: 'Not authorized to manage this staff member' });
      }
    }

    if (maxCapacity !== undefined) {
      staff.maxCapacity = Number(maxCapacity);
    }
    if (availabilityStatus !== undefined) {
      staff.availabilityStatus = availabilityStatus;
    }

    await staff.save();
    await calculateWorkloadScore(staff);

    res.status(200).json({
      success: true,
      message: 'Staff configuration updated successfully',
      data: staff
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getStaffWorkloads,
  getWorkloadDashboard,
  getWorkloadAlerts,
  transferComplaint,
  bulkReassign,
  updateStaffConfig
};
