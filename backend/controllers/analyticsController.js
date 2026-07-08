const Complaint = require('../models/Ticket');
const mongoose = require('mongoose');

// @desc    Get SLA & Risk metrics for admin dashboard widgets
// @route   GET /api/analytics/widgets
// @access  Private (Admin only)
const getDashboardWidgets = async (req, res) => {
  try {
    const filter = {};
    const isSuperAdmin = req.user.role === 'admin' && (
      (req.user.groups && req.user.groups.length > 0 && req.user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
      ((!req.user.groups || req.user.groups.length === 0) && (!req.user.department || req.user.department === 'General Administration'))
    );
    
    if (!isSuperAdmin) {
      const deptIds = (req.user.groups || []).map(g => (g.department && g.department._id) || g.department).filter(Boolean);
      filter.department = { $in: deptIds };
    }

    // 1. Response/Resolution SLA Breached
    const responseSlaBreachedCount = await Complaint.countDocuments({
      ...filter,
      responseSlaStatus: 'Breached'
    });
    const resolutionSlaBreachedCount = await Complaint.countDocuments({
      ...filter,
      resolutionSlaStatus: 'Breached'
    });

    // 2. Repeated Breaches (totalBreachCount > 1)
    const repeatedBreachesCount = await Complaint.countDocuments({
      ...filter,
      totalBreachCount: { $gt: 1 }
    });

    // 3. Critical Risk Complaints (riskScore >= 50)
    const criticalRiskCount = await Complaint.countDocuments({
      ...filter,
      riskScore: { $gte: 50 }
    });
    const topCriticalRiskComplaints = await Complaint.find({
      ...filter,
      riskScore: { $gt: 0 }
    })
      .sort({ riskScore: -1 })
      .limit(10)
      .select('trackingId title priority riskScore status assignedToName');

    // 4. Executive Escalations (executiveEscalated = true)
    const executiveEscalationsCount = await Complaint.countDocuments({
      ...filter,
      executiveEscalated: true
    });
    const executiveEscalatedComplaints = await Complaint.find({
      ...filter,
      executiveEscalated: true
    })
      .sort({ executiveEscalatedAt: -1 })
      .select('trackingId title priority riskScore status assignedToName executiveEscalatedAt executiveEscalationReason');

    // 5. Agent Rankings
    const matchStage = {
      assignedTo: { $ne: null }
    };
    if (!isSuperAdmin) {
      const deptIds = (req.user.groups || []).map(g => (g.department && g.department._id) || g.department).filter(Boolean);
      matchStage.department = { $in: deptIds };
    }

    const agentRankings = await Complaint.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$assignedTo',
          name: { $first: '$assignedToName' },
          totalAssigned: { $sum: 1 },
          resolvedCount: {
            $sum: {
              $cond: [{ $in: ['$status', ['Resolved', 'Closed']] }, 1, 0]
            }
          },
          slaCompliantResolvedCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['Resolved', 'Closed']] },
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
          name: 1,
          totalAssigned: 1,
          resolvedCount: 1,
          slaComplianceRate: {
            $cond: [
              { $gt: ['$resolvedCount', 0] },
              { $multiply: [{ $divide: ['$slaCompliantResolvedCount', '$resolvedCount'] }, 100] },
              100
            ]
          }
        }
      },
      { $sort: { slaComplianceRate: -1, resolvedCount: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          responseSlaBreachedCount,
          resolutionSlaBreachedCount,
          repeatedBreachesCount,
          criticalRiskCount,
          executiveEscalationsCount
        },
        topCriticalRiskComplaints,
        executiveEscalatedComplaints,
        agentRankings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardWidgets
};
