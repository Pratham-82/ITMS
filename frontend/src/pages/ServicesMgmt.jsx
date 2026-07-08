import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Settings, Plus, Trash2, Edit, Check, XCircle, CheckCircle2, User, Building2, Users } from 'lucide-react';
import '../styles/ServicesMgmt.css';

const ServicesMgmt = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [services, setServices] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingId, setEditingId] = useState(null);
  const [catalogId, setCatalogId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState([]);
  const [assignedDepartment, setAssignedDepartment] = useState('');
  const [assignedGroup, setAssignedGroup] = useState('');
  const [assignedStaff, setAssignedStaff] = useState('');
  const [assignedWorkflow, setAssignedWorkflow] = useState('');
  const [workflows, setWorkflows] = useState([]);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.token) {
      fetchInitialData();
    }
  }, [user]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${user.token}` };

      const [servRes, catRes, deptRes, groupRes, staffRes, wfRes] = await Promise.all([
        fetch('/api/services', { headers }).then(r => r.json()),
        fetch('/api/service-catalogs', { headers }).then(r => r.json()),
        fetch('/api/departments', { headers }).then(r => r.json()),
        fetch('/api/groups', { headers }).then(r => r.json()),
        fetch('/api/auth/admins', { headers }).then(r => r.json()),
        fetch('/api/service-workflows', { headers }).then(r => r.json()).catch(() => ({ data: [] }))
      ]);

      if (servRes.success) setServices(servRes.data || []);
      if (catRes.success) {
        const activeCats = (catRes.data || []).filter(c => c.isActive);
        setCatalogs(activeCats);
        if (activeCats.length > 0 && !catalogId) {
          setCatalogId(activeCats[0]._id);
        }
      }
      if (deptRes.success) setDepartments(deptRes.data || []);
      if (groupRes.success) setGroups(groupRes.data || []);
      if (wfRes.success) setWorkflows(wfRes.data || []);
      if (staffRes.success) {
        setStaffList((staffRes.data || []).filter(u => u.role === 'admin'));
      }
    } catch (err) {
      addToast('Error', 'Failed to retrieve options data from server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = () => {
    setFields([
      ...fields,
      { label: '', type: 'text', required: false, options: [''] }
    ]);
  };

  const handleRemoveField = (index) => {
    const updated = [...fields];
    updated.splice(index, 1);
    setFields(updated);
  };

  const handleFieldChange = (index, key, value) => {
    const updated = [...fields];
    updated[index][key] = value;
    setFields(updated);
  };

  const handleOptionChange = (fieldIndex, optIndex, value) => {
    const updated = [...fields];
    updated[fieldIndex].options[optIndex] = value;
    setFields(updated);
  };

  const handleAddOption = (fieldIndex) => {
    const updated = [...fields];
    updated[fieldIndex].options.push('');
    setFields(updated);
  };

  const handleRemoveOption = (fieldIndex, optIndex) => {
    const updated = [...fields];
    updated[fieldIndex].options.splice(optIndex, 1);
    setFields(updated);
  };

  const handleEdit = (service) => {
    setEditingId(service._id);
    setCatalogId(service.catalog?._id || service.catalog || '');
    setName(service.name);
    setDescription(service.description || '');
    setFields(service.fields || []);
    setAssignedDepartment(service.assignment?.department?._id || service.assignment?.department || '');
    setAssignedGroup(service.assignment?.group?._id || service.assignment?.group || '');
    setAssignedStaff(service.assignment?.staff?._id || service.assignment?.staff || '');
    setAssignedWorkflow(service.workflow?._id || service.workflow || '');
    setIsActive(service.isActive);
  };

  const handleCancel = () => {
    setEditingId(null);
    if (catalogs.length > 0) {
      setCatalogId(catalogs[0]._id);
    } else {
      setCatalogId('');
    }
    setName('');
    setDescription('');
    setFields([]);
    setAssignedDepartment('');
    setAssignedGroup('');
    setAssignedStaff('');
    setAssignedWorkflow('');
    setIsActive(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!catalogId) {
      addToast('Validation Error', 'Catalog is required', 'error');
      return;
    }
    if (!name.trim()) {
      addToast('Validation Error', 'Service name is required', 'error');
      return;
    }

    // Clean field labels and options
    const cleanedFields = fields.map(f => {
      const cleanField = {
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        options: f.type === 'select' ? f.options.map(o => o.trim()).filter(Boolean) : []
      };
      return cleanField;
    }).filter(f => f.label !== '');

    setIsSaving(true);
    try {
      const url = editingId ? `/api/services/${editingId}` : '/api/services';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          catalog: catalogId,
          name: name.trim(),
          description: description.trim(),
          fields: cleanedFields,
          assignment: {
            department: assignedDepartment || null,
            group: assignedGroup || null,
            staff: assignedStaff || null
          },
          workflow: assignedWorkflow || null,
          isActive
        })
      });
      const json = await res.json();
      if (json.success) {
        addToast(
          'Success',
          `Service ${editingId ? 'updated' : 'created'} successfully`,
          'success'
        );
        handleCancel();
        fetchInitialData();
      } else {
        addToast('Error', json.message || 'Failed to save service', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (service) => {
    try {
      const res = await fetch(`/api/services/${service._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ isActive: !service.isActive })
      });
      const json = await res.json();
      if (json.success) {
        addToast(
          'Status Updated',
          `Service "${service.name}" is now ${!service.isActive ? 'Active' : 'Inactive'}`,
          'success'
        );
        fetchInitialData();
      } else {
        addToast('Error', json.message || 'Failed to update service status', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    }
  };

  return (
    <div className="sm-container">
      {/* Form Card */}
      <div className="sm-form-card">
        <h3 className="sm-card-title">
          <Settings size={18} />
          {editingId ? 'Edit Catalog Service' : 'Create Catalog Service'}
        </h3>
        <p className="sm-card-subtitle">
          Define custom form inputs and automated assignments for this service.
        </p>

        {catalogs.length === 0 ? (
          <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--status-rejected-text)', borderRadius: '8px', fontSize: '13.5px' }}>
            <strong>Action Required:</strong> You must create at least one active Service Catalog under "Service Catalogs" tab before you can define services.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="sm-input-group">
              <label>Select Service Catalog</label>
              <select
                value={catalogId}
                onChange={(e) => setCatalogId(e.target.value)}
                className="sm-select"
                required
              >
                <option value="">-- Choose Catalog --</option>
                {catalogs.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm-input-group">
              <label>Service Name</label>
              <input
                type="text"
                placeholder="e.g. Request Waste Collection Bin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="sm-input"
                required
              />
            </div>

            <div className="sm-input-group">
              <label>Service Description</label>
              <textarea
                placeholder="Describe the service purpose, documents needed, or fulfillment details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="sm-textarea"
              />
            </div>

            {/* Field Builder */}
            <div className="sm-field-builder">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Dynamic Form Fields</span>
                <button
                  type="button"
                  onClick={handleAddField}
                  className="sm-btn sm-btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
                >
                  <Plus size={14} /> Add Input Field
                </button>
              </div>

              <div className="sm-field-list">
                {fields.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', fontSize: '12px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                    No custom fields. Renders as basic request description form only.
                  </div>
                ) : (
                  fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="sm-field-item">
                      <div className="sm-field-row">
                        <input
                          type="text"
                          placeholder="Field Label (e.g. Meter Serial No.)"
                          value={field.label}
                          onChange={(e) => handleFieldChange(fieldIndex, 'label', e.target.value)}
                          className="sm-input sm-field-label-input"
                          style={{ padding: '8px 12px', fontSize: '13px' }}
                          required
                        />
                        <select
                          value={field.type}
                          onChange={(e) => handleFieldChange(fieldIndex, 'type', e.target.value)}
                          className="sm-select sm-field-type-select"
                          style={{ padding: '8px 12px', fontSize: '13px' }}
                        >
                          <option value="text">Text Input</option>
                          <option value="number">Number Input</option>
                          <option value="select">Dropdown Select</option>
                          <option value="textarea">Textarea Box</option>
                          <option value="checkbox">Checkbox Switch</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(fieldIndex)}
                          className="sm-remove-field-btn"
                          title="Remove Field"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="sm-checkbox-label">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => handleFieldChange(fieldIndex, 'required', e.target.checked)}
                          />
                          Make field mandatory
                        </label>
                      </div>

                      {field.type === 'select' && (
                        <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid var(--accent-color)' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>Dropdown Options:</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                            {field.options.map((opt, optIndex) => (
                              <div key={optIndex} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  placeholder={`Option ${optIndex + 1}`}
                                  value={opt}
                                  onChange={(e) => handleOptionChange(fieldIndex, optIndex, e.target.value)}
                                  className="sm-field-options-input"
                                  required
                                />
                                {field.options.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(fieldIndex, optIndex)}
                                    style={{ background: 'none', border: 'none', color: 'var(--status-rejected-text)', cursor: 'pointer', fontSize: '11px' }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleAddOption(fieldIndex)}
                              style={{ width: 'fit-content', background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, marginTop: '2px' }}
                            >
                              + Add Option
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Fulfillment Workflow */}
            <div className="sm-field-builder" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '14px' }}>
                Workflow Configuration
              </span>
              <div className="sm-input-group">
                <label>Fulfillment Workflow</label>
                <select
                  value={assignedWorkflow}
                  onChange={(e) => setAssignedWorkflow(e.target.value)}
                  className="sm-select"
                >
                  <option value="">-- Standard Default Workflow --</option>
                  {workflows.map((wf) => (
                    <option key={wf._id} value={wf._id}>
                      {wf.workflowName} ({wf.states?.length || 0} states)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignments Configuration */}
            <div className="sm-assignment-section">
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '14px' }}>
                Fulfillment Auto-Assignment
              </span>

              <div className="sm-assignment-grid">
                <div className="sm-input-group">
                  <label>Assign Department</label>
                  <select
                    value={assignedDepartment}
                    onChange={(e) => setAssignedDepartment(e.target.value)}
                    className="sm-select"
                  >
                    <option value="">-- None (No Department) --</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm-input-group">
                  <label>Assign Support Group</label>
                  <select
                    value={assignedGroup}
                    onChange={(e) => setAssignedGroup(e.target.value)}
                    className="sm-select"
                  >
                    <option value="">-- None (No Group) --</option>
                    {groups.map((grp) => (
                      <option key={grp._id} value={grp._id}>
                        {grp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm-input-group">
                <label>Assign Officer / Staff</label>
                <select
                  value={assignedStaff}
                  onChange={(e) => setAssignedStaff(e.target.value)}
                  className="sm-select"
                >
                  <option value="">-- None (Unassigned) --</option>
                  {staffList.map((st) => (
                    <option key={st._id} value={st._id}>
                      {st.name} ({st.department || 'General Administration'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {editingId && (
              <div className="sm-input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="service-active"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                />
                <label htmlFor="service-active" style={{ margin: 0, cursor: 'pointer' }}>Active (Publish to portal)</label>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="submit"
                disabled={isSaving}
                className="sm-btn sm-btn-primary"
                style={{ flex: 1 }}
              >
                {isSaving ? 'Publishing...' : editingId ? 'Update Service' : 'Publish Service'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="sm-btn sm-btn-secondary"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* List Card */}
      <div className="sm-form-card" style={{ height: 'fit-content' }}>
        <h3 className="sm-card-title">
          <Settings size={18} />
          Published Services
        </h3>
        <p className="sm-card-subtitle">
          Manage dynamic forms and automated routing rules.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Loading service configurations...
          </div>
        ) : services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No services configured yet.
          </div>
        ) : (
          <div className="sm-list-container">
            {services.map((service) => (
              <div key={service._id} className="sm-item-card">
                <div className="sm-item-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="sm-item-title">{service.name}</span>
                      <span className={`scm-badge ${service.isActive ? 'scm-badge-active' : 'scm-badge-inactive'}`}>
                        {service.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {service.catalog && (
                      <span
                        className="sm-item-catalog-badge"
                        style={{ backgroundColor: service.catalog.color || '#6366f1' }}
                      >
                        {service.catalog.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="sm-item-desc">
                  {service.description || 'No description provided.'}
                </div>

                <div className="sm-item-fields-summary">
                  <div className="sm-item-fields-title">Form Input Fields ({service.fields?.length || 0})</div>
                  {service.fields?.length > 0 ? (
                    <div className="sm-fields-tags">
                      {service.fields.map((f, idx) => (
                        <span key={idx} className="sm-field-tag">
                          {f.label} ({f.type}){f.required && '*'}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None (Standard description form)</span>
                  )}
                </div>

                <div className="sm-item-assignment-summary">
                  <div className="sm-assign-row">
                    <span className="sm-assign-label">Department:</span>
                    <span className="sm-assign-value">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={13} className="text-accent" />
                        {service.assignment?.department?.name || 'None'}
                      </span>
                    </span>
                  </div>
                  <div className="sm-assign-row">
                    <span className="sm-assign-label">Group:</span>
                    <span className="sm-assign-value">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={13} className="text-accent" />
                        {service.assignment?.group?.name || 'None'}
                      </span>
                    </span>
                  </div>
                  <div className="sm-assign-row">
                    <span className="sm-assign-label">Staff:</span>
                    <span className="sm-assign-value">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={13} className="text-accent" />
                        {service.assignment?.staff?.name || 'None'}
                      </span>
                    </span>
                  </div>
                  <div className="sm-assign-row">
                    <span className="sm-assign-label">Workflow:</span>
                    <span className="sm-assign-value">
                      <span style={{ color: service.workflow ? 'var(--accent-color)' : 'var(--text-muted)' }}>
                        {service.workflow?.workflowName || 'Standard Default Workflow'}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="sm-item-actions">
                  <button
                    onClick={() => handleEdit(service)}
                    className="scm-btn scm-btn-secondary"
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit size={13} /> Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(service)}
                    className="scm-btn scm-btn-secondary"
                    style={{ padding: '6px 12px', color: service.isActive ? 'var(--status-rejected-text)' : 'var(--accent-color)' }}
                  >
                    {service.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServicesMgmt;
