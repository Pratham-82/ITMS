import React, { useState, useEffect } from 'react';
import { calendarTemplates } from './TemplateConfigProvider';
import { Calendar, Clock, Plus, Trash2, ShieldAlert, CheckCircle, ArrowLeft, ArrowRight, Check } from 'lucide-react';

const BusinessCalendarWizard = ({ user, addToast, onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [holidays, setHolidays] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  // Form helpers
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayRecurring, setHolidayRecurring] = useState(false);

  const [exceptDate, setExceptDate] = useState('');
  const [exceptStart, setExceptStart] = useState('09:00');
  const [exceptEnd, setExceptEnd] = useState('17:00');
  const [exceptReason, setExceptReason] = useState('');

  const loadTemplate = (key) => {
    const tpl = calendarTemplates[key];
    if (!tpl) return;
    setName(tpl.name);
    setWorkingDays(tpl.workingDays);
    setStartTime(tpl.workingHours.start);
    setEndTime(tpl.workingHours.end);
    setHolidays(tpl.holidays);
    setExceptions(tpl.exceptions);
    addToast('Template Loaded', `Autofilled using ${tpl.name} template`, 'success');
  };

  const handleNext = () => {
    if (step === 1 && !name.trim()) {
      addToast('Validation', 'Calendar policy name is required', 'error');
      return;
    }
    setStep(step + 1);
  };

  const handlePrev = () => {
    setStep(step - 1);
  };

  const handleDayToggle = (dayNum) => {
    if (workingDays.includes(dayNum)) {
      setWorkingDays(workingDays.filter(d => d !== dayNum));
    } else {
      setWorkingDays([...workingDays, dayNum].sort());
    }
  };

  const handleAddHoliday = (e) => {
    e.preventDefault();
    if (!holidayName || !holidayDate) return;
    setHolidays([...holidays, { name: holidayName, date: new Date(holidayDate), isRecurring: holidayRecurring }]);
    setHolidayName('');
    setHolidayDate('');
    setHolidayRecurring(false);
  };

  const handleAddException = (e) => {
    e.preventDefault();
    if (!exceptDate) return;
    setExceptions([...exceptions, { date: new Date(exceptDate), startTime: exceptStart, endTime: exceptEnd, reason: exceptReason }]);
    setExceptDate('');
    setExceptStart('09:00');
    setExceptEnd('17:00');
    setExceptReason('');
  };

  const handleFinish = async () => {
    const payload = {
      name,
      description,
      timeZone,
      workingDays,
      workingHours: { start: startTime, end: endTime },
      holidays,
      exceptions,
      isActive,
      isDefault
    };

    try {
      const res = await fetch('/api/calendars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'Business Calendar policy created successfully', 'success');
        onComplete(data.data);
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Error saving calendar settings', 'error');
    }
  };

  const daysOfWeek = [
    { label: 'Sun', val: 0 },
    { label: 'Mon', val: 1 },
    { label: 'Tue', val: 2 },
    { label: 'Wed', val: 3 },
    { label: 'Thu', val: 4 },
    { label: 'Fri', val: 5 },
    { label: 'Sat', val: 6 }
  ];

  return (
    <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)' }}>
      {/* Step Indicator Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h4 style={{ fontWeight: 800, fontSize: '18px', margin: 0 }}>Business Calendar Wizard</h4>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Step {step} of 6 — {
            step === 1 ? 'Basic Info' :
            step === 2 ? 'Working Hours' :
            step === 3 ? 'Working Days' :
            step === 4 ? 'Holidays List' :
            step === 5 ? 'Overriding Exceptions' :
            'Review & Complete'
          }</span>
        </div>
        <div className="d-flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div 
              key={i} 
              style={{ 
                height: '6px', 
                width: '30px', 
                borderRadius: '3px', 
                backgroundColor: i + 1 <= step ? 'var(--accent-color)' : 'var(--border-color)',
                transition: 'all 0.3s' 
              }} 
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div style={{ minHeight: '260px' }}>
        {step === 1 && (
          <div>
            <div className="mb-4">
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Choose Template Preset (Optional)</label>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('standardOffice')}>Standard Office</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('support247')}>24/7 Support</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('governmentOffice')}>Gov Office</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('itOps')}>IT Operations</button>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Calendar Name *</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard 9-5 Office Hours"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
              />
            </div>

            <div className="mb-3">
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Description</label>
              <textarea
                className="form-control"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief purpose of the calendar..."
                rows="2"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
              />
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Timezone</label>
                <select
                  className="form-control"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                >
                  <option value="UTC">UTC</option>
                  <option value="Asia/Kolkata">IST (Asia/Kolkata)</option>
                  <option value="America/New_York">EST (America/New_York)</option>
                  <option value="Europe/London">GMT/BST</option>
                </select>
              </div>
              <div className="col-md-6 d-flex align-items-center justify-content-around mt-4">
                <label className="d-flex align-items-center gap-2">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Active</span>
                </label>
                <label className="d-flex align-items-center gap-2">
                  <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Default</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Define default daily start and end working hours. Standard hours are 09:00 to 17:00.</p>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Working Hours Start</label>
                <input
                  type="time"
                  className="form-control"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Working Hours End</label>
                <input
                  type="time"
                  className="form-control"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Toggle working days. SLA clocks run only on these selected calendar days.</p>
            <div className="d-flex gap-2 flex-wrap" style={{ marginTop: '20px' }}>
              {daysOfWeek.map(d => (
                <button
                  key={d.val}
                  type="button"
                  onClick={() => handleDayToggle(d.val)}
                  className={`btn ${workingDays.includes(d.val) ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ flex: '1 1 80px', padding: '12px 0', fontSize: '13px', fontWeight: 700 }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Add holidays when SLA clocks are paused.</p>
            <form onSubmit={handleAddHoliday} className="row g-2 mb-3 align-items-end">
              <div className="col-md-5">
                <input
                  type="text"
                  placeholder="Holiday Name"
                  className="form-control form-control-sm"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div className="col-md-4">
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div className="col-md-3 d-flex align-items-center gap-2">
                <label className="d-flex align-items-center gap-1" style={{ fontSize: '11px', margin: 0 }}>
                  <input type="checkbox" checked={holidayRecurring} onChange={(e) => setHolidayRecurring(e.target.checked)} />
                  Yearly
                </label>
                <button type="submit" className="btn btn-sm btn-primary">Add</button>
              </div>
            </form>

            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              {holidays.length === 0 ? (
                <p className="text-center p-3 mb-0 text-muted">No holidays added.</p>
              ) : (
                <ul className="list-group list-group-flush mb-0">
                  {holidays.map((h, i) => (
                    <li key={i} className="list-group-item bg-transparent d-flex justify-content-between align-items-center py-2" style={{ borderBottom: '1px solid var(--border-color)', fontSize: '12px' }}>
                      <span>{h.name} ({new Date(h.date).toLocaleDateString()})</span>
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => setHolidays(holidays.filter((_, idx) => idx !== i))}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Define specific days with override hours (e.g. half-days or working Saturdays).</p>
            <form onSubmit={handleAddException} className="row g-2 mb-3 align-items-end">
              <div className="col-md-4">
                <input type="date" className="form-control form-control-sm" value={exceptDate} onChange={(e) => setExceptDate(e.target.value)} style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }} />
              </div>
              <div className="col-md-3">
                <input type="time" className="form-control form-control-sm" value={exceptStart} onChange={(e) => setExceptStart(e.target.value)} style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }} />
              </div>
              <div className="col-md-3">
                <input type="time" className="form-control form-control-sm" value={exceptEnd} onChange={(e) => setExceptEnd(e.target.value)} style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }} />
              </div>
              <div className="col-md-2">
                <button type="submit" className="btn btn-sm btn-primary w-100">Add</button>
              </div>
            </form>

            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              {exceptions.length === 0 ? (
                <p className="text-center p-3 mb-0 text-muted">No exceptions defined.</p>
              ) : (
                <ul className="list-group list-group-flush mb-0">
                  {exceptions.map((ex, i) => (
                    <li key={i} className="list-group-item bg-transparent d-flex justify-content-between align-items-center py-2" style={{ borderBottom: '1px solid var(--border-color)', fontSize: '12px' }}>
                      <span>{new Date(ex.date).toLocaleDateString()} ({ex.startTime} - {ex.endTime})</span>
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => setExceptions(exceptions.filter((_, idx) => idx !== i))}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <p className="text-muted mb-3" style={{ fontSize: '13px' }}>Verify calendar settings draft before final activation.</p>
            <div className="p-3" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}>
              <div><strong>Name:</strong> {name}</div>
              <div><strong>Timezone:</strong> {timeZone}</div>
              <div><strong>Hours:</strong> {startTime} - {endTime}</div>
              <div><strong>Days:</strong> {workingDays.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</div>
              <div><strong>Holidays:</strong> {holidays.length} defined</div>
              <div><strong>Overrides:</strong> {exceptions.length} defined</div>
            </div>
          </div>
        )}
      </div>

      {/* Stepper Footer Controls */}
      <div className="d-flex justify-content-between mt-4 pt-3 border-top">
        <button 
          type="button" 
          onClick={step === 1 ? onCancel : handlePrev} 
          className="btn btn-secondary px-4 py-2"
        >
          <ArrowLeft size={14} className="me-2" />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        <button 
          type="button" 
          onClick={step === 6 ? handleFinish : handleNext} 
          className="btn btn-primary px-4 py-2"
        >
          {step === 6 ? 'Create Calendar' : 'Next'}
          {step === 6 ? <Check size={14} className="ms-2" /> : <ArrowRight size={14} className="ms-2" />}
        </button>
      </div>
    </div>
  );
};

export default BusinessCalendarWizard;
