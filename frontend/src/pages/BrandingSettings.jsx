import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Settings, Save, Upload, Eye, CheckCircle2, Lock, Unlock, Mail, Globe, Plus, Trash2, ArrowUp, ArrowDown, Heart, Smile, ThumbsUp, HelpCircle } from 'lucide-react';
import '../styles/BrandingSettings.css';

const BrandingSettings = () => {
  const { settings, fetchSettings } = useSettings();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === 'admin' && (!user.department || user.department === 'General Administration');

  useEffect(() => {
    if (user && !isSuperAdmin) {
      navigate('/', { replace: true });
    }
  }, [user, isSuperAdmin, navigate]);

  const [websiteName, setWebsiteName] = useState('');
  const [websiteDescription, setWebsiteDescription] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [contactEmail, setContactEmail] = useState('');
  const [allowCitizenRegistration, setAllowCitizenRegistration] = useState(true);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  // Sync state with settings context
  useEffect(() => {
    if (settings) {
      setWebsiteName(settings.websiteName || '');
      setWebsiteDescription(settings.websiteDescription || '');
      setPrimaryColor(settings.primaryColor || '#6366f1');
      setContactEmail(settings.contactEmail || 'support@apexresolve.com');
      setAllowCitizenRegistration(settings.allowCitizenRegistration !== false);
      setLogoPreview(settings.websiteLogo || '');
    }
  }, [settings]);

  if (!user || !isSuperAdmin) {
    return null;
  }

  const colorPresets = [
    { name: 'Indigo (Default)', hex: '#6366f1' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Rose', hex: '#f43f5e' },
    { name: 'Purple', hex: '#a855f7' },
    { name: 'Slate', hex: '#64748b' }
  ];

  const handleLogoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      const isImg = /\.(jpg|jpeg|png)$/i.test(file.name);
      if (!isImg) {
        addToast('File Rejected', 'Images (PNG, JPG) only.', 'error');
        return;
      }
      
      // Validate size
      if (file.size > 2 * 1024 * 1024) {
        addToast('File Rejected', 'Logo image must be under 2MB.', 'error');
        return;
      }

      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!websiteName.trim() || !websiteDescription.trim()) {
      addToast('Validation Error', 'Website Name and Description are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('websiteName', websiteName.trim());
      formData.append('websiteDescription', websiteDescription.trim());
      formData.append('primaryColor', primaryColor);
      formData.append('contactEmail', contactEmail.trim());
      formData.append('allowCitizenRegistration', allowCitizenRegistration);

      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${user.token}`
        },
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        addToast('Branding Saved', 'System branding settings saved successfully', 'success');
        fetchSettings(); // Refresh settings context
        setLogoFile(null); // Clear active file state
      } else {
        addToast('Update Failed', result.message || 'Error updating settings', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Connection Error', 'Failed to save changes to the database', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bs-container">
      
      {/* Settings Form */}
      <div className="form-card bs-form-card">
        <h2 className="bs-card-title">
          <Settings size={20} className="text-accent" />
          <span>System Settings & Branding</span>
        </h2>
        <p className="bs-card-subtitle">
          Customize details like website name, accent themes, public signups, and custom logos.
        </p>

        <form onSubmit={handleSubmit}>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Website Name *</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. ApexResolve"
                value={websiteName}
                onChange={(e) => setWebsiteName(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Support / Contact Email</label>
              <div className="bs-mail-icon-wrapper">
                <Mail size={16} className="bs-mail-icon" />
                <input 
                  type="email" 
                  className="form-control bs-email-input" 
                  placeholder="support@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Website Subtitle / Description *</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Managing and tracking issues efficiently..."
              value={websiteDescription}
              onChange={(e) => setWebsiteDescription(e.target.value)}
              required
            />
          </div>

          {/* Accent Color Chooser */}
          <div className="bs-section-divider">
            <label className="form-label bs-accent-color-label">Branding Accent Color</label>
            <div className="bs-colors-flex-row">
              <div className="bs-preset-grid">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setPrimaryColor(preset.hex)}
                    className="bs-color-preset-btn"
                    style={{
                      backgroundColor: preset.hex,
                      border: primaryColor.toLowerCase() === preset.hex.toLowerCase() ? '3px solid white' : '1px solid var(--border-color)',
                      boxShadow: primaryColor.toLowerCase() === preset.hex.toLowerCase() ? '0 0 10px rgba(255,255,255,0.4)' : 'none'
                    }}
                    title={preset.name}
                  />
                ))}
              </div>
              <div className="bs-custom-color-picker-container">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="bs-color-input"
                />
                <span className="bs-color-hex-text">
                  {primaryColor.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Custom Logo Upload */}
          <div className="bs-section-divider">
            <label className="form-label">System Branding Logo</label>
            <div className="bs-logo-upload-container">
              <div className="bs-logo-preview-box">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="bs-logo-img" />
                ) : (
                  <Globe size={32} />
                )}
              </div>
              <div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="bs-logo-hidden-input" 
                  onChange={handleLogoChange}
                  accept=".png,.jpg,.jpeg"
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current.click()}
                  className="btn btn-secondary bs-logo-upload-btn"
                >
                  <Upload size={14} />
                  <span>Choose Logo File</span>
                </button>
                <div className="bs-logo-upload-hint">
                  Images (PNG, JPG) under 2MB are supported. Replaces default brand icons.
                </div>
              </div>
            </div>
          </div>

          {/* Security & Access Controls */}
          <div className="bs-section-divider">
            <label className="form-label">Citizen Registrations</label>
            <label className="bs-registration-checkbox-label">
              <div className="bs-registration-icon-desc">
                {allowCitizenRegistration ? (
                  <Unlock size={18} className="bs-status-active-icon" />
                ) : (
                  <Lock size={18} className="bs-status-locked-icon" />
                )}
                <div>
                  <strong className="bs-registration-text-title">
                    {allowCitizenRegistration ? 'Public Registrations Active' : 'Public Registrations Locked'}
                  </strong>
                  <span className="bs-registration-text-desc">
                    {allowCitizenRegistration ? 'Anyone can sign up as a citizen to file complaints' : 'Only admins can register accounts; registration form is closed'}
                  </span>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={allowCitizenRegistration}
                onChange={(e) => setAllowCitizenRegistration(e.target.checked)}
                className="bs-registration-checkbox"
              />
            </label>
          </div>
          <button 
            type="submit" 
            className="btn btn-primary bs-submit-btn" 
            disabled={isSubmitting}
          >
            <Save size={16} />
            <span>{isSubmitting ? 'Saving settings...' : 'Save Configuration'}</span>
          </button>

        </form>
      </div>

      {/* Live Preview Panel */}
      <div className="dashboard-panel bs-preview-panel">
        <h3 className="panel-title bs-preview-title">
          <Eye size={18} className="text-accent" />
          <span>Branding Live Preview</span>
        </h3>
        <p className="bs-preview-subtitle">
          Behold how settings adapt on the frontend layout in real-time.
        </p>

        {/* Live Mock card */}
        <div className="bs-preview-mock-card">
          {/* Header Bar */}
          <div className="bs-mock-header">
            <div className="bs-mock-dot-red" />
            <div className="bs-mock-dot-yellow" />
            <div className="bs-mock-dot-green" />
            <span className="bs-mock-header-text">Mock Preview</span>
          </div>

          {/* Render Mock Layout */}
          <div className="bs-mock-body">
            {/* Logo Preview */}
            <div className="bs-mock-identity-row">
              <div 
                className="bs-preview-logo-wrapper"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)` }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Brand" className="bs-preview-logo-img" />
                ) : (
                  'L'
                )}
              </div>
              <strong className="bs-mock-website-title">{websiteName || 'ApexResolve'}</strong>
            </div>

            {/* Title / Description */}
            <div className="bs-mock-desc-container">
              <div className="bs-mock-desc-label">Subtitle Banner</div>
              <p className="bs-mock-desc-p">
                {websiteDescription || 'Managing and tracking issues efficiently'}
              </p>
            </div>

            {/* Mock button and badge */}
            <div className="bs-mock-actions-row">
              <span 
                className="badge bs-preview-badge" 
                style={{ 
                  backgroundColor: `rgba(99, 102, 241, 0.1)`, 
                  color: primaryColor,
                  borderColor: `rgba(99,102,241,0.2)`
                }}
              >
                Accent Tag
              </span>
              <button 
                type="button"
                className="btn btn-primary bs-preview-btn" 
                style={{ 
                  background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
                  boxShadow: `0 4px 10px rgba(${primaryColor === '#6366f1' ? '99,102,241' : '16,185,129'}, 0.2)`
                }}
              >
                Sample Button
              </button>
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div className="bs-info-panel">
          <CheckCircle2 size={16} className="text-accent bs-info-icon" />
          <div className="bs-info-text">
            <strong>Applying Theme Accents:</strong> Saving setting updates compiles the RGB code for primary colors, recalculating background glows and active gradients across all system views dynamically.
          </div>
        </div>

      </div>

    </div>
  );
};

export default BrandingSettings;
