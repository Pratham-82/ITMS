import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { TrendingUp, Award, AlertTriangle, CheckCircle, Clock, ShieldAlert, BarChart2 } from 'lucide-react';

const ExecutiveDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    resolved: 0,
    slaCompliantResolved: 0,
    slaComplianceRate: 100,
    responseBreaches: 0,
    resolutionBreaches: 0,
    warningTickets: 0
  });

  const [deptStats, setDeptStats] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tickets', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        setComplaints(data.data);
        calculateStats(data.data);
      }
    } catch (err) {
      addToast('Error', 'Error loading executive stats', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (list) => {
    let total = list.length;
    let open = 0;
    let resolved = 0;
    let slaCompliantResolved = 0;
    let responseBreaches = 0;
    let resolutionBreaches = 0;
    let warningTickets = 0;

    const deptMap = {};

    list.forEach(c => {
      // Open/Resolved check
      const isOpen = !['Resolved', 'Rejected', 'Closed', 'Awaiting Feedback'].includes(c.status);
      if (isOpen) {
        open++;
      } else {
        resolved++;
      }

      // Legacy vs upgraded SLA checks
      const isResponseBreached = c.responseSlaStatus === 'Breached';
      const isResolutionBreached = c.resolutionSlaStatus === 'Breached' || 
        (c.escalationStatus === 'completed' && c.currentEscalationLevel > 0);

      if (isResponseBreached) responseBreaches++;
      if (isResolutionBreached) resolutionBreaches++;

      const isWarning = c.responseSlaStatus === 'Warning' || c.resolutionSlaStatus === 'Warning';
      if (isWarning) warningTickets++;

      // SLA Compliance: resolved within SLA
      if (!isOpen) {
        const metOrWithin = c.resolutionSlaStatus === 'Met' || c.resolutionSlaStatus === 'Within SLA' || c.resolutionSlaStatus === 'none' || !isResolutionBreached;
        if (metOrWithin) {
          slaCompliantResolved++;
        }
      }

      // Department grouping
      const deptName = c.assignedDepartment || 'General Administration';
      if (!deptMap[deptName]) {
        deptMap[deptName] = { name: deptName, total: 0, open: 0, breached: 0, resolved: 0 };
      }
      deptMap[deptName].total++;
      if (isOpen) deptMap[deptName].open++;
      else deptMap[deptName].resolved++;
      if (isResolutionBreached || isResponseBreached) {
        deptMap[deptName].breached++;
      }
    });

    const slaComplianceRate = resolved > 0 ? Math.round((slaCompliantResolved / resolved) * 100) : 100;

    setStats({
      total,
      open,
      resolved,
      slaCompliantResolved,
      slaComplianceRate,
      responseBreaches,
      resolutionBreaches,
      warningTickets
    });

    setDeptStats(Object.values(deptMap).sort((a, b) => b.total - a.total));
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="container-fluid" style={{ padding: '24px', color: 'var(--text-primary)' }}>
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-accent" role="status" />
        </div>
      ) : (
        <div>
          {/* Executive Overview Header Cards */}
          <div className="row mb-4 g-3">
            <div className="col-md-3">
              <div className="card shadow-sm p-4 d-flex flex-row align-items-center justify-content-between" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>SLA Compliance Rate</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: stats.slaComplianceRate >= 80 ? '#10b981' : '#f59e0b' }}>
                    {stats.slaComplianceRate}%
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '50%' }}>
                  <Award size={24} style={{ color: '#10b981' }} />
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card shadow-sm p-4 d-flex flex-row align-items-center justify-content-between" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Response SLA Breaches</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#ef4444' }}>
                    {stats.responseBreaches}
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '50%' }}>
                  <Clock size={24} style={{ color: '#ef4444' }} />
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card shadow-sm p-4 d-flex flex-row align-items-center justify-content-between" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Resolution SLA Breaches</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#ef4444' }}>
                    {stats.resolutionBreaches}
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '50%' }}>
                  <ShieldAlert size={24} style={{ color: '#ef4444' }} />
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card shadow-sm p-4 d-flex flex-row align-items-center justify-content-between" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Approach SLA Warning</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#f59e0b' }}>
                    {stats.warningTickets}
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '50%' }}>
                  <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            {/* SLA Heatmap & Breakdown per Department */}
            <div className="col-md-8 mb-4">
              <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', minHeight: '380px' }}>
                <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <BarChart2 size={20} className="text-accent" />
                  Department SLA & Workload Breakdown
                </h3>

                <div className="table-responsive">
                  <table className="table table-hover align-middle" style={{ color: 'var(--text-primary)' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '12px' }}>
                        <th>Department</th>
                        <th>Total Workload</th>
                        <th>Active Open</th>
                        <th>Resolved Count</th>
                        <th>Breached SLA</th>
                        <th>Health Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptStats.map((dept, index) => {
                        const breachRate = dept.total > 0 ? (dept.breached / dept.total) * 100 : 0;
                        let healthText = 'Healthy';
                        let healthColor = '#10b981';
                        if (breachRate > 30) {
                          healthText = 'Critical Risk';
                          healthColor = '#ef4444';
                        } else if (breachRate > 10) {
                          healthText = 'Warning State';
                          healthColor = '#f59e0b';
                        }

                        return (
                          <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ fontWeight: 700 }}>{dept.name}</td>
                            <td>{dept.total} tickets</td>
                            <td>{dept.open}</td>
                            <td>{dept.resolved}</td>
                            <td style={{ color: dept.breached > 0 ? '#ef4444' : 'var(--text-secondary)' }}>{dept.breached} breached</td>
                            <td>
                              <span className="badge" style={{ backgroundColor: `${healthColor}20`, color: healthColor, border: `1px solid ${healthColor}50` }}>
                                {healthText}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick Metrics Circular visual widgets */}
            <div className="col-md-4 mb-4">
              <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', minHeight: '380px' }}>
                <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <TrendingUp size={20} className="text-accent" />
                  SLA Target Status
                </h3>

                <div className="d-flex flex-column gap-4 mt-2">
                  <div>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '13px' }}>
                      <span>Resolution SLA Met</span>
                      <strong className="text-success">{stats.resolved - stats.resolutionBreaches} resolved</strong>
                    </div>
                    <div className="progress" style={{ height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                      <div 
                        className="progress-bar bg-success" 
                        role="progressbar" 
                        style={{ width: `${stats.resolved > 0 ? Math.round(((stats.resolved - stats.resolutionBreaches) / stats.resolved) * 100) : 100}%`, borderRadius: '4px' }} 
                      />
                    </div>
                  </div>

                  <div>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '13px' }}>
                      <span>First Response SLA Met</span>
                      <strong className="text-success">{stats.total - stats.responseBreaches} met</strong>
                    </div>
                    <div className="progress" style={{ height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                      <div 
                        className="progress-bar bg-accent" 
                        role="progressbar" 
                        style={{ width: `${stats.total > 0 ? Math.round(((stats.total - stats.responseBreaches) / stats.total) * 100) : 100}%`, borderRadius: '4px' }} 
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Active Ticket Pool Summary</div>
                    <div className="d-flex justify-content-between mb-2" style={{ fontSize: '13px' }}>
                      <span>Total Registered:</span>
                      <strong>{stats.total}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-2" style={{ fontSize: '13px' }}>
                      <span>Currently Open:</span>
                      <strong className="text-accent">{stats.open}</strong>
                    </div>
                    <div className="d-flex justify-content-between" style={{ fontSize: '13px' }}>
                      <span>Fully Resolved:</span>
                      <strong className="text-success">{stats.resolved}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveDashboard;
