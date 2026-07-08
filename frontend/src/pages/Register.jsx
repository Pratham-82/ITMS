import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { FolderLock } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState('');
  
  const { register } = useAuth();
  const { addToast } = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await fetch('/api/departments');
        const data = await res.json();
        if (data.success) {
          setDepartments(data.data?.filter(d => d.isActive) || []);
        }
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    };
    fetchDepts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      addToast('Validation Error', 'Please fill in all fields', 'error');
      return;
    }

    if (password !== confirmPassword) {
      addToast('Validation Error', 'Passwords do not match', 'error');
      return;
    }

    if (password.length < 6) {
      addToast('Validation Error', 'Password must be at least 6 characters', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register(name, email, password, department);
      if (res.success) {
        addToast('Welcome to ApexResolve', 'Account registered successfully', 'success');
        navigate('/');
      } else {
        addToast('Registration Failed', res.message || 'Check your registration details', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with the server', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!settings.allowCitizenRegistration) {
    return (
      <div className="auth-container" style={{ animation: 'fadeIn 0.4s ease-out' }}>
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <div className="brand-icon" style={{ width: '48px', height: '48px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-rejected-text)', backgroundColor: 'var(--status-rejected-bg)' }}>
              {settings.websiteLogo ? (
                <img src={settings.websiteLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <FolderLock size={26} />
              )}
            </div>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Registration Closed</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px', lineHeight: '20px' }}>
            Public registration is currently disabled by the system administrator. Please contact <strong>{settings.contactEmail}</strong> if you require a citizen account.
          </p>
          <Link to="/login" className="btn btn-primary btn-block">Return to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <div className="brand-icon" style={{ width: '48px', height: '48px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {settings.websiteLogo ? (
                <img src={settings.websiteLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <FolderLock size={26} />
              )}
            </div>
          </div>
          <div className="auth-logo">Create Account</div>
          <div className="auth-subtitle">Register a citizen profile for {settings.websiteName}</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. John Doe" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-control" 
              placeholder="e.g. john@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="Min. 6 characters" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="Re-enter password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Department / Course (Optional)</label>
            <select 
              className="form-control" 
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">-- Choose Department / Course --</option>
              {departments.map((d) => (
                <option key={d._id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            disabled={isSubmitting}
            style={{ marginTop: '10px' }}
          >
            {isSubmitting ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
