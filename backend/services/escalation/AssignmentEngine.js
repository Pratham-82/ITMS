const User = require('../../models/User');
const Complaint = require('../../models/Ticket');
const CalendarEngine = require('./CalendarEngine');

// In-memory pointer for round-robin assignment (per department/group)
const roundRobinPointers = new Map();

/**
 * AssignmentEngine manages routing strategies, workload scoring,
 * and workload balancing suggestions.
 */
class AssignmentEngine {
  /**
   * Calculates and updates the workload score and utilization for a staff member.
   * @param {Object} user - User document
   * @returns {Promise<Object>} Workload metrics summary
   */
  async calculateWorkloadScore(user) {
    const tenantLocalStorage = require('../../middleware/tenantContext');
    const userTenantId = user.tenantId || 'default-tenant';

    return await tenantLocalStorage.run(userTenantId, async () => {
      const openComplaints = await Complaint.find({
        assignedTo: user._id,
        status: { $nin: ['Resolved', 'Rejected', 'Awaiting Feedback', 'Closed'] }
      });

      let score = 0;
      let criticalCount = 0;
      let slaRiskCount = 0;
      let escalationRiskCount = 0;

      const now = new Date();

      openComplaints.forEach((c) => {
        // 1. Priority Weight (Low = 1, Medium = 2, High = 3, Critical = 5)
        let pWeight = 1;
        if (c.priority === 'Medium') {
          pWeight = 2;
        } else if (c.priority === 'High') {
          pWeight = 3;
        } else if (c.priority === 'Critical') {
          pWeight = 5;
          criticalCount += 1;
          // Critical Complaint extra penalty: +2 points per critical complaint
          score += 2;
        }
        score += pWeight;

        // 2. SLA & Escalation risk from nextEscalationDueAt
        if (c.nextEscalationDueAt) {
          const remainingMs = new Date(c.nextEscalationDueAt).getTime() - now.getTime();
          const remainingHours = remainingMs / (3600 * 1000);

          if (remainingHours > 0) {
            // SLA Risk: < 2h (+5), < 24h (+3), < 48h (+1)
            let slaWeight = 0;
            if (remainingHours < 2) {
              slaWeight = 5;
              slaRiskCount += 1;
            } else if (remainingHours < 24) {
              slaWeight = 3;
              slaRiskCount += 1;
            } else if (remainingHours < 48) {
              slaWeight = 1;
            }
            score += slaWeight;

            // Escalation Risk: < 2h (+5), < 24h (+3), < 48h (+1)
            let escWeight = 0;
            if (remainingHours < 2) {
              escWeight = 5;
              escalationRiskCount += 1;
            } else if (remainingHours < 24) {
              escWeight = 3;
              escalationRiskCount += 1;
            } else if (remainingHours < 48) {
              escWeight = 1;
            }
            score += escWeight;
          }
        }
      });

      // Calculate capacity utilization percentage
      const maxCap = Math.max(1, user.maxCapacity || 20);
      user.capacityPercentage = Math.round((score / maxCap) * 100);
      await user.save();

      return {
        score,
        openCount: openComplaints.length,
        criticalCount,
        slaRiskCount,
        escalationRiskCount
      };
    });
  }

  /**
   * Perform Round-Robin assignment from the list of eligible users.
   */
  async assignRoundRobin(complaint, eligibleUsers, key) {
    if (eligibleUsers.length === 0) return null;

    let index = roundRobinPointers.get(key) || 0;
    if (index >= eligibleUsers.length) {
      index = 0;
    }

    const assignedUser = eligibleUsers[index];
    roundRobinPointers.set(key, (index + 1) % eligibleUsers.length);
    return assignedUser;
  }

  /**
   * Perform Least-Tickets assignment.
   */
  async assignLeastTickets(complaint, eligibleUsers) {
    if (eligibleUsers.length === 0) return null;

    const userTicketCounts = [];
    for (const user of eligibleUsers) {
      const count = await Complaint.countDocuments({
        assignedTo: user._id,
        status: { $nin: ['Resolved', 'Rejected', 'Awaiting Feedback', 'Closed'] }
      });
      userTicketCounts.push({ user, count });
    }

    userTicketCounts.sort((a, b) => a.count - b.count);
    return userTicketCounts[0].user;
  }

  /**
   * Perform Skill-based assignment.
   */
  async assignSkillBased(complaint, eligibleUsers) {
    if (eligibleUsers.length === 0) return null;

    const requiredSkill = (complaint.categoryName || '').toLowerCase();
    const matches = eligibleUsers.filter(user => 
      user.skills && user.skills.some(skill => skill.toLowerCase() === requiredSkill)
    );

    const candidates = matches.length > 0 ? matches : eligibleUsers;
    return this.assignLeastTickets(complaint, candidates);
  }

  /**
   * Core routing assignment interface.
   * Modifies complaint object but does NOT call save().
   */
  async assignComplaint(complaint, strategy = 'workload') {
    const tenantLocalStorage = require('../../middleware/tenantContext');
    const complaintTenantId = complaint.tenantId || 'default-tenant';

    return await tenantLocalStorage.run(complaintTenantId, async () => {
      try {
        const calendar = await CalendarEngine.resolveCalendarForComplaint(complaint);
        const isPaused = calendar ? await CalendarEngine.isBlackoutPeriod(new Date(), calendar._id) : false;
        if (isPaused) {
          complaint.assignmentReason = `Auto-assignment paused: Active blackout period on resolved calendar "${calendar.name}"`;
          return null;
        }

        let query = {
          role: 'admin',
          availabilityStatus: 'Available'
        };

        // Filter by Group
        let targetGroupId = complaint.assignedGroup;
        if (!targetGroupId && complaint.department) {
          const Department = require('../../models/Department');
          const deptDoc = await Department.findById(complaint.department);
          if (deptDoc && deptDoc.routingGroup) {
            targetGroupId = deptDoc.routingGroup;
          }
        }

        if (targetGroupId) {
          const EscalationGroup = require('../../models/EscalationGroup');
          const groupDoc = await EscalationGroup.findById(targetGroupId);
          if (groupDoc && groupDoc.members && groupDoc.members.length > 0) {
            query = {
              _id: { $in: groupDoc.members },
              availabilityStatus: 'Available'
            };
          } else if (complaint.department) {
            const EscalationGroup = require('../../models/EscalationGroup');
            const deptGroups = await EscalationGroup.find({ department: complaint.department });
            const memberIds = deptGroups.reduce((acc, g) => acc.concat(g.members || []), []);
            query = {
              _id: { $in: memberIds },
              availabilityStatus: 'Available'
            };
          }
        } else if (complaint.department) {
          const EscalationGroup = require('../../models/EscalationGroup');
          const deptGroups = await EscalationGroup.find({ department: complaint.department });
          const memberIds = deptGroups.reduce((acc, g) => acc.concat(g.members || []), []);
          query = {
            _id: { $in: memberIds },
            availabilityStatus: 'Available'
          };
        }

        // Filter by Escalation Role
        if (complaint.escalationRole) {
          query.escalationRole = complaint.escalationRole;
        }

        let eligibleUsers = await User.find(query);

        // Fallback 1: if no users match escalation role, fallback to any role in target department/group
        if (eligibleUsers.length === 0 && complaint.escalationRole) {
          delete query.escalationRole;
          eligibleUsers = await User.find(query);
        }

        // Fallback: Group Leader / Backup Leader (Available)
        if (eligibleUsers.length === 0 && targetGroupId) {
          const EscalationGroup = require('../../models/EscalationGroup');
          const groupDoc = await EscalationGroup.findById(targetGroupId);
          if (groupDoc) {
            const leaders = [];
            if (groupDoc.leader) leaders.push(groupDoc.leader);
            if (groupDoc.backupLeader) leaders.push(groupDoc.backupLeader);
            if (leaders.length > 0) {
              eligibleUsers = await User.find({
                _id: { $in: leaders },
                availabilityStatus: 'Available'
              });
            }
          }
        }

        // Fallback 2: if no available staff, fallback to offline/busy staff in the same department/group
        if (eligibleUsers.length === 0 && query.availabilityStatus === 'Available') {
          delete query.availabilityStatus;
          eligibleUsers = await User.find(query);
        }

        // Fallback: Group Leader / Backup Leader (Offline)
        if (eligibleUsers.length === 0 && targetGroupId) {
          const EscalationGroup = require('../../models/EscalationGroup');
          const groupDoc = await EscalationGroup.findById(targetGroupId);
          if (groupDoc) {
            const leaders = [];
            if (groupDoc.leader) leaders.push(groupDoc.leader);
            if (groupDoc.backupLeader) leaders.push(groupDoc.backupLeader);
            if (leaders.length > 0) {
              eligibleUsers = await User.find({
                _id: { $in: leaders }
              });
            }
          }
        }

        // Fallback 3: if still no staff in target department/group, fallback to any admin in the tenant
        if (eligibleUsers.length === 0) {
          eligibleUsers = await User.find({ role: 'admin' });
        }

        if (eligibleUsers.length === 0) {
          complaint.assignedTo = null;
          complaint.assignmentReason = `No available staff matching routing criteria`;
          return null;
        }

        let assignedUser = null;
        const pointerKey = complaint.assignedGroup 
          ? `group_${complaint.assignedGroup.toString()}` 
          : `dept_${complaint.assignedDepartment}`;

        if (strategy === 'round-robin') {
          assignedUser = await this.assignRoundRobin(complaint, eligibleUsers, pointerKey);
        } else if (strategy === 'least-tickets') {
          assignedUser = await this.assignLeastTickets(complaint, eligibleUsers);
        } else if (strategy === 'skill-based') {
          assignedUser = await this.assignSkillBased(complaint, eligibleUsers);
        } else {
          // Workload strategy
          const staffWorkloads = [];
          for (const staff of eligibleUsers) {
            const metrics = await this.calculateWorkloadScore(staff);
            staffWorkloads.push({ staff, score: metrics.score });
          }
          staffWorkloads.sort((a, b) => a.score - b.score);
          assignedUser = staffWorkloads[0].staff;
        }

        if (!assignedUser) {
          return null;
        }

        // Record assignment change
        const previousOwner = complaint.assignedTo;
        complaint.assignedTo = assignedUser._id;
        complaint.assignedAt = new Date();
        complaint.assignmentReason = `Assigned using ${strategy} routing strategy`;

        complaint.history.push({
          action: `Complaint assigned automatically to ${assignedUser.name}. Strategy: ${strategy}`,
          actor: 'System Auto-Assignment'
        });

        // Update metrics
        await this.calculateWorkloadScore(assignedUser);

        return { assignedUser, previousOwner };
      } catch (error) {
        console.error('Error in assignComplaint:', error);
        return null;
      }
    });
  }

  /**
   * Generates balancing suggestions.
   */
  async getBalancingSuggestions(departmentName, groupId = null) {
    try {
      const Department = require('../../models/Department');
      const EscalationGroup = require('../../models/EscalationGroup');
      
      let memberIds = [];
      if (groupId) {
        const groupDoc = await EscalationGroup.findById(groupId);
        if (groupDoc) {
          memberIds = groupDoc.members || [];
        }
      } else {
        const deptDoc = await Department.findOne({ name: departmentName });
        if (deptDoc) {
          const groups = await EscalationGroup.find({ department: deptDoc._id });
          memberIds = groups.reduce((acc, g) => acc.concat(g.members || []), []);
        }
      }

      const staff = await User.find({
        role: 'admin',
        _id: { $in: memberIds },
        availabilityStatus: 'Available'
      });

      if (staff.length < 2) return [];

      const staffMetrics = [];
      for (const member of staff) {
        const metrics = await this.calculateWorkloadScore(member);
        staffMetrics.push({
          member,
          ...metrics
        });
      }

      const suggestions = [];
      const overloadedStaff = staffMetrics.filter(s => s.member.capacityPercentage > 90);
      const underloadedStaff = staffMetrics.filter(s => s.member.capacityPercentage <= 75);

      if (overloadedStaff.length === 0 || underloadedStaff.length === 0) {
        return [];
      }

      underloadedStaff.sort((a, b) => a.score - b.score);

      for (const overloaded of overloadedStaff) {
        const openComplaints = await Complaint.find({
          assignedTo: overloaded.member._id,
          status: { $nin: ['Resolved', 'Rejected', 'Awaiting Feedback', 'Closed'] }
        }).sort({ priority: -1, createdAt: 1 });

        if (openComplaints.length === 0) continue;

        const ticketToMove = openComplaints[0];
        const target = underloadedStaff[0];

        suggestions.push({
          complaintId: ticketToMove._id,
          trackingId: ticketToMove.trackingId,
          title: ticketToMove.title,
          priority: ticketToMove.priority,
          fromUser: {
            _id: overloaded.member._id,
            name: overloaded.member.name,
            score: overloaded.score,
            utilization: overloaded.member.capacityPercentage
          },
          toUser: {
            _id: target.member._id,
            name: target.member.name,
            score: target.score,
            utilization: target.member.capacityPercentage
          },
          reason: `Rebalance workload: ${overloaded.member.name} is overloaded at ${overloaded.member.capacityPercentage}% capacity (Score: ${overloaded.score}). Suggest moving complaint #${ticketToMove.trackingId} to ${target.member.name} (Score: ${target.score}).`
        });

        let weight = 1;
        if (ticketToMove.priority === 'Medium') weight = 2;
        else if (ticketToMove.priority === 'High') weight = 3;
        else if (ticketToMove.priority === 'Critical') weight = 7;

        target.score += weight;
        target.member.capacityPercentage = Math.round((target.score / (target.member.maxCapacity || 20)) * 100);
        underloadedStaff.sort((a, b) => a.score - b.score);
      }

      return suggestions;
    } catch (error) {
      console.error('Error in getBalancingSuggestions:', error);
      return [];
    }
  }
}

module.exports = new AssignmentEngine();
