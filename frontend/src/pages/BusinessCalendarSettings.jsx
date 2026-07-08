import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Calendar, Clock, Plus, Trash2, ShieldAlert, CheckCircle, Save, Settings, List, User, PlusCircle } from 'lucide-react';
import '../styles/SettingsHub.css';

const BusinessCalendarSettings = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [loading, setLoading] = useState(true);

  // Calendar configs
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [metaCreator, setMetaCreator] = useState(null);

  // List arrays
  const [holidays, setHolidays] = useState([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState([]);
  const [exceptions, setExceptions] = useState([]);

  // Form states
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayRecurring, setHolidayRecurring] = useState(false);

  const [maintDesc, setMaintDesc] = useState('');
  const [maintStart, setMaintStart] = useState('');
  const [maintEnd, setMaintEnd] = useState('');

  const [exceptDate, setExceptDate] = useState('');
  const [exceptStart, setExceptStart] = useState('09:00');
  const [exceptEnd, setExceptEnd] = useState('17:00');
  const [exceptReason, setExceptReason] = useState('');

  const fetchCalendars = async (selectId = null) => {
    try {
      setLoading(true);
      const res = await fetch('/api/calendars', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCalendars(data.data);
        if (data.data.length > 0) {
          const defaultCal = data.data.find(c => c.isDefault) || data.data[0];
          const activeId = selectId || defaultCal._id;
          setSelectedCalendarId(activeId);
          loadCalendarDetails(data.data.find(c => c._id === activeId) || defaultCal);
        } else {
          handleNewCalendarReset();
        }
      }
    } catch (err) {
      addToast('Error', 'Error loading calendars', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarDetails = (cal) => {
    if (!cal) return;
    setName(cal.name || '');
    setDescription(cal.description || '');
    setTimeZone(cal.timeZone || 'UTC');
    setWorkingDays(cal.workingDays || [1, 2, 3, 4, 5]);
    setStartTime(cal.workingHours?.start || '09:00');
    setEndTime(cal.workingHours?.end || '17:00');
    setHolidays(cal.holidays || []);
    setMaintenanceWindows(cal.maintenanceWindows || []);
    setExceptions(cal.exceptions || []);
    setIsActive(cal.isActive !== undefined ? cal.isActive : true);
    setIsDefault(cal.isDefault || false);
    setMetaCreator(cal.createdBy || null);
  };

  useEffect(() => {
    fetchCalendars();
  }, []);

  const handleCalendarSelectChange = (e) => {
    const id = e.target.value;
    setSelectedCalendarId(id);
    const cal = calendars.find(c => c._id === id);
    loadCalendarDetails(cal);
  };

  const handleNewCalendarReset = () => {
    setSelectedCalendarId('new');
    setName('');
    setDescription('');
    setTimeZone('UTC');
    setWorkingDays([1, 2, 3, 4, 5]);
    setStartTime('09:00');
    setEndTime('17:00');
    setHolidays([]);
    setExceptions([]);
    setMaintenanceWindows([]);
    setIsActive(true);
    setIsDefault(false);
    setMetaCreator(null);
  };

  const handleDayToggle = (dayNum) => {
    if (workingDays.includes(dayNum)) {
      setWorkingDays(workingDays.filter(d => d !== dayNum));
    } else {
      setWorkingDays([...workingDays, dayNum].sort());
    }
  };

  const handleSaveCalendar = async () => {
    if (!name.trim()) {
      addToast('Validation', 'Calendar Name is required', 'error');
      return;
    }
    const payload = {
      name,
      description,
      timeZone,
      workingDays,
      workingHours: { start: startTime, end: endTime },
      holidays,
      maintenanceWindows,
      exceptions,
      isActive,
      isDefault
    };

    try {
      const isNew = selectedCalendarId === 'new';
      const url = isNew ? '/api/calendars' : `/api/calendars/${selectedCalendarId}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'Business Calendar saved successfully', 'success');
        fetchCalendars(data.data._id);
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Error saving calendar settings', 'error');
    }
  };

  const handleDeleteCalendar = async () => {
    if (selectedCalendarId === 'new') return;
    if (isDefault) {
      addToast('Validation', 'Cannot delete the default calendar', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the calendar "${name}"?`)) return;

    try {
      const res = await fetch(`/api/calendars/${selectedCalendarId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'Calendar deleted successfully', 'success');
        fetchCalendars();
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Error deleting calendar', 'error');
    }
  };

  const handleAddHoliday = (e) => {
    e.preventDefault();
    if (!holidayName || !holidayDate) {
      addToast('Validation', 'Holiday name and date are required', 'error');
      return;
    }
    const newHoliday = {
      name: holidayName,
      date: new Date(holidayDate),
      isRecurring: holidayRecurring
    };
    setHolidays([...holidays, newHoliday]);
    setHolidayName('');
    setHolidayDate('');
    setHolidayRecurring(false);
    addToast('Draft Info', 'Holiday added to unsaved draft', 'info');
  };

  const handleRemoveHoliday = (idx) => {
    setHolidays(holidays.filter((_, i) => i !== idx));
  };

  const handleAddMaint = (e) => {
    e.preventDefault();
    if (!maintDesc || !maintStart || !maintEnd) {
      addToast('Validation', 'All maintenance fields are required', 'error');
      return;
    }
    const startD = new Date(maintStart);
    const endD = new Date(maintEnd);
    if (endD <= startD) {
      addToast('Validation', 'Maintenance end date must be after start date', 'error');
      return;
    }
    const newMaint = {
      description: maintDesc,
      start: startD,
      end: endD
    };
    setMaintenanceWindows([...maintenanceWindows, newMaint]);
    setMaintDesc('');
    setMaintStart('');
    setMaintEnd('');
    addToast('Draft Info', 'Maintenance window added to unsaved draft', 'info');
  };

  const handleRemoveMaint = (idx) => {
    setMaintenanceWindows(maintenanceWindows.filter((_, i) => i !== idx));
  };

  const handleAddException = (e) => {
    e.preventDefault();
    if (!exceptDate) {
      addToast('Validation', 'Exception Date is required', 'error');
      return;
    }
    const newExcept = {
      date: new Date(exceptDate),
      startTime: exceptStart || '09:00',
      endTime: exceptEnd || '17:00',
      reason: exceptReason
    };
    setExceptions([...exceptions, newExcept]);
    setExceptDate('');
    setExceptStart('09:00');
    setExceptEnd('17:00');
    setExceptReason('');
    addToast('Draft Info', 'Exception override added to unsaved draft', 'info');
  };

  const handleRemoveException = (idx) => {
    setExceptions(exceptions.filter((_, i) => i !== idx));
  };

  const daysOfWeek = [
    { label: 'S', val: 0, fullName: 'Sunday' },
    { label: 'M', val: 1, fullName: 'Monday' },
    { label: 'T', val: 2, fullName: 'Tuesday' },
    { label: 'W', val: 3, fullName: 'Wednesday' },
    { label: 'T', val: 4, fullName: 'Thursday' },
    { label: 'F', val: 5, fullName: 'Friday' },
    { label: 'S', val: 6, fullName: 'Saturday' }
  ];

  return (
    <div className="fade-in" style={{ color: 'var(--text-primary)' }}>
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-accent" role="status" />
        </div>
      ) : (
        <div>
          {/* Calendar Selector Toolbar */}
          <div className="calendar-toolbar">
            <div className="d-flex align-items-center gap-2" style={{ flex: 1, minWidth: '260px' }}>
              <List size={18} className="text-accent" />
              <select
                className="form-select"
                value={selectedCalendarId}
                onChange={handleCalendarSelectChange}
                style={{ width: 'auto', minWidth: '220px', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600 }}
              >
                {calendars.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
              {selectedCalendarId === 'new' && (
                <span className="badge bg-success" style={{ fontSize: '11px', padding: '6px 10px' }}>Draft Mode</span>
              )}
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                onClick={handleNewCalendarReset}
                style={{ fontWeight: 700 }}
              >
                <PlusCircle size={14} /> Create Calendar
              </button>
              {selectedCalendarId !== 'new' && (
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={handleDeleteCalendar}
                  disabled={isDefault}
                >
                  Delete Calendar
                </button>
              )}
              {selectedCalendarId === 'new' && calendars.length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCalendarId(calendars[0]._id)}>
                  Cancel Draft
                </button>
              )}
            </div>
          </div>

          <div className="row g-4">
            {/* Left Column: General Configuration */}
            <div className="col-md-6">
              <div className="card p-4 shadow-sm h-100" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h4 style={{ fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '20px' }}>
                  <Clock size={18} className="text-accent" />
                  Calendar Configuration Settings
                </h4>

                <div className="mb-3">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Calendar Policy Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Standard 9-5 Business Hours"
                    style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Description</label>
                  <textarea
                    className="form-control"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide calendar details, target scope, etc."
                    rows="2"
                    style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}
                  />
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Operating Timezone</label>
                    <select
                      className="form-select"
                      value={timeZone}
                      onChange={(e) => setTimeZone(e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}
                    >
                      <option value="UTC">UTC (Universal Coordinated Time)</option>
                      <option value="Asia/Kolkata">IST (Asia/Kolkata)</option>
                      <option value="America/New_York">EST (America/New_York)</option>
                      <option value="Europe/London">GMT/BST (Europe/London)</option>
                      <option value="Asia/Singapore">SGT (Asia/Singapore)</option>
                    </select>
                  </div>
                  <div className="col-md-6 d-flex align-items-center justify-content-around mt-4">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="isActiveSwitch"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="isActiveSwitch" style={{ fontSize: '12.5px', fontWeight: 600 }}>Active</label>
                    </div>

                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="isDefaultSwitch"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        disabled={selectedCalendarId !== 'new' && isDefault}
                      />
                      <label className="form-check-label" htmlFor="isDefaultSwitch" style={{ fontSize: '12.5px', fontWeight: 600 }}>Is Default</label>
                    </div>
                  </div>
                </div>

                {/* Day selector Sun-Sat */}
                <div className="mb-4">
                  <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '10px' }}>
                    Working Days of Week
                  </label>
                  <div className="d-flex justify-content-between gap-1">
                    {daysOfWeek.map(d => (
                      <button
                        key={d.val}
                        type="button"
                        onClick={() => handleDayToggle(d.val)}
                        className={`day-toggle-pill ${workingDays.includes(d.val) ? 'active' : ''}`}
                        title={d.fullName}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="row g-2 mb-4">
                  <div className="col-6">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Working Hours Start</label>
                    <input
                      type="time"
                      className="form-control"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Working Hours End</label>
                    <input
                      type="time"
                      className="form-control"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}
                    />
                  </div>
                </div>

                {metaCreator && (
                  <div className="mb-3 text-muted" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={12} />
                    <span>Created By Administrator {metaCreator.name || 'System'}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 mt-auto"
                  onClick={handleSaveCalendar}
                  style={{ fontWeight: 800, borderRadius: '8px' }}
                >
                  <Save size={16} />
                  Save Calendar Configuration
                </button>
              </div>
            </div>

            {/* Right Column: Holidays and Exceptions list inputs */}
            <div className="col-md-6">
              <div className="d-flex flex-column gap-4">
                
                {/* Exceptions panel */}
                <div className="card p-4 shadow-sm" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <h4 style={{ fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    <Settings size={18} className="text-accent" />
                    Calendar Exceptions Overrides ({exceptions.length})
                  </h4>
                  <p className="text-muted" style={{ fontSize: '11.5px', marginBottom: '14px' }}>
                    Define custom hours for specific dates (e.g. working Saturdays or half-days).
                  </p>

                  <form onSubmit={handleAddException} className="mb-3 p-3 border rounded" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                    <div className="row g-2 mb-2">
                      <div className="col-4">
                        <label style={{ fontSize: '10.5px', fontWeight: 600 }}>Date</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={exceptDate}
                          onChange={(e) => setExceptDate(e.target.value)}
                        />
                      </div>
                      <div className="col-4">
                        <label style={{ fontSize: '10.5px', fontWeight: 600 }}>Start</label>
                        <input
                          type="time"
                          className="form-control form-control-sm"
                          value={exceptStart}
                          onChange={(e) => setExceptStart(e.target.value)}
                        />
                      </div>
                      <div className="col-4">
                        <label style={{ fontSize: '10.5px', fontWeight: 600 }}>End</label>
                        <input
                          type="time"
                          className="form-control form-control-sm"
                          value={exceptEnd}
                          onChange={(e) => setExceptEnd(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="d-flex gap-2 align-items-center mt-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Reason (e.g. Special Working Saturday)"
                        value={exceptReason}
                        onChange={(e) => setExceptReason(e.target.value)}
                        style={{ border: '1px solid var(--border-color)' }}
                      />
                      <button type="submit" className="btn btn-sm btn-primary d-flex align-items-center gap-1" style={{ height: '31px', whiteSpace: 'nowrap' }}>
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </form>

                  <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    {exceptions.length === 0 ? (
                      <p className="text-center text-muted p-2" style={{ fontSize: '12px' }}>No exceptions overrides registered.</p>
                    ) : (
                      exceptions.map((ex, idx) => (
                        <div key={idx} className="form-list-card-item">
                          <div>
                            <span style={{ fontSize: '12.5px', fontWeight: 700 }}>
                              {new Date(ex.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="ms-2 badge bg-secondary" style={{ fontSize: '10px' }}>
                              {ex.startTime && ex.endTime && ex.startTime !== '00:00' ? `${ex.startTime} - ${ex.endTime}` : 'Closed / Off-Day'}
                            </span>
                            {ex.reason && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{ex.reason}</div>}
                          </div>
                          <button type="button" className="btn btn-link text-danger p-0" onClick={() => handleRemoveException(idx)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Holidays panel */}
                <div className="card p-4 shadow-sm" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <h4 style={{ fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '14px' }}>
                    <Calendar size={18} className="text-accent" />
                    In-document Holidays List ({holidays.length})
                  </h4>

                  <form onSubmit={handleAddHoliday} className="row g-2 mb-3 align-items-end">
                    <div className="col-md-5">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Holiday Name (e.g. New Year)"
                        value={holidayName}
                        onChange={(e) => setHolidayName(e.target.value)}
                        style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      />
                    </div>
                    <div className="col-md-4">
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={holidayDate}
                        onChange={(e) => setHolidayDate(e.target.value)}
                        style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      />
                    </div>
                    <div className="col-md-3 d-flex align-items-center gap-2">
                      <div className="form-check" style={{ marginBottom: '0' }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="isRecCheck"
                          checked={holidayRecurring}
                          onChange={(e) => setHolidayRecurring(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="isRecCheck" style={{ fontSize: '11px' }}>Yearly</label>
                      </div>
                      <button type="submit" className="btn btn-sm btn-primary">
                        <Plus size={14} />
                      </button>
                    </div>
                  </form>

                  <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    {holidays.length === 0 ? (
                      <p className="text-center text-muted p-2" style={{ fontSize: '12px' }}>No holidays registered.</p>
                    ) : (
                      holidays.map((h, idx) => (
                        <div key={idx} className="form-list-card-item">
                          <div>
                            <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{h.name}</span>
                            <span className="ms-2 badge bg-secondary" style={{ fontSize: '10px' }}>
                              {new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: h.isRecurring ? undefined : 'numeric' })}
                              {h.isRecurring ? ' (Recurring)' : ''}
                            </span>
                          </div>
                          <button type="button" className="btn btn-link text-danger p-0" onClick={() => handleRemoveHoliday(idx)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Maintenance windows panel */}
                <div className="card p-4 shadow-sm" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <h4 style={{ fontWeight: 800, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '14px' }}>
                    <ShieldAlert size={18} className="text-accent" />
                    Scheduled Maintenance Windows ({maintenanceWindows.length})
                  </h4>

                  <form onSubmit={handleAddMaint} className="mb-3">
                    <div className="mb-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Description (e.g. Server Migration)"
                        value={maintDesc}
                        onChange={(e) => setMaintDesc(e.target.value)}
                        style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      />
                    </div>
                    <div className="row g-2 mb-2">
                      <div className="col">
                        <input
                          type="datetime-local"
                          className="form-control form-control-sm"
                          value={maintStart}
                          onChange={(e) => setMaintStart(e.target.value)}
                          style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                        />
                      </div>
                      <div className="col">
                        <input
                          type="datetime-local"
                          className="form-control form-control-sm"
                          value={maintEnd}
                          onChange={(e) => setMaintEnd(e.target.value)}
                          style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-sm btn-primary w-100 py-1 d-flex align-items-center justify-content-center gap-1" style={{ borderRadius: '6px' }}>
                      <Plus size={14} /> Add Window
                    </button>
                  </form>

                  <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    {maintenanceWindows.length === 0 ? (
                      <p className="text-center text-muted p-2" style={{ fontSize: '12px' }}>No scheduled maintenance windows.</p>
                    ) : (
                      maintenanceWindows.map((m, idx) => (
                        <div key={idx} className="form-list-card-item">
                          <div style={{ wordBreak: 'break-word', flex: 1, marginRight: '10px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 700 }}>{m.description}</span>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {new Date(m.start).toLocaleString()} - {new Date(m.end).toLocaleString()}
                            </div>
                          </div>
                          <button type="button" className="btn btn-link text-danger p-0" onClick={() => handleRemoveMaint(idx)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
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

export default BusinessCalendarSettings;
