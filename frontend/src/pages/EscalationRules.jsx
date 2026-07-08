import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import '../styles/EscalationRules.css';
import { 
  Plus, Trash2, Edit2, Save, AlertCircle, Play, 
  Layers, Clock, ArrowRight, CheckCircle, RefreshCw, X, GitMerge
} from 'lucide-react';

const parseDuration = (hours) => {
  const seconds = Math.round(hours * 3600);
  if (seconds > 0 && seconds < 60) return { value: seconds, unit: 'seconds' };
  if (seconds % 86400 === 0) return { value: seconds / 86400, unit: 'days' };
  if (seconds % 3600 === 0) return { value: seconds / 3600, unit: 'hours' };
  if (seconds % 60 === 0) return { value: seconds / 60, unit: 'minutes' };
  
  return { value: Number(hours.toFixed(4)), unit: 'hours' };
};

const formatDuration = (hours) => {
  const { value, unit } = parseDuration(hours);
  const unitShort = unit === 'seconds' ? 's' : unit === 'minutes' ? 'm' : unit === 'hours' ? 'h' : 'd';
  return `${value}${unitShort}`;
};

const EscalationRules = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [levels, setLevels] = useState([
    { 
      level: 1, 
      department: '', 
      durationHours: 24, 
      description: '', 
      targetType: 'group', 
      targetId: '', 
      responseSlaMinutes: 60, 
      resolutionSlaMinutes: 480, 
      warningThresholds: '50, 75, 90', 
      isParallelBranch: false,
      responseSlaActions: [],
      resolutionSlaActions: []
    }
  ]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/escalations', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setRules(result.data);
      } else {
        addToast('Error', result.message || 'Failed to fetch escalation rules', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setCategories(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch categories list', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setDepartments(result.data.filter(d => d.isActive));
      }
    } catch (err) {
      console.error('Failed to fetch departments list', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setGroups(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch groups list', err);
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/auth/admins', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setAdmins(result.data.filter(u => u.role === 'admin'));
      }
    } catch (err) {
      console.error('Failed to fetch staff admins', err);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchRules();
      fetchCategories();
      fetchDepartments();
      fetchGroups();
      fetchAdmins();
    }
  }, [user]);

  const handleAddLevel = () => {
    const nextLevel = levels.length + 1;
    setLevels([
      ...levels,
      { 
        level: nextLevel, 
        department: '', 
        durationHours: 24, 
        description: '', 
        targetType: 'group', 
        targetId: '', 
        responseSlaMinutes: 60, 
        resolutionSlaMinutes: 480, 
        warningThresholds: '50, 75, 90', 
        isParallelBranch: false,
        responseSlaActions: [],
        resolutionSlaActions: []
      }
    ]);
  };

  const handleRemoveLevel = (index) => {
    if (levels.length === 1) {
      addToast('Validation', 'A workflow must have at least one level.', 'error');
      return;
    }
    const updated = levels
      .filter((_, idx) => idx !== index)
      .map((level, idx) => ({ ...level, level: idx + 1 }));
    setLevels(updated);
  };

  const handleLevelChange = (index, key, value) => {
    const updated = [...levels];
    updated[index][key] = value;

    // Autofill department if department target selected
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

  const resetForm = () => {
    setSelectedDepartment('');
    setSelectedCategory('');
    setWorkflowName('');
    setIsActive(true);
    setLevels([{ 
      level: 1, 
      department: '', 
      durationHours: 24, 
      description: '', 
      targetType: 'group', 
      targetId: '', 
      responseSlaMinutes: 60, 
      resolutionSlaMinutes: 480, 
      warningThresholds: '50, 75, 90', 
      isParallelBranch: false,
      responseSlaActions: [],
      resolutionSlaActions: []
    }]);
    setIsEditing(false);
    setEditId(null);
  };

  const handleEditClick = (rule) => {
    setIsEditing(true);
    setEditId(rule._id);
    
    const deptId = rule.departmentId?._id || rule.departmentId;
    const catId = rule.categoryId?._id || rule.categoryId;
    
    setSelectedDepartment(deptId || '');
    setSelectedCategory(catId || '');
    
    setWorkflowName(rule.workflowName);
    setIsActive(rule.isActive);
    
    setLevels(rule.levels.map(l => ({ 
      ...l,
      targetType: l.targetType || 'group',
      targetId: l.targetId || (l.targetType === 'department' ? l.department : ''),
      responseSlaMinutes: l.responseSlaMinutes || 0,
      resolutionSlaMinutes: l.resolutionSlaMinutes || 0,
      warningThresholds: Array.isArray(l.warningThresholds) ? l.warningThresholds.join(', ') : '50, 75, 90',
      isParallelBranch: !!l.isParallelBranch,
      responseSlaActions: l.responseSlaActions || [],
      resolutionSlaActions: l.resolutionSlaActions || []
    })));
  };

  const handleDeleteClick = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the escalation workflow for "${name}"?`)) return;

    try {
      const response = await fetch(`/api/escalations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Rule Deleted', 'Escalation rule deleted successfully', 'success');
        fetchRules();
        if (editId === id) resetForm();
      } else {
        addToast('Error', result.message || 'Failed to delete escalation rule', 'error');
      }
    } catch (err) {
      addToast('Error', 'Communication failure', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCategory) {
      addToast('Validation Error', 'Category is required', 'error');
      return;
    }
    if (!workflowName.trim()) {
      addToast('Validation Error', 'Workflow name is required', 'error');
      return;
    }

    const errors = [];
    const payloadLevels = levels.map((l) => {
      // Validate target specified
      if (l.targetType === 'department' && !l.department) {
        errors.push(`Level ${l.level} targets Department but none is selected.`);
      }
      if (['group', 'user', 'role'].includes(l.targetType) && !l.targetId) {
        errors.push(`Level ${l.level} targets ${l.targetType} but no target ID or role is selected.`);
      }

      let thresholds = [50, 75, 90];
      if (typeof l.warningThresholds === 'string') {
        thresholds = l.warningThresholds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      } else if (Array.isArray(l.warningThresholds)) {
        thresholds = l.warningThresholds;
      }

      return {
        level: l.level,
        department: l.targetType === 'department' ? l.department : '',
        durationHours: l.durationHours || 24,
        description: l.description,
        targetType: l.targetType,
        targetId: l.targetId || (l.targetType === 'department' ? l.department : ''),
        responseSlaMinutes: Number(l.responseSlaMinutes || 0),
        resolutionSlaMinutes: Number(l.resolutionSlaMinutes || 0),
        warningThresholds: thresholds,
        isParallelBranch: !!l.isParallelBranch,
        responseSlaActions: l.responseSlaActions || [],
        resolutionSlaActions: l.resolutionSlaActions || []
      };
    });

    if (errors.length > 0) {
      addToast('Validation Failed', errors[0], 'error');
      return;
    }

    setIsSaving(true);
    try {
      const url = isEditing ? `/api/escalations/${editId}` : '/api/escalations';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          departmentId: selectedDepartment,
          categoryId: selectedCategory,
          workflowName: workflowName.trim(),
          levels: payloadLevels,
          isActive
        })
      });

      const result = await response.json();
      if (result.success) {
        addToast(
          isEditing ? 'Workflow Updated' : 'Workflow Configured',
          `Escalation workflow saved successfully`,
          'success'
        );
        resetForm();
        fetchRules();
      } else {
        addToast('Save Failed', result.message || 'Error saving workflow', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedDeptDocForDiagram = departments.find(d => d._id === selectedDepartment);
  const startingDeptName = selectedDeptDocForDiagram ? selectedDeptDocForDiagram.name : 'Not Set';
  const deptCategories = selectedDeptDocForDiagram ? selectedDeptDocForDiagram.categories || [] : [];

  return (
    <div className="detail-grid db-container">
      
      {/* Rule Form Card */}
      <div className="form-card er-form-card-override" style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className="er-header">
          <h2 className="er-header-title">
            <Layers size={22} className="text-accent" />
            {isEditing ? 'Modify Escalation Workflow' : 'Configure Escalation Workflow'}
          </h2>
          {isEditing && (
            <button 
              type="button" 
              onClick={resetForm} 
              className="btn btn-secondary er-cancel-btn"
            >
              <X size={16} /> Cancel
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="er-form">
          
          <div className="er-grid-2col">
            <div className="input-group">
              <label>Target Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedCategory('');
                }}
                disabled={isEditing}
                className="er-input-style"
                required
              >
                <option value="">-- Choose Department --</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Target Complaint Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  const cat = deptCategories.find(c => c._id === e.target.value);
                  if (cat) {
                    setWorkflowName(`${cat.name} Escalation`);
                  }
                }}
                disabled={isEditing || !selectedDepartment}
                className="er-input-style"
                required
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
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    );
                  })}
              </select>
            </div>
          </div>

          <div className="er-grid-15-1col-center">
            <div className="input-group">
              <label>Workflow Name</label>
              <input
                type="text"
                placeholder="e.g. IT Helpdesk Escalation"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="er-input-style"
                required
              />
            </div>

            <div className="er-checkbox-container">
              <input 
                type="checkbox" 
                id="isActive" 
                checked={isActive} 
                onChange={(e) => setIsActive(e.target.checked)}
                className="er-checkbox-input"
              />
              <label htmlFor="isActive" className="er-checkbox-label">Active Workflow (Processed by Engine)</label>
            </div>
          </div>

          <div className="er-section-divider">
            <div className="er-levels-header">
              <h3 className="er-levels-title">Escalation Levels Chain</h3>
              <button
                type="button"
                onClick={handleAddLevel}
                className="btn btn-primary er-add-level-btn"
              >
                <Plus size={16} /> Add Level
              </button>
            </div>

            <div className="er-levels-list">
              {levels.map((level, idx) => (
                <div key={idx} className="er-level-builder-card p-3 mb-3" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="badge bg-accent" style={{ fontWeight: 800 }}>Level {level.level}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLevel(idx)}
                      className="btn btn-link text-danger p-0"
                    >
                      <Trash2 size={16} /> Remove
                    </button>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Type</label>
                      <select
                        value={level.targetType}
                        onChange={(e) => handleLevelChange(idx, 'targetType', e.target.value)}
                        className="form-control form-control-sm"
                      >
                        {level.targetType === 'department' && (
                          <option value="department">Department (Legacy)</option>
                        )}
                        <option value="group">Support Group</option>
                        <option value="user">Specific User</option>
                        <option value="role">Administrative Role</option>
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Assignment</label>
                      {level.targetType === 'department' && (
                        <select
                          value={level.department}
                          onChange={(e) => handleLevelChange(idx, 'department', e.target.value)}
                          className="form-control form-control-sm"
                          required
                        >
                          <option value="">-- Choose Dept --</option>
                          {departments.map((dept) => (
                            <option key={dept._id} value={dept.name}>{dept.name}</option>
                          ))}
                        </select>
                      )}

                      {level.targetType === 'group' && (
                        <select
                          value={level.targetId}
                          onChange={(e) => handleLevelChange(idx, 'targetId', e.target.value)}
                          className="form-control form-control-sm"
                          required
                        >
                          <option value="">-- Choose Group --</option>
                          {groups.map((group) => (
                            <option key={group._id} value={group._id}>{group.name}</option>
                          ))}
                        </select>
                      )}

                      {level.targetType === 'user' && (
                        <select
                          value={level.targetId}
                          onChange={(e) => handleLevelChange(idx, 'targetId', e.target.value)}
                          className="form-control form-control-sm"
                          required
                        >
                          <option value="">-- Choose Agent --</option>
                          {admins.map((admin) => (
                            <option key={admin._id} value={admin._id}>{admin.name}</option>
                          ))}
                        </select>
                      )}

                      {level.targetType === 'role' && (
                        <select
                          value={level.targetId}
                          onChange={(e) => handleLevelChange(idx, 'targetId', e.target.value)}
                          className="form-control form-control-sm"
                          required
                        >
                          <option value="">-- Choose Role --</option>
                          <option value="agent">Support Agent</option>
                          <option value="lead">Team Lead</option>
                          <option value="manager">Department Manager</option>
                          <option value="director">Executive Director</option>
                        </select>
                      )}
                    </div>

                    <div className="col-md-5">
                      <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Level Description</label>
                      <input
                        type="text"
                        placeholder="e.g. Escalate to Manager Review"
                        value={level.description}
                        onChange={(e) => handleLevelChange(idx, 'description', e.target.value)}
                        className="form-control form-control-sm"
                      />
                    </div>
                  </div>

                  <div className="row g-3 mt-1">
                    <div className="col-md-2">
                      <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Response SLA (Mins)</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        value={level.responseSlaMinutes}
                        onChange={(e) => handleLevelChange(idx, 'responseSlaMinutes', e.target.value)}
                      />
                    </div>

                    <div className="col-md-2">
                      <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Resolution SLA (Mins)</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        value={level.resolutionSlaMinutes}
                        onChange={(e) => handleLevelChange(idx, 'resolutionSlaMinutes', e.target.value)}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Escalation Timeout (Mins)</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control form-control-sm"
                        value={Math.round((level.durationHours || 24) * 60)}
                        onChange={(e) => handleLevelChange(idx, 'durationHours', Number(e.target.value) / 60)}
                      />
                    </div>

                    <div className="col-md-2">
                      <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Warnings (%)</label>
                      <input
                        type="text"
                        placeholder="50, 75, 90"
                        className="form-control form-control-sm"
                        value={level.warningThresholds}
                        onChange={(e) => handleLevelChange(idx, 'warningThresholds', e.target.value)}
                      />
                    </div>

                    <div className="col-md-3 d-flex align-items-center mt-4">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`parallelCheck_${idx}`}
                          checked={level.isParallelBranch}
                          onChange={(e) => handleLevelChange(idx, 'isParallelBranch', e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor={`parallelCheck_${idx}`} style={{ fontSize: '11px' }}>
                          Parallel Escalate
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="row g-3 mt-2">
                    <div className="col-md-6">
                      <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Response SLA Breach Actions (Default: All Actions)
                      </label>
                      <div className="d-flex flex-wrap gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.01)', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        {[
                          { label: 'Escalate Level', value: 'LEVEL_ESCALATION' },
                          { label: 'Upgrade Priority', value: 'PRIORITY_UPGRADE' },
                          { label: 'Notify Manager', value: 'NOTIFY_MANAGER' },
                          { label: 'Notify Assigned', value: 'NOTIFY_ASSIGNED' },
                          { label: 'Mark Attention', value: 'MARK_ATTENTION' }
                        ].map(act => {
                          const isChecked = (level.responseSlaActions || []).includes(act.value);
                          return (
                            <label key={act.value} className="d-flex align-items-center gap-1" style={{ fontSize: '10px', cursor: 'pointer', margin: 0, fontWeight: 500, color: 'var(--text-primary)' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const currentList = level.responseSlaActions || [];
                                  const newList = e.target.checked 
                                    ? [...currentList, act.value]
                                    : currentList.filter(v => v !== act.value);
                                  handleLevelChange(idx, 'responseSlaActions', newList);
                                }}
                              />
                              {act.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Resolution SLA Breach Actions (Default: All Actions)
                      </label>
                      <div className="d-flex flex-wrap gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.01)', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        {[
                          { label: 'Escalate Level', value: 'LEVEL_ESCALATION' },
                          { label: 'Upgrade Priority', value: 'PRIORITY_UPGRADE' },
                          { label: 'Notify Dept Head', value: 'NOTIFY_DEPT_HEAD' },
                          { label: 'Notify Assigned', value: 'NOTIFY_ASSIGNED' },
                          { label: 'Increase Risk', value: 'INCREASE_RISK_SCORE' },
                          { label: 'Flag Dashboard', value: 'FLAG_DASHBOARD' }
                        ].map(act => {
                          const isChecked = (level.resolutionSlaActions || []).includes(act.value);
                          return (
                            <label key={act.value} className="d-flex align-items-center gap-1" style={{ fontSize: '10px', cursor: 'pointer', margin: 0, fontWeight: 500, color: 'var(--text-primary)' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const currentList = level.resolutionSlaActions || [];
                                  const newList = e.target.checked 
                                    ? [...currentList, act.value]
                                    : currentList.filter(v => v !== act.value);
                                  handleLevelChange(idx, 'resolutionSlaActions', newList);
                                }}
                              />
                              {act.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow Diagram Preview */}
          <div className="er-diagram-container">
            <h4 className="er-diagram-title">
              <Play size={14} className="text-accent" /> Live Escalation Path Diagram Preview
            </h4>
            
            <div className="er-diagram-nodes-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <div className="er-diagram-start-node">
                <span className="er-diagram-node-subtitle">Filing Node</span>
                <span className="er-diagram-node-name">{startingDeptName}</span>
              </div>

              {levels.map((level, idx) => {
                let targetText = 'Select Target';
                if (level.targetType === 'department') targetText = level.department || 'Dept';
                else if (level.targetType === 'group') {
                  const grp = groups.find(g => g._id === level.targetId);
                  targetText = grp ? grp.name : 'Group';
                } else if (level.targetType === 'user') {
                  const u = admins.find(a => a._id === level.targetId);
                  targetText = u ? u.name : 'User';
                } else if (level.targetType === 'role') {
                  targetText = level.targetId ? `Role: ${level.targetId}` : 'Role';
                }

                return (
                  <React.Fragment key={idx}>
                    <ArrowRight size={18} className="text-accent" />
                    
                    <div className="er-diagram-level-node" style={{ border: level.isParallelBranch ? '1px dashed var(--accent-color)' : '1px solid var(--border-color)' }}>
                      <span className="er-diagram-level-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {level.isParallelBranch && <GitMerge size={10} />}
                        L{level.level} ({formatDuration(level.durationHours || 24)})
                      </span>
                      <span className="er-diagram-node-name">
                        {targetText}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}

              <ArrowRight size={18} className="text-muted" />
              <div className="er-diagram-end-node">
                <span className="er-diagram-end-text">
                  <CheckCircle size={14} /> Resolved
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary er-submit-btn w-100 py-2 d-flex align-items-center justify-content-center gap-2"
            disabled={isSaving}
            style={{ fontWeight: 800 }}
          >
            {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            {isEditing ? 'Update Escalation Workflow' : 'Activate Escalation Rule'}
          </button>
        </form>
      </div>

      {/* Rules Display List */}
      <div>
        <div className="er-list-header">
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Escalation Workflows</h2>
          <span className="er-list-count">
            {rules.length} Rule(s)
          </span>
        </div>

        {loading ? (
          <div className="er-loading-wrapper text-center py-5">
            <RefreshCw className="animate-spin text-accent" size={32} />
          </div>
        ) : rules.length === 0 ? (
          <div className="er-empty-state">
            <AlertCircle size={32} className="er-empty-icon" />
            <p className="er-empty-text">No automatic escalation rules have been configured yet.</p>
          </div>
        ) : (
          <div className="er-rules-list">
            {rules.map((rule) => (
              <div 
                key={rule._id} 
                className="card er-rule-card"
              >
                <div className="er-rule-card-header">
                  <div>
                    <span className="er-rule-card-category">
                      Dept: {rule.departmentId?.name || 'General'} | Category: {rule.categoryName}
                    </span>
                    <h3 className="er-rule-card-title">{rule.workflowName}</h3>
                  </div>

                  <div className="er-rule-card-actions">
                    <span style={{ 
                      padding: '3px 8px', 
                      borderRadius: '8px', 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      backgroundColor: rule.isActive ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                      color: rule.isActive ? '#34d399' : '#f87171' 
                    }}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                    
                    <button 
                      onClick={() => handleEditClick(rule)} 
                      className="er-rule-card-btn"
                      title="Edit Workflow"
                    >
                      <Edit2 size={16} />
                    </button>
                    
                    <button 
                      onClick={() => handleDeleteClick(rule._id, rule.categoryName)} 
                      className="er-rule-card-btn-delete"
                      title="Delete Workflow"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="er-card-levels-preview">
                  {rule.levels.map((lvl) => {
                    let targetValText = 'Level ' + lvl.level;
                    if (lvl.targetType === 'department') targetValText = `Dept: ${lvl.department}`;
                    else if (lvl.targetType === 'group') targetValText = `Group`;
                    else if (lvl.targetType === 'user') targetValText = `User`;
                    else if (lvl.targetType === 'role') targetValText = `Role: ${lvl.targetId}`;

                    return (
                      <div key={lvl._id} className="er-card-level-preview-row">
                        <div className="er-card-level-preview-badge">
                          {lvl.level}
                        </div>
                        
                        <div className="er-card-level-preview-info">
                          <span className="er-card-level-preview-dept">{targetValText}</span>
                          <span className="er-card-level-preview-duration" style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} /> Timeout: {formatDuration(lvl.durationHours || 24)} | Overrides: Resp {lvl.responseSlaMinutes}m / Res {lvl.resolutionSlaMinutes}m
                            {lvl.isParallelBranch && <span className="badge bg-accent" style={{ fontSize: '9px', padding: '1px 3px' }}>Parallel</span>}
                          </span>
                          {(lvl.responseSlaActions?.length > 0 || lvl.resolutionSlaActions?.length > 0) && (
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '3px' }}>
                              {lvl.responseSlaActions?.length > 0 && `Resp Actions: ${lvl.responseSlaActions.map(a => a.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')).join(', ')}`}
                              {lvl.responseSlaActions?.length > 0 && lvl.resolutionSlaActions?.length > 0 && ' | '}
                              {lvl.resolutionSlaActions?.length > 0 && `Res Actions: ${lvl.resolutionSlaActions.map(a => a.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')).join(', ')}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default EscalationRules;
