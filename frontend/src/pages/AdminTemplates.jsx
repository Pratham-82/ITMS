import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, Trash, Settings, Save, AlertCircle, RefreshCw, Layers } from 'lucide-react';

const AdminTemplates = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');

  // Form States
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState([{ label: '', type: 'text', required: false, options: '' }]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/categories', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setCategories(result.data);
      } else {
        addToast('Error', result.message || 'Failed to fetch categories', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setDepartments(result.data.filter(d => d.isActive));
      }
    } catch (err) {
      console.error('Failed to fetch departments list', err);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchCategories();
      fetchDepartments();
    }
  }, [user]);

  const handleAddField = () => {
    setFields([...fields, { label: '', type: 'text', required: false, options: '' }]);
  };

  const handleRemoveField = (index) => {
    setFields(fields.filter((_, idx) => idx !== index));
  };

  const handleFieldChange = (index, key, value) => {
    const updatedFields = [...fields];
    updatedFields[index][key] = value;
    setFields(updatedFields);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedDepartment('');
    setFields([{ label: '', type: 'text', required: false, options: '' }]);
    setIsEditing(false);
    setEditId(null);
  };

  const handleEditClick = (cat) => {
    setIsEditing(true);
    setEditId(cat._id);
    setName(cat.name);
    setDescription(cat.description || '');
    setSelectedDepartment(cat.department || '');
    // Map fields back, converting options array to comma string
    const mappedFields = cat.fields.map(f => ({
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options ? f.options.join(', ') : ''
    }));
    setFields(mappedFields.length > 0 ? mappedFields : [{ label: '', type: 'text', required: false, options: '' }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Validation Error', 'Category name is required', 'error');
      return;
    }

    // Filter fields with labels
    const activeFields = fields.filter(f => f.label.trim() !== '');
    const formattedFields = activeFields.map(f => ({
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      options: f.type === 'select' ? f.options.split(',').map(o => o.trim()).filter(Boolean) : []
    }));

    setIsSaving(true);
    try {
      const url = isEditing ? `/api/categories/${editId}` : '/api/categories';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          fields: formattedFields
        })
      });

      const result = await response.json();
      if (result.success) {
        addToast(
          isEditing ? 'Category Updated' : 'Category Created',
          `Template "${name}" saved successfully`,
          'success'
        );
        resetForm();
        fetchCategories();
      } else {
        addToast('Save Failed', result.message || 'Error saving category', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (id, catName) => {
    if (!window.confirm(`Are you sure you want to deactivate category "${catName}"? Older complaints will persist, but citizens can no longer file new ones.`)) return;

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Category Deactivated', `${catName} is now inactive`, 'info');
        fetchCategories();
      } else {
        addToast('Deactivation Failed', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Communication failure', 'error');
    }
  };

  const handleActivateToggle = async (cat) => {
    try {
      const response = await fetch(`/api/categories/${cat._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ isActive: !cat.isActive })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Status Toggled', `Category is now ${!cat.isActive ? 'Active' : 'Inactive'}`, 'success');
        fetchCategories();
      }
    } catch (err) {
      addToast('Error', 'Failed to update category status', 'error');
    }
  };

  const handleAssignMapping = async (deptId, catId, catName, deptName) => {
    if (!deptId) return;
    try {
      const response = await fetch(`/api/departments/${deptId}/categories/${catId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Mapping Added', `Successfully linked "${catName}" to "${deptName}"`, 'success');
        fetchDepartments();
      } else {
        addToast('Mapping Failed', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to assign category to department', 'error');
    }
  };

  const handleRemoveMapping = async (deptId, catId, catName, deptName) => {
    if (!window.confirm(`Are you sure you want to remove "${catName}" from "${deptName}"?`)) return;
    try {
      const response = await fetch(`/api/departments/${deptId}/categories/${catId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Mapping Removed', `Successfully unlinked "${catName}" from "${deptName}"`, 'success');
        fetchDepartments();
      } else {
        addToast('Removal Failed', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to remove category assignment', 'error');
    }
  };

  // Map categories to their active department mappings in memory
  const uniqueCategories = categories.map((cat) => {
    const mappedDepts = departments.filter((dept) => 
      dept.categories && dept.categories.some((c) => c._id === cat._id)
    );

    return {
      ...cat,
      departments: mappedDepts.map(d => ({
        id: d._id,
        name: d.name,
        isActive: d.isActive
      })),
      rawCategory: cat
    };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start', animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Category Editor Form */}
      <div className="form-card" style={{ maxWidth: 'none', margin: 0 }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={20} className="text-accent" />
          <span>{isEditing ? 'Modify Category Template' : 'Create Custom Category'}</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
          Define dynamic fields that citizens will fill out when selecting this ticket type.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Category Name *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Printer & Hardware Support" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Brief summary of issues covered under this category..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Custom Form Fields</h3>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleAddField}
                style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}
              >
                <Plus size={14} />
                <span>Add Field</span>
              </button>
            </div>

            {fields.map((field, index) => (
              <div 
                key={index} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  backgroundColor: 'rgba(255,255,255,0.01)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--border-radius-sm)', 
                  padding: '16px', 
                  marginBottom: '12px',
                  position: 'relative'
                }}
              >
                {fields.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveField(index)}
                    style={{ 
                      position: 'absolute', 
                      top: '12px', 
                      right: '12px', 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-muted)', 
                      cursor: 'pointer' 
                    }}
                  >
                    <Trash size={14} className="hover:text-error" />
                  </button>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: field.type === 'select' ? '12px' : 0 }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Field Label *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Room Number" 
                      value={field.label}
                      onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '13px', marginTop: '4px' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Input Type</label>
                    <select 
                      className="form-control" 
                      value={field.type}
                      onChange={(e) => handleFieldChange(index, 'type', e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '13px', marginTop: '4px' }}
                    >
                      <option value="text">Text Box</option>
                      <option value="number">Numeric</option>
                      <option value="select">Dropdown Select</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Validation</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      <input 
                        type="checkbox" 
                        checked={field.required}
                        onChange={(e) => handleFieldChange(index, 'required', e.target.checked)}
                      />
                      <span>Required</span>
                    </label>
                  </div>
                </div>

                {field.type === 'select' && (
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Select Choices (Comma Separated)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Server, Desktop, Printer, Router" 
                      value={field.options}
                      onChange={(e) => handleFieldChange(index, 'options', e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '13px', marginTop: '4px' }}
                      required
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSaving}>
              <Save size={16} />
              <span>{isSaving ? 'Saving Template...' : isEditing ? 'Update Template' : 'Publish Category'}</span>
            </button>
            {isEditing && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Categories Queue Panel */}
      <div className="dashboard-panel" style={{ margin: 0 }}>
        <div className="panel-header">
          <h2 className="panel-title">
            <Layers size={20} className="text-accent" />
            <span>Active Complaint Categories</span>
          </h2>
          <button className="theme-toggle" onClick={fetchCategories} title="Reload categories list">
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading categories...</div>
        ) : uniqueCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No dynamic categories set up. Set one up in the left form.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {uniqueCategories.map((cat) => (
              <div 
                key={cat._id} 
                style={{ 
                  padding: '16px', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--border-radius-md)', 
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  opacity: cat.isActive ? 1 : 0.6
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '15px' }}>{cat.name}</strong>
                    
                    {/* Render all departments assigned to this category */}
                    {cat.departments.length === 0 ? (
                      <span className="badge" style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-muted)', fontSize: '10px', padding: '2px 8px', textTransform: 'none' }}>
                        No Departments Assigned
                      </span>
                    ) : (
                      cat.departments.map((dept, dIdx) => (
                        <span 
                          key={dIdx} 
                          className="badge" 
                          style={{ 
                            backgroundColor: 'rgba(99, 102, 241, 0.08)', 
                            color: 'var(--accent-color)', 
                            fontSize: '10px', 
                            padding: '2px 8px', 
                            textTransform: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{dept.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMapping(dept.id, cat._id, cat.name, dept.name)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-color)',
                              cursor: 'pointer',
                              padding: 0,
                              fontWeight: 'bold',
                              fontSize: '10px',
                              lineHeight: 1
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}

                    <span className={`badge ${cat.isActive ? 'badge-status-resolved' : 'badge-status-rejected'}`} style={{ fontSize: '9px', padding: '2px 8px' }}>
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {cat.description || 'No description provided.'}
                  </p>

                  {/* Mapping quick assigner dropdown select */}
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Link to Dept:</span>
                    <select
                      className="form-control"
                      style={{ padding: '4px 8px', fontSize: '11px', width: 'auto', display: 'inline-block', height: 'auto', marginTop: 0, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
                      onChange={(e) => {
                        const deptId = e.target.value;
                        if (!deptId) return;
                        const deptObj = departments.find(d => d._id === deptId);
                        handleAssignMapping(deptId, cat._id, cat.name, deptObj ? deptObj.name : '');
                        e.target.value = '';
                      }}
                      defaultValue=""
                    >
                      <option value="">-- Choose Department --</option>
                      {departments
                        .filter(dept => !cat.departments.some(d => d.id === dept._id))
                        .map(dept => (
                          <option key={dept._id} value={dept._id}>{dept.name}</option>
                        ))}
                    </select>
                  </div>
                  
                  {/* Fields Summary */}
                  {cat.fields.length > 0 && (
                    <div style={{ marginTop: '12px', fontSize: '11px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Fields:</span>
                      {cat.fields.map((f, fIdx) => (
                        <span 
                          key={fIdx} 
                          style={{ 
                            backgroundColor: 'rgba(255,255,255,0.04)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '4px', 
                            padding: '2px 6px',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {f.label} ({f.type}){f.required && '*'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                  <button 
                    onClick={() => handleEditClick(cat.rawCategory)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => cat.isActive ? handleDeactivate(cat._id, cat.name) : handleActivateToggle(cat.rawCategory)}
                    className="btn"
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '12px', 
                      backgroundColor: cat.isActive ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      color: cat.isActive ? 'var(--status-rejected-text)' : 'var(--status-resolved-text)',
                      border: '1px solid rgba(255,255,255,0.03)'
                    }}
                  >
                    {cat.isActive ? 'Deactivate' : 'Activate'}
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

export default AdminTemplates;
