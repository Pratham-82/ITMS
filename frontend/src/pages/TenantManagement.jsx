import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Building2, Globe, ExternalLink, Edit3, Trash2, CheckCircle, 
  XCircle, Search, Save, AlertCircle, X, ShieldAlert
} from 'lucide-react';

const TenantManagement = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit Modal State
  const [editTenant, setEditTenant] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation State
  const [deleteTenantId, setDeleteTenantId] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tenants', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setTenants(result.data);
      } else {
        addToast('Error', result.message || 'Failed to fetch tenants', 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to connect to the server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchTenants();
    }
  }, [user]);

  const handleEditClick = (tenant) => {
    setEditTenant(tenant);
    setEditName(tenant.name);
    setEditIsActive(tenant.isActive);
  };

  const handleSaveTenant = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      addToast('Validation Error', 'Organization name cannot be empty', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/tenants/${editTenant._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          name: editName.trim(),
          isActive: editIsActive
        })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Success', 'Organization updated successfully', 'success');
        setEditTenant(null);
        fetchTenants();
      } else {
        addToast('Error', result.message || 'Failed to update tenant', 'error');
      }
    } catch (err) {
      addToast('Error', 'Connection failure', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (tenant) => {
    try {
      const response = await fetch(`/api/tenants/${tenant._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          isActive: !tenant.isActive
        })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Success', `Organization ${tenant.isActive ? 'deactivated' : 'activated'} successfully`, 'success');
        fetchTenants();
      } else {
        addToast('Error', result.message || 'Failed to update tenant status', 'error');
      }
    } catch (err) {
      addToast('Error', 'Connection failure', 'error');
    }
  };

  const handleDeleteTenant = async () => {
    if (deleteConfirmationText !== 'DELETE') {
      addToast('Validation Error', 'Please type DELETE to confirm', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/tenants/${deleteTenantId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        addToast('Success', 'Organization deleted permanently', 'success');
        setDeleteTenantId(null);
        setDeleteConfirmationText('');
        fetchTenants();
      } else {
        addToast('Error', result.message || 'Failed to delete organization', 'error');
      }
    } catch (err) {
      addToast('Error', 'Connection failure', 'error');
    }
  };

  const getWorkspaceUrl = (subdomain) => {
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
      return `http://${subdomain}.localhost${port}`;
    }
    const mainDomain = hostname.startsWith('www.') ? hostname.substring(4) : hostname;
    return `https://${subdomain}.${mainDomain}${port}`;
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subdomain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div>
          <h3 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '4px' }}>Customer Organizations</h3>
          <p className="text-muted" style={{ fontSize: '13px', marginBottom: '24px' }}>
            Manage SaaS customer registrations, subdomains, and operational statuses globally.
          </p>
        </div>
      </div>

      {/* Top Search bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--border-radius-md)',
        padding: '12px 16px',
        marginBottom: '24px',
        boxShadow: 'var(--box-shadow-sm)'
      }}>
        <Search size={18} className="text-muted" />
        <input 
          type="text"
          className="form-control"
          placeholder="Search organizations by name or subdomain..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ border: 'none', background: 'transparent', padding: 0, margin: 0, boxShadow: 'none' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
          Loading SaaS customer registers...
        </div>
      ) : filteredTenants.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          border: '1px dashed var(--border-color)', 
          borderRadius: 'var(--border-radius-md)',
          background: 'rgba(255, 255, 255, 0.01)'
        }} className="text-muted">
          <Building2 size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <div>No customer organizations found matching your search.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredTenants.map((tenant) => {
            const url = getWorkspaceUrl(tenant.subdomain);
            return (
              <div 
                key={tenant._id}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  boxShadow: 'var(--box-shadow-sm)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                {/* Status Indicator */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div 
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--accent-glow)',
                        color: 'var(--accent-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Building2 size={16} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                        {tenant.name}
                      </h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={11} /> {tenant.subdomain}
                      </span>
                    </div>
                  </div>
                  <span 
                    style={{
                      padding: '4px 10px',
                      borderRadius: '100px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: tenant.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: tenant.isActive ? '#10b981' : '#ef4444',
                      border: `1px solid ${tenant.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                    }}
                  >
                    {tenant.isActive ? 'Active' : 'Suspended'}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', flexGrow: 1 }}>
                  <div><strong>Portal Title:</strong> {tenant.branding?.websiteName || 'ApexResolve Portal'}</div>
                  <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.8 }}>
                    <strong>Registered:</strong> {new Date(tenant.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Launch & Actions */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  borderTop: '1px solid var(--border-color)', 
                  paddingTop: '16px',
                  marginTop: '8px'
                }}>
                  <a 
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '6px', 
                      fontSize: '12px', 
                      padding: '8px 12px' 
                    }}
                  >
                    <span>Launch</span>
                    <ExternalLink size={12} />
                  </a>
                  
                  <button 
                    onClick={() => handleEditClick(tenant)}
                    className="btn"
                    style={{ 
                      padding: '8px 10px', 
                      backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                      border: '1px solid var(--border-color)', 
                      color: 'var(--text-secondary)' 
                    }}
                    title="Edit profile"
                  >
                    <Edit3 size={14} />
                  </button>

                  <button 
                    onClick={() => handleToggleActive(tenant)}
                    className="btn"
                    style={{ 
                      padding: '8px 10px', 
                      backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                      border: '1px solid var(--border-color)', 
                      color: tenant.isActive ? '#ef4444' : '#10b981' 
                    }}
                    title={tenant.isActive ? 'Suspend organization' : 'Activate organization'}
                  >
                    {tenant.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                  </button>

                  <button 
                    onClick={() => setDeleteTenantId(tenant._id)}
                    className="btn"
                    style={{ 
                      padding: '8px 10px', 
                      backgroundColor: 'rgba(239, 68, 68, 0.05)', 
                      border: '1px solid rgba(239, 68, 68, 0.15)', 
                      color: '#ef4444' 
                    }}
                    title="Delete permanently"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Organization Modal */}
      {editTenant && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-lg)',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: 'var(--box-shadow-lg)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setEditTenant(null)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)' }}>
              Edit Organization
            </h3>
            <p className="text-muted" style={{ fontSize: '12.5px', marginBottom: '20px' }}>
              Update client parameters for workspace <strong>{editTenant.subdomain}</strong>.
            </p>

            <form onSubmit={handleSaveTenant} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Organization Name</label>
                <input 
                  type="text"
                  className="form-control"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <input 
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="editIsActive" style={{ cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}>
                  Organization Workspace Active
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button"
                  className="btn"
                  onClick={() => setEditTenant(null)}
                  style={{ flex: 1, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Save size={14} />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Permanent Confirmation Modal */}
      {deleteTenantId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--border-radius-lg)',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 10px 30px rgba(239, 68, 68, 0.1)',
            position: 'relative'
          }}>
            <button 
              onClick={() => { setDeleteTenantId(null); setDeleteConfirmationText(''); }}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '12px' }}>
              <ShieldAlert size={24} />
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                Delete Organization?
              </h3>
            </div>
            
            <p className="text-muted" style={{ fontSize: '13px', lineHeight: '20px', marginBottom: '20px' }}>
              This action is <strong className="text-danger">irreversible</strong>. It will delete the workspace record permanently. Customer staff and citizen accounts for this domain will lose access.
            </p>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input 
                type="text"
                className="form-control"
                placeholder="DELETE"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button"
                className="btn"
                onClick={() => { setDeleteTenantId(null); setDeleteConfirmationText(''); }}
                style={{ flex: 1, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={handleDeleteTenant}
                disabled={deleteConfirmationText !== 'DELETE'}
                style={{ 
                  flex: 1, 
                  backgroundColor: deleteConfirmationText === 'DELETE' ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
                  color: 'white',
                  border: 'none',
                  boxShadow: deleteConfirmationText === 'DELETE' ? '0 4px 14px rgba(239, 68, 68, 0.3)' : 'none'
                }}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantManagement;
