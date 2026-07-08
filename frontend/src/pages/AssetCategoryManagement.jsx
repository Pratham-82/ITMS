import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, Trash, Edit, Layers, Save, RefreshCw, ToggleLeft, ToggleRight, Check } from 'lucide-react';

const COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Teal', value: '#06b6d4' },
  { name: 'Slate', value: '#64748b' }
];

const ICONS = [
  'Laptop', 'Server', 'Network', 'Folder', 'Database', 'HardDrive',
  'Cpu', 'Shield', 'Key', 'Car', 'Wrench', 'Package', 'HelpCircle', 'Building2'
];

const AssetCategoryManagement = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/asset-categories', {
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

  useEffect(() => {
    if (user?.token) {
      fetchCategories();
    }
  }, [user]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedColor(COLORS[0].value);
    setSelectedIcon(ICONS[0]);
    setIsEditing(false);
    setEditId(null);
  };

  const handleEditClick = (cat) => {
    setIsEditing(true);
    setEditId(cat._id);
    setName(cat.name);
    setDescription(cat.description || '');
    setSelectedColor(cat.color || COLORS[0].value);
    setSelectedIcon(cat.icon || ICONS[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Validation Error', 'Category name is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const url = isEditing ? `/api/asset-categories/${editId}` : '/api/asset-categories';
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
          color: selectedColor,
          icon: selectedIcon
        })
      });

      const result = await response.json();
      if (result.success) {
        addToast(
          isEditing ? 'Category Updated' : 'Category Created',
          `Asset Category "${name}" saved successfully`,
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

  const handleToggleActive = async (cat) => {
    try {
      const response = await fetch(`/api/asset-categories/${cat._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ isActive: !cat.isActive })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Status Updated', `Category is now ${!cat.isActive ? 'Active' : 'Inactive'}`, 'success');
        fetchCategories();
      } else {
        addToast('Update Failed', result.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to update category status', 'error');
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"? This cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/asset-categories/${cat._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Category Deleted', `${cat.name} removed successfully`, 'success');
        fetchCategories();
      } else {
        addToast('Delete Failed', result.message || 'Error deleting category', 'error');
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
            <Layers className="text-accent" size={22} />
            Asset Categories
          </h3>
          <p className="text-muted" style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
            Configure root asset groups and categorizations.
          </p>
        </div>
        <button className="sh-wizard-btn d-flex align-items-center gap-2" onClick={fetchCategories} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="row">
        {/* Left Form Panel */}
        <div className="col-md-5 mb-4">
          <div className="card-custom" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h4 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '20px', color: 'var(--text-primary)' }}>
              {isEditing ? 'Modify Category' : 'Create Asset Category'}
            </h4>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Category Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. IT Hardware, Vehicles"
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

              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Enter details about this asset classification..."
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

              {/* Color Picker */}
              <div className="mb-3">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)', display: 'block' }}>Theme Color</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setSelectedColor(color.value)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: color.value,
                        border: selectedColor === color.value ? '2.5px solid white' : '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: selectedColor === color.value ? `0 0 10px ${color.value}` : 'none',
                        transition: 'all 0.2s ease'
                      }}
                      title={color.name}
                    >
                      {selectedColor === color.value && <Check size={14} style={{ color: 'white' }} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Picker */}
              <div className="mb-4">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-secondary)' }}>Representative Icon</label>
                <select
                  className="form-control"
                  value={selectedIcon}
                  onChange={(e) => setSelectedIcon(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    padding: '10px'
                  }}
                >
                  {ICONS.map((icon) => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
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
                  {isSaving ? 'Saving...' : 'Save Category'}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetForm}
                    style={{
                      borderRadius: '8px',
                      padding: '10px 20px'
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Categories Grid */}
        <div className="col-md-7">
          {loading && categories.length === 0 ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : categories.length === 0 ? (
            <div className="card-custom text-center p-5" style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px'
            }}>
              <Layers size={40} className="text-muted mb-3" />
              <h5 style={{ fontWeight: 700 }}>No categories configured</h5>
              <p className="text-muted" style={{ fontSize: '13px' }}>Create your first category using the left panel.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              {categories.map((cat) => (
                <div
                  key={cat._id}
                  className="card-custom d-flex justify-content-between align-items-center"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '18px 24px',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                    boxShadow: 'var(--box-shadow-sm)',
                    borderLeft: `5px solid ${cat.color || 'var(--accent-color)'}`
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: `${cat.color || '#6366f1'}15`,
                      border: `1px solid ${cat.color || '#6366f1'}40`,
                      color: cat.color || '#6366f1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800
                    }}>
                      <span style={{ fontSize: '12px' }}>{cat.icon ? cat.icon.substring(0, 3).toUpperCase() : 'CAT'}</span>
                    </div>

                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <h4 style={{ fontWeight: 700, fontSize: '14.5px', margin: 0, color: 'var(--text-primary)' }}>{cat.name}</h4>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: cat.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: cat.isActive ? '#10b981' : '#ef4444'
                        }}>
                          {cat.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-muted" style={{ fontSize: '12.5px', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                        {cat.description || 'No description provided.'}
                      </p>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      onClick={() => handleToggleActive(cat)}
                      className="btn btn-icon"
                      style={{
                        padding: '6px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                      title={cat.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {cat.isActive ? <ToggleRight size={22} className="text-success" /> : <ToggleLeft size={22} className="text-muted" />}
                    </button>
                    <button
                      onClick={() => handleEditClick(cat)}
                      className="btn btn-icon"
                      style={{
                        padding: '6px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                      title="Edit Category"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="btn btn-icon"
                      style={{
                        padding: '6px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                      title="Delete Category"
                    >
                      <Trash size={16} className="text-danger-hover" />
                    </button>
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

export default AssetCategoryManagement;
