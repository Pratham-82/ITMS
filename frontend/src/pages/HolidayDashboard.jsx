import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Calendar, Plus, Trash2, ShieldAlert, Award, Star, List, Settings } from 'lucide-react';

const HolidayDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);

  const [holidays, setHolidays] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarFilter, setSelectedCalendarFilter] = useState('all');

  // Add Form states
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayType, setHolidayType] = useState('National');
  const [holidayRecurring, setHolidayRecurring] = useState(false);
  const [targetCalendarId, setTargetCalendarId] = useState('global');

  const fetchData = async () => {
    try {
      setLoading(true);

      const holidayUrl = selectedCalendarFilter === 'all' 
        ? '/api/holidays' 
        : `/api/holidays?calendarId=${selectedCalendarFilter}`;

      const holRes = await fetch(holidayUrl, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const holData = await holRes.json();

      const calRes = await fetch('/api/calendars', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const calData = await calRes.json();

      if (holData.success && calData.success) {
        setHolidays(holData.data);
        setCalendars(calData.data);
      }
    } catch (err) {
      addToast('Error', 'Error loading holiday details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCalendarFilter]);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!holidayName || !holidayDate) {
      addToast('Validation', 'Holiday Name and Date are required', 'error');
      return;
    }

    const payload = {
      name: holidayName,
      date: new Date(holidayDate),
      type: holidayType,
      recurring: holidayRecurring,
      calendarId: targetCalendarId === 'global' ? null : targetCalendarId
    };

    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'Holiday created successfully', 'success');
        setHolidayName('');
        setHolidayDate('');
        setHolidayRecurring(false);
        fetchData();
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Error adding holiday', 'error');
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;

    try {
      const res = await fetch(`/api/holidays/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'Holiday deleted successfully', 'success');
        fetchData();
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Error deleting holiday', 'error');
    }
  };

  // Compile all exceptions from calendars
  const allExceptions = [];
  calendars.forEach(cal => {
    if (cal.exceptions && cal.exceptions.length > 0) {
      cal.exceptions.forEach(ex => {
        allExceptions.push({
          ...ex,
          calendarName: cal.name,
          calendarId: cal._id
        });
      });
    }
  });

  return (
    <div className="container-fluid" style={{ padding: '24px', color: 'var(--text-primary)' }}>
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-accent" role="status" />
        </div>
      ) : (
        <div className="row">
          {/* Left Column: Holiday list and filter */}
          <div className="col-md-7 mb-4">
            <div className="card shadow-sm p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <h3 className="m-0" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <Calendar size={20} className="text-accent" />
                  Holidays Calendar Table
                </h3>

                <div className="d-flex align-items-center gap-2">
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter:</span>
                  <select
                    className="form-control form-control-sm"
                    value={selectedCalendarFilter}
                    onChange={(e) => setSelectedCalendarFilter(e.target.value)}
                    style={{ border: '1px solid var(--border-color)', borderRadius: '6px', width: 'auto' }}
                  >
                    <option value="all">All Calendars & Global</option>
                    <option value="null">Global Only</option>
                    {calendars.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle" style={{ color: 'var(--text-primary)' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '12px' }}>
                      <th>Holiday Name</th>
                      <th>Scheduled Date</th>
                      <th>Type</th>
                      <th>Scope</th>
                      <th>Rule</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4 text-muted" style={{ fontSize: '13px' }}>No holidays matching search criteria.</td>
                      </tr>
                    ) : (
                      holidays.map((h, index) => {
                        const targetCal = calendars.find(c => c._id === h.calendarId);
                        return (
                          <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ fontWeight: 700 }}>{h.name}</td>
                            <td>{new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: h.recurring ? undefined : 'numeric' })}</td>
                            <td>
                              <span className={`badge ${h.type === 'National' ? 'bg-primary' : h.type === 'Regional' ? 'bg-info' : 'bg-secondary'}`}>
                                {h.type}
                              </span>
                            </td>
                            <td>{targetCal ? targetCal.name : 'Global Holiday'}</td>
                            <td>{h.recurring ? 'Yearly Recurring' : 'Single Occurence'}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-danger p-0"
                                onClick={() => handleDeleteHoliday(h._id)}
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

            {/* Calendar Exceptions Details Table */}
            <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Settings size={20} className="text-accent" />
                Aggregated Calendar Exceptions Overrides
              </h3>

              <div className="table-responsive">
                <table className="table table-hover align-middle" style={{ color: 'var(--text-primary)' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '12px' }}>
                      <th>Calendar</th>
                      <th>Override Date</th>
                      <th>Operating Hours</th>
                      <th>Exception Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allExceptions.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-muted" style={{ fontSize: '13px' }}>No active exceptions scheduled in any calendar.</td>
                      </tr>
                    ) : (
                      allExceptions.map((ex, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ fontWeight: 700 }}>{ex.calendarName}</td>
                          <td>{new Date(ex.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td>
                            {ex.startTime && ex.endTime && ex.startTime !== '00:00' ? (
                              <span className="badge bg-success">{ex.startTime} - {ex.endTime}</span>
                            ) : (
                              <span className="badge bg-danger">Closed / Off-Day</span>
                            )}
                          </td>
                          <td style={{ fontSize: '13px' }}>{ex.reason || 'No description provided'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Add Holiday Form */}
          <div className="col-md-5">
            <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Plus size={20} className="text-accent" />
                Add New Holiday
              </h3>

              <form onSubmit={handleAddHoliday}>
                <div className="mb-3">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Holiday Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Independence Day"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Scheduled Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Holiday Type</label>
                  <select
                    className="form-control"
                    value={holidayType}
                    onChange={(e) => setHolidayType(e.target.value)}
                    style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  >
                    <option value="National">National (Global)</option>
                    <option value="Regional">Regional (State/Local)</option>
                    <option value="Organization">Organization (Company Holiday)</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Calendar Association</label>
                  <select
                    className="form-control"
                    value={targetCalendarId}
                    onChange={(e) => setTargetCalendarId(e.target.value)}
                    style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  >
                    <option value="global">Global (Applies to all calendars)</option>
                    {calendars.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-check form-switch mb-4">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="isRecurringSwitch"
                    checked={holidayRecurring}
                    onChange={(e) => setHolidayRecurring(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="isRecurringSwitch" style={{ fontSize: '13px', fontWeight: 600 }}>Yearly Recurring Holiday</label>
                  <div className="text-muted" style={{ fontSize: '10px' }}>If enabled, the year of the date will be ignored in calculations.</div>
                </div>

                <button type="submit" className="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2" style={{ fontWeight: 800 }}>
                  <Plus size={16} /> Create Holiday
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HolidayDashboard;
