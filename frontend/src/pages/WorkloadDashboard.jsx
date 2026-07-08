import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Gauge, 
  Briefcase, 
  ShieldAlert, 
  Clock, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Scale,
  Save
} from 'lucide-react';
import '../styles/WorkloadDashboard.css';

const WorkloadDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const isSuperAdmin = user?.role === 'admin' && (!user.department || user.department === 'General Administration');
  
  // States
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [staffData, setStaffData] = useState([]);
  const [alertsData, setAlertsData] = useState({ alerts: [], suggestions: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Bulk Reassignment Form State
  const [bulkFrom, setBulkFrom] = useState('');
  const [bulkTo, setBulkTo] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Fetch active groups/teams of the active tenant
  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        const activeGroups = result.data.filter(g => g.isActive);
        setGroups(activeGroups);
        
        // Determine initial group selection
        if (activeGroups.length > 0) {
          const userGroup = activeGroups.find(g => user?.groups?.some(ug => (ug._id || ug) === g._id));
          if (userGroup) {
            setSelectedGroup(userGroup._id);
          } else {
            setSelectedGroup(activeGroups[0]._id);
          }
        } else {
          setSelectedGroup('');
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to load support groups:', err);
      setLoading(false);
    }
  };

  // Fetch all workload data
  const fetchData = async (showRefreshToast = false) => {
    if (!selectedGroup || !user?.token) return;
    
    if (showRefreshToast) setRefreshing(true);
    else setLoading(true);

    try {
      const headers = { Authorization: `Bearer ${user.token}` };
      const groupQuery = `?group=${encodeURIComponent(selectedGroup)}`;

      const [dashRes, staffRes, alertsRes] = await Promise.all([
        fetch(`/api/workload/dashboard${groupQuery}`, { headers }),
        fetch(`/api/workload/staff${groupQuery}`, { headers }),
        fetch(`/api/workload/alerts${groupQuery}`, { headers })
      ]);

      const [dashVal, staffVal, alertsVal] = await Promise.all([
        dashRes.json(),
        staffRes.json(),
        alertsRes.json()
      ]);

      if (dashVal.success) setDashboardData(dashVal.data);
      if (staffVal.success) setStaffData(staffVal.data);
      if (alertsVal.success) setAlertsData(alertsVal.data);

      if (showRefreshToast) {
        addToast('Data Refreshed', 'Workload balancing metrics updated in real-time.', 'success');
      }
    } catch (err) {
      console.error('Failed to fetch workload data:', err);
      addToast('Error', 'Failed to retrieve workload metrics from database', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchGroups();
    }
  }, [user]);

  useEffect(() => {
    if (user?.token && selectedGroup) {
      fetchData();
    }
  }, [selectedGroup]);

  // Handle staff configuration updates (Availability status & Max capacity)
  const handleStaffUpdate = async (staffId, updates) => {
    try {
      const response = await fetch(`/api/workload/staff/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(updates)
      });

      const result = await response.json();
      if (result.success) {
        addToast('Staff Config Saved', `Successfully updated staff preferences.`, 'success');
        fetchData(); // Reload stats and recalculate scores
      } else {
        addToast('Update Failed', result.message || 'Failed to update staff settings', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Connection failed while saving staff details', 'error');
    }
  };

  // Handle manual reassignment suggestion execution
  const executeReassignment = async (complaintId, targetStaffId, trackingId, toName) => {
    try {
      const response = await fetch('/api/workload/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          complaintId,
          targetStaffId,
          reason: 'Workload balancing auto-recommendation'
        })
      });

      const result = await response.json();
      if (result.success) {
        addToast('Ticket Reassigned', `Ticket #${trackingId} has been moved to ${toName}.`, 'success');
        fetchData();
      } else {
        addToast('Reassignment Failed', result.message || 'Failed to reassign complaint', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Failed to reassign complaint', 'error');
    }
  };

  // Handle bulk reassignment execution
  const handleBulkReassign = async (e) => {
    e.preventDefault();
    if (!bulkFrom) {
      addToast('Validation Error', 'Please select the source staff member', 'error');
      return;
    }
    if (bulkFrom === bulkTo) {
      addToast('Validation Error', 'Source and target staff member cannot be the same', 'error');
      return;
    }

    setBulkSubmitting(true);
    try {
      const response = await fetch('/api/workload/bulk-reassign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          fromStaffId: bulkFrom,
          toStaffId: bulkTo || null,
          reason: bulkReason
        })
      });

      const result = await response.json();
      if (result.success) {
        addToast('Bulk Reassign Complete', result.message || 'Complaints reassigned successfully.', 'success');
        setBulkFrom('');
        setBulkTo('');
        setBulkReason('');
        fetchData();
      } else {
        addToast('Bulk Reassign Failed', result.message || 'Could not execute bulk reassignment', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Bulk transfer execution failed', 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const getProgressBarColor = (percentage) => {
    if (percentage <= 75) return 'wl-fill-safe';
    if (percentage <= 90) return 'wl-fill-warn';
    return 'wl-fill-danger';
  };

  if (loading) {
    return (
      <div className="wl-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="sh-tip-banner" style={{ background: 'none', border: 'none' }}>
          <RefreshCw size={36} className="animate-spin text-accent" />
          <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Loading Workload Dashboard metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wl-container">
      {/* Top Banner and Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isSuperAdmin ? (
            <select 
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="wl-staff-select"
              style={{ fontSize: '18px', fontWeight: 800, padding: '8px 12px', borderRadius: '8px' }}
              disabled={groups.length === 0}
            >
              {groups.length === 0 ? (
                <option value="">No Active Groups/Teams</option>
              ) : (
                groups.map((group) => (
                  <option key={group._id} value={group._id}>{group.name}</option>
                ))
              )}
            </select>
          ) : (
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Workload & Capacity Control Center</h2>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Group/Team Scope: {groups.find(g => g._id === selectedGroup)?.name || 'Loading...'}</span>
            </div>
          )}
        </div>

        <button 
          onClick={() => fetchData(true)} 
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px' }}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Sync Realtime</span>
        </button>
      </div>

      {/* Aggregate Stats Cards */}
      {dashboardData && (
        <div className="wl-grid-4">
          <div className="wl-stat-card">
            <div className="wl-icon-wrapper">
              <Briefcase size={22} />
            </div>
            <div className="wl-stat-meta">
              <h3>Active Open complaints</h3>
              <p>{dashboardData.totalOpen}</p>
            </div>
          </div>

          <div className="wl-stat-card" style={{ boxShadow: dashboardData.criticalCount > 0 ? '0 0 12px rgba(239, 68, 68, 0.1)' : '' }}>
            <div className="wl-icon-wrapper" style={{ background: dashboardData.criticalCount > 0 ? 'rgba(239, 68, 68, 0.08)' : '', color: dashboardData.criticalCount > 0 ? '#ef4444' : '' }}>
              <ShieldAlert size={22} />
            </div>
            <div className="wl-stat-meta">
              <h3>Critical Complaints</h3>
              <p>{dashboardData.criticalCount}</p>
            </div>
          </div>

          <div className="wl-stat-card" style={{ boxShadow: dashboardData.nearSlaBreachCount > 0 ? '0 0 12px rgba(245, 158, 11, 0.1)' : '' }}>
            <div className="wl-icon-wrapper" style={{ background: dashboardData.nearSlaBreachCount > 0 ? 'rgba(245, 158, 11, 0.08)' : '', color: dashboardData.nearSlaBreachCount > 0 ? '#f59e0b' : '' }}>
              <Clock size={22} />
            </div>
            <div className="wl-stat-meta">
              <h3>SLA Breach Risks (&lt;24h)</h3>
              <p>{dashboardData.nearSlaBreachCount}</p>
            </div>
          </div>

          <div className="wl-stat-card">
            <div className="wl-icon-wrapper">
              <Gauge size={22} />
            </div>
            <div className="wl-stat-meta">
              <h3>Avg Workload Score</h3>
              <p>{dashboardData.averageWorkload}</p>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="wl-layout-split">
        {/* Left Column: Team Capacity Log */}
        <div className="wl-card">
          <h3 className="wl-card-title">
            <Users size={18} className="text-accent" />
            <span>Group/Team Staff Capacities</span>
          </h3>

          {staffData.length === 0 ? (
            <div className="db-table-empty">No staff found for this group/team.</div>
          ) : (
            staffData.map((staff) => (
              <div key={staff._id} className="wl-staff-row">
                <div className="wl-staff-header">
                  <div className="wl-staff-info">
                    <h4>{staff.name} {staff._id === user.id && '(You)'}</h4>
                    <p>{staff.email}</p>
                  </div>
                  
                  <div className="wl-staff-status-row">
                    <span style={{ fontSize: '13px', fontWeight: 700, marginRight: '8px' }}>
                      Score: <span style={{ color: 'var(--accent-color)' }}>{staff.workloadScore}</span>
                    </span>
                    <select
                      value={staff.availabilityStatus}
                      onChange={(e) => handleStaffUpdate(staff._id, { availabilityStatus: e.target.value })}
                      className={`wl-staff-select wl-badge-status ${
                        staff.availabilityStatus === 'Available' ? 'wl-status-available' :
                        staff.availabilityStatus === 'Busy' ? 'wl-status-busy' :
                        staff.availabilityStatus === 'On Leave' ? 'wl-status-leave' : 'wl-status-unavailable'
                      }`}
                    >
                      <option value="Available">Available</option>
                      <option value="Busy">Busy</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Unavailable">Unavailable</option>
                    </select>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="wl-progress-container">
                  <div className="wl-progress-bar-bg">
                    <div 
                      className={`wl-progress-bar-fill ${getProgressBarColor(staff.capacityPercentage)}`}
                      style={{ width: `${Math.min(staff.capacityPercentage, 100)}%` }}
                    />
                  </div>
                  <span className="wl-progress-label">{staff.capacityPercentage}%</span>
                </div>

                {/* Slider controls for maxCapacity */}
                <div className="wl-staff-controls">
                  <label>Max Workload Limit:</label>
                  <input 
                    type="range" 
                    min="5" 
                    max="50" 
                    value={staff.maxCapacity} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setStaffData(prev => prev.map(s => s._id === staff._id ? { ...s, maxCapacity: val, capacityPercentage: Math.round((s.workloadScore / val) * 100) } : s));
                    }}
                    onMouseUp={(e) => handleStaffUpdate(staff._id, { maxCapacity: Number(e.target.value) })}
                    onTouchEnd={(e) => handleStaffUpdate(staff._id, { maxCapacity: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: 'var(--accent-color)' }}
                  />
                  <input 
                    type="number" 
                    className="wl-staff-input"
                    value={staff.maxCapacity}
                    onChange={(e) => {
                      const val = Math.max(5, Math.min(50, Number(e.target.value)));
                      setStaffData(prev => prev.map(s => s._id === staff._id ? { ...s, maxCapacity: val, capacityPercentage: Math.round((s.workloadScore / val) * 100) } : s));
                    }}
                    onBlur={(e) => handleStaffUpdate(staff._id, { maxCapacity: Number(e.target.value) })}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Alerts and Balancing Suggestion Engine */}
        <div>
          {/* Active Workload Alerts */}
          <div className="wl-card" style={{ paddingBottom: '16px' }}>
            <h3 className="wl-card-title">
              <ShieldAlert size={18} className="text-accent" />
              <span>Real-Time Workload Alerts</span>
            </h3>

            {alertsData.alerts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#22c55e', fontSize: '13px', padding: '4px' }}>
                <CheckCircle2 size={16} />
                <span>All staff are operating within safe capacity limits.</span>
              </div>
            ) : (
              alertsData.alerts.map((alert, idx) => (
                <div key={idx} className={`wl-alert-box ${alert.type === 'danger' ? 'wl-alert-danger' : 'wl-alert-warning'}`}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>{alert.message}</strong>
                    <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '3px' }}>{alert.recommendation}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Balancing Suggestions */}
          <div className="wl-card">
            <h3 className="wl-card-title">
              <Scale size={18} className="text-accent" />
              <span>Auto-Balancing Suggestions</span>
            </h3>

            {alertsData.suggestions.length === 0 ? (
              <div className="db-table-empty" style={{ padding: '8px' }}>
                No active rebalancing suggestions available.
              </div>
            ) : (
              alertsData.suggestions.map((sug, idx) => (
                <div key={idx} className="wl-suggestion-item">
                  <div className="wl-sug-header">
                    <div>
                      <span className="wl-sug-ticket">{sug.trackingId}</span>
                      <h4 className="wl-sug-title">{sug.title}</h4>
                    </div>
                    <span className={`wl-badge-status ${sug.priority === 'Critical' ? 'wl-status-leave' : sug.priority === 'High' ? 'wl-status-busy' : 'wl-status-available'}`}>
                      {sug.priority}
                    </span>
                  </div>

                  <div className="wl-sug-path">
                    <span>{sug.fromUser.name}</span>
                    <ArrowRight size={12} className="wl-sug-arrow" />
                    <span>{sug.toUser.name}</span>
                  </div>

                  <p className="wl-sug-reason">{sug.reason}</p>

                  <button
                    onClick={() => executeReassignment(sug.complaintId, sug.toUser._id, sug.trackingId, sug.toUser.name)}
                    className="btn btn-primary wl-reassign-btn"
                  >
                    Approve and Reassign Now
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Bulk Reassignment */}
          <div className="wl-card">
            <h3 className="wl-card-title">
              <RefreshCw size={18} className="text-accent" />
              <span>Bulk Ticket Reassignment</span>
            </h3>

            <form onSubmit={handleBulkReassign}>
              <div className="wl-form-group">
                <label>Reassign From (Source Staff)</label>
                <select
                  value={bulkFrom}
                  onChange={(e) => setBulkFrom(e.target.value)}
                  className="wl-form-control"
                  required
                >
                  <option value="">-- Select Staff Member --</option>
                  {staffData.map(s => (
                    <option key={s._id} value={s._id}>{s.name} (Score: {s.workloadScore} | {s.openCount} open)</option>
                  ))}
                </select>
              </div>

              <div className="wl-form-group">
                <label>Reassign To (Target Staff / Group/Team Queue)</label>
                <select
                  value={bulkTo}
                  onChange={(e) => setBulkTo(e.target.value)}
                  className="wl-form-control"
                >
                  <option value="">Unassigned Group/Team Queue</option>
                  {staffData.filter(s => s._id !== bulkFrom).map(s => (
                    <option key={s._id} value={s._id}>{s.name} (Score: {s.workloadScore} | Capacity: {s.capacityPercentage}%)</option>
                  ))}
                </select>
              </div>

              <div className="wl-form-group">
                <label>Reason for Bulk Reassignment</label>
                <textarea
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  className="wl-form-control"
                  rows="2"
                  placeholder="e.g. Annual leave cover, emergency balancing..."
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-danger wl-bulk-btn"
                disabled={bulkSubmitting}
              >
                {bulkSubmitting ? 'Transferring complaints...' : 'Execute Bulk Reassignment'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkloadDashboard;
