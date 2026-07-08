import React, { useState } from 'react';
import { slaTemplates } from './TemplateConfigProvider';
import { Layers, CheckCircle, ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';

const SlaPolicyWizard = ({ user, addToast, onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Priority limits
  const [criticalResponse, setCriticalResponse] = useState(15);
  const [criticalResolution, setCriticalResolution] = useState(240);
  const [highResponse, setHighResponse] = useState(60);
  const [highResolution, setHighResolution] = useState(480);
  const [mediumResponse, setMediumResponse] = useState(240);
  const [mediumResolution, setMediumResolution] = useState(1440);
  const [lowResponse, setLowResponse] = useState(480);
  const [lowResolution, setLowResolution] = useState(4320);

  // SLA Actions
  const [responseActions, setResponseActions] = useState(['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER']);
  const [resolutionActions, setResolutionActions] = useState(['AUDIT_LOG', 'HISTORY_LOG', 'LEVEL_ESCALATION', 'NOTIFY_DEPT_HEAD']);

  // Multi-Breach Rules
  const [multiBreachRules, setMultiBreachRules] = useState([
    { breachCount: 1, action: 'NOTIFY_MANAGER' },
    { breachCount: 2, action: 'PRIORITY_UPGRADE' },
    { breachCount: 3, action: 'NOTIFY_DEPT_HEAD' },
    { breachCount: 4, action: 'EXECUTIVE_ESCALATE' },
    { breachCount: 5, action: 'CRITICAL_INCIDENT_FLAG' }
  ]);

  // Risk weights
  const [riskRules, setRiskRules] = useState({
    responseBreachIncrease: 10,
    resolutionBreachIncrease: 20,
    reopenIncrease: 15,
    escalationIncrease: 10,
    lowRatingIncrease: 15,
    criticalPriorityIncrease: 20
  });

  const loadTemplate = (key) => {
    const tpl = slaTemplates[key];
    if (!tpl) return;
    setName(tpl.name);
    
    setCriticalResponse(tpl.priorities.Critical.responseSlaMinutes);
    setCriticalResolution(tpl.priorities.Critical.resolutionSlaMinutes);
    setHighResponse(tpl.priorities.High.responseSlaMinutes);
    setHighResolution(tpl.priorities.High.resolutionSlaMinutes);
    setMediumResponse(tpl.priorities.Medium.responseSlaMinutes);
    setMediumResolution(tpl.priorities.Medium.resolutionSlaMinutes);
    setLowResponse(tpl.priorities.Low.responseSlaMinutes);
    setLowResolution(tpl.priorities.Low.resolutionSlaMinutes);

    setResponseActions(tpl.breachActions.responseSla);
    setResolutionActions(tpl.breachActions.resolutionSla);
    setMultiBreachRules(tpl.multiBreachRules);
    setRiskRules(tpl.riskScoreRules);
    
    addToast('Template Loaded', `Autofilled SLA template: ${tpl.name}`, 'success');
  };

  const handleNext = () => {
    if (step === 1 && !name.trim()) {
      addToast('Validation', 'SLA Policy name is required', 'error');
      return;
    }
    setStep(step + 1);
  };

  const handlePrev = () => {
    setStep(step - 1);
  };

  const handleResponseActionToggle = (val) => {
    if (responseActions.includes(val)) {
      setResponseActions(responseActions.filter(x => x !== val));
    } else {
      setResponseActions([...responseActions, val]);
    }
  };

  const handleResolutionActionToggle = (val) => {
    if (resolutionActions.includes(val)) {
      setResolutionActions(resolutionActions.filter(x => x !== val));
    } else {
      setResolutionActions([...resolutionActions, val]);
    }
  };

  const handleMultiBreachActionChange = (idx, val) => {
    const updated = [...multiBreachRules];
    updated[idx].action = val;
    setMultiBreachRules(updated);
  };

  const handleFinish = async () => {
    const payload = {
      name,
      priorities: {
        Critical: { responseSlaMinutes: Number(criticalResponse), resolutionSlaMinutes: Number(criticalResolution) },
        High: { responseSlaMinutes: Number(highResponse), resolutionSlaMinutes: Number(highResolution) },
        Medium: { responseSlaMinutes: Number(mediumResponse), resolutionSlaMinutes: Number(mediumResolution) },
        Low: { responseSlaMinutes: Number(lowResponse), resolutionSlaMinutes: Number(lowResolution) }
      },
      breachActions: {
        responseSla: responseActions,
        resolutionSla: resolutionActions
      },
      multiBreachRules,
      riskScoreRules: riskRules,
      isDefault
    };

    try {
      const res = await fetch('/api/sla-configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'SLA Policy Matrix created successfully', 'success');
        onComplete(data.data);
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to create SLA configuration', 'error');
    }
  };

  const availableResponseActions = [
    { value: 'AUDIT_LOG', label: 'Audit Log DB Entry' },
    { value: 'HISTORY_LOG', label: 'Complaint History Event' },
    { value: 'NOTIFY_ASSIGNED', label: 'Notify Assigned Officer' },
    { value: 'NOTIFY_MANAGER', label: 'Notify Manager' },
    { value: 'NOTIFY_DEPT_HEAD', label: 'Notify Department Head' },
    { value: 'PRIORITY_UPGRADE', label: 'Priority Step-up (Low → Med → High → Critical)' },
    { value: 'LEVEL_ESCALATION', label: 'Escalate Assignment Level' },
    { value: 'MARK_ATTENTION', label: 'Flag Attention Required' },
    { value: 'INCREASE_RISK_SCORE', label: 'Increase Risk Score' }
  ];

  const availableResolutionActions = [
    { value: 'AUDIT_LOG', label: 'Audit Log DB Entry' },
    { value: 'HISTORY_LOG', label: 'Complaint History Event' },
    { value: 'LEVEL_ESCALATION', label: 'Escalate Assignment Level' },
    { value: 'NOTIFY_DEPT_HEAD', label: 'Notify Department Head' },
    { value: 'NOTIFY_ASSIGNED', label: 'Notify Assigned Officer' },
    { value: 'INCREASE_RISK_SCORE', label: 'Increase Risk Score' },
    { value: 'FLAG_DASHBOARD', label: 'Flag Dashboard Attention' },
    { value: 'PRIORITY_UPGRADE', label: 'Priority Step-up' },
    { value: 'EXECUTIVE_ESCALATE', label: 'Executive Escalation Queue Routing' }
  ];

  const multiBreachActions = [
    { value: 'NOTIFY_MANAGER', label: 'Notify Manager' },
    { value: 'PRIORITY_UPGRADE', label: 'Auto Priority Step-Up' },
    { value: 'NOTIFY_DEPT_HEAD', label: 'Notify Dept Head' },
    { value: 'EXECUTIVE_ESCALATE', label: 'Route to Executive Escalations' },
    { value: 'CRITICAL_INCIDENT_FLAG', label: 'Flag as Critical Incident' }
  ];

  return (
    <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)' }}>
      {/* Step Indicator */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h4 style={{ fontWeight: 800, fontSize: '18px', margin: 0 }}>SLA Configuration Wizard</h4>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Step {step} of 6 — {
            step === 1 ? 'Policy Details' :
            step === 2 ? 'Priorities Matrix' :
            step === 3 ? 'Response SLA Actions' :
            step === 4 ? 'Resolution SLA Actions' :
            step === 5 ? 'Repeated Breaches' :
            'Review & Save'
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
      <div style={{ minHeight: '280px' }}>
        {step === 1 && (
          <div>
            <div className="mb-4">
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Choose Template Preset (Optional)</label>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('standard')}>Standard Support</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('vip')}>VIP Premier</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('critical')}>Critical Incident</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('government')}>Government Matrix</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('enterprise')}>Enterprise SLA</button>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>SLA Policy Name *</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard Service Level Agreement"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
              />
            </div>

            <div className="form-check form-switch mt-4">
              <label className="d-flex align-items-center gap-2">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Set as Default SLA Policy</span>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Specify response and resolution due intervals (in minutes) per ticket priority.</p>
            <div className="table-responsive">
              <table className="table align-middle" style={{ color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <th>Priority</th>
                    <th>Response Limit (Min)</th>
                    <th>Resolution Limit (Min)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="badge bg-danger-subtle text-danger">Critical</span></td>
                    <td><input type="number" className="form-control form-control-sm" value={criticalResponse} onChange={(e) => setCriticalResponse(e.target.value)} style={{ width: '100px' }} /></td>
                    <td><input type="number" className="form-control form-control-sm" value={criticalResolution} onChange={(e) => setCriticalResolution(e.target.value)} style={{ width: '100px' }} /></td>
                  </tr>
                  <tr>
                    <td><span className="badge bg-warning-subtle text-warning">High</span></td>
                    <td><input type="number" className="form-control form-control-sm" value={highResponse} onChange={(e) => setHighResponse(e.target.value)} style={{ width: '100px' }} /></td>
                    <td><input type="number" className="form-control form-control-sm" value={highResolution} onChange={(e) => setHighResolution(e.target.value)} style={{ width: '100px' }} /></td>
                  </tr>
                  <tr>
                    <td><span className="badge bg-info-subtle text-info">Medium</span></td>
                    <td><input type="number" className="form-control form-control-sm" value={mediumResponse} onChange={(e) => setMediumResponse(e.target.value)} style={{ width: '100px' }} /></td>
                    <td><input type="number" className="form-control form-control-sm" value={mediumResolution} onChange={(e) => setMediumResolution(e.target.value)} style={{ width: '100px' }} /></td>
                  </tr>
                  <tr>
                    <td><span className="badge bg-success-subtle text-success">Low</span></td>
                    <td><input type="number" className="form-control form-control-sm" value={lowResponse} onChange={(e) => setLowResponse(e.target.value)} style={{ width: '100px' }} /></td>
                    <td><input type="number" className="form-control form-control-sm" value={lowResolution} onChange={(e) => setLowResolution(e.target.value)} style={{ width: '100px' }} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Select actions triggered immediately when response SLA due time passes.</p>
            <div className="row g-2">
              {availableResponseActions.map(act => (
                <div key={act.value} className="col-md-6">
                  <label className="d-flex align-items-start gap-2" style={{ cursor: 'pointer', fontSize: '13px' }}>
                    <input type="checkbox" checked={responseActions.includes(act.value)} onChange={() => handleResponseActionToggle(act.value)} />
                    <span>{act.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Select actions triggered immediately when resolution SLA due time passes.</p>
            <div className="row g-2">
              {availableResolutionActions.map(act => (
                <div key={act.value} className="col-md-6">
                  <label className="d-flex align-items-start gap-2" style={{ cursor: 'pointer', fontSize: '13px' }}>
                    <input type="checkbox" checked={resolutionActions.includes(act.value)} onChange={() => handleResolutionActionToggle(act.value)} />
                    <span>{act.label}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Define rules triggered when a ticket has repeated breach events.</p>
            <div className="table-responsive">
              <table className="table align-middle" style={{ color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <th>Breach Count</th>
                    <th>Automated Action</th>
                  </tr>
                </thead>
                <tbody>
                  {multiBreachRules.map((rule, idx) => (
                    <tr key={idx}>
                      <td>{rule.breachCount} {rule.breachCount === 1 ? 'Breach' : 'Breaches'}</td>
                      <td>
                        <select 
                          className="form-select form-select-sm w-75"
                          value={rule.action}
                          onChange={(e) => handleMultiBreachActionChange(idx, e.target.value)}
                          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                        >
                          {multiBreachActions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <p className="text-muted mb-3" style={{ fontSize: '13px' }}>Verify SLA configuration settings before saving.</p>
            <div className="p-3" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}>
              <div><strong>Name:</strong> {name}</div>
              <div><strong>Default:</strong> {isDefault ? 'Yes' : 'No'}</div>
              <div><strong>Breach Actions (Response):</strong> {responseActions.length} enabled</div>
              <div><strong>Breach Actions (Resolution):</strong> {resolutionActions.length} enabled</div>
              <div><strong>Multi-Breach Rules:</strong> {multiBreachRules.length} registered</div>
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
          {step === 6 ? 'Create SLA Policy' : 'Next'}
          {step === 6 ? <Check size={14} className="ms-2" /> : <ArrowRight size={14} className="ms-2" />}
        </button>
      </div>
    </div>
  );
};

export default SlaPolicyWizard;
