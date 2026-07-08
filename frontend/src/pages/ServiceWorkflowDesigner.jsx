import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import '../styles/WorkflowDesigner.css'; // Reuse visual styling to match theme
import {
  Plus, Trash2, Save, Play, RefreshCw, GitBranch, X, HelpCircle, ArrowRight, Layers
} from 'lucide-react';

const ServiceWorkflowDesigner = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form States for creating a new workflow
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form States for adding state
  const [newStateName, setNewStateName] = useState('');
  const [newStateDesc, setNewStateDesc] = useState('');

  // Modal States for adding transition
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [composeTransitionFrom, setComposeTransitionFrom] = useState('');
  const [composeTransitionTo, setComposeTransitionTo] = useState('');
  const [composeTransitionLabel, setComposeTransitionLabel] = useState('');
  const [composeTransitionRole, setComposeTransitionRole] = useState('admin');

  useEffect(() => {
    if (user?.token) {
      fetchWorkflows();
    }
  }, [user]);

  useEffect(() => {
    if (selectedWorkflowId) {
      if (selectedWorkflowId === 'new') {
        setWorkflow(null);
        setShowCreateModal(true);
      } else {
        fetchWorkflowDetail(selectedWorkflowId);
        setShowCreateModal(false);
      }
      resetStateForm();
      closeModal();
    } else {
      setWorkflow(null);
    }
  }, [selectedWorkflowId]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/service-workflows', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setWorkflows(json.data || []);
        if (json.data?.length > 0 && !selectedWorkflowId) {
          setSelectedWorkflowId(json.data[0]._id);
        }
      }
    } catch (err) {
      addToast('Error', 'Failed to load service workflows', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowDetail = async (id) => {
    try {
      const response = await fetch(`/api/service-workflows/${id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setWorkflow(result.data);
      }
    } catch (err) {
      addToast('Error', 'Failed to load workflow details', 'error');
    }
  };

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
  };

  const handleCreateWorkflow = async (e) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) {
      addToast('Validation', 'Workflow name is required', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const defaultPayload = {
        workflowName: newWorkflowName.trim(),
        states: [
          { name: 'Pending', description: 'Newly submitted request', isReserved: true },
          { name: 'In Progress', description: 'Fulfillment in progress', isReserved: false },
          { name: 'Closed', description: 'Completed / Fulfilled request', isReserved: true }
        ],
        transitions: [
          { fromState: 'Pending', toState: 'In Progress', label: 'Start Processing', allowedRole: 'admin' },
          { fromState: 'In Progress', toState: 'Closed', label: 'Complete Delivery', allowedRole: 'admin' }
        ]
      };

      const response = await fetch('/api/service-workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(defaultPayload)
      });

      const result = await response.json();
      if (result.success) {
        addToast('Workflow Created', `Workflow "${newWorkflowName}" initialized`, 'success');
        setNewWorkflowName('');
        setShowCreateModal(false);
        // Refresh list and select the new one
        const updatedRes = await fetch('/api/service-workflows', {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        const updatedJson = await updatedRes.json();
        if (updatedJson.success) {
          setWorkflows(updatedJson.data || []);
          const match = updatedJson.data.find(w => w.workflowName === defaultPayload.workflowName);
          if (match) setSelectedWorkflowId(match._id);
        }
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

    const updatedTransitions = [
      ...(workflow.transitions || []),
      {
        fromState: composeTransitionFrom,
        toState: composeTransitionTo,
        label: labelTrimmed,
        allowedRole: composeTransitionRole,
        actions: {}
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
      const endpoint = `/api/service-workflows/${workflow._id}`;

      const payload = {
        workflowName: workflow.workflowName,
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
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        addToast('Saved Successfully', `Workflow "${workflow.workflowName}" saved successfully`, 'success');
        fetchWorkflows();
        fetchWorkflowDetail(workflow._id);
      } else {
        addToast('Error', result.message || 'Failed to save workflow rules', 'error');
      }
    } catch (err) {
      addToast('Error', 'Communication failure', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="wd-container animate-fade-in">
      <div className="wd-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitBranch size={20} className="text-accent" /> Standalone Service Workflow Designer
            </h3>
            <p className="text-muted" style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
              Design state transition lifecycles independently for custom service requests.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={selectedWorkflowId}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
              className="sm-select"
              style={{ minWidth: '220px', padding: '10px 14px' }}
            >
              <option value="">-- Select Workflow to Design --</option>
              {workflows.map((wf) => (
                <option key={wf._id} value={wf._id}>
                  {wf.workflowName}
                </option>
              ))}
              <option value="new" style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>+ Create New Workflow</option>
            </select>
            
            {workflow && (
              <button
                onClick={handleSaveWorkflow}
                disabled={isSaving}
                className="scm-btn scm-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px' }}
              >
                <Save size={15} /> {isSaving ? 'Saving...' : 'Save Workflow'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="wd-state-form-card" style={{ marginTop: '20px', padding: '24px' }}>
          <h4 style={{ fontWeight: 800, margin: '0 0 16px 0', fontSize: '15px' }}>Create New Service Workflow Blueprint</h4>
          <form onSubmit={handleCreateWorkflow} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ fontSize: '12px', display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Workflow Blueprint Name</label>
              <input
                type="text"
                placeholder="e.g. Permits & Licenses Workflow"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                className="sm-input"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="scm-btn scm-btn-primary"
              style={{ padding: '11px 20px' }}
            >
              Initialize Blueprint
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setSelectedWorkflowId('');
              }}
              className="scm-btn scm-btn-secondary"
              style={{ padding: '11px 20px' }}
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {loading && selectedWorkflowId && selectedWorkflowId !== 'new' ? (
        <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-secondary)' }}>
          Loading selected workflow configuration...
        </div>
      ) : workflow ? (
        <div className="wd-designer-layout" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px' }}>
          {/* Visual Canvas States */}
          <div className="wd-canvas-card">
            <h4 className="wd-panel-title">
              <Layers size={15} /> Custom States Node Hierarchy
            </h4>
            <p className="text-muted" style={{ fontSize: '12px', marginBottom: '20px' }}>
              Reserved states (<strong style={{ color: 'var(--accent-color)' }}>Pending</strong>, <strong style={{ color: 'var(--accent-color)' }}>Closed</strong>) are mandatory and cannot be removed.
            </p>

            <div className="wd-states-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {workflow.states.map((s) => (
                <div key={s.name} className={`wd-state-node-card ${s.isReserved ? 'reserved' : ''}`} style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{s.name}</strong>
                      {s.isReserved && <span style={{ fontSize: '9px', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-color)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>Reserved</span>}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                      {s.description || 'No description added.'}
                    </span>
                  </div>
                  
                  {!s.isReserved && (
                    <button
                      onClick={() => handleRemoveState(s.name)}
                      className="sm-remove-field-btn"
                      title="Delete State Node"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add state node */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
              <h5 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>+ Append Custom State Node</h5>
              <form onSubmit={handleAddState} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <input
                    type="text"
                    placeholder="State Node Name (e.g. In Review)"
                    value={newStateName}
                    onChange={(e) => setNewStateName(e.target.value)}
                    className="sm-input"
                    required
                  />
                </div>
                <div style={{ flex: 2, minWidth: '240px' }}>
                  <input
                    type="text"
                    placeholder="Short description of this state's meaning..."
                    value={newStateDesc}
                    onChange={(e) => setNewStateDesc(e.target.value)}
                    className="sm-input"
                  />
                </div>
                <button type="submit" className="scm-btn scm-btn-secondary" style={{ padding: '12px 20px' }}>
                  Add State Node
                </button>
              </form>
            </div>
          </div>

          {/* Transitions list */}
          <div className="wd-canvas-card">
            <h4 className="wd-panel-title">
              <Play size={15} /> Transitions & Action Routing Map
            </h4>
            <p className="text-muted" style={{ fontSize: '12px', marginBottom: '20px' }}>
              Define button clicks that transition the request from one state to another.
            </p>

            <div className="wd-transitions-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(workflow.transitions || []).length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  No transitions configured yet. Connect your state nodes to enable processing.
                </div>
              ) : (
                (workflow.transitions || []).map((t, idx) => (
                  <div key={idx} className="wd-transition-card" style={{ padding: '14px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t.fromState}</span>
                        <ArrowRight size={12} className="text-muted" />
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{t.toState}</span>
                        <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          Role: {t.allowedRole}
                        </span>
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '12.5px', color: 'var(--accent-color)', fontWeight: 700 }}>
                        Button Action Label: "{t.label}"
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveTransition(idx)}
                      className="sm-remove-field-btn"
                      title="Delete Transition Rule"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Compose new transition button triggers */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
              <h5 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '14px' }}>+ Connect Transition Rule</h5>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  value={composeTransitionFrom}
                  onChange={(e) => {
                    setComposeTransitionFrom(e.target.value);
                    setShowTransitionModal(true);
                  }}
                  className="sm-select"
                  style={{ width: 'fit-content', padding: '10px 14px' }}
                >
                  <option value="">-- Choose Origin State Node --</option>
                  {workflow.states.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="wd-canvas-card" style={{ padding: '60px', textAlign: 'center', marginTop: '24px', color: 'var(--text-secondary)' }}>
          <GitBranch size={44} className="text-muted" style={{ opacity: 0.3, marginBottom: '16px' }} />
          <div>Select or create a standalone service workflow blueprint above to begin designing states.</div>
        </div>
      )}

      {/* Connection transition Modal details */}
      {showTransitionModal && (
        <div className="wd-modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="scm-form-card" style={{ width: '100%', maxWidth: '480px', padding: '28px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ fontWeight: 800, fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Play size={15} className="text-accent" /> Connect Transition Link
              </h4>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleModalTransitionSubmit}>
              <div className="sm-input-group">
                <label>Origin State Node</label>
                <input type="text" className="sm-input" value={composeTransitionFrom} disabled />
              </div>

              <div className="sm-input-group">
                <label>Target Destination State Node</label>
                <select
                  value={composeTransitionTo}
                  onChange={(e) => setComposeTransitionTo(e.target.value)}
                  className="sm-select"
                  required
                >
                  <option value="">-- Choose Target State --</option>
                  {workflow?.states.filter(s => s.name !== composeTransitionFrom).map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm-input-group">
                <label>Action Button Label (Visible to user)</label>
                <input
                  type="text"
                  placeholder="e.g. Approve & Close Request"
                  value={composeTransitionLabel}
                  onChange={(e) => setComposeTransitionLabel(e.target.value)}
                  className="sm-input"
                  required
                />
              </div>

              <div className="sm-input-group">
                <label>Allowed Transition Role</label>
                <select
                  value={composeTransitionRole}
                  onChange={(e) => setComposeTransitionRole(e.target.value)}
                  className="sm-select"
                >
                  <option value="admin">Admins / Officers Only</option>
                  <option value="citizen">Citizens Only</option>
                  <option value="any">Anyone (Both Citizen & Officer)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="submit" className="scm-btn scm-btn-primary" style={{ flex: 1 }}>
                  Create Transition
                </button>
                <button type="button" onClick={closeModal} className="scm-btn scm-btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceWorkflowDesigner;
