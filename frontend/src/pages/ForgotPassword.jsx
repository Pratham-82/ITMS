import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { KeyRound, ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1); // 1 = request code, 2 = reset password, 3 = success
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devOtp, setDevOtp] = useState(''); // Developer helper to display generated code

  const { addToast } = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      addToast('Validation Error', 'Please enter your email address', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const result = await response.json();

      if (result.success) {
        addToast('Verification Sent', 'OTP verification code has been generated', 'success');
        setDevOtp(result.otp); // Save the code for dev verification display
        setStep(2);
      } else {
        addToast('Request Failed', result.message || 'Email address not found', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to reach authentication server', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword || !confirmPassword) {
      addToast('Validation Error', 'Please fill in all inputs', 'error');
      return;
    }

    if (newPassword.length < 6) {
      addToast('Validation Error', 'Password must be at least 6 characters long', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('Validation Error', 'Passwords do not match', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          newPassword: newPassword.trim()
        })
      });
      const result = await response.json();

      if (result.success) {
        addToast('Reset Complete', 'Your password has been changed successfully', 'success');
        setStep(3);
      } else {
        addToast('Reset Failed', result.message || 'Invalid or expired code', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to submit reset request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="auth-card">
        
        {step === 1 && (
          <div>
            <div className="auth-header">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <div className="brand-icon" style={{ width: '48px', height: '48px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)', backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
                  {settings.websiteLogo ? (
                    <img src={settings.websiteLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <KeyRound size={24} />
                  )}
                </div>
              </div>
              <div className="auth-logo" style={{ fontSize: '22px' }}>Reset Password</div>
              <div className="auth-subtitle">
                Enter your email address to request a One-Time Verification code for {settings.websiteName}.
              </div>
            </div>

            <form onSubmit={handleRequestOtp}>
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

              <button 
                type="submit" 
                className="btn btn-primary btn-block" 
                disabled={isSubmitting}
                style={{ marginTop: '16px' }}
              >
                {isSubmitting ? 'Generating Verification...' : 'Send Verification Code'}
              </button>
            </form>

            <div className="auth-footer" style={{ marginTop: '24px' }}>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '13px' }} className="hover:text-primary">
                <ArrowLeft size={14} />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="auth-header">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <div className="brand-icon" style={{ width: '48px', height: '48px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-pending-text)', backgroundColor: 'var(--status-pending-bg)' }}>
                  {settings.websiteLogo ? (
                    <img src={settings.websiteLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <ShieldAlert size={24} />
                  )}
                </div>
              </div>
              <div className="auth-logo" style={{ fontSize: '22px' }}>Enter Reset Details</div>
              <div className="auth-subtitle">
                A verification code was generated for <strong>{email}</strong>.
              </div>
            </div>

            {/* Development OTP helper card */}
            {devOtp && (
              <div 
                style={{ 
                  padding: '12px 16px', 
                  backgroundColor: 'rgba(245, 158, 11, 0.08)', 
                  border: '1px solid rgba(245, 158, 11, 0.2)', 
                  borderRadius: 'var(--border-radius-sm)', 
                  marginBottom: '20px',
                  fontSize: '13px',
                  textAlign: 'center'
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>Dev Testing Code: </span>
                <strong style={{ color: 'var(--status-pending-text)', fontSize: '15px', letterSpacing: '1px' }}>{devOtp}</strong>
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">Verification Code (OTP) *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Enter 6-digit code" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '16px', fontWeight: 700 }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Min. 6 characters" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Repeat your password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary btn-block" 
                disabled={isSubmitting}
                style={{ marginTop: '16px' }}
              >
                {isSubmitting ? 'Resetting Password...' : 'Save New Password'}
              </button>
            </form>

            <div className="auth-footer" style={{ marginTop: '24px' }}>
              <button 
                onClick={() => setStep(1)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }} 
                className="hover:text-primary"
              >
                <ArrowLeft size={14} />
                <span>Go Back</span>
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div 
                style={{ 
                  width: '56px', 
                  height: '56px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--status-resolved-bg)', 
                  color: 'var(--status-resolved-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CheckCircle2 size={30} />
              </div>
            </div>
            
            <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '8px' }}>Password Saved</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px', lineHeight: '20px' }}>
              Your password has been reset successfully. You can now use your new password to sign in.
            </p>

            <button 
              onClick={() => navigate('/login')} 
              className="btn btn-primary btn-block"
            >
              Sign In Now
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ForgotPassword;
