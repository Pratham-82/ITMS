import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, MapPin, Tag } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const AssetEditModal = ({ isOpen, onClose, asset, token, onSaveSuccess }) => {
  const { addToast } = useToast();

  // Dropdown list states
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [allAssetsList, setAllAssetsList] = useState([]);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [assetTypeId, setAssetTypeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [custodianUserId, setCustodianUserId] = useState('');
  const [custodianEmail, setCustodianEmail] = useState('');
  const [isOwnerManual, setIsOwnerManual] = useState(false);
  const [isCustodianManual, setIsCustodianManual] = useState(false);
  const [status, setStatus] = useState('Active');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [location, setLocation] = useState('');
  const [dynamicValues, setDynamicValues] = useState({});
  const [serialNumber, setSerialNumber] = useState('');

  // Schema references
  const [selectedTypeSchema, setSelectedTypeSchema] = useState(null);
  const [availableStatuses, setAvailableStatuses] = useState(['Active', 'In Store', 'Retired', 'Under Repair']);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch prerequisites
  useEffect(() => {
    if (!isOpen) return;

    const fetchPrerequisites = async () => {
      try {
        setLoading(true);
        const headers = { Authorization: `Bearer ${token}` };
        const [catRes, typeRes, deptRes, userRes, allAssetsRes] = await Promise.all([
          fetch('/api/asset-categories', { headers }).then(r => r.json()),
          fetch('/api/asset-types', { headers }).then(r => r.json()),
          fetch('/api/departments', { headers }).then(r => r.json()),
          fetch('/api/auth/users', { headers }).then(r => r.json()),
          fetch('/api/assets?limit=100', { headers }).then(r => r.json())
        ]);

        if (catRes.success) setCategories(catRes.data.filter(c => c.isActive));
        if (typeRes.success) setTypes(typeRes.data.filter(t => t.isActive));
        if (deptRes.success) setDepartments(deptRes.data.filter(d => d.isActive));
        if (userRes.success) setUsers(userRes.data || []);
        if (allAssetsRes.success) setAllAssetsList(allAssetsRes.data || []);
      } catch (err) {
        console.error('Failed to load prerequisites', err);
        addToast('Error', 'Failed to load dropdown prerequisites', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchPrerequisites();
  }, [isOpen, token]);

  // Load asset data when modal opens
  useEffect(() => {
    if (isOpen && asset) {
      setName(asset.name || '');
      setDescription(asset.description || '');
      setCategoryId(asset.categoryId?._id || asset.categoryId || '');
      setAssetTypeId(asset.assetTypeId?._id || asset.assetTypeId || '');
      setDepartmentId(asset.departmentId?._id || asset.departmentId || '');
      
      const oId = asset.ownerUserId?._id || asset.ownerUserId || '';
      setOwnerUserId(oId);
      setOwnerEmail(asset.ownerEmail || '');
      setIsOwnerManual(!oId && !!asset.ownerEmail);

      const cId = asset.custodianUserId?._id || asset.custodianUserId || '';
      setCustodianUserId(cId);
      setCustodianEmail(asset.custodianEmail || '');
      setIsCustodianManual(!cId && !!asset.custodianEmail);

      setStatus(asset.status || 'Active');
      setPurchaseDate(asset.purchaseDate ? asset.purchaseDate.substring(0, 10) : '');
      setWarrantyExpiry(asset.warrantyExpiry ? asset.warrantyExpiry.substring(0, 10) : '');
      setLocation(asset.location || '');
      setDynamicValues(asset.dynamicValues || {});
      setSerialNumber(asset.serialNumber || '');
    }
  }, [isOpen, asset]);

  // Handle type selection details (statuses, custom schema)
  useEffect(() => {
    if (assetTypeId && types.length > 0) {
      const typeDoc = types.find(t => t._id === assetTypeId);
      if (typeDoc) {
        setSelectedTypeSchema(typeDoc.dynamicFields || []);
        setAvailableStatuses(typeDoc.lifecycleStatuses || ['Active', 'In Store', 'Retired', 'Under Repair']);
        
        // Auto-select category if not selected or mismatching
        const matchCatId = typeDoc.categoryId?._id || typeDoc.categoryId;
        if (matchCatId && categoryId !== matchCatId) {
          setCategoryId(matchCatId);
        }
      }
    } else {
      setSelectedTypeSchema(null);
      setAvailableStatuses(['Active', 'In Store', 'Retired', 'Under Repair']);
    }
  }, [assetTypeId, types]);

  const handleDynamicFieldChange = (fieldKey, value, fieldType) => {
    let finalValue = value;
    if (fieldType === 'boolean') {
      finalValue = value === true || value === 'true';
    }
    setDynamicValues({
      ...dynamicValues,
      [fieldKey]: finalValue
    });
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Validation Error', 'Asset Name is required', 'error');
      return;
    }
    if (!categoryId) {
      addToast('Validation Error', 'Asset Category is required', 'error');
      return;
    }
    if (!assetTypeId) {
      addToast('Validation Error', 'Asset Type is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        categoryId,
        assetTypeId,
        departmentId: departmentId || null,
        ownerUserId: ownerUserId || null,
        ownerEmail: ownerEmail.trim().toLowerCase(),
        custodianUserId: custodianUserId || null,
        custodianEmail: custodianEmail.trim().toLowerCase(),
        status,
        purchaseDate: purchaseDate || null,
        warrantyExpiry: warrantyExpiry || null,
        location: location.trim(),
        dynamicValues,
        serialNumber: serialNumber.trim()
      };

      const response = await fetch(`/api/assets/${asset._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        addToast('Asset Updated', `Asset [${result.data?.assetCode || 'Inventory'}] saved successfully`, 'success');
        if (onSaveSuccess) onSaveSuccess(result.data);
        onClose();
      } else {
        addToast('Save Failed', result.message || 'Error occurred', 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to connect to server', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const renderDynamicInput = (field) => {
    const { fieldKey, label, type, required, options, placeholder } = field;
    const value = dynamicValues[fieldKey] !== undefined ? dynamicValues[fieldKey] : '';

    const selectStyle = { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' };

    switch (type) {
      case 'textarea':
        return (
          <textarea
            className="form-control form-control-sm"
            placeholder={placeholder}
            required={required}
            value={value}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={selectStyle}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            className="form-control form-control-sm"
            placeholder={placeholder}
            required={required}
            value={value}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={selectStyle}
          />
        );
      case 'date':
        return (
          <input
            type="date"
            className="form-control form-control-sm"
            required={required}
            value={value ? value.substring(0, 10) : ''}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={selectStyle}
          />
        );
      case 'datetime':
        return (
          <input
            type="datetime-local"
            className="form-control form-control-sm"
            required={required}
            value={value}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={selectStyle}
          />
        );
      case 'boolean':
        return (
          <div className="form-check form-switch pt-1">
            <input
              type="checkbox"
              className="form-check-input"
              checked={!!value}
              onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.checked, type)}
              id={`switch-${fieldKey}`}
              style={{ cursor: 'pointer' }}
            />
            <label className="form-check-label text-muted" htmlFor={`switch-${fieldKey}`} style={{ fontSize: '11px' }}>
              {label} (Yes/No)
            </label>
          </div>
        );
      case 'select':
        return (
          <select
            className="form-control form-control-sm"
            required={required}
            value={value}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={selectStyle}
          >
            <option value="">-- Choose Option --</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'user':
        return (
          <select
            className="form-control form-control-sm"
            required={required}
            value={value}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={selectStyle}
          >
            <option value="">-- Select Member --</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
            ))}
          </select>
        );
      case 'department':
        return (
          <select
            className="form-control form-control-sm"
            required={required}
            value={value}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={selectStyle}
          >
            <option value="">-- Select Department --</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        );
      case 'asset':
        return (
          <select
            className="form-control form-control-sm"
            required={required}
            value={value}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={selectStyle}
          >
            <option value="">-- Select Linked Asset --</option>
            {allAssetsList.filter(a => a._id !== asset._id).map((a) => (
              <option key={a._id} value={a._id}>{a.assetCode} - {a.name}</option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type={type}
            className="form-control form-control-sm"
            placeholder={placeholder}
            required={required}
            value={value}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={selectStyle}
          />
        );
    }
  };

  if (!isOpen || !asset) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1060,
      backdropFilter: 'blur(5px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--border-radius-lg)',
        width: '95%',
        maxWidth: '850px',
        maxHeight: '90vh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)'
        }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Edit Asset: {asset.assetCode}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Modify details and custom dynamic attributes of the configuration item.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '40px' }}>
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : (
          <form onSubmit={handleSaveSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <h5 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-color)', margin: 0 }}>
                1. Base Inventory Details
              </h5>

              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Asset Name</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Developer Laptop, HQ Router"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    required
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Category</label>
                  <select
                    className="form-control form-control-sm"
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setAssetTypeId('');
                    }}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    required
                  >
                    <option value="">-- Choose Category --</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Asset Type Schema</label>
                  <select
                    className="form-control form-control-sm"
                    value={assetTypeId}
                    onChange={(e) => setAssetTypeId(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    required
                  >
                    <option value="">-- Choose Type Schema --</option>
                    {types.filter(t => !categoryId || (t.categoryId?._id || t.categoryId) === categoryId).map((t) => (
                      <option key={t._id} value={t._id}>{t.name} ({t.assetPrefix})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row">
                <div className="col-md-3 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Serial Number</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. SN-89102-X"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Status</label>
                  <select
                    className="form-control form-control-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  >
                    {availableStatuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Department Assigned</label>
                  <select
                    className="form-control form-control-sm"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  >
                    <option value="">(None - Unassigned)</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Location / Office</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Server Room B"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label mb-0" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Owner Assigned</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOwnerManual(!isOwnerManual);
                        setOwnerUserId('');
                        setOwnerEmail('');
                      }}
                      className="btn btn-link p-0"
                      style={{ fontSize: '10.5px', textDecoration: 'none', color: 'var(--accent-color)' }}
                    >
                      {isOwnerManual ? 'Select Registered User' : 'Use Manual Email'}
                    </button>
                  </div>
                  {isOwnerManual ? (
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      placeholder="Enter owner email address..."
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                  ) : (
                    <select
                      className="form-control form-control-sm"
                      value={ownerUserId}
                      onChange={(e) => setOwnerUserId(e.target.value)}
                      style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    >
                      <option value="">(None - Unassigned)</option>
                      {users.map(u => (
                        <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="col-md-6 mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label mb-0" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Custodian Assigned</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustodianManual(!isCustodianManual);
                        setCustodianUserId('');
                        setCustodianEmail('');
                      }}
                      className="btn btn-link p-0"
                      style={{ fontSize: '10.5px', textDecoration: 'none', color: 'var(--accent-color)' }}
                    >
                      {isCustodianManual ? 'Select Registered User' : 'Use Manual Email'}
                    </button>
                  </div>
                  {isCustodianManual ? (
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      placeholder="Enter custodian email address..."
                      value={custodianEmail}
                      onChange={(e) => setCustodianEmail(e.target.value)}
                      style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                  ) : (
                    <select
                      className="form-control form-control-sm"
                      value={custodianUserId}
                      onChange={(e) => setCustodianUserId(e.target.value)}
                      style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    >
                      <option value="">(None - Unassigned)</option>
                      {users.map(u => (
                        <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Purchase Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Warranty Expiry</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>Asset Description</label>
                <textarea
                  className="form-control form-control-sm"
                  rows="2"
                  placeholder="Provide physical details or purchase details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>

              {/* Dynamic Specifications */}
              {selectedTypeSchema && selectedTypeSchema.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <h5 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-color)', marginBottom: '14px' }}>
                    2. Schema Dynamic Fields
                  </h5>
                  <div className="row">
                    {selectedTypeSchema.map((field) => (
                      <div className="col-md-6 mb-3" key={field.fieldKey}>
                        <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {field.label} {field.required && <span className="text-danger">*</span>}
                        </label>
                        {renderDynamicInput(field)}
                        {field.helpText && (
                          <div className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>
                            {field.helpText}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              borderTop: '1px solid var(--border-color)',
              padding: '16px 24px',
              background: 'var(--bg-secondary)',
              zIndex: 10
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSaving}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary d-flex align-items-center gap-2"
                disabled={isSaving}
                style={{ padding: '8px 16px' }}
              >
                <Save size={16} />
                {isSaving ? 'Saving Changes...' : 'Save Asset Details'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AssetEditModal;
