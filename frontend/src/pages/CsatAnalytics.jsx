import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Smile, 
  Star, 
  TrendingUp, 
  BarChart3, 
  FileText, 
  AlertTriangle, 
  ThumbsUp, 
  ThumbsDown,
  Printer, 
  X,
  ArrowLeft,
  Calendar,
  MessageSquare
} from 'lucide-react';
import '../styles/CsatAnalytics.css';

const CsatAnalytics = ({ startDate, endDate }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [departmentsData, setDepartmentsData] = useState([]);
  const [categoriesData, setCategoriesData] = useState(null);
  const [reportsData, setReportsData] = useState(null);

  // Modal Report States
  const [activeReport, setActiveReport] = useState(null); // 'monthly' | 'department' | 'lowSatisfaction' | 'reopened'
  const [isReportOpen, setIsReportOpen] = useState(false);

  const fetchCsatData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${user.token}` };

      const params = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      const queryStr = params.length > 0 ? `?${params.join('&')}` : '';

      // 1. Dashboard
      const dashRes = await fetch(`/api/csat/dashboard${queryStr}`, { headers });
      const dashResult = await dashRes.json();
      
      // 2. Departments
      const deptRes = await fetch(`/api/csat/departments${queryStr}`, { headers });
      const deptResult = await deptRes.json();

      // 3. Categories
      const catRes = await fetch(`/api/csat/categories${queryStr}`, { headers });
      const catResult = await catRes.json();

      // 4. Reports
      const repRes = await fetch(`/api/csat/reports${queryStr}`, { headers });
      const repResult = await repRes.json();

      if (dashResult.success && deptResult.success && catResult.success && repResult.success) {
        setDashboardData(dashResult.data);
        setDepartmentsData(deptResult.data);
        setCategoriesData(catResult.data);
        setReportsData(repResult.data);
      } else {
        addToast('Error', 'Failed to retrieve CSAT analytics', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Connection Error', 'Failed to fetch CSAT statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchCsatData();
    }
  }, [user, startDate, endDate]);

  const renderStars = (rating) => {
    const starCount = Math.round(rating || 0);
    return (
      <div className="rating-stars">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            size={13} 
            fill={i < starCount ? "#fbbf24" : "none"} 
            stroke={i < starCount ? "#fbbf24" : "rgba(255, 255, 255, 0.2)"}
          />
        ))}
      </div>
    );
  };

  const handleOpenReport = (type) => {
    setActiveReport(type);
    setIsReportOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="cd-loading-container">
        <div className="spinner cd-spinner" />
      </div>
    );
  }

  const { globalMetrics, netPositiveFeedback, recentFeedback, negativeFeedbackAlerts, monthlyTrends } = dashboardData || {};

  return (
    <div className="csat-container">
      {/* Header Panel */}
      <div className="csat-header">
        <div>
          <button onClick={() => navigate('/settings')} className="btn btn-secondary cd-back-btn" style={{ marginBottom: '12px' }}>
            <ArrowLeft size={15} />
            <span>Settings Portal</span>
          </button>
          <h1>Citizen Satisfaction Portal (CSAT)</h1>
          <p className="cd-manual-escalate-desc" style={{ marginTop: '4px', marginBottom: 0 }}>
            Executive breakdown of satisfaction ratings, reopen analysis, and service scores.
          </p>
        </div>

        <div className="csat-actions">
          <button onClick={() => handleOpenReport('lowSatisfaction')} className="btn-report">
            <AlertTriangle size={15} />
            <span>Low CSAT Report</span>
          </button>
          <button onClick={() => handleOpenReport('reopened')} className="btn-report">
            <TrendingUp size={15} />
            <span>Reopens Report</span>
          </button>
          <button onClick={() => handleOpenReport('monthly')} className="btn-report">
            <Calendar size={15} />
            <span>Monthly Trends</span>
          </button>
          <button onClick={() => handleOpenReport('department')} className="btn-report">
            <BarChart3 size={15} />
            <span>Department Report</span>
          </button>
        </div>
      </div>

      {/* Main CSAT Stats Cards */}
      <div className="csat-overview-grid">
        <div className="csat-card">
          <Smile className="csat-card-icon" size={44} />
          <span className="csat-card-title">Overall CSAT Score</span>
          <div className="csat-card-value">{globalMetrics?.csatScore}%</div>
          <span className="csat-card-sub">Percentage of 4 & 5 star ratings</span>
        </div>

        <div className="csat-card">
          <Star className="csat-card-icon" size={44} />
          <span className="csat-card-title">Average Overall Rating</span>
          <div className="csat-card-value">
            {globalMetrics?.avgOverallRating} <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>/ 5</span>
          </div>
          {renderStars(globalMetrics?.avgOverallRating)}
        </div>

        <div className="csat-card">
          <ThumbsUp className="csat-card-icon" size={44} />
          <span className="csat-card-title">Net Positive Feedback</span>
          <div className="csat-card-value" style={{ color: netPositiveFeedback >= 0 ? '#10b981' : '#ef4444' }}>
            {netPositiveFeedback > 0 ? `+${netPositiveFeedback}` : netPositiveFeedback}
          </div>
          <span className="csat-card-sub">Positive ratings minus negative ratings</span>
        </div>

        <div className="csat-card">
          <TrendingUp className="csat-card-icon" size={44} />
          <span className="csat-card-title">Reopen Rate</span>
          <div className="csat-card-value" style={{ color: globalMetrics?.reopenRate > 15 ? '#f59e0b' : 'inherit' }}>
            {globalMetrics?.reopenRate}%
          </div>
          <span className="csat-card-sub">Resolved tickets citizen reopened</span>
        </div>

        <div className="csat-card">
          <BarChart3 className="csat-card-icon" size={44} />
          <span className="csat-card-title">First-Time Resolution</span>
          <div className="csat-card-value">{globalMetrics?.firstTimeResolutionRate}%</div>
          <span className="csat-card-sub">Resolved tickets never reopened</span>
        </div>

        <div className="csat-card">
          <Smile className="csat-card-icon" size={44} fill="none" />
          <span className="csat-card-title">Recommend Service</span>
          <div className="csat-card-value">{globalMetrics?.recommendationRate}%</div>
          <span className="csat-card-sub">Citizen willingness to recommend</span>
        </div>
      </div>

      {/* Breakdown Rows */}
      <div className="csat-dashboard-row">
        {/* Monthly Satisfaction Trends Chart */}
        <div className="csat-panel">
          <div className="csat-panel-header">
            <h2><TrendingUp size={18} className="text-accent" /> Monthly CSAT Rating Trends</h2>
            <span className="cd-manual-escalate-desc" style={{ margin: 0 }}>Past 6 Months</span>
          </div>
          <div className="trends-chart">
            {monthlyTrends?.map((trend, idx) => {
              const heightPercent = trend.avgRating ? (trend.avgRating / 5) * 100 : 0;
              return (
                <div key={idx} className="trend-bar-wrapper">
                  <div 
                    className="trend-bar" 
                    style={{ height: `${heightPercent}%` }}
                  >
                    <div className="trend-tooltip">
                      Rating: {trend.avgRating} ({trend.feedbackCount} feedback)
                    </div>
                  </div>
                  <span className="trend-label">{trend.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rating Breakdown Sub-components */}
        <div className="csat-panel">
          <div className="csat-panel-header">
            <h2><Star size={18} className="text-accent" /> CSAT Dimension Averages</h2>
            <span className="cd-manual-escalate-desc" style={{ margin: 0 }}>Dimension-Specific Scores</span>
          </div>
          <div className="rankings-list">
            {globalMetrics?.ratingAverages && globalMetrics.ratingAverages.length > 0 ? (
              globalMetrics.ratingAverages.map((dim, idx) => (
                <div key={dim.id || idx} className="rankings-item">
                  <div className="rankings-info">
                    <span className="rankings-name">{dim.label}</span>
                  </div>
                  <div className="rankings-score">
                    <div className="rankings-score-val">{dim.average} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 5</span></div>
                    {renderStars(dim.average)}
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="rankings-item">
                  <div className="rankings-info">
                    <span className="rankings-name">Overall Rating</span>
                  </div>
                  <div className="rankings-score">
                    <div className="rankings-score-val">{globalMetrics?.avgOverallRating} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 5</span></div>
                    {renderStars(globalMetrics?.avgOverallRating)}
                  </div>
                </div>
                
                <div className="rankings-item">
                  <div className="rankings-info">
                    <span className="rankings-name">Response Time Satisfaction</span>
                  </div>
                  <div className="rankings-score">
                    <div className="rankings-score-val">{globalMetrics?.avgResponseTimeRating} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 5</span></div>
                    {renderStars(globalMetrics?.avgResponseTimeRating)}
                  </div>
                </div>

                <div className="rankings-item">
                  <div className="rankings-info">
                    <span className="rankings-name">Staff Communication</span>
                  </div>
                  <div className="rankings-score">
                    <div className="rankings-score-val">{globalMetrics?.avgCommunicationRating} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 5</span></div>
                    {renderStars(globalMetrics?.avgCommunicationRating)}
                  </div>
                </div>

                <div className="rankings-item">
                  <div className="rankings-info">
                    <span className="rankings-name">Resolution Quality</span>
                  </div>
                  <div className="rankings-score">
                    <div className="rankings-score-val">{globalMetrics?.avgResolutionQualityRating} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 5</span></div>
                    {renderStars(globalMetrics?.avgResolutionQualityRating)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Departments CSAT Rankings */}
      <div className="csat-dashboard-row">
        <div className="csat-panel">
          <div className="csat-panel-header">
            <h2><BarChart3 size={18} className="text-accent" /> Department Satisfaction Rankings</h2>
            <span className="cd-manual-escalate-desc" style={{ margin: 0 }}>Highest to Lowest</span>
          </div>
          <div className="rankings-list">
            {departmentsData.map((dept, index) => (
              <div key={index} className="rankings-item">
                <div className="rankings-info">
                  <div className={`rankings-badge ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}`}>
                    {index + 1}
                  </div>
                  <div>
                    <span className="rankings-name">{dept.departmentName}</span>
                    <div className="rankings-meta">
                      Feedback Count: {dept.feedbackCount} • Reopen Rate: {dept.reopenRate}%
                    </div>
                  </div>
                </div>
                <div className="rankings-score">
                  <div className="rankings-score-val">{dept.avgRating} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CSAT</span></div>
                  {renderStars(dept.avgRating)}
                </div>
              </div>
            ))}
            {departmentsData.length === 0 && (
              <div className="cd-chat-empty">No department CSAT ratings available.</div>
            )}
          </div>
        </div>

        {/* Categories Analysis */}
        <div className="csat-panel">
          <div className="csat-panel-header">
            <h2><Smile size={18} className="text-accent" /> Category Satisfaction Rankings</h2>
            <span className="cd-manual-escalate-desc" style={{ margin: 0 }}>Category-level Breakdown</span>
          </div>

          <div className="rankings-list" style={{ marginBottom: '20px' }}>
            <div className="category-name-heading" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ThumbsUp size={15} /> Most Loved Categories (Highest CSAT)
            </div>
            {categoriesData?.mostLovedCategories?.map((cat, idx) => (
              <div key={idx} className="rankings-item" style={{ padding: '8px 12px' }}>
                <span className="rankings-name" style={{ fontSize: '13px' }}>{cat.categoryName}</span>
                <span className="category-rating-val">{cat.csatScore}%</span>
              </div>
            ))}
            {(!categoriesData?.mostLovedCategories || categoriesData.mostLovedCategories.length === 0) && (
              <div className="cd-chat-empty" style={{ padding: '8px' }}>No category CSAT data.</div>
            )}
          </div>

          <div className="rankings-list">
            <div className="category-name-heading" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ThumbsDown size={15} /> Lowest Rated Categories (Attention Needed)
            </div>
            {categoriesData?.lowestRatedCategories?.map((cat, idx) => (
              <div key={idx} className="rankings-item" style={{ padding: '8px 12px' }}>
                <span className="rankings-name" style={{ fontSize: '13px' }}>{cat.categoryName}</span>
                <span className="category-rating-val" style={{ color: '#ef4444' }}>{cat.csatScore}%</span>
              </div>
            ))}
            {(!categoriesData?.lowestRatedCategories || categoriesData.lowestRatedCategories.length === 0) && (
              <div className="cd-chat-empty" style={{ padding: '8px' }}>No category CSAT data.</div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts and Feedbacks */}
      <div className="csat-dashboard-row">
        {/* Negative CSAT Alerts */}
        <div className="csat-panel">
          <div className="csat-panel-header">
            <h2 style={{ color: '#ef4444' }}><AlertTriangle size={18} /> Negative Feedback Alerts (1-2 Stars)</h2>
            <span className="cd-manual-escalate-desc" style={{ margin: 0 }}>Attention Requested</span>
          </div>
          <div className="alert-list">
            {negativeFeedbackAlerts?.map((alert, idx) => (
              <div 
                key={idx} 
                className="alert-item"
                onClick={() => navigate(`/complaints/${alert.complaintId}`)}
              >
                <div className="alert-header">
                  <span className="alert-ticket-id">{alert.trackingId}</span>
                  <span className="alert-date">{new Date(alert.submittedAt).toLocaleDateString()}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{alert.title}</div>
                <div className="alert-comment">"{alert.comment || 'No comment provided'}"</div>
                {renderStars(alert.overallRating)}
                <div className="alert-meta">
                  <span>Filed by: {alert.citizenName}</span>
                  <span>Dept: {alert.assignedTo}</span>
                </div>
              </div>
            ))}
            {negativeFeedbackAlerts?.length === 0 && (
              <div className="cd-chat-empty">No low satisfaction ratings recorded!</div>
            )}
          </div>
        </div>

        {/* Recent Feedback Feed */}
        <div className="csat-panel">
          <div className="csat-panel-header">
            <h2><MessageSquare size={18} className="text-accent" /> Recent Citizen Comments</h2>
            <span className="cd-manual-escalate-desc" style={{ margin: 0 }}>Feedback Feed</span>
          </div>
          <div className="alert-list">
            {recentFeedback?.map((feed, idx) => (
              <div 
                key={idx} 
                className="alert-item" 
                style={{ borderLeftColor: feed.overallRating >= 4 ? '#10b981' : feed.overallRating === 3 ? '#f59e0b' : '#ef4444', background: 'rgba(255, 255, 255, 0.01)', borderStyle: 'solid', borderWidth: '1px 1px 1px 4px', borderColor: 'var(--border-color) var(--border-color) var(--border-color) ' }}
                onClick={() => navigate(`/complaints/${feed.complaintId}`)}
              >
                <div className="alert-header">
                  <span className="alert-ticket-id" style={{ color: 'var(--text-color)' }}>{feed.trackingId}</span>
                  <span className="alert-date">{new Date(feed.submittedAt).toLocaleDateString()}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{feed.title}</div>
                <div className="alert-comment" style={{ color: 'var(--text-color)' }}>"{feed.comment || 'No comment provided'}"</div>
                {renderStars(feed.overallRating)}
                <div className="alert-meta">
                  <span>Submitted by: {feed.citizenName}</span>
                </div>
              </div>
            ))}
            {recentFeedback?.length === 0 && (
              <div className="cd-chat-empty">No comments submitted yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* High-Fidelity Reports Modal Overlay */}
      {isReportOpen && (
        <div className="csat-modal-overlay">
          <div className="csat-modal">
            <div className="csat-modal-header">
              <h3>
                {activeReport === 'monthly' && 'CSAT Monthly Satisfaction Trends Report'}
                {activeReport === 'department' && 'Department Satisfaction Summary Report'}
                {activeReport === 'lowSatisfaction' && 'Low Satisfaction Complaints Audit Log'}
                {activeReport === 'reopened' && 'Complaints Reopened After Resolution Log'}
              </h3>
              <button className="btn-close-modal" onClick={() => setIsReportOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="csat-modal-body">
              {activeReport === 'monthly' && (
                <table className="csat-report-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Feedback Count</th>
                      <th>Avg Overall Rating</th>
                      <th>CSAT Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportsData?.monthlyReport?.map((row, idx) => (
                      <tr key={idx}>
                        <td><strong>{row.month}</strong></td>
                        <td>{row.feedbackCount}</td>
                        <td>{row.avgOverallRating} / 5</td>
                        <td><span style={{ fontWeight: 700, color: 'var(--accent-color)' }}>{row.csatScore}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeReport === 'department' && (
                <table className="csat-report-table">
                  <thead>
                    <tr>
                      <th>Department Name</th>
                      <th>Feedback Count</th>
                      <th>Avg CSAT</th>
                      {departmentsData[0]?.ratingAverages ? (
                        departmentsData[0].ratingAverages.map(avg => (
                          <th key={avg.id}>{avg.label}</th>
                        ))
                      ) : (
                        <>
                          <th>Quality Score</th>
                          <th>Communication Score</th>
                        </>
                      )}
                      <th>Reopen Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentsData?.map((row, idx) => (
                      <tr key={idx}>
                        <td><strong>{row.departmentName}</strong></td>
                        <td>{row.feedbackCount}</td>
                        <td>{row.avgRating} / 5 ({row.csatScore}%)</td>
                        {row.ratingAverages ? (
                          row.ratingAverages.map(avg => (
                            <td key={avg.id}>{avg.average} / 5</td>
                          ))
                        ) : (
                          <>
                            <td>{row.resolutionQualityScore} / 5</td>
                            <td>{row.communicationScore} / 5</td>
                          </>
                        )}
                        <td style={{ color: row.reopenRate > 15 ? '#ef4444' : 'inherit' }}>{row.reopenRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeReport === 'lowSatisfaction' && (
                <table className="csat-report-table">
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Title</th>
                      <th>Department</th>
                      <th>Citizen</th>
                      <th>Rating</th>
                      <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportsData?.lowSatisfactionReport?.map((row, idx) => (
                      <tr key={idx}>
                        <td><strong>{row.trackingId}</strong></td>
                        <td>{row.title}</td>
                        <td>{row.department}</td>
                        <td>{row.citizenName}</td>
                        <td style={{ color: '#ef4444', fontWeight: 700 }}>{row.overallRating} / 5</td>
                        <td><em>"{row.comment || 'N/A'}"</em></td>
                      </tr>
                    ))}
                    {reportsData?.lowSatisfactionReport?.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center' }}>No low satisfaction complaints found!</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeReport === 'reopened' && (
                <table className="csat-report-table">
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Title</th>
                      <th>Department</th>
                      <th>Citizen</th>
                      <th>Reopen Count</th>
                      <th>Reason</th>
                      <th>Reopened At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportsData?.reopenedReport?.map((row, idx) => (
                      <tr key={idx}>
                        <td><strong>{row.trackingId}</strong></td>
                        <td>{row.title}</td>
                        <td>{row.department}</td>
                        <td>{row.citizenName}</td>
                        <td style={{ fontWeight: 700, color: '#f59e0b' }}>{row.reopenedCount}</td>
                        <td><em>"{row.reopenedReason}"</em></td>
                        <td>{new Date(row.reopenedAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {reportsData?.reopenedReport?.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center' }}>No reopened complaints found!</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="print-actions">
              <button onClick={handlePrint} className="btn-print">
                <Printer size={15} />
                <span>Print / Download PDF</span>
              </button>
              <button onClick={() => setIsReportOpen(false)} className="btn btn-secondary">
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CsatAnalytics;
