import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { User, Mail, Lock, Shield, Save, X, Building2 } from 'lucide-react';
import '../styles/Profile.css';

const Profile = () => {
  const { user, setUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Basic Information States
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Workload Settings
  const [availabilityStatus, setAvailabilityStatus] = useState(user?.availabilityStatus || 'Available');
  const [maxCapacity, setMaxCapacity] = useState(user?.maxCapacity || 20);

  const [department, setDepartment] = useState(user?.department || '');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const response = await fetch('/api/departments', {
          headers: {
            Authorization: `Bearer ${user.token}`
          }
        });
        const result = await response.json();
        if (result.success) {
          setDepartments(result.data || []);
        }
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    };
    if (user?.token) {
      fetchDepts();
    }
  }, [user]);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      addToast('Validation Error', 'Name and Email are required fields', 'error');
      return;
    }

    // If changing password, validate matches and length
    if (newPassword) {
      if (!currentPassword) {
        addToast('Validation Error', 'Current password is required to change password', 'error');
        return;
      }
      if (newPassword.length < 6) {
        addToast('Validation Error', 'New password must be at least 6 characters long', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        addToast('Validation Error', 'New passwords do not match', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
          maxCapacity: user?.role === 'admin' ? maxCapacity : undefined,
          availabilityStatus: user?.role === 'admin' ? availabilityStatus : undefined,
          department: department
        })
      });

      const result = await response.json();
      if (result.success) {
        // Update local context and token
        localStorage.setItem('token', result.data.token);
        setUser({ ...result.data, token: result.data.token });
        
        // Reset password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        addToast('Profile Updated', 'Your personal details have been updated successfully', 'success');
      } else {
        addToast('Update Failed', result.message || 'Could not update profile details', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Connection Error', 'Failed to save changes to the database', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="profile-container">
      {/* Header Profile Panel */}
      <div className="profile-header-card">
        <div className="profile-header-avatar">
          {getInitials(user?.name)}
        </div>
        <div className="profile-header-meta">
          <h2>{user?.name}</h2>
          <p>{user?.role === 'admin' ? (user?.department || 'General Administration') : 'Citizen Account'}</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* Main Editable Form */}
        <form onSubmit={handleProfileSubmit} className="profile-form-card">
          <div>
            <h3 className="profile-section-title">
              <User size={16} className="text-accent" />
              <span>Personal Information</span>
            </h3>
            
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-control" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ paddingLeft: '44px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  className="form-control" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '44px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">{user?.role === 'admin' ? 'Department Assignment' : 'Department / Course (Optional)'}</label>
              <div style={{ position: 'relative' }}>
                <Building2 size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <select 
                  className="form-control" 
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  style={{ paddingLeft: '44px' }}
                  disabled={user?.role === 'admin' && user?.department}
                >
                  <option value="">{user?.role === 'admin' ? '-- Select Department --' : '-- Choose Department / Course --'}</option>
                  {departments.filter(d => d.isActive).map((d) => (
                    <option key={d._id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="profile-section-title" style={{ marginTop: '12px' }}>
              <Lock size={16} className="text-accent" />
              <span>Change Password</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
              Fill this section only if you want to update your password. Otherwise, leave it blank.
            </p>

            <div className="form-group">
              <label className="form-label">Current Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{ paddingLeft: '44px' }}
                />
              </div>
            </div>

            <div className="form-row" style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="password" 
                    className="form-control" 
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ paddingLeft: '44px' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="password" 
                    className="form-control" 
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ paddingLeft: '44px' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {user?.role === 'admin' && (
            <div style={{ marginTop: '24px', marginBottom: '16px' }}>
              <h3 className="profile-section-title">
                <Shield size={16} className="text-accent" />
                <span>Workload & Availability Settings</span>
              </h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Availability Status</label>
                  <select 
                    className="form-control"
                    value={availabilityStatus}
                    onChange={(e) => setAvailabilityStatus(e.target.value)}
                  >
                    <option value="Available">Available</option>
                    <option value="Busy">Busy</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Maximum Workload Capacity</label>
                  <input 
                    type="number" 
                    className="form-control"
                    min="5"
                    max="50"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(Number(e.target.value))}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          <div className="profile-action-row">
            <button 
              type="submit" 
              className="btn btn-primary profile-save-btn"
              disabled={isSubmitting}
            >
              <Save size={16} />
              <span>{isSubmitting ? 'Saving changes...' : 'Save Profile'}</span>
            </button>
            <button 
              type="button" 
              className="btn btn-secondary profile-cancel-btn"
              onClick={() => navigate('/')}
            >
              <X size={16} />
              <span>Cancel</span>
            </button>
          </div>
        </form>

        {/* Read-Only Account Summary Sidebar */}
        <div className="profile-info-sidebar">
          <h3 className="profile-section-title">
            <Shield size={16} className="text-accent" />
            <span>Account Details</span>
          </h3>

          <div className="profile-info-item">
            <span className="profile-info-label">Account Role</span>
            <span className="profile-info-badge">{user?.role}</span>
          </div>

          {user?.role === 'admin' && (
            <>
              <div className="profile-info-item">
                <span className="profile-info-label">Department Assignment</span>
                <span className="profile-info-value">{user?.department || 'General Administration'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Availability Status</span>
                <span className="profile-info-value">{user?.availabilityStatus || 'Available'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Max Capacity Limit</span>
                <span className="profile-info-value">{user?.maxCapacity || 20}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Capacity Utilization</span>
                <span className="profile-info-value">{user?.capacityPercentage || 0}%</span>
              </div>
            </>
          )}

          {user?.role === 'citizen' && (
            <div className="profile-info-item">
              <span className="profile-info-label">Department / Course</span>
              <span className="profile-info-value">{user?.department || 'Not Assigned'}</span>
            </div>
          )}

          <div className="profile-info-item">
            <span className="profile-info-label">Registered Since</span>
            <span className="profile-info-value">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
