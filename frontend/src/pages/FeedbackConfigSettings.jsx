import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Settings, Save, Plus, Trash2, ArrowUp, ArrowDown, 
  Heart, Smile, ThumbsUp, Star, Eye, HelpCircle 
} from 'lucide-react';
import '../styles/BrandingSettings.css'; // Leverage existing branding config layout classes

const FeedbackConfigSettings = () => {
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

  // Feedback form config states
  const [feedbackExpiryDays, setFeedbackExpiryDays] = useState(3);
  const [feedbackWelcomeMessage, setFeedbackWelcomeMessage] = useState('');
  const [feedbackSuccessMessage, setFeedbackSuccessMessage] = useState('');
  const [feedbackRatingIcon, setFeedbackRatingIcon] = useState('star');
  const [feedbackQuestions, setFeedbackQuestions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultQuestions = [
    { id: 'overallRating', label: 'Overall Satisfaction', type: 'rating', required: true, order: 1, isActive: true },
    { id: 'responseTimeRating', label: 'Response Time Satisfaction', type: 'rating', required: true, order: 2, isActive: true },
    { id: 'communicationRating', label: 'Staff Communication', type: 'rating', required: true, order: 3, isActive: true },
    { id: 'resolutionQualityRating', label: 'Resolution Quality', type: 'rating', required: true, order: 4, isActive: true },
    { id: 'resolvedCompletely', label: 'Was the issue fully resolved?', type: 'boolean', required: true, order: 5, isActive: true },
    { id: 'recommendation', label: 'Would you recommend this service to others?', type: 'boolean', required: true, order: 6, isActive: true },
    { id: 'comment', label: 'Additional Comments or Feedback', type: 'text', required: false, order: 7, isActive: true }
  ];

  // Sync state with settings context
  useEffect(() => {
    if (settings) {
      setFeedbackExpiryDays(settings.feedbackExpiryDays ?? 3);
      setFeedbackWelcomeMessage(settings.feedbackWelcomeMessage || 'Please take a moment to rate your satisfaction with how we resolved your complaint. Your feedback helps us improve our public services.');
      setFeedbackSuccessMessage(settings.feedbackSuccessMessage || 'Thank you for your feedback! It helps us improve our services.');
      setFeedbackRatingIcon(settings.feedbackRatingIcon || 'star');
      setFeedbackQuestions(settings.feedbackQuestions && settings.feedbackQuestions.length > 0 ? settings.feedbackQuestions : defaultQuestions);
    }
  }, [settings]);

  if (!user || !isSuperAdmin) {
    return null;
  }

  const handleAddQuestion = () => {
    const newId = `question_${Date.now()}`;
    const newQuestion = {
      id: newId,
      label: 'New Question Label',
      type: 'rating',
      required: false,
      choices: [],
      order: feedbackQuestions.length + 1,
      isActive: true
    };
    setFeedbackQuestions([...feedbackQuestions, newQuestion]);
  };

  const handleUpdateQuestion = (id, fields) => {
    setFeedbackQuestions(prev => prev.map(q => q.id === id ? { ...q, ...fields } : q));
  };

  const handleRemoveQuestion = (id) => {
    setFeedbackQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleMoveQuestion = (index, direction) => {
    const newQuestions = [...feedbackQuestions];
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < newQuestions.length) {
      const temp = newQuestions[index];
      newQuestions[index] = newQuestions[targetIndex];
      newQuestions[targetIndex] = temp;
      
      // Update orders
      newQuestions.forEach((q, idx) => {
        q.order = idx + 1;
      });
      
      setFeedbackQuestions(newQuestions);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('feedbackExpiryDays', feedbackExpiryDays);
      formData.append('feedbackWelcomeMessage', feedbackWelcomeMessage.trim());
      formData.append('feedbackSuccessMessage', feedbackSuccessMessage.trim());
      formData.append('feedbackRatingIcon', feedbackRatingIcon);
      formData.append('feedbackQuestions', JSON.stringify(feedbackQuestions));

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${user.token}`
        },
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        addToast('Settings Saved', 'Feedback & CSAT configuration updated successfully', 'success');
        fetchSettings(); // Refresh settings context
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
          <span>CSAT Survey & Feedback Builder</span>
        </h2>
        <p className="bs-card-subtitle">
          Construct citizen satisfaction surveys dynamically to map custom questions, choices, validation, and rating icons.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
          <div className="bs-section-divider" style={{ borderTop: 'none', paddingTop: 0 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Auto-Resolution Period (Days)</label>
                <input 
                  type="number" 
                  min="1"
                  max="30"
                  className="form-control" 
                  value={feedbackExpiryDays}
                  onChange={(e) => setFeedbackExpiryDays(Number(e.target.value))}
                  required
                />
                <div className="bs-logo-upload-hint">
                  Number of days a ticket stays in 'Awaiting Feedback' before auto-resolving.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Satisfaction Rating Symbol</label>
                <select 
                  className="form-control"
                  value={feedbackRatingIcon}
                  onChange={(e) => setFeedbackRatingIcon(e.target.value)}
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  <option value="star">★ Star Rating</option>
                  <option value="heart">♥ Heart Rating</option>
                  <option value="smile">☺ Smile Icon Rating</option>
                  <option value="thumb">👍 Thumbs Up Rating</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Welcome Instructions Message</label>
              <textarea 
                className="form-control" 
                rows="2"
                value={feedbackWelcomeMessage}
                onChange={(e) => setFeedbackWelcomeMessage(e.target.value)}
                required
                placeholder="Instructions shown to the citizen before they complete the survey..."
              />
            </div>

            <div className="form-group" style={{ marginTop: '16px', marginBottom: '24px' }}>
              <label className="form-label">Thank You / Success Message</label>
              <textarea 
                className="form-control" 
                rows="2"
                value={feedbackSuccessMessage}
                onChange={(e) => setFeedbackSuccessMessage(e.target.value)}
                required
                placeholder="Thank you message shown after they successfully submit feedback..."
              />
            </div>

            {/* Questionnaire Builder Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <strong style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>CSAT Questionnaire Builder</strong>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleAddQuestion}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} /> Add Custom Question
              </button>
            </div>

            {/* List of custom questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {feedbackQuestions.map((q, idx) => (
                <div 
                  key={q.id} 
                  style={{ 
                    background: 'rgba(255,255,255,0.01)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '10px', 
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        type="button" 
                        onClick={() => handleMoveQuestion(idx, -1)} 
                        disabled={idx === 0}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-secondary)' }}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleMoveQuestion(idx, 1)} 
                        disabled={idx === feedbackQuestions.length - 1}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: idx === feedbackQuestions.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-secondary)' }}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>Q#{idx + 1} (ID: {q.id})</span>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => handleRemoveQuestion(q.id)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-danger, #ef4444)', padding: 0 }}
                      title="Remove question"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Question Label / Prompt</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={q.label}
                        onChange={(e) => handleUpdateQuestion(q.id, { label: e.target.value })}
                        required
                        style={{ height: '36px', fontSize: '13px' }}
                      />
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Input Type</label>
                      <select 
                        className="form-control" 
                        value={q.type}
                        onChange={(e) => handleUpdateQuestion(q.id, { type: e.target.value })}
                        style={{ height: '36px', fontSize: '13px', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      >
                        <option value="rating">Rating (1-5)</option>
                        <option value="boolean">Yes / No Choice</option>
                        <option value="text">Text Comments</option>
                        <option value="choice">Multiple Choice</option>
                      </select>
                    </div>
                  </div>

                  {q.type === 'choice' && (
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>Choices (Comma separated list)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={q.choices ? q.choices.join(', ') : ''}
                        onChange={(e) => handleUpdateQuestion(q.id, { choices: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="e.g. Excellent, Good, Fair, Poor"
                        style={{ height: '36px', fontSize: '13px' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={q.required} 
                        onChange={(e) => handleUpdateQuestion(q.id, { required: e.target.checked })}
                      /> Required field
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={q.isActive} 
                        onChange={(e) => handleUpdateQuestion(q.id, { isActive: e.target.checked })}
                      /> Active / Enabled
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary bs-submit-btn" 
            disabled={isSubmitting}
            style={{ marginTop: '20px' }}
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
          <span>Survey Mock Live Preview</span>
        </h3>
        <p className="bs-preview-subtitle">
          Adapts on the citizen portal layout in real-time according to current configuration.
        </p>

        <div className="bs-preview-mock-card" style={{ padding: '20px', minHeight: '300px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '16px' }}>
            {feedbackWelcomeMessage || 'Instructions will be displayed here...'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {feedbackQuestions.filter(q => q.isActive).map((q, idx) => (
              <div key={q.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  {q.label} {q.required && '*'}
                </label>

                {q.type === 'rating' && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <span key={star} style={{ color: star <= 4 ? '#fbbf24' : 'rgba(255,255,255,0.15)', cursor: 'pointer' }}>
                        {feedbackRatingIcon === 'heart' && <Heart size={20} fill={star <= 4 ? '#fbbf24' : 'none'} />}
                        {feedbackRatingIcon === 'smile' && <Smile size={20} fill={star <= 4 ? '#fbbf24' : 'none'} />}
                        {feedbackRatingIcon === 'thumb' && <ThumbsUp size={20} fill={star <= 4 ? '#fbbf24' : 'none'} />}
                        {feedbackRatingIcon === 'star' && <Star size={20} fill={star <= 4 ? '#fbbf24' : 'none'} />}
                      </span>
                    ))}
                  </div>
                )}

                {q.type === 'boolean' && (
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="radio" disabled checked /> Yes
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="radio" disabled /> No
                    </label>
                  </div>
                )}

                {q.type === 'choice' && (
                  <select className="form-control" style={{ height: '32px', fontSize: '12px', maxWidth: '200px' }} disabled>
                    {q.choices && q.choices.map(c => <option key={c}>{c}</option>)}
                  </select>
                )}

                {q.type === 'text' && (
                  <textarea className="form-control" rows="2" placeholder="Write remarks..." disabled />
                )}
              </div>
            ))}
          </div>

          <button className="btn btn-primary" style={{ marginTop: '20px', width: '100%', padding: '8px', fontSize: '13px' }} disabled>
            Submit Satisfaction Survey
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackConfigSettings;
