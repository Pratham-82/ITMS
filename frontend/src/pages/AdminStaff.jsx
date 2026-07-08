import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserPlus, Users, Key, Mail, User, Shield, RefreshCw, Building2, ChevronDown } from 'lucide-react';
import '../styles/AdminStaff.css';

const AdminStaff = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [admins, setAdmins] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // New States for Citizens
  const [activeUserTab, setActiveUserTab] = useState('staff'); // 'staff' | 'citizens'
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Permissions States
  const [selectedAdminId, setSelectedAdminId] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState(null);

  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('General Administration');
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleGroup = (groupId) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  const handleToggleEditPermissions = (admin) => {
    const defaultPermissions = {
      allowAll: true,
      systemSettings: false,
      slaSettings: false,
      escalationRules: false,
      escalationAnalytics: true,
      manageFields: true,
      manageStaff: false,
      manageDepartments: true
    };
    if (selectedAdminId === admin._id) {
      setSelectedAdminId(null);
      setSelectedPermissions(null);
    } else {
      setSelectedAdminId(admin._id);
      setSelectedPermissions({
        ...defaultPermissions,
        ...(admin.settingsPermissions || {})
      });
    }
  };

  const handleSavePermissions = async (adminId) => {
    try {
      const response = await fetch(`/api/auth/admins/${adminId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ settingsPermissions: selectedPermissions })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Permissions Saved', 'Administrator settings permissions updated successfully', 'success');
        setSelectedAdminId(null);
        setSelectedPermissions(null);
        fetchAdmins();
      } else {
        addToast('Error', result.message || 'Failed to update permissions', 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to communicate with server', 'error');
    }
  };

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/admins', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setAdmins(result.data);
      } else {
        addToast('Error', result.message || 'Failed to retrieve admin staff list', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/auth/users', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setUsers(result.data || []);
      } else {
        addToast('Error', result.message || 'Failed to retrieve user list', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoadingUsers(false);
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
        setDepartments(result.data);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setGroups(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };

  useEffect(() => {
    if (user?.token) {
      if (activeUserTab === 'staff') {
        fetchAdmins();
        fetchGroups();
      } else {
        fetchUsers();
      }
      fetchDepartments();
    }
  }, [user, activeUserTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isStaff = activeUserTab === 'staff';

    if (isStaff) {
      if (!name.trim() || !email.trim() || !password.trim() || selectedGroups.length === 0) {
        addToast('Validation Error', 'All fields are mandatory, and at least one support group must be selected', 'error');
        return;
      }
    } else {
      if (!name.trim() || !email.trim() || !password.trim()) {
        addToast('Validation Error', 'Name, Email and Password are required', 'error');
        return;
      }
    }

    if (password.length < 6) {
      addToast('Validation Error', 'Password must be at least 6 characters', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(isStaff ? '/api/auth/admins' : '/api/auth/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          role: isStaff ? 'admin' : 'citizen',
          department: isStaff ? 'General Administration' : '',
          groups: isStaff ? selectedGroups : []
        })
      });

      const result = await response.json();
      if (result.success) {
        addToast('Account Created', `${isStaff ? 'Officer' : 'Citizen'} account "${name}" registered successfully`, 'success');
        setName('');
        setEmail('');
        setPassword('');
        setDepartment('General Administration');
        setSelectedGroups([]);
        if (isStaff) {
          fetchAdmins();
        } else {
          fetchUsers();
        }
      } else {
        addToast('Registration Failed', result.message || 'Error creating account', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="as-container-wrapper" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* User Management Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '4px',
        width: 'fit-content'
      }}>
        <button
          onClick={() => { setActiveUserTab('staff'); setName(''); setEmail(''); setPassword(''); }}
          style={{
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: activeUserTab === 'staff' ? 'var(--accent-color)' : 'transparent',
            color: activeUserTab === 'staff' ? 'white' : 'var(--text-secondary)',
            boxShadow: activeUserTab === 'staff' ? '0 2px 8px var(--accent-glow)' : 'none'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} />
            Staff Members
          </span>
        </button>
        <button
          onClick={() => { setActiveUserTab('citizens'); setName(''); setEmail(''); setPassword(''); }}
          style={{
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: activeUserTab === 'citizens' ? 'var(--accent-color)' : 'transparent',
            color: activeUserTab === 'citizens' ? 'white' : 'var(--text-secondary)',
            boxShadow: activeUserTab === 'citizens' ? '0 2px 8px var(--accent-glow)' : 'none'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={14} />
            Registered Citizens
          </span>
        </button>
      </div>

      <div className="as-container">
        
        {/* Add User Form */}
        <div className="form-card as-form-card">
          <h2 className="as-card-title">
            <UserPlus size={20} className="text-accent" />
            <span>{activeUserTab === 'staff' ? 'Register New Officer / Admin' : 'Register New Citizen'}</span>
          </h2>
          <p className="as-card-subtitle">
            {activeUserTab === 'staff' 
              ? 'Assign administrative authority to a new staff member.'
              : 'Manually register a citizen profile in this organization workspace.'}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <div className="as-input-icon-wrapper">
                <User size={16} className="as-input-icon" />
                <input 
                  type="text" 
                  className="form-control as-icon-input" 
                  placeholder={activeUserTab === 'staff' ? "e.g. Officer Bob" : "e.g. Jane Doe"} 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <div className="as-input-icon-wrapper">
                <Mail size={16} className="as-input-icon" />
                <input 
                  type="email" 
                  className="form-control as-icon-input" 
                  placeholder={activeUserTab === 'staff' ? "e.g. bob@apex.com" : "e.g. jane@example.com"} 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <div className="as-input-icon-wrapper">
                <Key size={16} className="as-input-icon" />
                <input 
                  type="password" 
                  className="form-control as-icon-input" 
                  placeholder="Min. 6 characters" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {activeUserTab === 'staff' ? (
              <div className="form-group">
                <label className="form-label">Support Groups / Teams *</label>
                <div className="as-custom-dropdown-container" ref={dropdownRef}>
                  <button
                    type="button"
                    className="form-control as-custom-dropdown-trigger"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    disabled={groups.length === 0}
                  >
                    <Users size={16} className="as-dropdown-trigger-icon" />
                    <span className="as-dropdown-trigger-text">
                      {selectedGroups.length === 0
                        ? "-- Choose Support Groups / Teams --"
                        : groups
                            .filter(g => selectedGroups.includes(g._id))
                            .map(g => g.name)
                            .join(', ')}
                    </span>
                    <ChevronDown size={16} className={`as-dropdown-arrow ${isDropdownOpen ? 'open' : ''}`} />
                  </button>

                  {isDropdownOpen && (
                    <div className="as-custom-dropdown-menu">
                      {groups.length === 0 ? (
                        <div className="as-dropdown-no-groups">No support groups available</div>
                      ) : (
                        groups.map((g) => {
                          const isChecked = selectedGroups.includes(g._id);
                          return (
                            <div
                              key={g._id}
                              className={`as-dropdown-item ${isChecked ? 'selected' : ''}`}
                              onClick={() => handleToggleGroup(g._id)}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // toggled by row click
                                className="as-dropdown-checkbox"
                              />
                              <div className="as-dropdown-item-text">
                                <span className="as-dropdown-item-name">{g.name}</span>
                                <span className="as-dropdown-item-desc">
                                  ({g.description || g.department?.name || 'No Description'})
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Department / Course (Optional)</label>
                <div className="as-input-icon-wrapper">
                  <Building2 size={16} className="as-input-icon" />
                  <select 
                    className="form-control as-icon-input" 
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="">-- Choose Department / Course --</option>
                    {departments.filter(d => d.isActive).map((d) => (
                      <option key={d._id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary btn-block as-submit-btn" 
              disabled={isSaving}
            >
              {isSaving 
                ? (activeUserTab === 'staff' ? 'Registering Officer...' : 'Registering Citizen...') 
                : (activeUserTab === 'staff' ? 'Create Admin Account' : 'Create Citizen Account')}
            </button>
          </form>
        </div>

        {/* User List Panel */}
        <div className="dashboard-panel as-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <Users size={20} className="text-accent" />
              <span>{activeUserTab === 'staff' ? 'Active Officers & Staff' : 'Registered Citizens'}</span>
            </h2>
            <button className="theme-toggle" onClick={activeUserTab === 'staff' ? fetchAdmins : fetchUsers} title="Reload list">
              <RefreshCw size={14} />
            </button>
          </div>

          {activeUserTab === 'staff' ? (
            loading ? (
              <div className="as-loading">Loading staff...</div>
            ) : admins.length === 0 ? (
              <div className="as-empty">
                No admin users found.
              </div>
            ) : (
              <div className="as-list-container">
                {admins.map((admin) => {
                  const loggedInIsSuperAdmin = !user.department || user.department === 'General Administration';
                  const showConfigButton = loggedInIsSuperAdmin && admin._id !== user._id;

                  return (
                    <div key={admin._id} className="as-item-card">
                      <div className="as-item-row">
                        <div className="as-avatar-icon">
                          <Shield size={18} />
                        </div>
                        <div className="as-info-col">
                          <div className="as-admin-name">
                            {admin.name} {admin._id === user._id && '(You)'}
                          </div>
                          <div className="as-meta-row" style={{ flexWrap: 'wrap', gap: '6px' }}>
                            <span>{admin.email}</span>
                            <span>•</span>
                            {admin.groups && admin.groups.length > 0 ? (
                              admin.groups.map(g => (
                                <span key={g._id} className="as-dept-badge" style={{ marginRight: '4px' }}>{g.name}</span>
                              ))
                            ) : (
                              <span className="as-dept-badge" style={{ opacity: 0.7 }}>General Admin (No Group)</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="as-actions-col">
                          {showConfigButton && (
                            <button
                              onClick={() => handleToggleEditPermissions(admin)}
                              className={`btn as-permissions-btn ${selectedAdminId === admin._id ? 'btn-primary' : 'btn-secondary'}`}
                            >
                              Permissions
                            </button>
                          )}
                          <div className="as-role-badge">
                            Admin
                          </div>
                        </div>
                      </div>

                      {/* Expandable permissions configuration panel */}
                      {selectedAdminId === admin._id && selectedPermissions && (
                        <div className="as-permissions-panel">
                          <div className="as-permissions-panel-header">
                            <span>Portal & Setting Feature Permissions</span>
                            {!admin.settingsPermissions && (
                              <span className="as-permissions-defaults-text">Using System Defaults</span>
                            )}
                          </div>

                          {/* Master Toggle */}
                          <label className="as-permissions-master-label">
                            <input 
                              type="checkbox"
                              checked={selectedPermissions.allowAll}
                              onChange={(e) => setSelectedPermissions({ ...selectedPermissions, allowAll: e.target.checked })}
                              className="as-permissions-master-checkbox"
                            />
                            <span>Enable Settings Portal Access</span>
                          </label>

                          {/* Individual permission checkboxes */}
                          <div 
                            className="as-permissions-grid"
                            style={{ 
                              opacity: selectedPermissions.allowAll ? 1 : 0.4,
                              pointerEvents: selectedPermissions.allowAll ? 'auto' : 'none'
                            }}
                          >
                            <label className="as-permission-checkbox-label">
                              <input 
                                type="checkbox"
                                checked={selectedPermissions.systemSettings}
                                onChange={(e) => setSelectedPermissions({ ...selectedPermissions, systemSettings: e.target.checked })}
                                className="as-permission-checkbox"
                              />
                              <span>System Settings (Branding)</span>
                            </label>

                            <label className="as-permission-checkbox-label">
                              <input 
                                type="checkbox"
                                checked={selectedPermissions.slaSettings}
                                onChange={(e) => setSelectedPermissions({ ...selectedPermissions, slaSettings: e.target.checked })}
                                className="as-permission-checkbox"
                              />
                              <span>SLA Configurations</span>
                            </label>

                            <label className="as-permission-checkbox-label">
                              <input 
                                type="checkbox"
                                checked={selectedPermissions.escalationRules}
                                onChange={(e) => setSelectedPermissions({ ...selectedPermissions, escalationRules: e.target.checked })}
                                className="as-permission-checkbox"
                              />
                              <span>Escalation Rules</span>
                            </label>

                            <label className="as-permission-checkbox-label">
                              <input 
                                type="checkbox"
                                checked={selectedPermissions.escalationAnalytics}
                                onChange={(e) => setSelectedPermissions({ ...selectedPermissions, escalationAnalytics: e.target.checked })}
                                className="as-permission-checkbox"
                              />
                              <span>Escalation Analytics</span>
                            </label>

                            <label className="as-permission-checkbox-label">
                              <input 
                                type="checkbox"
                                checked={selectedPermissions.manageFields}
                                onChange={(e) => setSelectedPermissions({ ...selectedPermissions, manageFields: e.target.checked })}
                                className="as-permission-checkbox"
                              />
                              <span>Manage Fields (Categories)</span>
                            </label>

                            <label className="as-permission-checkbox-label">
                              <input 
                                type="checkbox"
                                checked={selectedPermissions.manageStaff}
                                onChange={(e) => setSelectedPermissions({ ...selectedPermissions, manageStaff: e.target.checked })}
                                className="as-permission-checkbox"
                              />
                              <span>Manage Staff</span>
                            </label>

                            <label className="as-permission-checkbox-label">
                              <input 
                                type="checkbox"
                                checked={selectedPermissions.manageDepartments}
                                onChange={(e) => setSelectedPermissions({ ...selectedPermissions, manageDepartments: e.target.checked })}
                                className="as-permission-checkbox"
                              />
                              <span>Manage Departments</span>
                            </label>
                          </div>

                          {/* Action buttons */}
                          <div className="as-permissions-action-row">
                            <button 
                              onClick={() => handleSavePermissions(admin._id)}
                              className="btn btn-primary as-action-save-btn"
                            >
                              Save Changes
                            </button>
                            <button 
                              onClick={() => { setSelectedAdminId(null); setSelectedPermissions(null); }}
                              className="btn btn-secondary as-action-cancel-btn"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            loadingUsers ? (
              <div className="as-loading">Loading citizens...</div>
            ) : users.filter(u => u.role === 'citizen').length === 0 ? (
              <div className="as-empty">
                No citizens found in this workspace.
              </div>
            ) : (
              <div className="as-list-container">
                {users.filter(u => u.role === 'citizen').map((citizen) => (
                  <div key={citizen._id} className="as-item-card" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                    <div className="as-item-row">
                      <div className="as-avatar-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <User size={18} />
                      </div>
                      <div className="as-info-col">
                        <div className="as-admin-name">
                          {citizen.name}
                        </div>
                        <div className="as-meta-row">
                          <span>{citizen.email}</span>
                          <span>•</span>
                          {citizen.department && (
                            <>
                              <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{citizen.department}</span>
                              <span>•</span>
                            </>
                          )}
                          <span>Joined: {new Date(citizen.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="as-actions-col">
                        <div className="as-role-badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                          Citizen
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminStaff;
