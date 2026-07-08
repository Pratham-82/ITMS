const Complaint = require('../../models/Ticket');
const User = require('../../models/User');

/**
 * EscalationAnalytics calculates key ITSM operational metrics:
 * MTTA, MTTR, SLA Compliance, Escalation Rates, and rankings.
 */
class EscalationAnalytics {
  /**
   * Calculates Mean Time to Assign (MTTA) in minutes.
   */
  async calculateMTTA(query = {}) {
    const assignedComplaints = await Complaint.find({
      assignedAt: { $exists: true, $ne: null },
      ...query
    });

    if (assignedComplaints.length === 0) return 0;

    let totalDiffMs = 0;
    assignedComplaints.forEach((c) => {
      const diff = new Date(c.assignedAt).getTime() - new Date(c.createdAt).getTime();
      if (diff > 0) totalDiffMs += diff;
    });

    return Math.round(totalDiffMs / (assignedComplaints.length * 60 * 1000));
  }

  /**
   * Calculates Mean Time to Resolve (MTTR) in minutes.
   */
  async calculateMTTR(query = {}) {
    const resolvedComplaints = await Complaint.find({
      resolvedAt: { $exists: true, $ne: null },
      ...query
    });

    if (resolvedComplaints.length === 0) return 0;

    let totalDiffMs = 0;
    resolvedComplaints.forEach((c) => {
      const diff = new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime();
      if (diff > 0) totalDiffMs += diff;
    });

    return Math.round(totalDiffMs / (resolvedComplaints.length * 60 * 1000));
  }

  /**
   * Calculates SLA Compliance Percentage.
   */
  async getSlaCompliancePercentage(query = {}) {
    const totalResolved = await Complaint.countDocuments({
      status: { $in: ['Resolved', 'Closed', 'Awaiting Feedback'] },
      ...query
    });

    if (totalResolved === 0) return 100;

    const compliantCount = await Complaint.countDocuments({
      status: { $in: ['Resolved', 'Closed', 'Awaiting Feedback'] },
      responseSlaStatus: { $ne: 'Breached' },
      resolutionSlaStatus: { $ne: 'Breached' },
      ...query
    });

    return Math.round((compliantCount / totalResolved) * 100);
  }

  /**
   * Calculates Escalation Rate Percentage.
   */
  async getEscalationRatePercentage(query = {}) {
    const totalComplaints = await Complaint.countDocuments(query);
    if (totalComplaints === 0) return 0;

    const escalatedCount = await Complaint.countDocuments({
      $or: [
        { isEscalated: true },
        { currentEscalationLevel: { $gt: 0 } }
      ],
      ...query
    });

    return Math.round((escalatedCount / totalComplaints) * 100);
  }

  /**
   * Generates ranking of departments by SLA compliance.
   */
  async getDepartmentRankings(query = {}) {
    const aggregation = await Complaint.aggregate([
      { $match: { status: { $in: ['Resolved', 'Closed', 'Awaiting Feedback'] }, ...query } },
      {
        $group: {
          _id: '$assignedDepartment',
          total: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$responseSlaStatus', 'Breached'] },
                    { $ne: ['$resolutionSlaStatus', 'Breached'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          department: '$_id',
          total: 1,
          complianceRate: {
            $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$compliant', '$total'] }, 100] }, 100]
          }
        }
      },
      { $sort: { complianceRate: -1 } }
    ]);

    return aggregation;
  }

  /**
   * Generates ranking of agents by compliance.
   */
  async getAgentRankings(query = {}) {
    const aggregation = await Complaint.aggregate([
      { $match: { assignedTo: { $ne: null }, ...query } },
      {
        $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$responseSlaStatus', 'Breached'] },
                    { $ne: ['$resolutionSlaStatus', 'Breached'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          agentId: '$_id',
          total: 1,
          complianceRate: {
            $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$compliant', '$total'] }, 100] }, 100]
          }
        }
      },
      { $sort: { complianceRate: -1 } }
    ]);

    // Populate Agent name
    const populated = [];
    for (const item of aggregation) {
      const user = await User.findById(item.agentId);
      populated.push({
        agentName: user ? user.name : 'Unknown Officer',
        total: item.total,
        complianceRate: Math.round(item.complianceRate)
      });
    }

    return populated;
  }

  /**
   * Aggregated report summarizing all metrics.
   */
  async getMetricsSummary(query = {}) {
    const mtta = await this.calculateMTTA(query);
    const mttr = await this.calculateMTTR(query);
    const compliance = await this.getSlaCompliancePercentage(query);
    const escalationRate = await this.getEscalationRatePercentage(query);

    return {
      mtta,
      mttr,
      slaComplianceRate: compliance,
      escalationRate
    };
  }
}

module.exports = new EscalationAnalytics();
