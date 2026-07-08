import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [status, setStatus] = useState('Verifying...');

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await res.json();
        if (data.success) {
          setStatus('Email verified! Redirecting to login...');
          addToast('Success', 'Your email has been verified.', 'success');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setStatus('Verification failed.');
          addToast('Error', data.message || 'Verification failed.', 'error');
        }
      } catch (err) {
        setStatus('Network error.');
        addToast('Error', 'Unable to verify email.', 'error');
      }
    };
    if (token) verify();
  }, [token, navigate, addToast]);

  return (
    <div className="auth-container" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h2>{status}</h2>
      </div>
    </div>
  );
};

export default VerifyEmail;
