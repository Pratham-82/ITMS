import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  ArrowLeft, 
  Activity, 
  AlertTriangle, 
  UserPlus, 
  Copy, 
  ShieldAlert, 
  RefreshCw,
  Search
} from 'lucide-react';
import '../styles/CsatAnalytics.css'; // Leverage existing CSS classes for consistency

const DuplicateAnalytics = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);
  const [filterAction, setFilterAction] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    duplicatesPrevented: 0,
    complaintsJoined: 0,
    warningsOverrode: 0,
    priorityEscalated: 0
  });

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/duplicates/audits', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const json = await res.json();
      
      if (json.success && json.data) {
        setAuditLogs(json.data);
        
        // Compute statistics from audit logs
        const logs = json.data;
        const prevented = logs.filter(l => l.action === 'COMPLAINT_MERGED').length;
        const joined = logs.filter(l => l.action === 'COMPLAINT_JOINED').length;
        const overrode = logs.filter(l => l.action === 'DUPLICATE_DETECTED').length;
        const escalated = logs.filter(l => l.action === 'PRIORITY_CHANGED').length;

        setStats({
          duplicatesPrevented: prevented,
          complaintsJoined: joined,
          warningsOverrode: overrode,
          priorityEscalated: escalated
        });
      } else {
        addToast('Error', 'Failed to retrieve duplicate logs', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Connection Error', 'Could not communicate with the analytics API', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchAnalyticsData();
    }
  }, [user]);

  // Filter logs by action and search query (trackingId or userName)
  const filteredLogs = auditLogs.filter(log => {
    const matchesAction = filterAction === 'ALL' || log.action === filterAction;
    
    const term = searchQuery.toLowerCase().trim();
    if (!term) return matchesAction;

    const childTrackId = log.complaintId?.trackingId?.toLowerCase() || '';
    const childTitle = log.complaintId?.title?.toLowerCase() || '';
    const parentTrackId = log.parentComplaintId?.trackingId?.toLowerCase() || '';
    const parentTitle = log.parentComplaintId?.title?.toLowerCase() || '';
    const name = log.userName?.toLowerCase() || '';
    const reason = log.reason?.toLowerCase() || '';

    const matchesSearch = 
      childTrackId.includes(term) ||
      childTitle.includes(term) ||
      parentTrackId.includes(term) ||
      parentTitle.includes(term) ||
      name.includes(term) ||
      reason.includes(term);

    return matchesAction && matchesSearch;
  });

  const getActionBadge = (action) => {
    switch (action) {
      case 'DUPLICATE_DETECTED':
        return <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>Warning Overrode</span>;
      case 'COMPLAINT_JOINED':
        return <span style={{ color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>Ticket Joined</span>;
      case 'COMPLAINT_MERGED':
        return <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>Tickets Merged</span>;
      case 'PRIORITY_CHANGED':
        return <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>Priority Shifted</span>;
      default:
        return <span style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}>{action}</span>;
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Back button */}
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => navigate('/settings')} className="btn btn-secondary" style={{ padding: '8px 16px', gap: '6px' }}>
          <ArrowLeft size={16} />
          <span>Back to Settings Hub</span>
        </button>
      </div>

      <div className="csat-card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-lg)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>AI Duplicate Prevention & Auditing</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Track ticket optimization metrics, duplicate overrides, and merged reports.
            </p>
          </div>
          <button onClick={fetchAnalyticsData} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <div style={{ padding: '20px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Duplicates Merged
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Copy size={24} style={{ color: '#10b981' }} />
              <strong style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 800 }}>
                {stats.duplicatesPrevented}
              </strong>
            </div>
          </div>

          <div style={{ padding: '20px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Citizens Joined
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserPlus size={24} style={{ color: '#6366f1' }} />
              <strong style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 800 }}>
                {stats.complaintsJoined}
              </strong>
            </div>
          </div>

          <div style={{ padding: '20px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Warnings Overrode
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={24} style={{ color: '#ef4444' }} />
              <strong style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 800 }}>
                {stats.warningsOverrode}
              </strong>
            </div>
          </div>

          <div style={{ padding: '20px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Priority Escalations
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={24} style={{ color: '#f59e0b' }} />
              <strong style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 800 }}>
                {stats.priorityEscalated}
              </strong>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search audit logs by Tracking ID, user, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '38px' }}
            />
          </div>

          <select
            className="form-control select-filter"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="ALL">All Actions</option>
            <option value="DUPLICATE_DETECTED">Warnings Overrode</option>
            <option value="COMPLAINT_JOINED">Citizens Joined</option>
            <option value="COMPLAINT_MERGED">Tickets Merged</option>
            <option value="PRIORITY_CHANGED">Priority Shifts</option>
          </select>
        </div>

        {/* Table representation */}
        <div className="table-container" style={{ margin: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Loading audit logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No audit logs match the current filters.
            </div>
          ) : (
            <table className="custom-table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Ticket Ref</th>
                  <th>Parent / Master</th>
                  <th>Remarks / Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{getActionBadge(log.action)}</td>
                    <td style={{ fontWeight: 600 }}>{log.userName}</td>
                    <td>
                      {log.complaintId ? (
                        <span 
                          onClick={() => navigate(`/complaints/${log.complaintId._id}`)}
                          style={{ color: 'var(--accent-color)', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {log.complaintId.trackingId}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                      )}
                    </td>
                    <td>
                      {log.parentComplaintId ? (
                        <span 
                          onClick={() => navigate(`/complaints/${log.parentComplaintId._id}`)}
                          style={{ color: 'var(--accent-color)', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {log.parentComplaintId.trackingId}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: '250px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={log.reason}>
                      {log.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DuplicateAnalytics;
