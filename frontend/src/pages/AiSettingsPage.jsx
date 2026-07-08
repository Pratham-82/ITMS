import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Cpu, 
  Save, 
  History, 
  Activity, 
  TrendingUp, 
  FileText, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import '../styles/AiSettingsPage.css';

const AiSettingsPage = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    enableAiRouting: true,
    autoAcceptThreshold: 0.90,
    suggestionThreshold: 0.70,
    aiProvider: 'google_gemini',
    apiKey: '',
    modelName: 'gemini-2.5-flash'
  });

  // Prompt states
  const [prompts, setPrompts] = useState([]);
  const [newPrompt, setNewPrompt] = useState({
    systemPrompt: '',
    classificationPrompt: '',
    fallbackPrompt: '',
    reasoningPrompt: '',
    description: ''
  });

  // Analytics states
  const [analytics, setAnalytics] = useState(null);

  // Health state
  const [health, setHealth] = useState(null);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);

  // Fetch all configuration and tab-specific data
  const fetchData = async (tab = activeTab) => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${user.token}` };
      
      if (tab === 'general') {
        const res = await fetch('/api/ai/settings', { headers });
        const json = await res.json();
        if (json.success) {
          setSettings(json.data);
        } else {
          addToast('Error', json.message || 'Failed to fetch settings', 'error');
        }
      } 
      
      else if (tab === 'prompts') {
        const [settRes, promptRes] = await Promise.all([
          fetch('/api/ai/settings', { headers }),
          fetch('/api/ai/prompts', { headers })
        ]);
        const settJson = await settRes.json();
        const promptJson = await promptRes.json();
        
        if (settJson.success && promptJson.success) {
          setSettings(settJson.data);
          setPrompts(promptJson.data);
          
          // Populate editor fields with current active prompt or latest
          const activePrompt = promptJson.data.find(p => p._id === settJson.data.activePromptId) || promptJson.data[0];
          if (activePrompt) {
            setNewPrompt({
              systemPrompt: activePrompt.systemPrompt || '',
              classificationPrompt: activePrompt.classificationPrompt || '',
              fallbackPrompt: activePrompt.fallbackPrompt || '',
              reasoningPrompt: activePrompt.reasoningPrompt || '',
              description: `Version ${activePrompt.version + 1} modification`
            });
          }
        }
      } 
      
      else if (tab === 'analytics') {
        const res = await fetch('/api/ai/analytics', { headers });
        const json = await res.json();
        if (json.success) {
          setAnalytics(json.data);
        } else {
          addToast('Error', json.message || 'Failed to fetch analytics', 'error');
        }
      } 
      
      else if (tab === 'health') {
        const res = await fetch('/api/ai/health', { headers });
        const json = await res.json();
        if (json.success) {
          setHealth(json.data);
        } else {
          addToast('Error', json.message || 'Failed to fetch health telemetry', 'error');
        }
      } 
      
      else if (tab === 'audits') {
        const res = await fetch('/api/ai/audit-logs', { headers });
        const json = await res.json();
        if (json.success) {
          setAuditLogs(json.data);
        } else {
          addToast('Error', json.message || 'Failed to fetch audit logs', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Communication failure with server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
    }));
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/ai/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(settings)
      });
      const json = await res.json();
      if (json.success) {
        setSettings(json.data);
        addToast('Settings Saved', 'AI Config properties updated successfully', 'success');
      } else {
        addToast('Save Failed', json.message || 'Error occurred while saving settings', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Failed to save settings', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromptChange = (e) => {
    const { name, value } = e.target;
    setNewPrompt(prev => ({ ...prev, [name]: value }));
  };

  const saveNewPromptVersion = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/ai/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(newPrompt)
      });
      const json = await res.json();
      if (json.success) {
        addToast('Success', json.message, 'success');
        fetchData('prompts');
      } else {
        addToast('Failed', json.message || 'Failed to save prompt version', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Failed to save new prompt version', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const rollbackToPrompt = async (promptId) => {
    if (!window.confirm('Are you sure you want to rollback to this prompt version? This will set it active immediately.')) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/ai/prompts/rollback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ promptId })
      });
      const json = await res.json();
      if (json.success) {
        addToast('Rollback Successful', json.message, 'success');
        fetchData('prompts');
      } else {
        addToast('Failed', json.message || 'Rollback action failed', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Failed to execute rollback request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const clearCache = async () => {
    try {
      const res = await fetch('/api/ai/cache/clear', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        addToast('Cache Cleared', json.message, 'success');
        if (activeTab === 'health') {
          fetchData('health');
        }
      } else {
        addToast('Failed', json.message || 'Could not clear cache', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Failed to clear memory cache', 'error');
    }
  };

  return (
    <div className="ai-settings-container">
      {/* Settings Navigation Tabs */}
      <div className="ai-tabs-nav">
        <button 
          className={`ai-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <Cpu size={16} />
          <span>General Config</span>
        </button>
        <button 
          className={`ai-tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
          onClick={() => setActiveTab('prompts')}
        >
          <FileText size={16} />
          <span>Prompt Manager</span>
        </button>
        <button 
          className={`ai-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <TrendingUp size={16} />
          <span>Routing Analytics</span>
        </button>
        <button 
          className={`ai-tab-btn ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          <Activity size={16} />
          <span>Health Telemetry</span>
        </button>
        <button 
          className={`ai-tab-btn ${activeTab === 'audits' ? 'active' : ''}`}
          onClick={() => setActiveTab('audits')}
        >
          <History size={16} />
          <span>Config Audits</span>
        </button>
      </div>

      <div className="ai-tab-content">
        {loading ? (
          <div className="ai-loading-container">
            <RefreshCw size={36} className="ai-spinner" />
            <p>Loading AI Governance panel...</p>
          </div>
        ) : (
          <>
            {/* General Settings Tab */}
            {activeTab === 'general' && (
              <form onSubmit={saveSettings} className="ai-form">
                <div className="ai-section-header">
                  <h3>General & Provider Settings</h3>
                  <p>Configure auto-routing switches, confidence thresholds, and third-party LLM providers securely.</p>
                </div>

                <div className="ai-grid-2">
                  <div className="ai-card">
                    <h4>Routing Switches & Thresholds</h4>
                    <div className="ai-switch-group" style={{ marginBottom: '14px' }}>
                      <label className="ai-switch-label">
                        <input 
                          type="checkbox" 
                          name="enableAiRouting"
                          checked={settings.enableAiRouting}
                          onChange={handleSettingsChange}
                        />
                        <span>Enable AI Smart Routing System</span>
                      </label>
                      <small>Central toggle that activates real-time complaint routing recommendations.</small>
                    </div>

                    <div className="ai-switch-group" style={{ marginBottom: '14px' }}>
                      <label className="ai-switch-label">
                        <input 
                          type="checkbox" 
                          name="enableClassification"
                          checked={settings.enableClassification}
                          onChange={handleSettingsChange}
                        />
                        <span>Perform Classifications on Filed Tickets</span>
                      </label>
                      <small>Determines if incoming issue texts run through AI parser.</small>
                    </div>

                    <div className="ai-switch-group" style={{ marginBottom: '14px' }}>
                      <label className="ai-switch-label">
                        <input 
                          type="checkbox" 
                          name="autoSelectDepartment"
                          checked={settings.autoSelectDepartment}
                          onChange={handleSettingsChange}
                        />
                        <span>Auto-select Department</span>
                      </label>
                      <small>Auto-populate department fields if classification confidence exceeds thresholds.</small>
                    </div>

                    <div className="ai-switch-group" style={{ marginBottom: '14px' }}>
                      <label className="ai-switch-label">
                        <input 
                          type="checkbox" 
                          name="autoSelectCategory"
                          checked={settings.autoSelectCategory}
                          onChange={handleSettingsChange}
                        />
                        <span>Auto-select Category</span>
                      </label>
                      <small>Auto-populate category fields if classification confidence exceeds thresholds.</small>
                    </div>

                    <div className="ai-switch-group" style={{ marginBottom: '24px' }}>
                      <label className="ai-switch-label">
                        <input 
                          type="checkbox" 
                          name="autoLoadDynamicFields"
                          checked={settings.autoLoadDynamicFields}
                          onChange={handleSettingsChange}
                        />
                        <span>Auto-load Custom Fields layout template</span>
                      </label>
                      <small>Automatically loads custom fields of matching categories on the fly.</small>
                    </div>

                    <div className="ai-field-group" style={{ marginBottom: '24px' }}>
                      <label className="ai-field-label">
                        <span>Auto-Accept Threshold</span>
                        <span className="badge">{(settings.autoAcceptThreshold * 100).toFixed(0)}%</span>
                      </label>
                      <input 
                        type="range" 
                        name="autoAcceptThreshold"
                        min="0.5" 
                        max="1.0" 
                        step="0.05"
                        value={settings.autoAcceptThreshold}
                        onChange={handleSettingsChange}
                        className="ai-range"
                      />
                      <small>Scores above this trigger direct auto-routing with no human action needed.</small>
                    </div>

                    <div className="ai-field-group" style={{ marginBottom: '24px' }}>
                      <label className="ai-field-label">
                        <span>Suggestion Threshold</span>
                        <span className="badge">{(settings.suggestionThreshold * 100).toFixed(0)}%</span>
                      </label>
                      <input 
                        type="range" 
                        name="suggestionThreshold"
                        min="0.1" 
                        max="0.9" 
                        step="0.05"
                        value={settings.suggestionThreshold}
                        onChange={handleSettingsChange}
                        className="ai-range"
                      />
                      <small>Scores between this and accept values show manual recommendation banners.</small>
                    </div>

                    <h4 style={{ marginTop: '24px' }}>General Configuration</h4>
                    <div className="ai-switch-group">
                      <label className="ai-switch-label">
                        <input 
                          type="checkbox" 
                          name="loggingEnabled"
                          checked={settings.loggingEnabled}
                          onChange={handleSettingsChange}
                        />
                        <span>Enable Database Audits Logging</span>
                      </label>
                      <small>Save LLM attempts, classifications logs, overrides reasons and failures details.</small>
                    </div>
                  </div>

                  <div className="ai-card">
                    <h4>AI Provider Configuration</h4>
                    <div className="ai-field-group" style={{ marginBottom: '18px' }}>
                      <label className="ai-input-label">Provider Name</label>
                      <select 
                        name="aiProvider"
                        value={settings.aiProvider}
                        onChange={handleSettingsChange}
                        className="ai-select"
                      >
                        <option value="google_gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="claude">Anthropic Claude</option>
                        <option value="groq">Groq</option>
                      </select>
                    </div>

                    <div className="ai-field-group" style={{ marginBottom: '18px' }}>
                      <label className="ai-input-label">Model Name</label>
                      <input 
                        type="text" 
                        name="modelName"
                        value={settings.modelName}
                        onChange={handleSettingsChange}
                        className="ai-input"
                        placeholder="e.g. gemini-2.5-flash"
                      />
                    </div>

                    <div className="ai-field-group" style={{ marginBottom: '18px' }}>
                      <label className="ai-input-label">API Key</label>
                      <input 
                        type="password" 
                        name="apiKey"
                        value={settings.apiKey}
                        onChange={handleSettingsChange}
                        className="ai-input text-secure"
                        placeholder="••••••••••••••••"
                      />
                    </div>

                    <h4 style={{ marginTop: '24px' }}>LLM Hyperparameters</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div className="ai-field-group">
                        <label className="ai-input-label">Temperature (0.0 - 1.0)</label>
                        <input 
                          type="number" 
                          name="temperature"
                          min="0" 
                          max="1" 
                          step="0.05"
                          value={settings.temperature}
                          onChange={handleSettingsChange}
                          className="ai-input"
                        />
                      </div>

                      <div className="ai-field-group">
                        <label className="ai-input-label">Max Output Tokens</label>
                        <input 
                          type="number" 
                          name="maxTokens"
                          value={settings.maxTokens}
                          onChange={handleSettingsChange}
                          className="ai-input"
                        />
                      </div>

                      <div className="ai-field-group">
                        <label className="ai-input-label">Timeout (ms)</label>
                        <input 
                          type="number" 
                          name="timeoutMs"
                          value={settings.timeoutMs}
                          onChange={handleSettingsChange}
                          className="ai-input"
                        />
                      </div>

                      <div className="ai-field-group">
                        <label className="ai-input-label">Cache TTL (mins)</label>
                        <input 
                          type="number" 
                          name="cacheDurationMinutes"
                          value={settings.cacheDurationMinutes}
                          onChange={handleSettingsChange}
                          className="ai-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ai-card" style={{ marginTop: '20px' }}>
                  <h4>Rate Limiting Settings (Per Citizen User)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    <div className="ai-field-group">
                      <label className="ai-input-label">Requests / Minute</label>
                      <input 
                        type="number" 
                        name="rateLimitPerUserPerMinute"
                        value={settings.rateLimitPerUserPerMinute}
                        onChange={handleSettingsChange}
                        className="ai-input"
                      />
                    </div>

                    <div className="ai-field-group">
                      <label className="ai-input-label">Requests / Hour</label>
                      <input 
                        type="number" 
                        name="rateLimitPerUserPerHour"
                        value={settings.rateLimitPerUserPerHour}
                        onChange={handleSettingsChange}
                        className="ai-input"
                      />
                    </div>

                    <div className="ai-field-group">
                      <label className="ai-input-label">Requests / Day</label>
                      <input 
                        type="number" 
                        name="rateLimitPerUserPerDay"
                        value={settings.rateLimitPerUserPerDay}
                        onChange={handleSettingsChange}
                        className="ai-input"
                      />
                    </div>

                    <div className="ai-field-group">
                      <label className="ai-input-label">Global Requests / Day</label>
                      <input 
                        type="number" 
                        name="globalUsageLimitPerDay"
                        value={settings.globalUsageLimitPerDay}
                        onChange={handleSettingsChange}
                        className="ai-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="ai-form-actions" style={{ marginTop: '24px' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    <Save size={16} />
                    <span>{submitting ? 'Saving changes...' : 'Save AI Settings'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Prompt Manager Tab */}
            {activeTab === 'prompts' && (
              <div className="ai-prompt-manager">
                <div className="ai-section-header">
                  <h3>AI Prompt Version Controller</h3>
                  <p>Update system prompt, contextual settings and fallback rules. Active prompt determines LLM decision behaviors.</p>
                </div>

                <div className="ai-grid-2">
                  <form onSubmit={saveNewPromptVersion} className="ai-card">
                    <h4>Prompt Designer</h4>
                    
                    <div className="ai-field-group">
                      <label className="ai-input-label">System Persona Prompt *</label>
                      <textarea 
                        name="systemPrompt"
                        value={newPrompt.systemPrompt}
                        onChange={handlePromptChange}
                        rows="4"
                        className="ai-textarea"
                        required
                      />
                    </div>

                    <div className="ai-field-group">
                      <label className="ai-input-label">
                        <span>Classification Core Instruction *</span>
                        <span className="tooltip-hint" title="Use {departments} and {categories} placeholders to dynamically inject database definitions.">
                          <HelpCircle size={14} />
                        </span>
                      </label>
                      <textarea 
                        name="classificationPrompt"
                        value={newPrompt.classificationPrompt}
                        onChange={handlePromptChange}
                        rows="6"
                        className="ai-textarea"
                        required
                      />
                    </div>

                    <div className="ai-field-group">
                      <label className="ai-input-label">Fallback Rules Prompt *</label>
                      <textarea 
                        name="fallbackPrompt"
                        value={newPrompt.fallbackPrompt}
                        onChange={handlePromptChange}
                        rows="3"
                        className="ai-textarea"
                        required
                      />
                    </div>

                    <div className="ai-field-group">
                      <label className="ai-input-label">Reasoning Length Limit Prompt *</label>
                      <textarea 
                        name="reasoningPrompt"
                        value={newPrompt.reasoningPrompt}
                        onChange={handlePromptChange}
                        rows="2"
                        className="ai-textarea"
                        required
                      />
                    </div>

                    <div className="ai-field-group">
                      <label className="ai-input-label">Change Log Description</label>
                      <input 
                        type="text" 
                        name="description"
                        value={newPrompt.description}
                        onChange={handlePromptChange}
                        className="ai-input"
                        placeholder="e.g. Fine-tuned classification parameters"
                      />
                    </div>

                    <div className="ai-form-actions">
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={submitting}
                      >
                        <Save size={16} />
                        <span>Deploy Prompt Version</span>
                      </button>
                    </div>
                  </form>

                  <div className="ai-card">
                    <h4>Prompt History Log</h4>
                    <div className="ai-history-list">
                      {prompts.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)' }}>No prompt history recorded.</p>
                      ) : (
                        prompts.map((p, idx) => {
                          const isActive = p._id === settings.activePromptId;
                          return (
                            <div 
                              key={p._id} 
                              className={`ai-history-item ${isActive ? 'active-version' : ''}`}
                            >
                              <div className="ai-history-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="version-badge">v{p.version}</span>
                                  {isActive && <span className="active-badge">Active</span>}
                                </div>
                                <span className="history-date">
                                  {new Date(p.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="history-desc">{p.description || 'No description provided'}</p>
                              <div className="history-meta">
                                <span>Author: {p.createdBy?.name || 'System Seeder'}</span>
                              </div>
                              {!isActive && (
                                <button 
                                  onClick={() => rollbackToPrompt(p._id)}
                                  className="btn btn-secondary btn-xs"
                                  disabled={submitting}
                                  style={{ marginTop: '10px', fontSize: '11px', padding: '4px 8px' }}
                                >
                                  Rollback to v{p.version}
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && analytics && (
              <div className="ai-analytics">
                <div className="ai-section-header">
                  <h3>Intelligent Routing Analytics</h3>
                  <p>Monitor classification success rates, manual override audits, and response metrics.</p>
                </div>

                <div className="ai-telemetry-grid">
                  <div className="telemetry-box">
                    <span className="telemetry-label">Total Predictions</span>
                    <span className="telemetry-val">{analytics.totalClassifications}</span>
                  </div>
                  <div className="telemetry-box">
                    <span className="telemetry-label">Classification Accuracy</span>
                    <span className="telemetry-val" style={{ color: '#10b981' }}>
                      {analytics.classificationAccuracy.toFixed(1)}%
                    </span>
                  </div>
                  <div className="telemetry-box">
                    <span className="telemetry-label">Manual Override Rate</span>
                    <span className="telemetry-val" style={{ color: '#f59e0b' }}>
                      {analytics.overrideRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="telemetry-box">
                    <span className="telemetry-label">Average Confidence</span>
                    <span className="telemetry-val">
                      {analytics.averageConfidence.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="ai-grid-2" style={{ marginTop: '20px' }}>
                  <div className="ai-card">
                    <h4>Top Predicted Categories</h4>
                    <table className="ai-table">
                      <thead>
                        <tr>
                          <th>Category Name</th>
                          <th style={{ textAlign: 'right' }}>Occurrences</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.mostPredictedCategories.length === 0 ? (
                          <tr><td colSpan="2" style={{ color: 'var(--text-muted)' }}>No prediction statistics.</td></tr>
                        ) : (
                          analytics.mostPredictedCategories.map((c, idx) => (
                            <tr key={idx}>
                              <td>{c.name}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.count}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="ai-card">
                    <h4>Top Overridden Categories</h4>
                    <table className="ai-table">
                      <thead>
                        <tr>
                          <th>Category Name</th>
                          <th style={{ textAlign: 'right' }}>Overrides Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.highestOverrideCategories.length === 0 ? (
                          <tr><td colSpan="2" style={{ color: 'var(--text-muted)' }}>No overrides recorded.</td></tr>
                        ) : (
                          analytics.highestOverrideCategories.map((c, idx) => (
                            <tr key={idx}>
                              <td>{c.name}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>{c.count}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="ai-card" style={{ marginTop: '20px' }}>
                  <h4>Recent User Override Reasons</h4>
                  <div className="ai-overrides-list">
                    {analytics.overrideReasons.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>No manual overrides recorded recently.</p>
                    ) : (
                      analytics.overrideReasons.map((item, idx) => (
                        <div key={idx} className="override-reason-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span className="override-cat">Suggested Category: <strong>{item.suggestedCat || 'N/A'}</strong></span>
                            <span className="override-time">{new Date(item.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="override-reason-text">"{item.reason}"</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Health & Telemetry Tab */}
            {activeTab === 'health' && health && (
              <div className="ai-health">
                <div className="ai-section-header">
                  <h3>AI Provider Health & Telemetry</h3>
                  <p>Inspect real-time API connectivity metrics, timeouts, and latency tracking.</p>
                </div>

                <div className="ai-grid-2">
                  <div className="ai-card">
                    <h4>Status Telemetry</h4>
                    
                    <div className="health-status-banner" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px',
                      borderRadius: 'var(--border-radius-sm)',
                      background: health.providerStatus === 'Healthy' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${health.providerStatus === 'Healthy' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                      marginBottom: '20px'
                    }}>
                      {health.providerStatus === 'Healthy' ? (
                        <CheckCircle2 size={32} style={{ color: '#10b981' }} />
                      ) : (
                        <ShieldAlert size={32} style={{ color: '#ef4444' }} />
                      )}
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800 }}>
                          API State: {health.providerStatus}
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                          Running model: <strong>{health.currentModel}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="telemetry-sub-list">
                      <div className="telemetry-sub-row">
                        <span>API Request Success Rate</span>
                        <strong>{health.successRate.toFixed(1)}%</strong>
                      </div>
                      <div className="telemetry-sub-row">
                        <span>Average Latency</span>
                        <strong>{health.avgLatencyMs.toFixed(0)} ms</strong>
                      </div>
                      <div className="telemetry-sub-row">
                        <span>Timeout Failures</span>
                        <strong style={{ color: health.timeoutCount > 0 ? '#ef4444' : 'inherit' }}>
                          {health.timeoutCount}
                        </strong>
                      </div>
                      <div className="telemetry-sub-row">
                        <span>API Server Error Counts</span>
                        <strong style={{ color: health.apiErrorCount > 0 ? '#ef4444' : 'inherit' }}>
                          {health.apiErrorCount}
                        </strong>
                      </div>
                      <div className="telemetry-sub-row">
                        <span>Last Successful Run</span>
                        <span>
                          {health.lastSuccessTimestamp 
                            ? new Date(health.lastSuccessTimestamp).toLocaleString() 
                            : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ai-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h4>Cache Management</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                        To reduce API costs and improve frontend response speeds, ApexResolve caches LLM classifications in-memory. 
                        Clearing the cache will force the system to query the AI provider for all future tickets.
                      </p>
                    </div>
                    <div>
                      <button 
                        onClick={clearCache}
                        className="btn btn-secondary btn-block"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Trash2 size={16} />
                        <span>Purge Classification Cache</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === 'audits' && (
              <div className="ai-audits">
                <div className="ai-section-header">
                  <h3>Governance & Configurations Audits</h3>
                  <p>Chronological logs detailing administrative changes to AI parameters and prompts.</p>
                </div>

                <div className="ai-card">
                  <table className="ai-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Super Admin</th>
                        <th>Action</th>
                        <th>Details / Changed Values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                            No configurations modifications audited.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log._id}>
                            <td className="log-time">{new Date(log.createdAt).toLocaleString()}</td>
                            <td className="log-user">{log.userName}</td>
                            <td className="log-action">
                              <span className={`badge-action ${log.action.toLowerCase()}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="log-details">
                              {Array.isArray(log.newValue) ? (
                                <div className="audit-change-list">
                                  {log.newValue.map((c, idx) => (
                                    <div key={idx} style={{ marginBottom: '4px', fontSize: '12px' }}>
                                      <code>{c.field}</code>: 
                                      <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', margin: '0 4px' }}>
                                        {c.oldVal?.toString()}
                                      </span>
                                      <ChevronRight size={12} style={{ verticalAlign: 'middle' }} />
                                      <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                                        {c.newVal?.toString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px' }}>
                                  {log.oldValue && <span>Old: <code>{log.oldValue.toString()}</code> &raquo; </span>}
                                  {log.newValue && <span>New: <code>{log.newValue.toString()}</code></span>}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AiSettingsPage;
