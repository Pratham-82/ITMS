import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import '../styles/WorkflowDesigner.css';
import {
  Plus, Trash2, Save, Layers, Play, RefreshCw, GitBranch, X, HelpCircle, ArrowRight, Clock
} from 'lucide-react';

const WorkflowDesigner = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [expandedDepts, setExpandedDepts] = useState({});

  const toggleDept = (deptName) => {
    setExpandedDepts(prev => ({
      ...prev,
      [deptName]: !prev[deptName]
    }));
  };

  // Form States for adding state
  const [newStateName, setNewStateName] = useState('');
  const [newStateDesc, setNewStateDesc] = useState('');

  // Modal States for adding transition
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [composeTransitionFrom, setComposeTransitionFrom] = useState('');
  const [composeTransitionTo, setComposeTransitionTo] = useState('');
  const [composeTransitionLabel, setComposeTransitionLabel] = useState('');
  const [composeTransitionRole, setComposeTransitionRole] = useState('admin');
  const [composeTransitionDept, setComposeTransitionDept] = useState('');
  const [composeTransitionDuration, setComposeTransitionDuration] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Categories
      const catRes = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const catResult = await catRes.json();
      if (catResult.success) {
        setCategories(catResult.data);
        if (catResult.data.length > 0) {
          setSelectedCategoryId(catResult.data[0]._id);
        }
      }

      // Fetch Departments
      const deptRes = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const deptResult = await deptRes.json();
      if (deptResult.success) {
        setDepartments(deptResult.data.filter(d => d.isActive));
      }
    } catch (err) {
      addToast('Error', 'Failed to load configuration data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflow = async (categoryId) => {
    if (!categoryId) return;
    try {
      const response = await fetch(`/api/workflows/category/${categoryId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setWorkflow(result.data);
      } else {
        setWorkflow(null);
      }
    } catch (err) {
      addToast('Error', 'Failed to load workflow rules', 'error');
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCategoryId) {
      fetchWorkflow(selectedCategoryId);
      resetStateForm();
      closeModal();
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    if (selectedCategoryId && categories.length > 0) {
      const selectedCat = categories.find(c => c._id === selectedCategoryId);
      if (selectedCat) {
        const dept = selectedCat.departmentName || 'Global Blueprints';
        setExpandedDepts(prev => ({
          ...prev,
          [dept]: true
        }));
      }
    }
  }, [selectedCategoryId, categories]);

  const resetStateForm = () => {
    setNewStateName('');
    setNewStateDesc('');
  };

  const closeModal = () => {
    setShowTransitionModal(false);
    setComposeTransitionFrom('');
    setComposeTransitionTo('');
    setComposeTransitionLabel('');
    setComposeTransitionRole('admin');
    setComposeTransitionDept('');
    setComposeTransitionDuration('');
  };

  const handleCreateWorkflow = async () => {
    const activeCategory = categories.find(c => c._id === selectedCategoryId);
    if (!activeCategory) return;

    try {
      setIsSaving(true);
      const defaultPayload = {
        workflowName: `${activeCategory.name} Workflow`,
        categoryId: selectedCategoryId,
        states: [
          { name: 'Pending', description: 'Newly filed complaint', isReserved: true },
          { name: 'Investigating', description: 'Complaint is under active review', isReserved: false },
          { name: 'On Hold', description: 'Complaint is paused temporarily', isReserved: false },
          { name: 'Awaiting Feedback', description: 'Awaiting citizen feedback', isReserved: true },
          { name: 'Closed', description: 'Complaint has been closed', isReserved: true },
          { name: 'Reopen Requested', description: 'Citizen requested to reopen the issue', isReserved: true }
        ],
        transitions: [
          { fromState: 'Pending', toState: 'Investigating', label: 'Start Investigation', allowedRole: 'admin', actions: {} },
          { fromState: 'Investigating', toState: 'On Hold', label: 'Place on Hold', allowedRole: 'admin', actions: {} },
          { fromState: 'On Hold', toState: 'Investigating', label: 'Resume Investigation', allowedRole: 'admin', actions: {} },
          { fromState: 'Investigating', toState: 'Awaiting Feedback', label: 'Mark as Resolved', allowedRole: 'admin', actions: {} },
          { fromState: 'Awaiting Feedback', toState: 'Closed', label: 'Submit CSAT & Close', allowedRole: 'citizen', actions: {} },
          { fromState: 'Awaiting Feedback', toState: 'Reopen Requested', label: 'Request Reopen', allowedRole: 'citizen', actions: {} },
          { fromState: 'Reopen Requested', toState: 'Investigating', label: 'Approve Reopen', allowedRole: 'admin', actions: {} },
          { fromState: 'Reopen Requested', toState: 'Closed', label: 'Reject Reopen', allowedRole: 'admin', actions: {} }
        ]
      };

      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(defaultPayload)
      });

      const result = await response.json();
      if (result.success) {
        addToast('Workflow Created', `Workflow initialized for "${activeCategory.name}"`, 'success');
        fetchWorkflow(selectedCategoryId);
      } else {
        addToast('Error', result.message || 'Failed to initialize workflow', 'error');
      }
    } catch (err) {
      addToast('Error', 'Communication failure', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddState = (e) => {
    e.preventDefault();
    if (!newStateName.trim()) {
      addToast('Validation', 'State name is required', 'error');
      return;
    }

    const trimmedName = newStateName.trim();
    const exists = workflow.states.some(s => s.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      addToast('Validation', `State "${trimmedName}" already exists in this workflow`, 'error');
      return;
    }

    const updatedStates = [
      ...workflow.states,
      { name: trimmedName, description: newStateDesc.trim(), isReserved: false }
    ];

    setWorkflow({
      ...workflow,
      states: updatedStates
    });

    resetStateForm();
    addToast('State Added', `Temporary state "${trimmedName}" added. Click Save to persist.`, 'info');
  };

  const handleRemoveState = (stateName) => {
    const targetState = workflow.states.find(s => s.name === stateName);
    if (targetState?.isReserved) {
      addToast('Error', `Cannot delete reserved system state "${stateName}"`, 'error');
      return;
    }

    const updatedStates = workflow.states.filter(s => s.name !== stateName);
    const updatedTransitions = (workflow.transitions || []).filter(
      t => t.fromState !== stateName && t.toState !== stateName
    );

    setWorkflow({
      ...workflow,
      states: updatedStates,
      transitions: updatedTransitions
    });

    addToast('State Removed', `State "${stateName}" and its links removed locally. Save to persist.`, 'info');
  };

  const handleModalTransitionSubmit = (e) => {
    e.preventDefault();
    if (!composeTransitionTo || !composeTransitionLabel.trim()) {
      addToast('Validation', 'Target state and button label are required.', 'error');
      return;
    }

    const labelTrimmed = composeTransitionLabel.trim();

    // Check if transition already exists
    const exists = (workflow.transitions || []).some(
      t => t.fromState === composeTransitionFrom && t.toState === composeTransitionTo
    );
    if (exists) {
      addToast('Validation', `Transition from "${composeTransitionFrom}" to "${composeTransitionTo}" already exists`, 'error');
      return;
    }

    const actions = {};
    if (composeTransitionDept) actions.autoRouteToDepartment = composeTransitionDept;
    if (composeTransitionDuration) actions.escalationDurationHours = Number(composeTransitionDuration);

    const updatedTransitions = [
      ...(workflow.transitions || []),
      {
        fromState: composeTransitionFrom,
        toState: composeTransitionTo,
        label: labelTrimmed,
        allowedRole: composeTransitionRole,
        actions
      }
    ];

    setWorkflow({
      ...workflow,
      transitions: updatedTransitions
    });

    closeModal();
    addToast('Transition Added', 'Transition linked locally. Click Save to persist.', 'info');
  };

  const handleRemoveTransition = (idx) => {
    const updatedTransitions = (workflow.transitions || []).filter((_, i) => i !== idx);
    setWorkflow({
      ...workflow,
      transitions: updatedTransitions
    });
    addToast('Transition Removed', 'Transition link removed locally.', 'info');
  };

  const handleSaveWorkflow = async () => {
    try {
      setIsSaving(true);
      const method = workflow.isDefaultFallback ? 'POST' : 'PUT';
      const endpoint = workflow.isDefaultFallback ? '/api/workflows' : `/api/workflows/${workflow._id}`;

      // Clean default fallback keys
      const payload = {
        workflowName: workflow.workflowName,
        categoryId: workflow.categoryId,
        states: workflow.states.map(s => ({ name: s.name, description: s.description })),
        transitions: (workflow.transitions || []).map(t => ({
          fromState: t.fromState,
          toState: t.toState,
          label: t.label,
          allowedRole: t.allowedRole,
          actions: t.actions
        }))
      };

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        addToast('Success', 'Workflow layout saved successfully', 'success');
        fetchWorkflow(selectedCategoryId);
      } else {
        addToast('Error', result.message || 'Failed to save workflow', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server error while saving workflow', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (workflow.isDefaultFallback) return;
    if (!window.confirm('Are you sure you want to delete this custom workflow? Active complaints will fall back to default system rules.')) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/workflows/${workflow._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Success', 'Custom workflow deleted, reverted to system defaults', 'success');
        fetchWorkflow(selectedCategoryId);
      } else {
        addToast('Error', result.message || 'Failed to delete workflow', 'error');
      }
    } catch (err) {
      addToast('Error', 'Communication failure', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="workflow-designer-container">
      <div className="workflow-header">
        <div>
          <h2>Workflow Designer</h2>
          <p className="workflow-subtitle">Configure custom ticket lifecycles, states, and transition rules per category.</p>
        </div>
      </div>

      <div className="workflow-grid-layout">
        {/* Category List Panel */}
        <div className="category-selector-panel">
          <h3>Complaint Categories</h3>
          <p className="workflow-subtitle" style={{ marginBottom: '12px' }}>Select a category to design its states:</p>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <RefreshCw className="spinning" size={24} />
            </div>
          ) : (
            <div className="category-list">
              {(() => {
                // Group categories by departmentName
                const categoriesByDept = {};
                categories.forEach(cat => {
                  const dept = cat.departmentName || 'Global Blueprints';
                  if (!categoriesByDept[dept]) {
                    categoriesByDept[dept] = [];
                  }
                  categoriesByDept[dept].push(cat);
                });

                // Sort department names
                const deptNames = Object.keys(categoriesByDept).sort((a, b) => {
                  if (a === 'Global Blueprints') return -1;
                  if (b === 'Global Blueprints') return 1;
                  return a.localeCompare(b);
                });

                return deptNames.map((deptName) => {
                  const isExpanded = expandedDepts[deptName] !== false;
                  const deptCats = categoriesByDept[deptName];
                  
                  return (
                    <div key={deptName} className="dept-group-container">
                      <div 
                        className="dept-group-header"
                        onClick={() => toggleDept(deptName)}
                      >
                        <span>{deptName} ({deptCats.length})</span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="dept-group-list">
                          {deptCats.map((cat) => (
                            <button
                              key={cat._id}
                              className={`category-item-btn ${selectedCategoryId === cat._id ? 'active' : ''}`}
                              onClick={() => setSelectedCategoryId(cat._id)}
                              style={{ padding: '10px 12px' }}
                            >
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cat.name}</div>
                              </div>
                              <GitBranch size={14} style={{ opacity: 0.7 }} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Workspace Panel */}
        <div className="workflow-workspace">
          {!workflow ? (
            <div className="empty-workspace-state">
              <RefreshCw className="spinning" size={32} />
              <p style={{ marginTop: '12px' }}>Loading workspace...</p>
            </div>
          ) : workflow.isDefaultFallback ? (
            <div className="empty-workspace-state">
              <div className="empty-state-icon">
                <Layers size={32} />
              </div>
              <h3>No Custom Workflow Designed</h3>
              <p style={{ maxWidth: '450px', margin: '8px auto 20px' }}>
                This category currently runs on standard fallback status rules. Initialize a custom workflow to add dynamic states and transition triggers.
              </p>
              <button
                className="primary-btn"
                onClick={handleCreateWorkflow}
                disabled={isSaving}
              >
                <Plus size={16} />
                Create Custom Workflow
              </button>
            </div>
          ) : (
            <div>
              {/* Workspace Header */}
              <div className="workspace-actions-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="text"
                    className="workflow-name-input"
                    value={workflow.workflowName}
                    onChange={(e) => setWorkflow({ ...workflow, workflowName: e.target.value })}
                  />
                  <span className="category-badge-pill">{workflow.categoryName}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="secondary-btn"
                    onClick={handleDeleteWorkflow}
                    disabled={isSaving}
                    style={{ color: '#ef4444' }}
                  >
                    <Trash2 size={16} />
                    Reset to Default
                  </button>
                  <button
                    className="primary-btn"
                    onClick={handleSaveWorkflow}
                    disabled={isSaving}
                  >
                    <Save size={16} />
                    {isSaving ? 'Saving...' : 'Save Workflow Layout'}
                  </button>
                </div>
              </div>

              {/* States Panel */}
              <div className="workspace-sections" style={{ gridTemplateColumns: '1fr' }}>
                <div className="builder-section-box">
                  <div className="section-box-header">
                    <span className="section-box-title">
                      <Layers size={18} style={{ color: 'var(--accent-color)' }} />
                      Workflow Status States (Nodes)
                    </span>
                  </div>

                  <div className="states-grid-container" style={{ maxHeight: 'none' }}>
                    {workflow.states.map((st) => (
                      <div key={st.name} className="state-designer-card">
                        <div className="state-card-info">
                          <span className="state-card-title">
                            {st.name}
                            {st.isReserved && <span className="reserved-badge">System Reserved</span>}
                          </span>
                          {st.description && <span className="state-card-desc">{st.description}</span>}
                        </div>
                        {!st.isReserved && (
                          <button
                            className="trash-btn"
                            onClick={() => handleRemoveState(st.name)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add State Form */}
                  <form onSubmit={handleAddState} className="add-state-form" style={{ marginTop: '16px' }}>
                    <input
                      type="text"
                      placeholder="State Name (e.g. Diagnosing)"
                      className="inline-input"
                      style={{ flex: 1 }}
                      value={newStateName}
                      onChange={(e) => setNewStateName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Short Description"
                      className="inline-input"
                      style={{ flex: 1.5 }}
                      value={newStateDesc}
                      onChange={(e) => setNewStateDesc(e.target.value)}
                    />
                    <button type="submit" className="primary-btn" style={{ padding: '8px 16px' }}>
                      <Plus size={14} /> Add State
                    </button>
                  </form>
                </div>
              </div>

              {/* Visual Flowchart & Integrated Transitions Composer */}
              <div className="visual-flowchart-board" style={{ marginTop: '30px' }}>
                <span className="visual-flowchart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Play size={18} style={{ color: 'var(--accent-color)' }} />
                    Interactive Workflow Transitions Builder
                  </span>
                </span>
                
                <div className="flowchart-nodes-container" style={{ gap: '20px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                  {workflow.states.map((st) => {
                    const outgoingTransitions = (workflow.transitions || []).filter(t => t.fromState === st.name);
                    return (
                      <div 
                        key={st.name} 
                        className="flowchart-node-box" 
                        style={{ 
                          minWidth: '240px', 
                          padding: '16px', 
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          background: 'rgba(30, 41, 59, 0.4)',
                          borderColor: 'rgba(255,255,255,0.05)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{st.name}</span>
                          <span className="reserved-badge" style={{ margin: 0, fontSize: '0.6rem', padding: '1px 4px' }}>
                            {st.isReserved ? 'Reserved' : 'Custom'}
                          </span>
                        </div>
                        
                        {/* Transitions List Inside Node Card */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1, marginBottom: '12px' }}>
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                            OUTGOING TRANSITIONS:
                          </span>
                          
                          {outgoingTransitions.length === 0 ? (
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', padding: '4px 0' }}>
                              No outgoing links
                            </span>
                          ) : (
                            outgoingTransitions.map((tr, idx) => {
                              const globalIdx = (workflow.transitions || []).findIndex(
                                t => t.fromState === tr.fromState && t.toState === tr.toState
                              );
                              return (
                                <div 
                                  key={idx} 
                                  style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    background: 'rgba(255,255,255,0.02)', 
                                    padding: '6px 8px', 
                                    borderRadius: '4px', 
                                    border: '1px solid rgba(255,255,255,0.04)' 
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      ➔ <span className="text-accent" style={{ color: 'var(--accent-color)' }}>{tr.toState}</span>
                                    </span>
                                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                                      "{tr.label}" ({tr.allowedRole})
                                    </span>
                                    {(tr.actions?.autoRouteToDepartment || tr.actions?.escalationDurationHours) && (
                                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                                        {tr.actions.autoRouteToDepartment && (
                                          <span style={{ fontSize: '0.6rem', color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '1px 3px', borderRadius: '2px' }}>
                                            Route: {tr.actions.autoRouteToDepartment}
                                          </span>
                                        )}
                                        {tr.actions.escalationDurationHours && (
                                          <span style={{ fontSize: '0.6rem', color: '#3b82f6', background: 'rgba(59,130,246,0.08)', padding: '1px 3px', borderRadius: '2px' }}>
                                            SLA: {tr.actions.escalationDurationHours}h
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className="trash-btn"
                                    onClick={() => handleRemoveTransition(globalIdx)}
                                    style={{ padding: '2px' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Trigger button for composer modal */}
                        <button
                          type="button"
                          className="secondary-btn"
                          style={{ 
                            width: '100%', 
                            padding: '6px 8px', 
                            fontSize: '0.75rem', 
                            justifyContent: 'center',
                            marginTop: 'auto',
                            border: '1px solid rgba(255,255,255,0.05)',
                            background: 'rgba(255,255,255,0.01)'
                          }}
                          onClick={() => {
                            setComposeTransitionFrom(st.name);
                            setShowTransitionModal(true);
                          }}
                        >
                          <Plus size={12} /> Add Transition Link
                        </button>

                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Optimized Modal Composer Overlay */}
      {showTransitionModal && (
        <div className="transition-modal-overlay">
          <div className="transition-modal-content">
            <div className="modal-header">
              <h3>Create Link Outgoing from "{composeTransitionFrom}"</h3>
              <button className="close-btn" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleModalTransitionSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label">To State (Target Status)</label>
                <select
                  className="form-control"
                  value={composeTransitionTo}
                  onChange={(e) => setComposeTransitionTo(e.target.value)}
                  required
                >
                  <option value="">Select target status...</option>
                  {workflow.states
                    .filter(s => s.name !== composeTransitionFrom)
                    .map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Transition Label (Button Text)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Start Investigation, Mark Resolved"
                  value={composeTransitionLabel}
                  onChange={(e) => setComposeTransitionLabel(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role Authorized to Click</label>
                <select
                  className="form-control"
                  value={composeTransitionRole}
                  onChange={(e) => setComposeTransitionRole(e.target.value)}
                >
                  <option value="admin">Admin Only</option>
                  <option value="citizen">Citizen Only</option>
                  <option value="any">Any Role</option>
                </select>
              </div>

              <div style={{ borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '12px', marginTop: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>Optional Auto-Actions:</span>
                
                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label className="form-label">Auto-Route to Department</label>
                  <select
                    className="form-control"
                    value={composeTransitionDept}
                    onChange={(e) => setComposeTransitionDept(e.target.value)}
                  >
                    <option value="">No Auto-Routing...</option>
                    {departments.map(d => (
                      <option key={d._id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reset SLA Duration Target (Hours)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 24, 48"
                    value={composeTransitionDuration}
                    onChange={(e) => setComposeTransitionDuration(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Link Transition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowDesigner;
