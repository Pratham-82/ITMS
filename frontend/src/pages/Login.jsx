import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { FolderLock } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Validation Error', 'Please fill in all fields', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(email, password);
      if (res.success) {
        addToast('Welcome Back', 'You have logged in successfully', 'success');
        navigate('/');
      } else {
        addToast('Authentication Failed', res.message || 'Invalid credentials', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with the server', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetTenant = () => {
    localStorage.removeItem('tenantId');
    window.location.href = '/login';
  };

  return (
    <div className="auth-container">
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
          <div className="auth-logo">{settings.websiteName}</div>
          {localStorage.getItem('tenantId') && localStorage.getItem('tenantId') !== 'default-tenant' && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
              <span className="workspace-badge" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(99, 102, 241, 0.08)',
                color: 'var(--accent-color)',
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '100px',
                border: '1px solid rgba(99, 102, 241, 0.20)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-color)' }}></span>
                {localStorage.getItem('tenantId')} Workspace
              </span>
            </div>
          )}
          <div className="auth-subtitle" style={{ marginTop: '10px' }}>{settings.websiteDescription}</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-control" 
              placeholder="e.g. citizen@apex.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Password</label>
              <Link to="/forgot-password" style={{ fontSize: '12px', color: 'var(--accent-color)', textDecoration: 'none' }}>Forgot Password?</Link>
            </div>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            disabled={isSubmitting}
            style={{ marginTop: '10px' }}
          >
            {isSubmitting ? 'Verifying Session...' : 'Sign In'}
          </button>
        </form>


        <div className="auth-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
          {settings.allowCitizenRegistration && (
            <div>
              Don't have a citizen account?{' '}
              <Link to="/register" className="auth-link">Register Here</Link>
            </div>
          )}
          <div>
            Need a custom workspace?{' '}
            <Link to="/register-tenant" className="auth-link">Create Portal</Link>
          </div>
          {localStorage.getItem('tenantId') && localStorage.getItem('tenantId') !== 'default-tenant' && (
            <div style={{ marginTop: '4px' }}>
              Want to switch?{' '}
              <button 
                onClick={handleResetTenant} 
                className="auth-link" 
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent-color)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
              >
                Go to Main Portal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
