import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, Trash, Edit, SlidersHorizontal, Save, RefreshCw, ToggleLeft, ToggleRight, PlusCircle } from 'lucide-react';

const FIELD_TYPES = [
  { label: 'Text', value: 'text' },
  { label: 'Text Area', value: 'textarea' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
  { label: 'Date Time', value: 'datetime' },
  { label: 'Boolean (Toggle)', value: 'boolean' },
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'URL', value: 'url' },
  { label: 'Select (Dropdown)', value: 'select' },
  { label: 'Multi-Select', value: 'multiselect' },
  { label: 'System User', value: 'user' },
  { label: 'Department', value: 'department' },
  { label: 'Other Asset Link', value: 'asset' }
];

const AssetTypeManagement = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assetPrefix, setAssetPrefix] = useState('');
  const [lifecycleStatuses, setLifecycleStatuses] = useState('Active, In Store, Retired, Under Repair');
  const [dynamicFields, setDynamicFields] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/asset-categories', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setCategories(result.data.filter(c => c.isActive));
        if (result.data.length > 0 && !categoryId) {
          setCategoryId(result.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/asset-types', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setTypes(result.data);
      } else {
        addToast('Error', result.message || 'Failed to fetch asset types', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchCategories();
      fetchTypes();
    }
  }, [user]);

  const handleAddField = () => {
    setDynamicFields([
      ...dynamicFields,
      {
        fieldKey: '',
        label: '',
        type: 'text',
        required: false,
        options: '',
        placeholder: '',
        helpText: '',
        inboundMappingKey: ''
      }
    ]);
  };

  const handleRemoveField = (index) => {
    setDynamicFields(dynamicFields.filter((_, idx) => idx !== index));
  };

  const handleFieldChange = (index, key, value) => {
    const updated = [...dynamicFields];
    updated[index][key] = value;
    setDynamicFields(updated);
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setAssetPrefix('');
    setLifecycleStatuses('Active, In Store, Retired, Under Repair');
    setDynamicFields([]);
    setIsEditing(false);
    setEditId(null);
    if (categories.length > 0) {
      setCategoryId(categories[0]._id);
    }
  };

  const handleEditClick = (type) => {
    setIsEditing(true);
    setEditId(type._id);
    setCategoryId(type.categoryId._id || type.categoryId);
    setName(type.name);
    setDescription(type.description || '');
    setAssetPrefix(type.assetPrefix || '');
    setLifecycleStatuses(type.lifecycleStatuses ? type.lifecycleStatuses.join(', ') : 'Active, In Store, Retired, Under Repair');
    
    // Map fields
    const mapped = type.dynamicFields ? type.dynamicFields.map(f => ({
      fieldKey: f.fieldKey,
      label: f.label,
      type: f.type,
      required: f.required || false,
      options: f.options ? f.options.join(', ') : '',
      placeholder: f.placeholder || '',
      helpText: f.helpText || '',
      inboundMappingKey: f.inboundMappingKey || ''
    })) : [];
    setDynamicFields(mapped);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoryId) {
      addToast('Validation Error', 'Please select or create an Asset Category first', 'error');
      return;
    }
    if (!name.trim()) {
      addToast('Validation Error', 'Asset Type name is required', 'error');
      return;
    }
    if (!assetPrefix.trim()) {
      addToast('Validation Error', 'Asset prefix is required (e.g. LAP)', 'error');
      return;
    }

    // Format lifecycle statuses
    const statuses = lifecycleStatuses.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 0) {
      addToast('Validation Error', 'Provide at least one lifecycle status', 'error');
      return;
    }

    // Validate dynamic fields
    for (let i = 0; i < dynamicFields.length; i++) {
      const field = dynamicFields[i];
      if (!field.fieldKey.trim() || !field.label.trim()) {
        addToast('Validation Error', `Dynamic field #${i + 1} must have a key and label`, 'error');
        return;
      }
      // enforce alphanumeric/underscore key formatting
      if (!/^[a-zA-Z0-9_]+$/.test(field.fieldKey)) {
        addToast('Validation Error', `Field Key "${field.fieldKey}" must be alphanumeric and contain no spaces`, 'error');
        return;
      }
    }

    // Format fields
    const formattedFields = dynamicFields.map(f => ({
      fieldKey: f.fieldKey.trim().toLowerCase(),
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      placeholder: f.placeholder?.trim() || '',
      helpText: f.helpText?.trim() || '',
      options: (f.type === 'select' || f.type === 'multiselect') ? f.options.split(',').map(o => o.trim()).filter(Boolean) : [],
      inboundMappingKey: f.inboundMappingKey?.trim() || ''
    }));

    setIsSaving(true);
    try {
      const url = isEditing ? `/api/asset-types/${editId}` : '/api/asset-types';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          categoryId,
          name: name.trim(),
          description: description.trim(),
          assetPrefix: assetPrefix.trim().toUpperCase(),
          lifecycleStatuses: statuses,
          dynamicFields: formattedFields
        })
      });

      const result = await response.json();
      if (result.success) {
        addToast(
          isEditing ? 'Asset Type Updated' : 'Asset Type Created',
          `Asset Type "${name}" saved successfully`,
          'success'
        );
        resetForm();
        fetchTypes();
      } else {
        addToast('Save Failed', result.message || 'Error saving type', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (type) => {
    try {
      const response = await fetch(`/api/asset-types/${type._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ isActive: !type.isActive })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Status Updated', `Asset type is now ${!type.isActive ? 'Active' : 'Inactive'}`, 'success');
        fetchTypes();
      } else {
        addToast('Update Failed', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to update asset type status', 'error');
    }
  };

  const handleDelete = async (type) => {
    if (!window.confirm(`Are you sure you want to delete asset type "${type.name}"? Active assets of this type might become invalid.`)) return;

    try {
      const response = await fetch(`/api/asset-types/${type._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Asset Type Deleted', `${type.name} removed successfully`, 'success');
        fetchTypes();
      } else {
        addToast('Delete Failed', result.message || 'Error deleting asset type', 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to contact server', 'error');
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 style={{ fontWeight: 800, fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal className="text-accent" size={22} />
            Asset Types & Templates
          </h3>
          <p className="text-muted" style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
            Define schemas, lifecycle statuses, and dynamic fields for categories of assets.
          </p>
        </div>
        <button className="sh-wizard-btn d-flex align-items-center gap-2" onClick={fetchTypes} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="row">
        {/* Form Container */}
        <div className="col-12 mb-4">
          <div className="card-custom" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h4 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '20px', color: 'var(--text-primary)' }}>
              {isEditing ? 'Modify Asset Type Schema' : 'Create New Asset Type Schema'}
            </h4>

            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-3 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Asset Category</label>
                  <select
                    className="form-control"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      padding: '10px'
                    }}
                    required
                  >
                    {categories.length === 0 && <option value="">(No Active Categories)</option>}
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Type Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Laptop, Cloud VM"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      padding: '10px'
                    }}
                    required
                  />
                </div>

                <div className="col-md-2 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Code Prefix</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. LAP, VM"
                    value={assetPrefix}
                    onChange={(e) => setAssetPrefix(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      padding: '10px'
                    }}
                    maxLength={5}
                    required
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Lifecycle Statuses (Comma separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Active, In Store, Retired"
                    value={lifecycleStatuses}
                    onChange={(e) => setLifecycleStatuses(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      padding: '10px'
                    }}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Type Description</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Enter details about this schema..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    padding: '10px'
                  }}
                />
              </div>

              {/* Dynamic Attribute Builders */}
              <div style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>Custom Dynamic Fields Definition</span>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="btn btn-secondary d-flex align-items-center gap-1"
                    style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '6px' }}
                  >
                    <PlusCircle size={14} /> Add Custom Field
                  </button>
                </div>

                {dynamicFields.length === 0 ? (
                  <p className="text-muted text-center p-3" style={{ fontSize: '12.5px', margin: 0 }}>
                    No custom fields defined. Assets of this type will only feature base properties.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {dynamicFields.map((field, idx) => (
                      <div key={idx} className="row align-items-center" style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        padding: '12px',
                        borderRadius: '6px',
                        margin: 0
                      }}>
                        <div className="col-md-2 mb-2 mb-md-0">
                          <input
                            type="text"
                            placeholder="field_key (lower_snake)"
                            className="form-control form-control-sm"
                            value={field.fieldKey}
                            onChange={(e) => handleFieldChange(idx, 'fieldKey', e.target.value)}
                            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            required
                          />
                        </div>
                        <div className="col-md-2 mb-2 mb-md-0">
                          <input
                            type="text"
                            placeholder="Field Label"
                            className="form-control form-control-sm"
                            value={field.label}
                            onChange={(e) => handleFieldChange(idx, 'label', e.target.value)}
                            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            required
                          />
                        </div>
                        <div className="col-md-2 mb-2 mb-md-0">
                          <select
                            className="form-control form-control-sm"
                            value={field.type}
                            onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}
                            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-2 mb-2 mb-md-0">
                          {(field.type === 'select' || field.type === 'multiselect') ? (
                            <input
                              type="text"
                              placeholder="Option1, Option2..."
                              className="form-control form-control-sm"
                              value={field.options}
                              onChange={(e) => handleFieldChange(idx, 'options', e.target.value)}
                              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                              required
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder="Placeholder text"
                              className="form-control form-control-sm"
                              value={field.placeholder}
                              onChange={(e) => handleFieldChange(idx, 'placeholder', e.target.value)}
                              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            />
                          )}
                        </div>
                        <div className="col-md-2 mb-2 mb-md-0">
                          <input
                            type="text"
                            placeholder="Inbound Mapping Key"
                            className="form-control form-control-sm"
                            value={field.inboundMappingKey || ''}
                            onChange={(e) => handleFieldChange(idx, 'inboundMappingKey', e.target.value)}
                            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            title="Optional: JSON payload key from external integrations (e.g. ram_size)"
                          />
                        </div>
                        <div className="col-md-1 d-flex align-items-center gap-1 mb-2 mb-md-0">
                          <label className="d-flex align-items-center gap-1" style={{ fontSize: '11px', cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => handleFieldChange(idx, 'required', e.target.checked)}
                            />
                            Req
                          </label>
                        </div>
                        <div className="col-md-1 text-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveField(idx)}
                            className="btn btn-link text-danger p-0"
                          >
                            <Trash size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="d-flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary d-flex align-items-center gap-2"
                  disabled={isSaving}
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    borderColor: 'var(--accent-color)',
                    fontWeight: 700,
                    borderRadius: '8px',
                    padding: '10px 20px',
                    boxShadow: '0 2px 8px var(--accent-glow)'
                  }}
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save Asset Type'}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetForm}
                    style={{ borderRadius: '8px', padding: '10px 20px' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Categories / Types Grid List */}
        <div className="col-12">
          {loading && types.length === 0 ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : types.length === 0 ? (
            <div className="card-custom text-center p-5" style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px'
            }}>
              <SlidersHorizontal size={40} className="text-muted mb-3" />
              <h5 style={{ fontWeight: 700 }}>No asset types configured</h5>
              <p className="text-muted" style={{ fontSize: '13px' }}>Create your first Asset Type schema above.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {types.map((type) => (
                <div
                  key={type._id}
                  className="card-custom d-flex flex-column justify-content-between"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: 'var(--box-shadow-sm)',
                    borderTop: `4px solid ${type.categoryId?.color || 'var(--accent-color)'}`
                  }}
                >
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: `${type.categoryId?.color || 'var(--accent-color)'}15`,
                          color: type.categoryId?.color || 'var(--accent-color)'
                        }}>
                          {type.categoryId?.name || 'Category'}
                        </span>
                        <h4 style={{ fontWeight: 700, fontSize: '15px', margin: '6px 0 2px 0', color: 'var(--text-primary)' }}>
                          {type.name}
                        </h4>
                      </div>

                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: type.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: type.isActive ? '#10b981' : '#ef4444'
                      }}>
                        {type.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <p className="text-muted" style={{ fontSize: '12.5px', marginBottom: '14px', lineHeight: 1.4 }}>
                      {type.description || 'No description provided.'}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11.5px', marginBottom: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Prefix: <strong>{type.assetPrefix}</strong></span>
                      <span style={{ color: 'var(--text-muted)' }}>|</span>
                      <span style={{ color: 'var(--text-secondary)' }}>Fields: <strong>{type.dynamicFields?.length || 0} configured</strong></span>
                    </div>

                    {type.dynamicFields && type.dynamicFields.length > 0 && (
                      <div className="mb-3">
                        <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          Attributes:
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {type.dynamicFields.map((f, i) => (
                            <span key={i} style={{
                              fontSize: '10.5px',
                              backgroundColor: 'var(--bg-tertiary)',
                              border: '1px solid var(--border-color)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              color: 'var(--text-secondary)'
                            }} title={`Type: ${f.type}`}>
                              {f.label}{f.required ? '*' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="d-flex justify-content-between align-items-center mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Code: {type.assetPrefix}-000001
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        onClick={() => handleToggleActive(type)}
                        className="btn btn-icon p-0"
                        title={type.isActive ? 'Deactivate' : 'Activate'}
                        style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                      >
                        {type.isActive ? <ToggleRight size={22} className="text-success" /> : <ToggleLeft size={22} className="text-muted" />}
                      </button>
                      <button
                        onClick={() => handleEditClick(type)}
                        className="btn btn-icon p-1"
                        title="Edit Schema"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(type)}
                        className="btn btn-icon p-1"
                        title="Delete Schema"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        <Trash size={15} className="text-danger-hover" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetTypeManagement;
