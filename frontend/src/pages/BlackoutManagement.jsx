import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ShieldAlert, Plus, Trash2, Calendar, AlertTriangle, List, Save } from 'lucide-react';

const BlackoutManagement = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);

  const [blackoutPeriods, setBlackoutPeriods] = useState([]);
  const [calendars, setCalendars] = useState([]);

  // Form states
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [calendarId, setCalendarId] = useState('global');

  const fetchData = async () => {
    try {
      setLoading(true);

      const resPeriods = await fetch('/api/blackout-periods', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const dataPeriods = await resPeriods.json();

      const resCalendars = await fetch('/api/calendars', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const dataCalendars = await resCalendars.json();

      if (dataPeriods.success && dataCalendars.success) {
        setBlackoutPeriods(dataPeriods.data);
        setCalendars(dataCalendars.data);
      }
    } catch (err) {
      addToast('Error', 'Error loading blackout management details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateBlackout = async (e) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) {
      addToast('Validation', 'Name, Start Date, and End Date are required', 'error');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      addToast('Validation', 'End Date must be after Start Date', 'error');
      return;
    }

    const payload = {
      name,
      startDate: start,
      endDate: end,
      description,
      calendarId: calendarId === 'global' ? null : calendarId
    };

    try {
      const res = await fetch('/api/blackout-periods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'Blackout period created successfully', 'success');
        setName('');
        setStartDate('');
        setEndDate('');
        setDescription('');
        setCalendarId('global');
        fetchData();
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Error creating blackout period', 'error');
    }
  };

  const handleDeleteBlackout = async (id) => {
    if (!window.confirm('Are you sure you want to delete this blackout period?')) return;

    try {
      const res = await fetch(`/api/blackout-periods/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'Blackout period deleted successfully', 'success');
        fetchData();
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Error deleting blackout period', 'error');
    }
  };

  return (
    <div className="container-fluid" style={{ padding: '24px', color: 'var(--text-primary)' }}>
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-accent" role="status" />
        </div>
      ) : (
        <div className="row">
          {/* Left Column: Blackout period list */}
          <div className="col-md-7 mb-4">
            <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', minHeight: '450px' }}>
              <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <ShieldAlert size={20} className="text-accent" />
                Active Blackout / Freeze Periods
              </h3>

              <div className="table-responsive">
                <table className="table table-hover align-middle" style={{ color: 'var(--text-primary)' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '12px' }}>
                      <th>Freeze Name</th>
                      <th>Start Period</th>
                      <th>End Period</th>
                      <th>Scope / Calendar</th>
                      <th>Status</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blackoutPeriods.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4 text-muted" style={{ fontSize: '13px' }}>No blackout periods currently scheduled.</td>
                      </tr>
                    ) : (
                      blackoutPeriods.map((bp, index) => {
                        const now = new Date();
                        const start = new Date(bp.startDate);
                        const end = new Date(bp.endDate);
                        
                        let statusText = 'Scheduled';
                        let statusColor = 'bg-info';
                        if (now >= start && now <= end) {
                          statusText = 'Active Now';
                          statusColor = 'bg-danger';
                        } else if (now > end) {
                          statusText = 'Expired';
                          statusColor = 'bg-secondary';
                        }

                        const targetCal = calendars.find(c => c._id === bp.calendarId);

                        return (
                          <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ fontWeight: 700 }}>
                              {bp.name}
                              {bp.description && <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 400 }}>{bp.description}</div>}
                            </td>
                            <td>{start.toLocaleString()}</td>
                            <td>{end.toLocaleString()}</td>
                            <td>{targetCal ? targetCal.name : 'Global Freeze'}</td>
                            <td>
                              <span className={`badge ${statusColor}`}>
                                {statusText}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-danger p-0"
                                onClick={() => handleDeleteBlackout(bp._id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Schedule Form */}
          <div className="col-md-5">
            <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Plus size={20} className="text-accent" />
                Schedule Blackout Period
              </h3>
              
              <div className="alert alert-warning d-flex align-items-start gap-2 p-3 mb-4" style={{ fontSize: '12px', border: '1px solid #ffeeba', backgroundColor: '#fff3cd', color: '#856404' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Important:</strong> During an active blackout period, SLA warning triggers, auto-assignments, and auto-escalations will freeze for all tickets assigned to the affected calendar.
                </div>
              </div>

              <form onSubmit={handleCreateBlackout}>
                <div className="mb-3">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Blackout Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Year-End Financial System Freeze"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
                  <textarea
                    className="form-control"
                    placeholder="Reason, impact scope details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows="2"
                    style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  />
                </div>

                <div className="row mb-3">
                  <div className="col">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Start Date & Time</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                  </div>
                  <div className="col">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>End Date & Time</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Scope Calendar</label>
                  <select
                    className="form-control"
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  >
                    <option value="global">Global (Applies to all calendars)</option>
                    {calendars.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2" style={{ fontWeight: 800 }}>
                  <Save size={16} /> Schedule Blackout
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlackoutManagement;
