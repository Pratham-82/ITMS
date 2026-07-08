import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Plus, Edit, Save, RefreshCw, ToggleLeft, ToggleRight, Check, 
  HelpCircle, AlertTriangle, ClipboardList, MessageSquare, LifeBuoy, CheckSquare
} from 'lucide-react';

const COLORS = [
  { name: 'Amber (Complaint)', value: '#f59e0b' },
  { name: 'Red (Incident)', value: '#ef4444' },
  { name: 'Blue (Request)', value: '#3b82f6' },
  { name: 'Purple (Problem)', value: '#8b5cf6' },
  { name: 'Green (Change)', value: '#10b981' },
  { name: 'Gray (Task)', value: '#6b7280' },
  { name: 'Teal', value: '#06b6d4' },
  { name: 'Indigo', value: '#6366f1' }
];

const ICONS = [
  'MessageSquare', 'AlertTriangle', 'ClipboardList', 'LifeBuoy', 'HelpCircle', 'CheckSquare',
  'Laptop', 'Server', 'Key', 'Shield', 'Settings'
];

const TicketTypeManagement = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [allowedRoles, setAllowedRoles] = useState(['citizen', 'admin']);
  const [enableSla, setEnableSla] = useState(true);
  const [enableEscalation, setEnableEscalation] = useState(true);
  const [enableAiRouting, setEnableAiRouting] = useState(true);
  const [enableDuplicateDetection, setEnableDuplicateDetection] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tickets/types', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setTypes(result.data);
      } else {
        addToast('Error', result.message || 'Failed to fetch ticket types', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchTypes();
    }
  }, [user]);

  const resetForm = () => {
    setName('');
    setCode('');
    setDescription('');
    setSelectedColor(COLORS[0].value);
    setSelectedIcon(ICONS[0]);
    setAllowedRoles(['citizen', 'admin']);
    setEnableSla(true);
    setEnableEscalation(true);
    setEnableAiRouting(true);
    setEnableDuplicateDetection(true);
    setIsActive(true);
    setIsEditing(false);
    setEditId(null);
  };

  const handleEditClick = (t) => {
    setIsEditing(true);
    setEditId(t._id);
    setName(t.name);
    setCode(t.code);
    setDescription(t.description || '');
    setSelectedColor(t.color || COLORS[0].value);
    setSelectedIcon(t.icon || ICONS[0]);
    setAllowedRoles(t.allowedRoles || ['citizen', 'admin']);
    setEnableSla(t.settings?.enableSla !== false);
    setEnableEscalation(t.settings?.enableEscalation !== false);
    setEnableAiRouting(t.settings?.enableAiRouting !== false);
    setEnableDuplicateDetection(t.settings?.enableDuplicateDetection !== false);
    setIsActive(t.isActive !== false);
  };

  const handleRoleToggle = (role) => {
    if (allowedRoles.includes(role)) {
      setAllowedRoles(allowedRoles.filter(r => r !== role));
    } else {
      setAllowedRoles([...allowedRoles, role]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Validation Error', 'Ticket type name is required', 'error');
      return;
    }
    if (!code.trim()) {
      addToast('Validation Error', 'Prefix code is required', 'error');
      return;
    }
    if (allowedRoles.length === 0) {
      addToast('Validation Error', 'Please select at least one allowed role', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const url = isEditing ? `/api/tickets/types/${editId}` : '/api/tickets/types';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
          color: selectedColor,
          icon: selectedIcon,
          allowedRoles,
          settings: {
            enableSla,
            enableEscalation,
            enableAiRouting,
            enableDuplicateDetection
          },
          isActive
        })
      });

      const result = await response.json();
      if (result.success) {
        addToast('Success', `Ticket type ${isEditing ? 'updated' : 'created'} successfully`, 'success');
        resetForm();
        fetchTypes();
      } else {
        addToast('Error', result.message || 'Operation failed', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server processing error', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (id, currentActive) => {
    try {
      const response = await fetch(`/api/tickets/types/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ isActive: !currentActive })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Success', `Ticket type status updated`, 'success');
        fetchTypes();
      } else {
        addToast('Error', result.message || 'Operation failed', 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to update status', 'error');
    }
  };

  return (
    <div className="fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 style={{ fontWeight: 800, fontSize: '20px', margin: 0 }}>Ticket Types Management</h3>
          <p className="text-muted" style={{ fontSize: '13px', margin: 0 }}>
            Configure and customize metadata parameters, SLA behaviors, and routing permissions per Ticket Type.
          </p>
        </div>
      </div>

      <div className="row">
        {/* Left Side: Form */}
        <div className="col-lg-4 mb-4">
          <div className="card p-4 shadow-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h5 className="mb-3" style={{ fontWeight: 700 }}>
              {isEditing ? 'Edit Ticket Type' : 'Create Ticket Type'}
            </h5>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Type Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Incident"
                  disabled={isEditing}
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Prefix Code</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. INC"
                  maxLength={5}
                  disabled={isEditing}
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', textTransform: 'uppercase' }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Description</label>
                <textarea 
                  className="form-control" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain when this ticket type should be used..."
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Allowed Roles</label>
                <div className="d-flex gap-3">
                  <label className="d-flex align-items-center gap-2" style={{ cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={allowedRoles.includes('citizen')} 
                      onChange={() => handleRoleToggle('citizen')}
                    />
                    Citizen
                  </label>
                  <label className="d-flex align-items-center gap-2" style={{ cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={allowedRoles.includes('admin')} 
                      onChange={() => handleRoleToggle('admin')}
                    />
                    Admin / Staff
                  </label>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Behavioral Policies</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: '12.5px' }}>
                    <span>Enable SLA Monitoring</span>
                    <button type="button" onClick={() => setEnableSla(!enableSla)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)' }}>
                      {enableSla ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </label>
                  <label className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: '12.5px' }}>
                    <span>Enable Escalation Engine</span>
                    <button type="button" onClick={() => setEnableEscalation(!enableEscalation)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)' }}>
                      {enableEscalation ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </label>
                  <label className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: '12.5px' }}>
                    <span>Enable AI Auto-Routing</span>
                    <button type="button" onClick={() => setEnableAiRouting(!enableAiRouting)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)' }}>
                      {enableAiRouting ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </label>
                  <label className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: '12.5px' }}>
                    <span>Duplicate Detection</span>
                    <button type="button" onClick={() => setEnableDuplicateDetection(!enableDuplicateDetection)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color)' }}>
                      {enableDuplicateDetection ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </label>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Palette Color</label>
                <div className="d-flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button 
                      key={c.value}
                      type="button"
                      onClick={() => setSelectedColor(c.value)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: c.value,
                        border: selectedColor === c.value ? '2px solid white' : 'none',
                        outline: selectedColor === c.value ? '2px solid var(--accent-color)' : 'none',
                        cursor: 'pointer'
                      }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Associated Icon</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                  {ICONS.map(iconName => (
                    <button 
                      key={iconName}
                      type="button"
                      onClick={() => setSelectedIcon(iconName)}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        background: selectedIcon === iconName ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        color: selectedIcon === iconName ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                      title={iconName}
                    >
                      {iconName === 'AlertTriangle' && <AlertTriangle size={14} />}
                      {iconName === 'ClipboardList' && <ClipboardList size={14} />}
                      {iconName === 'MessageSquare' && <MessageSquare size={14} />}
                      {iconName === 'LifeBuoy' && <LifeBuoy size={14} />}
                      {iconName === 'HelpCircle' && <HelpCircle size={14} />}
                      {iconName === 'CheckSquare' && <CheckSquare size={14} />}
                      {iconName !== 'AlertTriangle' && iconName !== 'ClipboardList' && iconName !== 'MessageSquare' && iconName !== 'LifeBuoy' && iconName !== 'HelpCircle' && iconName !== 'CheckSquare' && <HelpCircle size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="d-flex gap-2">
                <button 
                  type="submit" 
                  className="btn btn-primary d-flex align-items-center gap-2"
                  disabled={isSaving}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{isEditing ? 'Update Policy' : 'Create Type'}</span>
                </button>
                {isEditing && (
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Side: List Table */}
        <div className="col-lg-8">
          <div className="card p-4 shadow-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h5 className="mb-3" style={{ fontWeight: 700 }}>Available Ticket Types</h5>
            {loading ? (
              <div className="p-5 text-center">
                <RefreshCw size={24} className="animate-spin text-accent" />
                <div className="mt-2 text-muted">Retrieving configurations...</div>
              </div>
            ) : types.length === 0 ? (
              <div className="p-5 text-center text-muted">No custom ticket types defined.</div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle" style={{ color: 'var(--text-primary)' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Allowed Roles</th>
                      <th>SLA / AI / Dup</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map(t => (
                      <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td>
                          <span className="badge" style={{ backgroundColor: t.color || '#6366f1', color: 'white', fontWeight: 700, padding: '6px 10px' }}>
                            {t.code}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{t.name}</div>
                        </td>
                        <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.description || 'No description'}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          {t.allowedRoles?.map(role => (
                            <span key={role} className="badge bg-secondary me-1" style={{ fontSize: '10px' }}>{role}</span>
                          ))}
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <div>SLA: {t.settings?.enableSla ? '✓' : '✗'}</div>
                          <div>AI: {t.settings?.enableAiRouting ? '✓' : '✗'}</div>
                          <div>Dup: {t.settings?.enableDuplicateDetection ? '✓' : '✗'}</div>
                        </td>
                        <td>
                          <span className={`badge ${t.isActive ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '11px' }}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-end">
                          <button 
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => handleEditClick(t)}
                            title="Edit configurations"
                          >
                            <Edit size={12} />
                          </button>
                          <button 
                            className={`btn btn-sm ${t.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                            onClick={() => handleDeactivate(t._id, t.isActive)}
                            title={t.isActive ? 'Deactivate type' : 'Activate type'}
                          >
                            {t.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketTypeManagement;
