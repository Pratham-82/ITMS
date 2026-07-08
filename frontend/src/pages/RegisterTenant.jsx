import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { Building, Globe, User, Mail, Lock, CheckCircle2, Rocket, ArrowRight, Shield } from 'lucide-react';

const RegisterTenant = () => {
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const { addToast } = useToast();
  const { settings } = useSettings();

  // Sanitize subdomain input (only allow letters, numbers, and hyphens)
  const handleSubdomainChange = (e) => {
    const val = e.target.value;
    const sanitized = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(sanitized);
  };

  const getWorkspaceUrl = (sub) => {
    // Detect if we are running locally on localhost
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
      return `http://${sub}.localhost${port}`;
    }
    
    // Fallback for production base domain
    const mainDomain = hostname.startsWith('www.') ? hostname.substring(4) : hostname;
    return `https://${sub}.${mainDomain}${port}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !subdomain || !adminName || !adminEmail || !adminPassword || !confirmPassword) {
      addToast('Validation Error', 'Please fill in all fields', 'error');
      return;
    }

    if (subdomain.length < 3) {
      addToast('Validation Error', 'Subdomain must be at least 3 characters long', 'error');
      return;
    }

    if (adminPassword !== confirmPassword) {
      addToast('Validation Error', 'Admin passwords do not match', 'error');
      return;
    }

    if (adminPassword.length < 6) {
      addToast('Validation Error', 'Password must be at least 6 characters', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/tenants/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          subdomain,
          adminName,
          adminEmail,
          adminPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        addToast('Workspace Created', 'Your tenant portal has been bootstrapped!', 'success');
        setSuccessData({
          tenantName: name,
          subdomain: subdomain,
          adminEmail: adminEmail,
          workspaceUrl: getWorkspaceUrl(subdomain),
        });
      } else {
        addToast('Registration Failed', result.message || 'Check workspace setup details', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with the server', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successData) {
    return (
      <div className="auth-container" style={{ animation: 'fadeIn 0.4s ease-out' }}>
        <div className="auth-card" style={{ maxWidth: '520px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div 
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
              }}
            >
              <CheckCircle2 size={36} />
            </div>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
            Workspace Ready!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: '22px' }}>
            Your custom ITSM instance for <strong>{successData.tenantName}</strong> has been created and populated with standard ticket types, categories, and working hour configurations.
          </p>

          <div 
            style={{ 
              background: 'rgba(255, 255, 255, 0.02)', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--border-radius-md)', 
              padding: '20px', 
              textAlign: 'left',
              marginBottom: '32px'
            }}
          >
            <div style={{ marginBottom: '14px' }}>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                Workspace URL
              </span>
              <a 
                href={successData.workspaceUrl} 
                style={{ fontSize: '15px', color: 'var(--accent-color)', fontWeight: 600, wordBreak: 'break-all', textDecoration: 'none' }}
              >
                {successData.workspaceUrl}
              </a>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                Administrator Login
              </span>
              <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                {successData.adminEmail}
              </span>
            </div>
          </div>

          <a 
            href={successData.workspaceUrl}
            className="btn btn-primary btn-block"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
          >
            <span>Launch Workspace</span>
            <Rocket size={16} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="auth-card" style={{ maxWidth: '520px' }}>
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <div className="brand-icon" style={{ width: '48px', height: '48px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)', backgroundColor: 'var(--accent-glow)' }}>
              <Shield size={24} />
            </div>
          </div>
          <div className="auth-logo">Create Workspace</div>
          <div className="auth-subtitle">Launch your own configurable ITSM instance in seconds</div>
        </div>

        <form onSubmit={handleSubmit}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            Workspace Profile
          </h3>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building size={14} /> Organization Name
            </label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Acme Corporation" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={14} /> Workspace Subdomain
            </label>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: '6px' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. acme" 
                value={subdomain}
                onChange={handleSubdomainChange}
                required
                style={{ flex: 1 }}
              />
            </div>
            {subdomain && (
              <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-secondary)' }}>
                Your URL will be: <strong style={{ color: 'var(--accent-color)' }}>{getWorkspaceUrl(subdomain)}</strong>
              </div>
            )}
          </div>

          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', fontWeight: 700, marginTop: '24px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            Initial Admin Credentials
          </h3>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} /> Full Name
            </label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Administrator" 
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} /> Email Address
            </label>
            <input 
              type="email" 
              className="form-control" 
              placeholder="e.g. admin@acme.com" 
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} /> Password
            </label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="Min. 6 characters" 
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} /> Confirm Password
            </label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="Re-enter admin password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            disabled={isSubmitting}
            style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span>{isSubmitting ? 'Provisioning Instance...' : 'Create Workspace'}</span>
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: '20px' }}>
          Have an existing workspace?{' '}
          <Link to="/login" className="auth-link">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterTenant;
