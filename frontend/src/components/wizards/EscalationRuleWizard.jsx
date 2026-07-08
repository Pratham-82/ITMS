import React, { useState, useEffect } from 'react';
import { escalationTemplates } from './TemplateConfigProvider';
import { Layers, CheckCircle, ArrowLeft, ArrowRight, Check, Plus, Trash2, HelpCircle } from 'lucide-react';

const EscalationRuleWizard = ({ user, addToast, onComplete, onCancel, initialData }) => {
  const [step, setStep] = useState(1);
  const [workflowName, setWorkflowName] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Levels list
  const [levels, setLevels] = useState([
    {
      level: 1,
      department: '',
      durationHours: 24,
      description: '',
      targetType: 'department',
      targetId: '',
      responseSlaMinutes: 60,
      resolutionSlaMinutes: 480,
      warningThresholds: '50, 75, 90',
      isParallelBranch: false
    }
  ]);

  // Master lists
  const [departments, setDepartments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [rules, setRules] = useState([]); // to check existing rules for uniqueness

  const isEditing = !!initialData;

  // Load backend configurations
  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${user.token}` };

        // Fetch departments
        const deptRes = await fetch('/api/departments', { headers });
        const deptData = await deptRes.json();
        if (deptData.success) {
          setDepartments(deptData.data.filter(d => d.isActive));
        }

        // Fetch groups
        const groupRes = await fetch('/api/groups', { headers });
        const groupData = await groupRes.json();
        if (groupData.success) {
          setGroups(groupData.data);
        }

        // Fetch staff admins
        const adminRes = await fetch('/api/auth/admins', { headers });
        const adminData = await adminRes.json();
        if (adminData.success) {
          setAdmins(adminData.data.filter(u => u.role === 'admin'));
        }

        // Fetch existing rules for validation
        const rulesRes = await fetch('/api/escalations', { headers });
        const rulesData = await rulesRes.json();
        if (rulesData.success) {
          setRules(rulesData.data);
        }
      } catch (err) {
        console.error('Failed to fetch wizard dropdown dependencies', err);
      }
    };

    if (user?.token) {
      fetchData();
    }
  }, [user]);

  // Load initialData if editing
  useEffect(() => {
    if (initialData) {
      setWorkflowName(initialData.workflowName || '');
      setSelectedDepartment(initialData.departmentId?._id || initialData.departmentId || '');
      setSelectedCategory(initialData.categoryId?._id || initialData.categoryId || '');
      setIsActive(initialData.isActive !== false);
      if (initialData.levels && initialData.levels.length > 0) {
        setLevels(initialData.levels.map(l => ({
          ...l,
          targetType: l.targetType || 'department',
          targetId: l.targetId || (l.targetType === 'department' ? l.department : ''),
          responseSlaMinutes: l.responseSlaMinutes || 0,
          resolutionSlaMinutes: l.resolutionSlaMinutes || 0,
          warningThresholds: Array.isArray(l.warningThresholds) ? l.warningThresholds.join(', ') : '50, 75, 90',
          isParallelBranch: !!l.isParallelBranch
        })));
      }
    }
  }, [initialData]);

  // Calculate filtered categories based on selected department
  const selectedDeptDoc = departments.find(d => d._id === selectedDepartment);
  const deptCategories = selectedDeptDoc ? selectedDeptDoc.categories || [] : [];

  const loadTemplate = (key) => {
    const tpl = escalationTemplates[key];
    if (!tpl) return;
    setWorkflowName(tpl.name);
    setLevels(tpl.rules.map((r, idx) => ({
      level: idx + 1,
      targetType: 'role',
      targetId: r.role,
      department: '',
      durationHours: Math.round(r.cooldownMinutes / 60) || 1,
      description: `Auto-escalation to ${r.role} level`,
      responseSlaMinutes: 0,
      resolutionSlaMinutes: 0,
      warningThresholds: '50, 75, 90',
      isParallelBranch: false
    })));
    addToast('Template Loaded', `Autofilled Escalation Matrix using ${tpl.name}`, 'success');
  };

  const handleNext = () => {
    if (step === 1) {
      if (!workflowName.trim()) {
        addToast('Validation', 'Workflow name is required', 'error');
        return;
      }
    }
    if (step === 2) {
      if (!selectedDepartment) {
        addToast('Validation', 'Please select a Target Department', 'error');
        return;
      }
      if (!selectedCategory) {
        addToast('Validation', 'Please select a Target Complaint Category', 'error');
        return;
      }
      // Check duplicate rules if not editing
      if (!isEditing) {
        const alreadyConfigured = rules.some(r => {
          const ruleDeptId = r.departmentId?._id || r.departmentId;
          const ruleCatId = r.categoryId?._id || r.categoryId;
          return ruleDeptId === selectedDepartment && ruleCatId === selectedCategory;
        });
        if (alreadyConfigured) {
          addToast('Validation', 'An escalation rule already exists for this category under this department.', 'error');
          return;
        }
      }
    }
    if (step === 3) {
      // Validate levels targets
      for (const l of levels) {
        if (l.targetType === 'department' && !l.department) {
          addToast('Validation', `Level ${l.level} is missing a Target Department.`, 'error');
          return;
        }
        if (['group', 'user', 'role'].includes(l.targetType) && !l.targetId) {
          addToast('Validation', `Level ${l.level} is missing a Target Selection.`, 'error');
          return;
        }
      }
    }
    setStep(step + 1);
  };

  const handlePrev = () => {
    setStep(step - 1);
  };

  const handleAddLevel = () => {
    const nextLvl = levels.length + 1;
    setLevels([
      ...levels,
      {
        level: nextLvl,
        department: '',
        durationHours: 24,
        description: '',
        targetType: 'department',
        targetId: '',
        responseSlaMinutes: 60,
        resolutionSlaMinutes: 480,
        warningThresholds: '50, 75, 90',
        isParallelBranch: false
      }
    ]);
  };

  const handleRemoveLevel = (index) => {
    if (levels.length === 1) {
      addToast('Validation', 'An escalation rule must have at least one level.', 'error');
      return;
    }
    const updated = levels
      .filter((_, idx) => idx !== index)
      .map((lvl, idx) => ({ ...lvl, level: idx + 1 }));
    setLevels(updated);
  };

  const handleLevelChange = (index, key, value) => {
    const updated = [...levels];
    updated[index][key] = value;

    if (key === 'targetType') {
      updated[index].targetId = '';
      if (value === 'department') {
        updated[index].department = '';
      }
    }

    if (key === 'department') {
      updated[index].targetId = value;
    }

    setLevels(updated);
  };

  const handleFinish = async () => {
    // Parse thresholds and prepare payload
    const payloadLevels = levels.map((l) => {
      let thresholds = [50, 75, 90];
      if (typeof l.warningThresholds === 'string') {
        thresholds = l.warningThresholds
          .split(',')
          .map(s => parseInt(s.trim()))
          .filter(n => !isNaN(n));
      } else if (Array.isArray(l.warningThresholds)) {
        thresholds = l.warningThresholds;
      }

      return {
        level: l.level,
        department: l.targetType === 'department' ? l.department : '',
        durationHours: Number(l.durationHours || 24),
        description: l.description,
        targetType: l.targetType,
        targetId: l.targetId || (l.targetType === 'department' ? l.department : ''),
        responseSlaMinutes: Number(l.responseSlaMinutes || 0),
        resolutionSlaMinutes: Number(l.resolutionSlaMinutes || 0),
        warningThresholds: thresholds,
        isParallelBranch: !!l.isParallelBranch
      };
    });

    const payload = {
      departmentId: selectedDepartment,
      categoryId: selectedCategory,
      workflowName: workflowName.trim(),
      levels: payloadLevels,
      isActive
    };

    try {
      const url = isEditing ? `/api/escalations/${initialData._id}` : '/api/escalations';
      const method = isEditing ? 'PUT' : 'POST';

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
        addToast('Success', `Escalation rule ${isEditing ? 'updated' : 'created'} successfully`, 'success');
        onComplete(data.data);
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to save escalation rule configuration', 'error');
    }
  };

  return (
    <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)' }}>
      {/* Indicator Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h4 style={{ fontWeight: 800, fontSize: '18px', margin: 0 }}>
            {isEditing ? 'Edit Escalation Rule' : 'Escalation Rule Wizard'}
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Step {step} of 5 — {
              step === 1 ? 'Rule Preset' :
              step === 2 ? 'Assign Scope' :
              step === 3 ? 'Escalation Levels' :
              step === 4 ? 'Alert Rules & Notifications' :
              'Review & Complete'
            }
          </span>
        </div>
        <div className="d-flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
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
      <div style={{ minHeight: '320px' }}>
        {step === 1 && (
          <div>
            {!isEditing && (
              <div className="mb-4">
                <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 700 }}>Choose Template Preset (Optional)</label>
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('standard')}>Standard Escalation</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('vip')}>VIP Support Escalation</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('critical')}>Critical Incident SLA</button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadTemplate('management')}>Management Escalation</button>
                </div>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Escalation Rule / Workflow Name *</label>
              <input
                type="text"
                className="form-control"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g. IT Helpdesk Response Escalation"
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
              />
            </div>

            <div className="form-check form-switch mt-4">
              <label className="d-flex align-items-center gap-2" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Enable Escalation Rule Immediately</span>
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-muted" style={{ fontSize: '13px' }}>Define the organization scope and category filter where this escalation rule applies.</p>
            
            <div className="mb-3">
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Target Department *</label>
              <select
                className="form-select"
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedCategory('');
                }}
                disabled={isEditing}
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
              >
                <option value="">-- Choose Department --</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Target Complaint Category *</label>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  const cat = deptCategories.find(c => c._id === e.target.value);
                  if (cat && !workflowName) {
                    setWorkflowName(`${cat.name} Escalation`);
                  }
                }}
                disabled={isEditing || !selectedDepartment}
                style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
              >
                <option value="">
                  {!selectedDepartment ? '-- Select Department First --' : '-- Choose Category --'}
                </option>
                {deptCategories.map((cat) => {
                  const alreadyConfigured = rules.some(r => {
                    const ruleDeptId = r.departmentId?._id || r.departmentId;
                    const ruleCatId = r.categoryId?._id || r.categoryId;
                    return ruleDeptId === selectedDepartment && ruleCatId === cat._id;
                  });
                  if (alreadyConfigured && !isEditing) return null;
                  return (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  );
                })}
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <p className="text-muted m-0" style={{ fontSize: '13px' }}>Configure the sequential workflow levels and recipient targets.</p>
              <button type="button" className="btn btn-xs btn-outline-primary d-flex align-items-center gap-1" onClick={handleAddLevel} style={{ fontSize: '12px' }}>
                <Plus size={14} /> Add Escalation Level
              </button>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '8px' }}>
              {levels.map((lvl, idx) => (
                <div key={idx} className="p-3 mb-3" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', position: 'relative' }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="badge bg-primary">Level {lvl.level}</span>
                    <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => handleRemoveLevel(idx)}>
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="row g-2">
                    <div className="col-md-3">
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Target Type</label>
                      <select
                        className="form-select form-select-sm"
                        value={lvl.targetType}
                        onChange={(e) => handleLevelChange(idx, 'targetType', e.target.value)}
                        style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                      >
                        <option value="department">Department</option>
                        <option value="role">System Role</option>
                        <option value="user">Specific User</option>
                        <option value="group">Escalation Group</option>
                      </select>
                    </div>

                    <div className="col-md-5">
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Target Recipient</label>
                      {lvl.targetType === 'department' && (
                        <select
                          className="form-select form-select-sm"
                          value={lvl.department}
                          onChange={(e) => handleLevelChange(idx, 'department', e.target.value)}
                          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                        >
                          <option value="">-- Choose Department --</option>
                          {departments.map(d => (
                            <option key={d._id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      )}
                      {lvl.targetType === 'role' && (
                        <select
                          className="form-select form-select-sm"
                          value={lvl.targetId}
                          onChange={(e) => handleLevelChange(idx, 'targetId', e.target.value)}
                          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                        >
                          <option value="">-- Choose Role --</option>
                          <option value="agent">Agent</option>
                          <option value="lead">Lead</option>
                          <option value="manager">Manager</option>
                          <option value="director">Director</option>
                        </select>
                      )}
                      {lvl.targetType === 'user' && (
                        <select
                          className="form-select form-select-sm"
                          value={lvl.targetId}
                          onChange={(e) => handleLevelChange(idx, 'targetId', e.target.value)}
                          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                        >
                          <option value="">-- Choose User --</option>
                          {admins.map(u => (
                            <option key={u._id} value={u._id}>{u.name} ({u.department || 'Admin'})</option>
                          ))}
                        </select>
                      )}
                      {lvl.targetType === 'group' && (
                        <select
                          className="form-select form-select-sm"
                          value={lvl.targetId}
                          onChange={(e) => handleLevelChange(idx, 'targetId', e.target.value)}
                          style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                        >
                          <option value="">-- Choose Group --</option>
                          {groups.map(g => (
                            <option key={g._id} value={g._id}>{g.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Cooldown Duration (Hours)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={lvl.durationHours}
                        onChange={(e) => handleLevelChange(idx, 'durationHours', Number(e.target.value))}
                        style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mt-2">
                    <div className="col-md-6">
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Response SLA Minutes (Optional)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="0 for none"
                        value={lvl.responseSlaMinutes}
                        onChange={(e) => handleLevelChange(idx, 'responseSlaMinutes', Number(e.target.value))}
                        style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Resolution SLA Minutes (Optional)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="0 for none"
                        value={lvl.resolutionSlaMinutes}
                        onChange={(e) => handleLevelChange(idx, 'resolutionSlaMinutes', Number(e.target.value))}
                        style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                      />
                    </div>
                  </div>

                  <div className="mt-2 form-check">
                    <label className="form-label d-flex align-items-center gap-2 m-0" style={{ cursor: 'pointer', fontSize: '12px' }}>
                      <input 
                        type="checkbox" 
                        checked={lvl.isParallelBranch} 
                        onChange={(e) => handleLevelChange(idx, 'isParallelBranch', e.target.checked)} 
                      />
                      <span>Enable Parallel Escalation Branch (executes alongside other nodes at same level)</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="text-muted mb-3" style={{ fontSize: '13px' }}>Define alert warning thresholds and notification triggers for these rules.</p>
            
            <div className="mb-4">
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 700 }}>Warning Milestones (%)</label>
              <p className="text-muted" style={{ fontSize: '11px', marginTop: '-4px' }}>Specify percentages of SLA elapsed time that trigger warnings. Separate multiple with commas.</p>
              {levels.map((lvl, idx) => (
                <div key={idx} className="d-flex align-items-center gap-2 mb-2">
                  <span className="badge bg-secondary" style={{ minWidth: '60px' }}>Level {lvl.level}</span>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={lvl.warningThresholds}
                    onChange={(e) => handleLevelChange(idx, 'warningThresholds', e.target.value)}
                    placeholder="e.g. 50, 75, 90"
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              ))}
            </div>

            <div className="mb-3">
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: 700 }}>Additional Descriptions / Context</label>
              {levels.map((lvl, idx) => (
                <div key={idx} className="mb-2">
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Level {lvl.level} Notes</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={lvl.description}
                    onChange={(e) => handleLevelChange(idx, 'description', e.target.value)}
                    placeholder="Describe escalation trigger details..."
                    style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <p className="text-muted mb-3" style={{ fontSize: '13px' }}>Review the escalation rule settings before applying them.</p>
            <div className="p-3" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}>
              <div className="mb-2"><strong>Rule Name:</strong> {workflowName}</div>
              <div className="mb-2"><strong>Active Status:</strong> {isActive ? 'Enabled' : 'Disabled'}</div>
              <div className="mb-2"><strong>Target Scope:</strong> {departments.find(d => d._id === selectedDepartment)?.name || 'N/A'} — {deptCategories.find(c => c._id === selectedCategory)?.name || 'N/A'}</div>
              
              <div className="mt-3">
                <strong>Escalation Path Flow:</strong>
                <div className="mt-2 d-flex flex-column gap-2">
                  {levels.map((lvl, i) => (
                    <div key={i} className="p-2 border rounded" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <strong>Level {lvl.level}:</strong> Route to {lvl.targetType} ({
                        lvl.targetType === 'department' ? lvl.department :
                        lvl.targetType === 'role' ? lvl.targetId :
                        lvl.targetType === 'user' ? admins.find(a => a._id === lvl.targetId)?.name || lvl.targetId :
                        groups.find(g => g._id === lvl.targetId)?.name || lvl.targetId
                      }) within {lvl.durationHours} hours {lvl.isParallelBranch ? '(Parallel)' : ''}
                    </div>
                  ))}
                </div>
              </div>
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
          onClick={step === 5 ? handleFinish : handleNext} 
          className="btn btn-primary px-4 py-2"
        >
          {step === 5 ? (isEditing ? 'Save Changes' : 'Create Rule') : 'Next'}
          {step === 5 ? <Check size={14} className="ms-2" /> : <ArrowRight size={14} className="ms-2" />}
        </button>
      </div>
    </div>
  );
};

export default EscalationRuleWizard;
