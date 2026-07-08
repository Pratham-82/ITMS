const Complaint = require('../models/Ticket');
const Department = require('../models/Department');
const Settings = require('../models/Settings');

// Helper to calculate CSAT metrics from a set of complaints
const calculateCsatMetrics = (complaints, activeQuestions = []) => {
  const feedbackComplaints = complaints.filter(c => c.feedbackSubmitted && c.feedback);
  const totalFeedback = feedbackComplaints.length;
  
  if (totalFeedback === 0) {
    return {
      csatScore: 0,
      avgOverallRating: 0,
      avgResponseTimeRating: 0,
      avgCommunicationRating: 0,
      avgResolutionQualityRating: 0,
      ratingAverages: [],
      totalFeedback: 0,
      feedbackResponseRate: 0,
      reopenRate: 0,
      firstTimeResolutionRate: 0,
      recommendationRate: 0
    };
  }

  // CSAT Score = % of overall ratings that are 4 or 5
  // Fallback: look for overallRating in custom responses, then c.feedback.overallRating
  const positiveOverall = feedbackComplaints.filter(c => {
    const customOverall = c.feedback.responses?.find(r => r.questionId === 'overallRating');
    const score = (customOverall && typeof customOverall.value === 'number')
      ? customOverall.value
      : (c.feedback.overallRating || 5);
    return score >= 4;
  }).length;
  const csatScore = Math.round((positiveOverall / totalFeedback) * 100);

  // Dynamic averages for all rating-type fields
  const ratingAverages = [];
  const ratingQuestions = activeQuestions.length > 0 
    ? activeQuestions.filter(q => q.type === 'rating')
    : [
        { id: 'overallRating', label: 'Overall Satisfaction' },
        { id: 'responseTimeRating', label: 'Response Time Satisfaction' },
        { id: 'communicationRating', label: 'Staff Communication' },
        { id: 'resolutionQualityRating', label: 'Resolution Quality' }
      ];

  ratingQuestions.forEach(q => {
    let sum = 0;
    let count = 0;
    
    feedbackComplaints.forEach(c => {
      // 1. Look in custom responses
      const resp = c.feedback.responses && c.feedback.responses.find(r => r.questionId === q.id);
      if (resp && typeof resp.value === 'number') {
        sum += resp.value;
        count++;
      } else if (c.feedback[q.id] !== undefined && typeof c.feedback[q.id] === 'number') {
        // 2. Fall back to legacy field
        sum += c.feedback[q.id];
        count++;
      }
    });

    const average = count > 0 ? Number((sum / count).toFixed(1)) : 0;
    ratingAverages.push({
      id: q.id,
      label: q.label,
      average,
      count
    });
  });

  const overallRatingItem = ratingAverages.find(r => r.id === 'overallRating') || { average: 0 };
  const responseTimeRatingItem = ratingAverages.find(r => r.id === 'responseTimeRating') || { average: 0 };
  const communicationRatingItem = ratingAverages.find(r => r.id === 'communicationRating') || { average: 0 };
  const resolutionQualityRatingItem = ratingAverages.find(r => r.id === 'resolutionQualityRating') || { average: 0 };

  // Feedback Response Rate = total feedback submitted / total feedback requested
  const totalRequested = complaints.filter(c => c.feedbackRequested).length;
  const feedbackResponseRate = totalRequested > 0 ? Math.round((totalFeedback / totalRequested) * 100) : 0;

  // Reopen Rate = complaints that have been reopened / total complaints resolved or awaiting feedback
  const totalResolvedOrAwaiting = complaints.filter(c => 
    c.status === 'Resolved' || 
    c.status === 'Awaiting Feedback' || 
    c.status === 'Closed'
  ).length;
  const totalReopened = complaints.filter(c => c.reopenedCount > 0).length;
  const reopenRate = totalResolvedOrAwaiting > 0 ? Math.round((totalReopened / totalResolvedOrAwaiting) * 100) : 0;

  // First-Time Resolution Rate = % of resolved/closed complaints that were never reopened
  const neverReopened = complaints.filter(c => 
    (c.status === 'Resolved' || c.status === 'Awaiting Feedback' || c.status === 'Closed') && 
    (!c.reopenedCount || c.reopenedCount === 0)
  ).length;
  const firstTimeResolutionRate = totalResolvedOrAwaiting > 0 ? Math.round((neverReopened / totalResolvedOrAwaiting) * 100) : 0;

  // Recommendation Rate = % of respondents who recommend the service
  // Fallback: look for recommendation in responses, then c.feedback.recommendation
  const recommendCount = feedbackComplaints.filter(c => {
    const customRec = c.feedback.responses?.find(r => r.questionId === 'recommendation');
    return (customRec && customRec.value !== undefined)
      ? (customRec.value === 'Yes' || customRec.value === true)
      : !!c.feedback.recommendation;
  }).length;
  const recommendationRate = Math.round((recommendCount / totalFeedback) * 100);

  return {
    csatScore,
    avgOverallRating: overallRatingItem.average || Number((feedbackComplaints.reduce((sum, c) => sum + c.feedback.overallRating, 0) / totalFeedback).toFixed(1)) || 0,
    avgResponseTimeRating: responseTimeRatingItem.average,
    avgCommunicationRating: communicationRatingItem.average,
    avgResolutionQualityRating: resolutionQualityRatingItem.average,
    ratingAverages,
    totalFeedback,
    feedbackResponseRate,
    reopenRate,
    firstTimeResolutionRate,
    recommendationRate
  };
};

// @desc    Get CSAT overall dashboard metrics
// @route   GET /api/csat/dashboard
// @access  Private (Admin only)
const getCsatDashboard = async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: 'system_branding' });
    const activeQuestions = settings?.feedbackQuestions || [];
    const complaints = await Complaint.find({});
    const globalMetrics = calculateCsatMetrics(complaints, activeQuestions);

    // Get 5 most recent feedback entries
    const recentFeedbackRaw = await Complaint.find({ feedbackSubmitted: true })
      .populate('citizen', 'name email')
      .sort({ 'feedback.submittedAt': -1 })
      .limit(5);

    const recentFeedback = recentFeedbackRaw.map(c => ({
      complaintId: c._id,
      trackingId: c.trackingId,
      title: c.title,
      citizenName: c.citizen?.name || 'Anonymous',
      overallRating: c.feedback.overallRating,
      comment: c.feedback.comment,
      submittedAt: c.feedback.submittedAt
    }));

    // Get negative feedback alerts (overallRating <= 2)
    const negativeFeedbackRaw = await Complaint.find({ 
      feedbackSubmitted: true, 
      'feedback.overallRating': { $lte: 2 } 
    })
      .populate('citizen', 'name email')
      .sort({ 'feedback.submittedAt': -1 })
      .limit(10);

    const negativeFeedbackAlerts = negativeFeedbackRaw.map(c => ({
      complaintId: c._id,
      trackingId: c.trackingId,
      title: c.title,
      citizenName: c.citizen?.name || 'Anonymous',
      overallRating: c.feedback.overallRating,
      comment: c.feedback.comment,
      assignedTo: c.assignedDepartment,
      submittedAt: c.feedback.submittedAt
    }));

    // Net Positive Feedback (Count of 4/5 star ratings - Count of 1/2 star ratings)
    const feedbackList = complaints.filter(c => c.feedbackSubmitted && c.feedback);
    const positiveCount = feedbackList.filter(c => c.feedback.overallRating >= 4).length;
    const negativeCount = feedbackList.filter(c => c.feedback.overallRating <= 2).length;
    const netPositiveFeedback = positiveCount - negativeCount;

    // Monthly Satisfaction Trends (for the past 6 months)
    const monthlyTrends = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      
      const monthComplaints = feedbackList.filter(c => 
        c.feedback.submittedAt >= monthStart && c.feedback.submittedAt <= monthEnd
      );
      
      const monthAvg = monthComplaints.length > 0
        ? Number((monthComplaints.reduce((sum, c) => sum + c.feedback.overallRating, 0) / monthComplaints.length).toFixed(1))
        : 0;

      const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyTrends.push({
        month: monthLabel,
        avgRating: monthAvg,
        feedbackCount: monthComplaints.length
      });
    }

    res.status(200).json({
      success: true,
      data: {
        globalMetrics,
        netPositiveFeedback,
        recentFeedback,
        negativeFeedbackAlerts,
        monthlyTrends
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get CSAT metrics breakdown by department
// @route   GET /api/csat/departments
// @access  Private (Admin only)
const getDepartmentCsat = async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: 'system_branding' });
    const activeQuestions = settings?.feedbackQuestions || [];
    const ratingQuestions = activeQuestions.length > 0 
      ? activeQuestions.filter(q => q.type === 'rating')
      : [
          { id: 'overallRating', label: 'Overall Satisfaction' },
          { id: 'responseTimeRating', label: 'Response Time Satisfaction' },
          { id: 'communicationRating', label: 'Staff Communication' },
          { id: 'resolutionQualityRating', label: 'Resolution Quality' }
        ];

    const complaints = await Complaint.find({});
    const departments = await Department.find({ isActive: true });

    const departmentStats = departments.map(dept => {
      const deptComplaints = complaints.filter(c => c.assignedDepartment === dept.name);
      const feedbackComplaints = deptComplaints.filter(c => c.feedbackSubmitted && c.feedback);
      const totalFeedback = feedbackComplaints.length;

      const totalResolvedOrAwaiting = deptComplaints.filter(c => 
        c.status === 'Resolved' || 
        c.status === 'Awaiting Feedback' || 
        c.status === 'Closed'
      ).length;
      const totalReopened = deptComplaints.filter(c => c.reopenedCount > 0).length;
      const reopenRate = totalResolvedOrAwaiting > 0 ? Math.round((totalReopened / totalResolvedOrAwaiting) * 100) : 0;

      if (totalFeedback === 0) {
        return {
          departmentName: dept.name,
          avgRating: 0,
          feedbackCount: 0,
          reopenRate,
          resolutionQualityScore: 0,
          communicationScore: 0,
          csatScore: 0,
          ratingAverages: ratingQuestions.map(q => ({ id: q.id, label: q.label, average: 0 }))
        };
      }

      const ratingAverages = [];
      ratingQuestions.forEach(q => {
        let sum = 0;
        let count = 0;
        
        feedbackComplaints.forEach(c => {
          const resp = c.feedback.responses && c.feedback.responses.find(r => r.questionId === q.id);
          if (resp && typeof resp.value === 'number') {
            sum += resp.value;
            count++;
          } else if (c.feedback[q.id] !== undefined && typeof c.feedback[q.id] === 'number') {
            sum += c.feedback[q.id];
            count++;
          }
        });

        const average = count > 0 ? Number((sum / count).toFixed(1)) : 0;
        ratingAverages.push({
          id: q.id,
          label: q.label,
          average
        });
      });

      const overallRatingItem = ratingAverages.find(r => r.id === 'overallRating') || { average: 0 };
      const responseTimeRatingItem = ratingAverages.find(r => r.id === 'responseTimeRating') || { average: 0 };
      const communicationRatingItem = ratingAverages.find(r => r.id === 'communicationRating') || { average: 0 };
      const resolutionQualityRatingItem = ratingAverages.find(r => r.id === 'resolutionQualityRating') || { average: 0 };

      const positiveOverall = feedbackComplaints.filter(c => {
        const customOverall = c.feedback.responses?.find(r => r.questionId === 'overallRating');
        const score = (customOverall && typeof customOverall.value === 'number')
          ? customOverall.value
          : (c.feedback.overallRating || 5);
        return score >= 4;
      }).length;
      const csatScore = Math.round((positiveOverall / totalFeedback) * 100);

      return {
        departmentName: dept.name,
        avgRating: overallRatingItem.average || Number((feedbackComplaints.reduce((sum, c) => sum + c.feedback.overallRating, 0) / totalFeedback).toFixed(1)) || 0,
        feedbackCount: totalFeedback,
        reopenRate,
        resolutionQualityScore: resolutionQualityRatingItem.average,
        communicationScore: communicationRatingItem.average,
        csatScore,
        ratingAverages
      };
    });

    // Rank departments by satisfaction score (avgRating) descending
    departmentStats.sort((a, b) => b.avgRating - a.avgRating);

    res.status(200).json({
      success: true,
      data: departmentStats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get CSAT metrics breakdown by category
// @route   GET /api/csat/categories
// @access  Private (Admin only)
const getCategoryCsat = async (req, res) => {
  try {
    const complaints = await Complaint.find({});
    
    // Group complaints by categoryName
    const categoryGroups = {};
    complaints.forEach(c => {
      if (!c.categoryName) return;
      if (!categoryGroups[c.categoryName]) {
        categoryGroups[c.categoryName] = [];
      }
      categoryGroups[c.categoryName].push(c);
    });

    const categoryStats = Object.keys(categoryGroups).map(catName => {
      const catComplaints = categoryGroups[catName];
      const feedbackComplaints = catComplaints.filter(c => c.feedbackSubmitted && c.feedback);
      const totalFeedback = feedbackComplaints.length;

      const totalResolvedOrAwaiting = catComplaints.filter(c => 
        c.status === 'Resolved' || 
        c.status === 'Awaiting Feedback' || 
        c.status === 'Closed'
      ).length;
      const totalReopened = catComplaints.filter(c => c.reopenedCount > 0).length;
      const reopenRate = totalResolvedOrAwaiting > 0 ? Math.round((totalReopened / totalResolvedOrAwaiting) * 100) : 0;

      if (totalFeedback === 0) {
        return {
          categoryName: catName,
          csatScore: 0,
          avgRating: 0,
          feedbackCount: 0,
          reopenRate
        };
      }

      const positiveOverall = feedbackComplaints.filter(c => c.feedback.overallRating >= 4).length;
      const csatScore = Math.round((positiveOverall / totalFeedback) * 100);
      const avgRating = Number((feedbackComplaints.reduce((sum, c) => sum + c.feedback.overallRating, 0) / totalFeedback).toFixed(1));

      return {
        categoryName: catName,
        csatScore,
        avgRating,
        feedbackCount: totalFeedback,
        reopenRate
      };
    });

    // Sort categoryStats by score
    categoryStats.sort((a, b) => b.csatScore - a.csatScore);

    const mostLovedCategories = categoryStats.filter(c => c.feedbackCount > 0).slice(0, 3);
    const lowestRatedCategories = categoryStats.filter(c => c.feedbackCount > 0).slice(-3).reverse();

    res.status(200).json({
      success: true,
      data: {
        categoryStats,
        mostLovedCategories,
        lowestRatedCategories
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get detailed CSAT satisfaction reports
// @route   GET /api/csat/reports
// @access  Private (Admin only)
const getCsatReports = async (req, res) => {
  try {
    // 1. Low Satisfaction Complaints Report (overallRating <= 2)
    const lowSatisfactionComplaints = await Complaint.find({
      feedbackSubmitted: true,
      'feedback.overallRating': { $lte: 2 }
    })
      .populate('citizen', 'name email')
      .sort({ 'feedback.submittedAt': -1 });

    const lowSatisfactionReport = lowSatisfactionComplaints.map(c => ({
      trackingId: c.trackingId,
      title: c.title,
      department: c.assignedDepartment,
      citizenName: c.citizen?.name || 'Anonymous',
      overallRating: c.feedback.overallRating,
      comment: c.feedback.comment,
      submittedAt: c.feedback.submittedAt
    }));

    // 2. Complaints Reopened After Resolution Report
    const reopenedComplaints = await Complaint.find({
      reopenedCount: { $gt: 0 }
    })
      .populate('citizen', 'name email')
      .sort({ reopenedAt: -1 });

    const reopenedReport = reopenedComplaints.map(c => ({
      trackingId: c.trackingId,
      title: c.title,
      department: c.assignedDepartment,
      citizenName: c.citizen?.name || 'Anonymous',
      status: c.status,
      reopenedCount: c.reopenedCount,
      reopenedReason: c.reopenedReason,
      reopenedAt: c.reopenedAt
    }));

    // 3. Monthly Satisfaction Trends Report
    const complaints = await Complaint.find({});
    const feedbackList = complaints.filter(c => c.feedbackSubmitted && c.feedback);
    const monthlyReport = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      
      const monthComplaints = feedbackList.filter(c => 
        c.feedback.submittedAt >= monthStart && c.feedback.submittedAt <= monthEnd
      );
      
      const avgOverall = monthComplaints.length > 0
        ? Number((monthComplaints.reduce((sum, c) => sum + c.feedback.overallRating, 0) / monthComplaints.length).toFixed(2))
        : 0;
      
      const positiveOverall = monthComplaints.filter(c => c.feedback.overallRating >= 4).length;
      const csatScore = monthComplaints.length > 0
        ? Math.round((positiveOverall / monthComplaints.length) * 100)
        : 0;

      const monthLabel = monthStart.toLocaleString('default', { month: 'long', year: 'numeric' });
      monthlyReport.push({
        month: monthLabel,
        csatScore,
        avgOverallRating: avgOverall,
        feedbackCount: monthComplaints.length
      });
    }

    res.status(200).json({
      success: true,
      data: {
        lowSatisfactionReport,
        reopenedReport,
        monthlyReport
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCsatDashboard,
  getDepartmentCsat,
  getCategoryCsat,
  getCsatReports
};
