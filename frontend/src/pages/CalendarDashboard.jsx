import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Calendar, Clock, ShieldAlert, Award, Play, Pause, AlertTriangle, Activity, BarChart2 } from 'lucide-react';

const CalendarDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [calendars, setCalendars] = useState([]);
  const [complaints, setComplaints] = useState([]);

  // Stats
  const [stats, setStats] = useState({
    activeCalendars: 0,
    totalCalendars: 0,
    pausedSlaTickets: 0,
    avgPauseMinutes: 0,
    totalAccumulatedPauseMinutes: 0,
    upcomingHolidaysCount: 0,
    activeBlackouts: 0
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch calendars
      const calRes = await fetch('/api/calendars', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const calData = await calRes.json();
      
      // Fetch complaints
      const compRes = await fetch('/api/tickets', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const compData = await compRes.json();

      // Fetch blackout periods to count active ones
      const blackoutRes = await fetch('/api/blackout-periods', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const blackoutData = await blackoutRes.json();

      if (calData.success && compData.success) {
        setCalendars(calData.data);
        setComplaints(compData.data);
        calculateStats(calData.data, compData.data, blackoutData.data || []);
      }
    } catch (err) {
      addToast('Error', 'Error loading Calendar Dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (cals, comps, blackouts) => {
    const totalCalendars = cals.length;
    const activeCalendars = cals.filter(c => c.isActive).length;
    
    const pausedSlaTickets = comps.filter(c => c.slaPaused).length;
    
    // Sum accumulated pause time in minutes
    let totalPauseMs = 0;
    let compsWithPause = 0;
    comps.forEach(c => {
      if (c.slaAccumulatedPauseTime && c.slaAccumulatedPauseTime > 0) {
        totalPauseMs += c.slaAccumulatedPauseTime;
        compsWithPause++;
      }
      // If currently paused, add elapsed time since slaPausedAt
      if (c.slaPaused && c.slaPausedAt) {
        totalPauseMs += (new Date().getTime() - new Date(c.slaPausedAt).getTime());
        compsWithPause++;
      }
    });

    const totalAccumulatedPauseMinutes = Math.round(totalPauseMs / 60000);
    const avgPauseMinutes = compsWithPause > 0 ? Math.round(totalAccumulatedPauseMinutes / compsWithPause) : 0;

    // Count holidays
    let upcomingHolidaysCount = 0;
    const now = new Date();
    cals.forEach(c => {
      if (c.holidays) {
        upcomingHolidaysCount += c.holidays.length;
      }
    });

    // Count active blackout periods
    let activeBlackouts = 0;
    blackouts.forEach(b => {
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      if (now >= start && now <= end) {
        activeBlackouts++;
      }
    });

    setStats({
      activeCalendars,
      totalCalendars,
      pausedSlaTickets,
      avgPauseMinutes,
      totalAccumulatedPauseMinutes,
      upcomingHolidaysCount,
      activeBlackouts
    });
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
          {/* Header Dashboard Metrics */}
          <div className="row mb-4 g-3">
            <div className="col-md-3">
              <div className="card shadow-sm p-4 d-flex flex-row align-items-center justify-content-between" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Calendars</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>
                    {stats.activeCalendars} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>/ {stats.totalCalendars}</span>
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '50%' }}>
                  <Activity size={24} style={{ color: '#10b981' }} />
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card shadow-sm p-4 d-flex flex-row align-items-center justify-content-between" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>SLA Paused Tickets</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: stats.pausedSlaTickets > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
                    {stats.pausedSlaTickets}
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '50%' }}>
                  <Pause size={24} style={{ color: '#f59e0b' }} />
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card shadow-sm p-4 d-flex flex-row align-items-center justify-content-between" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Avg SLA Paused Time</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)' }}>
                    {stats.avgPauseMinutes} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>mins</span>
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '50%' }}>
                  <Clock size={24} style={{ color: '#6366f1' }} />
                </div>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card shadow-sm p-4 d-flex flex-row align-items-center justify-content-between" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Blackout Periods</div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: stats.activeBlackouts > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                    {stats.activeBlackouts}
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '50%' }}>
                  <ShieldAlert size={24} style={{ color: '#ef4444' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            {/* Calendars Summary */}
            <div className="col-md-7 mb-4">
              <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', minHeight: '380px' }}>
                <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <BarChart2 size={20} className="text-accent" />
                  Registered Business Calendars
                </h3>

                <div className="table-responsive">
                  <table className="table table-hover align-middle" style={{ color: 'var(--text-primary)' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '12px' }}>
                        <th>Calendar Name</th>
                        <th>Timezone</th>
                        <th>Working Days</th>
                        <th>Hours</th>
                        <th>Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendars.map((cal, index) => {
                        const dayNames = cal.workingDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');
                        return (
                          <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ fontWeight: 700 }}>{cal.name}</td>
                            <td>{cal.timeZone}</td>
                            <td style={{ fontSize: '11px', maxWidth: '180px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={dayNames}>{dayNames}</td>
                            <td>{cal.workingHours?.start} - {cal.workingHours?.end}</td>
                            <td>
                              {cal.isDefault ? (
                                <span className="badge bg-primary">Global Default</span>
                              ) : (
                                <span className="badge bg-secondary">Custom</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${cal.isActive ? 'bg-success' : 'bg-danger'}`}>
                                {cal.isActive ? 'Active' : 'Inactive'}
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

            {/* SLA Delay Details */}
            <div className="col-md-5 mb-4">
              <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', minHeight: '380px' }}>
                <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <AlertTriangle size={20} className="text-accent" />
                  SLA Pause & Delay Analysis
                </h3>

                <div className="mb-4 p-3 rounded" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Accumulated SLA Pause Metrics</div>
                  <div className="d-flex justify-content-between mb-2" style={{ fontSize: '13px' }}>
                    <span>Total Accumulated Paused Time:</span>
                    <strong>{stats.totalAccumulatedPauseMinutes} mins</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-2" style={{ fontSize: '13px' }}>
                    <span>Average Delay per Paused Ticket:</span>
                    <strong>{stats.avgPauseMinutes} mins</strong>
                  </div>
                  <div className="d-flex justify-content-between" style={{ fontSize: '13px' }}>
                    <span>Tickets Currently Paused:</span>
                    <strong className="text-accent">{stats.pausedSlaTickets}</strong>
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>Currently Paused Complaints</div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)' }}>
                  {complaints.filter(c => c.slaPaused).length === 0 ? (
                    <p className="p-3 text-center mb-0" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No tickets currently in paused state.</p>
                  ) : (
                    <ul className="list-group list-group-flush bg-transparent mb-0">
                      {complaints.filter(c => c.slaPaused).map((c, idx) => {
                        const pausedDur = Math.round((new Date().getTime() - new Date(c.slaPausedAt).getTime()) / 60000);
                        return (
                          <li key={idx} className="list-group-item bg-transparent d-flex justify-content-between align-items-center py-2" style={{ fontSize: '12px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                            <div>
                              <strong>#{c.trackingId}</strong> - {c.title}
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Status: {c.status}</div>
                            </div>
                            <span className="badge bg-warning text-dark">{pausedDur}m paused</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarDashboard;
