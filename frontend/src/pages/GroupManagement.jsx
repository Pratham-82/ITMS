import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Users, UserPlus, Trash2, Edit3, Shield, UserCheck, Check, X } from 'lucide-react';

const GroupManagement = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [leader, setLeader] = useState('');
  const [backupLeader, setBackupLeader] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [department, setDepartment] = useState('');
  const [isActive, setIsActive] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${user.token}` };
      
      const [groupsRes, usersRes, deptsRes] = await Promise.all([
        fetch('/api/groups', { headers }),
        fetch('/api/auth/admins', { headers }), // Fetch staff to get available admins
        fetch('/api/departments', { headers })
      ]);

      const groupsData = await groupsRes.json();
      const usersData = await usersRes.json();
      const deptsData = await deptsRes.json();

      if (groupsData.success) setGroups(groupsData.data);
      if (usersData.success) {
        // Filter only users who are admins
        setAdmins(usersData.data.filter(u => u.role === 'admin'));
      }
      if (deptsData.success) setDepartments(deptsData.data);
    } catch (err) {
      addToast('Error', 'Error loading group configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setLeader('');
    setBackupLeader('');
    setSelectedMembers([]);
    setDepartment('');
    setIsActive(true);
    setIsEditing(false);
    setEditingId(null);
  };

  const handleEdit = (group) => {
    setIsEditing(true);
    setEditingId(group._id);
    setName(group.name);
    setDescription(group.description || '');
    setLeader(group.leader?._id || '');
    setBackupLeader(group.backupLeader?._id || '');
    setSelectedMembers(group.members?.map(m => m._id) || []);
    setDepartment(group.department?._id || '');
    setIsActive(group.isActive);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      addToast('Validation', 'Group Name is required', 'error');
      return;
    }

    const payload = {
      name,
      description,
      leader: leader || null,
      backupLeader: backupLeader || null,
      members: selectedMembers,
      department: department || null,
      isActive
    };

    try {
      const url = isEditing ? `/api/groups/${editingId}` : '/api/groups';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        addToast('Success', isEditing ? 'Group updated successfully' : 'Group created successfully', 'success');
        resetForm();
        fetchData();
      } else {
        addToast('Error', data.message || 'Action failed', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server error processing group', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this support group?')) return;
    try {
      const res = await fetch(`/api/groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'Group deleted successfully', 'success');
        fetchData();
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Error deleting group', 'error');
    }
  };

  const toggleMemberSelection = (userId) => {
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  return (
    <div className="container-fluid" style={{ padding: '24px', color: 'var(--text-primary)' }}>
      <div className="row">
        {/* Editor Form Panel */}
        <div className="col-md-5">
          <div className="card shadow-sm p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <UserPlus size={20} className="text-accent" />
              {isEditing ? 'Modify Support Group' : 'Define New Support Group'}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Group Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. IT Helpdesk L2"
                  style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the group's responsibility"
                  style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Associated Department (Optional)</label>
                <select
                  className="form-control"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                >
                  <option value="">-- Choose Department (Optional) --</option>
                  {departments.map(d => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="row mb-3">
                <div className="col">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Group Leader</label>
                  <select
                    className="form-control"
                    value={leader}
                    onChange={(e) => setLeader(e.target.value)}
                    style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  >
                    <option value="">-- None --</option>
                    {admins.map(a => (
                      <option key={a._id} value={a._id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col">
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Backup Leader</label>
                  <select
                    className="form-control"
                    value={backupLeader}
                    onChange={(e) => setBackupLeader(e.target.value)}
                    style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  >
                    <option value="">-- None --</option>
                    {admins.map(a => (
                      <option key={a._id} value={a._id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Select Group Members
                </label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)' }}>
                  {admins.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No officers available.</p>
                  ) : (
                    admins.map(a => (
                      <div key={a._id} className="form-check d-flex align-items-center mb-2" style={{ cursor: 'pointer' }} onClick={() => toggleMemberSelection(a._id)}>
                        <input
                          type="checkbox"
                          className="form-check-input me-2"
                          checked={selectedMembers.includes(a._id)}
                          onChange={() => {}} // Handled by onClick
                          style={{ cursor: 'pointer' }}
                        />
                        <label className="form-check-label" style={{ cursor: 'pointer', fontSize: '13px' }}>
                          {a.name} <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({a.department || 'No department'})</span>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="form-check form-switch mb-4">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="groupIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="groupIsActive" style={{ fontSize: '13px', fontWeight: 600 }}>Active Status</label>
              </div>

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary px-4 py-2" style={{ fontWeight: 700 }}>
                  {isEditing ? 'Save Changes' : 'Register Group'}
                </button>
                {isEditing && (
                  <button type="button" className="btn btn-secondary px-4 py-2" onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Support Groups List Panel */}
        <div className="col-md-7">
          <div className="card shadow-sm p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', minHeight: '400px' }}>
            <h3 className="mb-4" style={{ fontWeight: 800, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <Users size={20} className="text-accent" />
              Active Support Groups ({groups.length})
            </h3>

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-accent" role="status" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-5" style={{ color: 'var(--text-secondary)' }}>
                No support groups defined yet. Define one using the rules panel on the left.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle" style={{ color: 'var(--text-primary)' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '12px' }}>
                      <th>Group Name</th>
                      <th>Department</th>
                      <th>Leader</th>
                      <th>Members Count</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(g => (
                      <tr key={g._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{g.name}</div>
                          {g.description && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{g.description}</div>}
                        </td>
                        <td>{g.department?.name || 'General'}</td>
                        <td>
                          <div style={{ fontSize: '13px' }}>
                            <Shield size={12} className="text-accent me-1" style={{ display: 'inline' }} />
                            {g.leader?.name || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>None</span>}
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-secondary" style={{ borderRadius: '12px' }}>
                            {g.members?.length || 0} members
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${g.isActive ? 'bg-success' : 'bg-danger'}`} style={{ borderRadius: '4px' }}>
                            {g.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-2">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => handleEdit(g)} title="Edit Group">
                              <Edit3 size={14} />
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(g._id)} title="Delete Group">
                              <Trash2 size={14} />
                            </button>
                          </div>
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

export default GroupManagement;
