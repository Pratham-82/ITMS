import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Folder, FolderPlus, Edit, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import '../styles/ServiceCatalogMgmt.css';

const ServiceCatalogMgmt = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Folder');
  const [color, setColor] = useState('#6366f1');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const colors = [
    '#6366f1', // Indigo
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#14b8a6', // Teal
  ];

  const icons = [
    { name: 'Folder', label: 'Default Folder' },
    { name: 'Server', label: 'Infrastructure' },
    { name: 'Cpu', label: 'IT Services' },
    { name: 'Building2', label: 'Facilities' },
    { name: 'Users', label: 'HR / Teams' },
    { name: 'FileText', label: 'Documentation' },
    { name: 'Activity', label: 'Operations' },
    { name: 'ShieldAlert', label: 'Security' }
  ];

  useEffect(() => {
    if (user?.token) {
      fetchCatalogs();
    }
  }, [user]);

  const fetchCatalogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/service-catalogs', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setCatalogs(json.data || []);
      } else {
        addToast('Error', json.message || 'Failed to fetch service catalogs', 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to communicate with the server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (catalog) => {
    setEditingId(catalog._id);
    setName(catalog.name);
    setDescription(catalog.description || '');
    setIcon(catalog.icon || 'Folder');
    setColor(catalog.color || '#6366f1');
    setIsActive(catalog.isActive);
  };

  const handleCancel = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setIcon('Folder');
    setColor('#6366f1');
    setIsActive(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Validation Error', 'Catalog name is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingId ? `/api/service-catalogs/${editingId}` : '/api/service-catalogs';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          icon,
          color,
          isActive
        })
      });
      const json = await res.json();
      if (json.success) {
        addToast(
          'Success',
          `Service catalog ${editingId ? 'updated' : 'created'} successfully`,
          'success'
        );
        handleCancel();
        fetchCatalogs();
      } else {
        addToast('Error', json.message || 'Failed to save service catalog', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (catalog) => {
    try {
      const res = await fetch(`/api/service-catalogs/${catalog._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ isActive: !catalog.isActive })
      });
      const json = await res.json();
      if (json.success) {
        addToast(
          'Status Updated',
          `Catalog "${catalog.name}" is now ${!catalog.isActive ? 'Active' : 'Inactive'}`,
          'success'
        );
        fetchCatalogs();
      } else {
        addToast('Error', json.message || 'Failed to update catalog status', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    }
  };

  return (
    <div className="scm-container">
      {/* Form Card */}
      <div className="scm-form-card">
        <h3 className="scm-card-title">
          <FolderPlus size={18} />
          {editingId ? 'Edit Service Catalog' : 'Create Service Catalog'}
        </h3>
        <p className="scm-card-subtitle">
          Configure a service catalog grouping to classify services for citizens.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="scm-input-group">
            <label htmlFor="catalog-name">Catalog Name</label>
            <div className="scm-input-icon-wrapper">
              <Folder size={16} className="scm-input-icon" />
              <input
                id="catalog-name"
                type="text"
                placeholder="e.g. IT & Software Services"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="scm-icon-input"
                required
              />
            </div>
          </div>

          <div className="scm-input-group">
            <label htmlFor="catalog-desc">Description</label>
            <textarea
              id="catalog-desc"
              placeholder="Provide a brief description of the services categorized under this catalog..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="scm-icon-input"
              style={{ minHeight: '80px', paddingLeft: '16px' }}
            />
          </div>

          <div className="scm-input-group">
            <label>Lucide Icon Symbol</label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="scm-icon-input"
              style={{ paddingLeft: '16px' }}
            >
              {icons.map((ic) => (
                <option key={ic.name} value={ic.name}>
                  {ic.label}
                </option>
              ))}
            </select>
          </div>

          <div className="scm-input-group">
            <label>Branding Theme Color</label>
            <div className="scm-color-picker-grid">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`scm-color-dot ${color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {editingId && (
            <div className="scm-input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="catalog-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
              />
              <label htmlFor="catalog-active" style={{ margin: 0, cursor: 'pointer' }}>Active (Visible to citizens)</label>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="submit"
              disabled={isSaving}
              className="scm-btn scm-btn-primary"
              style={{ flex: 1 }}
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Catalog' : 'Create Catalog'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="scm-btn scm-btn-secondary"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List Card */}
      <div className="scm-form-card" style={{ height: 'fit-content' }}>
        <h3 className="scm-card-title">
          <Folder size={18} />
          Active Catalogs
        </h3>
        <p className="scm-card-subtitle">
          Manage existing service catalog groupings.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            Loading catalogs...
          </div>
        ) : catalogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No catalogs created yet. Use the creation console to create your first one.
          </div>
        ) : (
          <div className="scm-list-container">
            {catalogs.map((catalog) => (
              <div key={catalog._id} className="scm-item-card">
                <div className="scm-item-row">
                  <div className="scm-avatar-icon" style={{ backgroundColor: catalog.color }}>
                    <Folder size={20} />
                  </div>
                  <div className="scm-info-col">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="scm-catalog-name">{catalog.name}</span>
                      <span className={`scm-badge ${catalog.isActive ? 'scm-badge-active' : 'scm-badge-inactive'}`}>
                        {catalog.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="scm-catalog-desc">
                      {catalog.description || 'No description provided.'}
                    </div>
                  </div>
                  <div className="scm-actions-col">
                    <button
                      onClick={() => handleEdit(catalog)}
                      className="scm-btn scm-btn-secondary"
                      style={{ padding: '6px 10px' }}
                      title="Edit Catalog Details"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(catalog)}
                      className="scm-btn scm-btn-secondary"
                      style={{ padding: '6px 10px', color: catalog.isActive ? 'var(--status-rejected-text)' : 'var(--accent-color)' }}
                      title={catalog.isActive ? 'Deactivate Catalog' : 'Activate Catalog'}
                    >
                      {catalog.isActive ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceCatalogMgmt;
