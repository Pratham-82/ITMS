import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, Trash, Edit, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, X, Save, Calendar, MapPin, Tag, Wrench, AlertCircle } from 'lucide-react';

const AssetManagementPage = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Inventory list states
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [allAssetsList, setAllAssetsList] = useState([]); // For asset lookup in dynamic fields

  // Pagination & Filtering
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterTicketStatus, setFilterTicketStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  // Form Mode
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  // Core Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [assetTypeId, setAssetTypeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [custodianUserId, setCustodianUserId] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [custodianEmail, setCustodianEmail] = useState('');
  const [isOwnerManual, setIsOwnerManual] = useState(false);
  const [isCustodianManual, setIsCustodianManual] = useState(false);
  const [status, setStatus] = useState('Active');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [location, setLocation] = useState('');
  const [dynamicValues, setDynamicValues] = useState({});
  const [serialNumber, setSerialNumber] = useState('');

  // Dynamic schema references
  const [selectedTypeSchema, setSelectedTypeSchema] = useState(null);
  const [availableStatuses, setAvailableStatuses] = useState(['Active', 'In Store', 'Retired', 'Under Repair']);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Inventory and dropdown prerequisites
  const fetchPrerequisites = async () => {
    try {
      const headers = { Authorization: `Bearer ${user.token}` };
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
    }
  };

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page,
        limit,
        search,
        categoryId: filterCategory,
        assetTypeId: filterType,
        status: filterStatus,
        departmentId: filterDept,
        hasTickets: filterTicketStatus
      });

      const response = await fetch(`/api/assets?${queryParams}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setAssets(result.data);
        setTotalPages(result.pagination?.pages || 1);
      } else {
        addToast('Error', result.message || 'Failed to fetch inventory', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchPrerequisites();
    }
  }, [user]);

  useEffect(() => {
    if (user?.token) {
      fetchAssets();
    }
  }, [user, page, filterCategory, filterType, filterStatus, filterDept, filterTicketStatus]);

  // Handle type selection logic: extracts lifecycle statuses and custom schema definition
  useEffect(() => {
    if (assetTypeId) {
      const typeDoc = types.find(t => t._id === assetTypeId);
      if (typeDoc) {
        setSelectedTypeSchema(typeDoc.dynamicFields || []);
        setAvailableStatuses(typeDoc.lifecycleStatuses || ['Active', 'In Store', 'Retired', 'Under Repair']);
        
        // Auto-select category if not selected or mismatching
        const matchCatId = typeDoc.categoryId?._id || typeDoc.categoryId;
        if (matchCatId && categoryId !== matchCatId) {
          setCategoryId(matchCatId);
        }

        // Initialize dynamic field defaults if not editing
        if (!isEditing) {
          const defaults = {};
          (typeDoc.dynamicFields || []).forEach(f => {
            defaults[f.fieldKey] = f.type === 'boolean' ? false : '';
          });
          setDynamicValues(defaults);
        }
      }
    } else {
      setSelectedTypeSchema(null);
      setAvailableStatuses(['Active', 'In Store', 'Retired', 'Under Repair']);
    }
  }, [assetTypeId, types]);

  // Filter type dropdown based on selected category in the form
  const filteredFormTypes = categoryId
    ? types.filter(t => (t.categoryId?._id || t.categoryId) === categoryId)
    : types;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAssets();
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditId(null);
    setName('');
    setDescription('');
    setCategoryId(categories.length > 0 ? categories[0]._id : '');
    setAssetTypeId('');
    setDepartmentId('');
    setOwnerUserId('');
    setOwnerEmail('');
    setIsOwnerManual(false);
    setCustodianUserId('');
    setCustodianEmail('');
    setIsCustodianManual(false);
    setStatus('Active');
    setPurchaseDate('');
    setWarrantyExpiry('');
    setLocation('');
    setDynamicValues({});
    setSerialNumber('');
    setIsFormOpen(true);
  };

  const handleEditClick = (asset) => {
    setIsEditing(true);
    setEditId(asset._id);
    setName(asset.name);
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
    
    // Load existing dynamic values
    setDynamicValues(asset.dynamicValues || {});
    setSerialNumber(asset.serialNumber || '');
    setIsFormOpen(true);
  };

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

  const handleSave = async (e) => {
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

      const url = isEditing ? `/api/assets/${editId}` : '/api/assets';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        addToast(
          isEditing ? 'Asset Updated' : 'Asset Registered',
          `Asset [${result.data?.assetCode || 'Inventory'}] saved successfully`,
          'success'
        );
        setIsFormOpen(false);
        fetchAssets();
      } else {
        addToast('Save Failed', result.message || 'Error occurred', 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to connect to server', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (asset) => {
    if (!window.confirm(`Are you sure you want to deactivate asset "${asset.name}" (${asset.assetCode})?`)) return;

    try {
      const response = await fetch(`/api/assets/${asset._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Asset Deactivated', `Asset Code ${asset.assetCode} retired.`, 'success');
        fetchAssets();
      } else {
        addToast('Action Failed', result.message || 'Failed to deactivate', 'error');
      }
    } catch (err) {
      addToast('Error', 'Communication failure', 'error');
    }
  };

  const getStatusColor = (s) => {
    const term = s.toLowerCase();
    if (term.includes('active') || term.includes('run') || term.includes('online')) return '#10b981';
    if (term.includes('store') || term.includes('spare') || term.includes('idle')) return '#0ea5e9';
    if (term.includes('repair') || term.includes('maintenance')) return '#f59e0b';
    return '#ef4444'; // retired / decommissioned
  };

  // Render input controls dynamically based on schema definitions
  const renderDynamicInput = (field) => {
    const { fieldKey, label, type, required, options, placeholder, helpText } = field;
    const value = dynamicValues[fieldKey] !== undefined ? dynamicValues[fieldKey] : '';

    switch (type) {
      case 'textarea':
        return (
          <textarea
            className="form-control form-control-sm"
            placeholder={placeholder}
            required={required}
            value={value}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
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
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
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
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
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
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
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
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
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
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
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
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
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
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
          >
            <option value="">-- Select Linked Asset --</option>
            {allAssetsList.filter(a => a._id !== editId).map((a) => (
              <option key={a._id} value={a._id}>{a.assetCode} - {a.name}</option>
            ))}
          </select>
        );
      default: // text, email, phone, url
        return (
          <input
            type={type}
            className="form-control form-control-sm"
            placeholder={placeholder}
            required={required}
            value={value}
            onChange={(e) => handleDynamicFieldChange(fieldKey, e.target.value, type)}
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
          />
        );
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* Form View Overlay/Toggle */}
      {isFormOpen ? (
        <div className="card-custom" style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <div className="d-flex justify-content-between align-items-center mb-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div>
              <h4 style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)', margin: 0 }}>
                {isEditing ? `Edit Asset: ${name}` : 'Register New Asset'}
              </h4>
              <p className="text-muted" style={{ fontSize: '12.5px', margin: '2px 0 0 0' }}>
                Fill out core information and custom dynamic field attributes.
              </p>
            </div>
            <button
              onClick={() => setIsFormOpen(false)}
              className="btn btn-secondary p-2 d-flex align-items-center justify-content-center"
              style={{ borderRadius: '8px' }}
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSave}>
            <h5 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-color)', marginBottom: '14px' }}>
              1. Base Inventory Details
            </h5>

            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Asset Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Developer Laptop, HQ Router"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  required
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Category</label>
                <select
                  className="form-control"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setAssetTypeId(''); // reset type on cat change
                  }}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  required
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Asset Type Schema</label>
                <select
                  className="form-control"
                  value={assetTypeId}
                  onChange={(e) => setAssetTypeId(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  required
                >
                  <option value="">-- Choose Type Schema --</option>
                  {filteredFormTypes.map((t) => (
                    <option key={t._id} value={t._id}>{t.name} ({t.assetPrefix})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row">
              <div className="col-md-3 mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Serial Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. SN-89102-X"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                />
              </div>

              <div className="col-md-3 mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Status</label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                >
                  {availableStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-3 mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Department Assigned</label>
                <select
                  className="form-control"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                >
                  <option value="">(None - Unassigned)</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-3 mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Location / Office</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Server Room B"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div className="row">
              <div className="col-md-3 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>Primary Owner</label>
                  <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}>
                    <input 
                      type="checkbox" 
                      checked={isOwnerManual} 
                      onChange={(e) => {
                        setIsOwnerManual(e.target.checked);
                        if (e.target.checked) setOwnerUserId('');
                        else setOwnerEmail('');
                      }} 
                    />
                    <span>Custom email</span>
                  </label>
                </div>
                {isOwnerManual ? (
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Enter Gmail or email address"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  />
                ) : (
                  <select
                    className="form-control"
                    value={ownerUserId}
                    onChange={(e) => {
                      setOwnerUserId(e.target.value);
                      const u = users.find(x => x._id === e.target.value);
                      setOwnerEmail(u ? u.email : '');
                    }}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  >
                    <option value="">(Select Owner)</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="col-md-3 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>Secondary Custodian</label>
                  <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}>
                    <input 
                      type="checkbox" 
                      checked={isCustodianManual} 
                      onChange={(e) => {
                        setIsCustodianManual(e.target.checked);
                        if (e.target.checked) setCustodianUserId('');
                        else setCustodianEmail('');
                      }} 
                    />
                    <span>Custom email</span>
                  </label>
                </div>
                {isCustodianManual ? (
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Enter Gmail or email address"
                    value={custodianEmail}
                    onChange={(e) => setCustodianEmail(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  />
                ) : (
                  <select
                    className="form-control"
                    value={custodianUserId}
                    onChange={(e) => {
                      setCustodianUserId(e.target.value);
                      const u = users.find(x => x._id === e.target.value);
                      setCustodianEmail(u ? u.email : '');
                    }}
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  >
                    <option value="">(Select Custodian)</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="col-md-3 mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Purchase Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                />
              </div>

              <div className="col-md-3 mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Warranty Expiry Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={warrantyExpiry}
                  onChange={(e) => setWarrantyExpiry(e.target.value)}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>General Asset Description</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Include serial numbers, model details, or vendor references..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
              />
            </div>

            {/* Dynamic Attributes Rendering */}
            {selectedTypeSchema && selectedTypeSchema.length > 0 && (
              <div style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h5 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-color)', marginBottom: '14px' }}>
                  2. Custom Configuration attributes ({selectedTypeSchema.length})
                </h5>

                <div className="row">
                  {selectedTypeSchema.map((field) => (
                    <div key={field.fieldKey} className="col-md-6 mb-3">
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        {field.label} {field.required && <span className="text-danger">*</span>}
                      </label>
                      {renderDynamicInput(field)}
                      {field.helpText && (
                        <div className="text-muted mt-1" style={{ fontSize: '11px' }}>{field.helpText}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                {isSaving ? 'Saving Asset...' : 'Save Asset Record'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsFormOpen(false)}
                style={{ borderRadius: '8px', padding: '10px 20px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Inventory List View */
        <div>
          {/* Header Controls */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h3 style={{ fontWeight: 800, fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag className="text-accent" size={22} />
                Asset Inventory & CMDB
              </h3>
              <p className="text-muted" style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
                Manage physical equipment, software deployment nodes, and configuration items.
              </p>
            </div>
            <button className="sh-wizard-btn d-flex align-items-center gap-2" onClick={handleOpenCreate}>
              <Plus size={15} />
              Register Asset
            </button>
          </div>

          {/* Filtering Bar */}
          <div className="card-custom mb-4" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '18px 24px'
          }}>
            <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
              <div className="col-md-2">
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search name, code..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      padding: '10px 10px 10px 34px',
                      fontSize: '12.5px'
                    }}
                  />
                </div>
              </div>

              <div className="col-md-2">
                <select
                  className="form-control form-control-sm"
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setFilterType('');
                    setPage(1);
                  }}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 10px', fontSize: '12.5px' }}
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <select
                  className="form-control form-control-sm"
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setPage(1);
                  }}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 10px', fontSize: '12.5px' }}
                >
                  <option value="">All Schemas</option>
                  {types
                    .filter(t => !filterCategory || (t.categoryId?._id || t.categoryId) === filterCategory)
                    .map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                </select>
              </div>

              <div className="col-md-1">
                <select
                  className="form-control form-control-sm"
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 10px', fontSize: '12.5px' }}
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="In Store">In Store</option>
                  <option value="Retired">Retired</option>
                  <option value="Under Repair">Under Repair</option>
                </select>
              </div>

              <div className="col-md-2">
                <select
                  className="form-control form-control-sm"
                  value={filterDept}
                  onChange={(e) => {
                    setFilterDept(e.target.value);
                    setPage(1);
                  }}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 10px', fontSize: '12.5px' }}
                >
                  <option value="">All Depts</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <select
                  className="form-control form-control-sm"
                  value={filterTicketStatus}
                  onChange={(e) => {
                    setFilterTicketStatus(e.target.value);
                    setPage(1);
                  }}
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '9px 10px', fontSize: '12.5px' }}
                >
                  <option value="">All Tickets</option>
                  <option value="true">With Tickets</option>
                  <option value="false">Without Tickets</option>
                </select>
              </div>

              <div className="col-md-1 d-grid">
                <button
                  type="submit"
                  className="btn btn-secondary d-flex align-items-center justify-content-center"
                  style={{ borderRadius: '8px', height: '38px' }}
                >
                  <Filter size={14} />
                </button>
              </div>
            </form>
          </div>

          {/* Table list */}
          {loading && assets.length === 0 ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : assets.length === 0 ? (
            <div className="card-custom text-center p-5" style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px'
            }}>
              <Tag size={40} className="text-muted mb-3" />
              <h5 style={{ fontWeight: 700 }}>No assets found</h5>
              <p className="text-muted" style={{ fontSize: '13px' }}>Try adjusting your filters or register a new asset.</p>
            </div>
          ) : (
            <div className="table-responsive" style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: 'var(--box-shadow-sm)'
            }}>
              <table className="table" style={{ margin: 0, color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Asset Code</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Name</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Category & Type</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Location</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Owner</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)' }} className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px 20px', fontWeight: 800, color: 'var(--accent-color)' }}>
                        <div>{asset.assetCode}</div>
                        {asset.serialNumber && (
                          <div className="text-muted" style={{ fontSize: '11px', fontWeight: 500, marginTop: '2px' }}>
                            S/N: {asset.serialNumber}
                          </div>
                        )}
                        {asset.hasTickets && (
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#fef3c7',
                            color: '#d97706',
                            border: '1px solid #fde68a',
                            marginTop: '5px',
                            display: 'inline-block'
                          }}>
                            Ticket Filed
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{asset.name}</div>
                        <div className="text-muted" style={{ fontSize: '11px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {asset.description || 'No description.'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{asset.assetTypeId?.name || 'Unknown Type'}</div>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {asset.categoryId?.name || 'Category'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '12px',
                          backgroundColor: `${getStatusColor(asset.status || 'Active')}15`,
                          color: getStatusColor(asset.status || 'Active'),
                          border: `1px solid ${getStatusColor(asset.status || 'Active')}30`
                        }}>
                          {asset.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '12.5px' }}>
                        <div className="d-flex align-items-center gap-1">
                          <MapPin size={12} className="text-muted" />
                          <span>{asset.location || 'N/A'}</span>
                        </div>
                        {asset.departmentId && (
                          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Dept: {asset.departmentId.name}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '12.5px' }}>
                        {asset.ownerUserId ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>{asset.ownerUserId.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{asset.ownerUserId.email}</div>
                          </div>
                        ) : asset.ownerEmail ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Unregistered Owner</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{asset.ownerEmail}</div>
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '11px' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px' }} className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <button
                            onClick={() => window.location.href = `/file-complaint?assetId=${asset._id}`}
                            className="btn btn-icon p-1"
                            title="File Complaint for Asset"
                            style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer' }}
                          >
                            <AlertCircle size={15} />
                          </button>
                          <button
                            onClick={() => window.location.href = `/service-portal?assetId=${asset._id}`}
                            className="btn btn-icon p-1"
                            title="Request Service for Asset"
                            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer' }}
                          >
                            <Wrench size={15} />
                          </button>
                          {user?.role === 'admin' && (
                            <>
                              {asset.hasTickets && (
                                <button
                                  onClick={() => handleEditClick(asset)}
                                  className="btn btn-icon p-1"
                                  title="Edit Asset"
                                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                >
                                  <Edit size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(asset)}
                                className="btn btn-icon p-1"
                                title="Deactivate / Retire"
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                              >
                                <Trash size={15} className="text-danger-hover" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination controls */}
              <div className="d-flex justify-content-between align-items-center p-3" style={{ backgroundColor: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', fontSize: '12.5px' }}>
                <span className="text-muted">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </span>
                <div className="d-flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="btn btn-secondary d-flex align-items-center justify-content-center p-2"
                    style={{ borderRadius: '6px' }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="btn btn-secondary d-flex align-items-center justify-content-center p-2"
                    style={{ borderRadius: '6px' }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetManagementPage;
