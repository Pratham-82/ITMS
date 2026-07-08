const EscalationRuleResolver = require('./EscalationRuleResolver');
const CalendarEngine = require('./CalendarEngine');
const AssignmentEngine = require('./AssignmentEngine');
const NotificationEngine = require('./NotificationEngine');
const AuditEngine = require('./AuditEngine');
const User = require('../../models/User');

/**
 * EscalationEngine orchestrates ticket escalation paths, level advancement,
 * parallel branches, and reopen resets.
 */
class EscalationEngine {
  /**
   * Evaluates and processes any due escalations for a complaint.
   * Modifies complaint object but does NOT call save().
   */
  async processComplaint(complaint, now = new Date()) {
    // Skip if resolved, rejected, closed, or not pending escalation
    if (
      ['Resolved', 'Rejected', 'Closed'].includes(complaint.status) ||
      complaint.escalationStatus !== 'pending'
    ) {
      return false;
    }

    // Check if nextEscalationDueAt is reached
    if (!complaint.nextEscalationDueAt || complaint.nextEscalationDueAt > now) {
      return false;
    }

    const rule = await EscalationRuleResolver.resolveRule(complaint);
    if (!rule) {
      console.warn(`[EscalationEngine] Escalation rule not found for complaint #${complaint.trackingId}. Clearing due date.`);
      complaint.nextEscalationDueAt = null;
      complaint.escalationStatus = 'none';
      return true;
    }

    const currentLevel = complaint.currentEscalationLevel || 0;
    const nextLevelNum = currentLevel + 1;
    const nextLevelDetails = rule.levels.find(l => l.level === nextLevelNum);

    if (!nextLevelDetails) {
      console.log(`[EscalationEngine] Complaint #${complaint.trackingId} reached max level.`);
      complaint.nextEscalationDueAt = null;
      complaint.escalationStatus = 'completed';
      return true;
    }

    const calendar = await CalendarEngine.resolveCalendarForComplaint(complaint);
    const previousDept = complaint.assignedDepartment;
    const previousOwner = complaint.assignedTo;

    // Check for VIP Citizen or Critical Priority to log VIP escalation
    let isVip = false;
    if (complaint.citizen) {
      const citizenUser = await User.findById(complaint.citizen);
      if (citizenUser && (citizenUser.isVip || citizenUser.role === 'vip')) {
        isVip = true;
      }
    }

    // Check if next level is a parallel branch
    if (nextLevelDetails.isParallelBranch) {
      await this.processParallelEscalation(complaint, nextLevelDetails, nextLevelNum, calendar, now);
    } else {
      // Standard level advancement
      const newDept = nextLevelDetails.department || previousDept;
      complaint.currentEscalationLevel = nextLevelNum;
      complaint.assignedDepartment = newDept;
      complaint.isAutoEscalated = true;
      complaint.status = 'Escalated';
      complaint.isEscalated = true; // backward compatibility
      complaint.lastEscalatedAt = now;

      if (currentLevel === 0) {
        complaint.escalationStartedAt = now;
      }

      // Reassign assignee properties based on targetType
      if (nextLevelDetails.targetType === 'department') {
        complaint.assignedDepartment = newDept;
        complaint.assignedGroup = null;
        complaint.escalationRole = null;
        
        const Department = require('../../models/Department');
        const deptDoc = await Department.findOne({ name: newDept });
        if (deptDoc) {
          complaint.department = deptDoc._id;
        }
      } else if (nextLevelDetails.targetType === 'group') {
        complaint.assignedGroup = nextLevelDetails.targetId;
        complaint.escalationRole = null;
        
        const EscalationGroup = require('../../models/EscalationGroup');
        const Department = require('../../models/Department');
        const groupDoc = await EscalationGroup.findById(nextLevelDetails.targetId);
        if (groupDoc && groupDoc.department) {
          const deptDoc = await Department.findById(groupDoc.department);
          if (deptDoc) {
            complaint.department = deptDoc._id;
            complaint.assignedDepartment = deptDoc.name;
          }
        }
      } else if (nextLevelDetails.targetType === 'role') {
        complaint.escalationRole = nextLevelDetails.targetId;
      } else if (nextLevelDetails.targetType === 'user') {
        complaint.assignedTo = nextLevelDetails.targetId;
      }

      // Adjust SLA response and resolution targets if specified on rule level
      if (nextLevelDetails.resolutionSlaMinutes) {
        complaint.resolutionDueAt = await CalendarEngine.calculateDueDate(now, nextLevelDetails.resolutionSlaMinutes, calendar, newDept);
        complaint.resolutionSlaStatus = 'Within SLA';
      }
      if (nextLevelDetails.responseSlaMinutes) {
        complaint.responseDueAt = await CalendarEngine.calculateDueDate(now, nextLevelDetails.responseSlaMinutes, calendar, newDept);
        complaint.responseSlaStatus = 'Within SLA';
      }

      // Schedule next escalation level if available
      const hasNextLevel = rule.levels.some(l => l.level === nextLevelNum + 1);
      if (hasNextLevel) {
        const hours = nextLevelDetails.durationHours || 24;
        complaint.nextEscalationDueAt = await CalendarEngine.calculateDueDate(now, hours * 60, calendar, newDept);
        complaint.escalationStatus = 'pending';
      } else {
        complaint.nextEscalationDueAt = null;
        complaint.escalationStatus = 'completed';
      }

      const durationInfo = `Level ${nextLevelNum} (${nextLevelDetails.durationHours || 24}h)`;
      const reason = `Auto-escalated ${isVip ? '(VIP route) ' : ''}due to SLA timeout (Level ${nextLevelNum})`;

      complaint.escalationPath.push({
        level: nextLevelNum,
        department: newDept,
        escalatedAt: now,
        escalatedBy: 'System Scheduler',
        reason
      });

      complaint.history.push({
        action: `Automated escalation to Level ${nextLevelNum} (${newDept}) due to SLA breach`,
        actor: 'System'
      });

      // Auto-assign to best staff member using strategy
      const assignResult = await AssignmentEngine.assignComplaint(complaint, 'least-tickets');

      // Dispatch Notifications
      await NotificationEngine.sendEscalation(complaint, nextLevelNum, previousDept, newDept);

      // Audit Log
      await AuditEngine.logEscalationAction({
        action: 'ESCALATED',
        complaintId: complaint._id,
        level: nextLevelNum,
        previousOwner,
        newOwner: complaint.assignedTo,
        previousDepartment: previousDept,
        newDepartment: newDept,
        reason,
        actor: 'System'
      });
    }

    return true;
  }

  /**
   * Helper to process parallel escalation branch.
   */
  async processParallelEscalation(complaint, levelDetails, levelNum, calendar, now) {
    const dueAt = await CalendarEngine.calculateDueDate(now, (levelDetails.durationHours || 24) * 60, calendar);
    complaint.parallelEscalations.push({
      level: levelNum,
      targetType: levelDetails.targetType,
      targetId: levelDetails.targetId,
      status: 'pending',
      dueAt,
      escalatedAt: now
    });

    complaint.history.push({
      action: `Triggered Parallel Escalation Branch Level ${levelNum}`,
      actor: 'System'
    });

    await AuditEngine.logEscalationAction({
      action: 'PARALLEL_ESCALATION_TRIGGERED',
      complaintId: complaint._id,
      level: levelNum,
      reason: `Parallel branch level ${levelNum} activated`,
      actor: 'System'
    });
  }

  /**
   * Forcefully advances the escalation level due to an SLA breach.
   * Modifies complaint object but does NOT call save().
   */
  async processSlaBreach(complaint, breachType, now = new Date()) {
    if (['Resolved', 'Rejected', 'Closed'].includes(complaint.status)) {
      return false;
    }

    const rule = await EscalationRuleResolver.resolveRule(complaint);
    if (!rule) return false;

    const currentLevel = complaint.currentEscalationLevel || 0;
    const nextLevelNum = currentLevel + 1;
    const nextLevelDetails = rule.levels.find(l => l.level === nextLevelNum);

    if (!nextLevelDetails) return false;

    const calendar = await CalendarEngine.resolveCalendarForComplaint(complaint);
    const previousDept = complaint.assignedDepartment;
    const previousOwner = complaint.assignedTo;

    // Standard level advancement
    const newDept = nextLevelDetails.department || previousDept;
    complaint.currentEscalationLevel = nextLevelNum;
    complaint.assignedDepartment = newDept;
    complaint.isAutoEscalated = true;
    complaint.status = 'Escalated';
    complaint.isEscalated = true;
    complaint.lastEscalatedAt = now;

    if (currentLevel === 0) {
      complaint.escalationStartedAt = now;
    }

    if (nextLevelDetails.targetType === 'department') {
      complaint.assignedDepartment = newDept;
      complaint.assignedGroup = null;
      complaint.escalationRole = null;
      
      const Department = require('../../models/Department');
      const deptDoc = await Department.findOne({ name: newDept });
      if (deptDoc) {
        complaint.department = deptDoc._id;
      }
    } else if (nextLevelDetails.targetType === 'group') {
      complaint.assignedGroup = nextLevelDetails.targetId;
      complaint.escalationRole = null;
      
      const EscalationGroup = require('../../models/EscalationGroup');
      const Department = require('../../models/Department');
      const groupDoc = await EscalationGroup.findById(nextLevelDetails.targetId);
      if (groupDoc && groupDoc.department) {
        const deptDoc = await Department.findById(groupDoc.department);
        if (deptDoc) {
          complaint.department = deptDoc._id;
          complaint.assignedDepartment = deptDoc.name;
        }
      }
    } else if (nextLevelDetails.targetType === 'role') {
      complaint.escalationRole = nextLevelDetails.targetId;
    } else if (nextLevelDetails.targetType === 'user') {
      complaint.assignedTo = nextLevelDetails.targetId;
    }

    // Schedule next escalation level if available
    const hasNextLevel = rule.levels.some(l => l.level === nextLevelNum + 1);
    if (hasNextLevel) {
      const hours = nextLevelDetails.durationHours || 24;
      complaint.nextEscalationDueAt = await CalendarEngine.calculateDueDate(now, hours * 60, calendar, newDept);
      complaint.escalationStatus = 'pending';
    } else {
      complaint.nextEscalationDueAt = null;
      complaint.escalationStatus = 'completed';
    }

    const reason = `Auto-escalated due to ${breachType === 'response' ? 'Response' : 'Resolution'} SLA Breach`;
    complaint.escalationPath.push({
      level: nextLevelNum,
      department: newDept,
      escalatedAt: now,
      escalatedBy: 'SLA Engine',
      reason
    });

    complaint.history.push({
      action: `Auto-escalated to Level ${nextLevelNum} (${newDept}) due to SLA Breach`,
      actor: 'System'
    });

    // Auto-assign using least open tickets strategy
    await AssignmentEngine.assignComplaint(complaint, 'least-tickets');

    // Notify
    await NotificationEngine.sendEscalation(complaint, nextLevelNum, previousDept, newDept);

    return true;
  }
}

module.exports = new EscalationEngine();
