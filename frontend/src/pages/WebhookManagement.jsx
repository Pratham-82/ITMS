import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Globe, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  Activity, 
  Check, 
  X, 
  Lock, 
  Unlock, 
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Code
} from 'lucide-react';
import '../styles/SettingsHub.css'; // Reuse primary hub elements

const WebhookManagement = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState(null);

  // Edit / Form state
  const [selectedWebhook, setSelectedWebhook] = useState(null); // null means "Create mode"
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Help Guide state
  const [showGuide, setShowGuide] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState('inbound'); // 'inbound' | 'outbound' | 'payloads'
  
  // Available events checklist
  const availableEvents = [
    { id: '*', label: 'All Events (Wildcard)', description: 'Trigger for every event in the system' },
    { id: 'ticket.created', label: 'Ticket Created', description: 'When a citizen files a new support incident or complaint' },
    { id: 'ticket.status_changed', label: 'Ticket Status Updated', description: 'When an officer updates a ticket status (e.g. Pending -> Investigating)' },
    { id: 'ticket.comment_added', label: 'Comment Added', description: 'When an officer or citizen posts a discussion response' },
    { id: 'ticket.reopened', label: 'Ticket Reopened', description: 'When a citizen rejects resolution and requests a reopen' },
    { id: 'sla.warning', label: 'SLA Warning Triggered', description: 'When a ticket reaches warning time threshold without response/resolution' },
    { id: 'sla.breached', label: 'SLA Target Breached', description: 'When a ticket violates response or resolution time limits' }
  ];

  const [selectedEvents, setSelectedEvents] = useState([]);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/webhooks', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setWebhooks(json.data || []);
      } else {
        addToast('Error', json.message || 'Failed to fetch webhook subscriptions', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Server connection error', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchWebhooks();
    }
  }, [user]);

  const handleEventToggle = (eventId) => {
    if (eventId === '*') {
      // If wildcard is selected, clear everything else and keep only wildcard
      if (selectedEvents.includes('*')) {
        setSelectedEvents([]);
      } else {
        setSelectedEvents(['*']);
      }
      return;
    }

    // Otherwise, toggle specific event and ensure wildcard is unselected
    let updated = selectedEvents.filter(e => e !== '*');
    if (updated.includes(eventId)) {
      updated = updated.filter(e => e !== eventId);
    } else {
      updated.push(eventId);
    }
    setSelectedEvents(updated);
  };

  const handleResetForm = () => {
    setSelectedWebhook(null);
    setName('');
    setUrl('');
    setSecret('');
    setIsActive(true);
    setSelectedEvents([]);
  };

  const handleSelectWebhook = (wh) => {
    setSelectedWebhook(wh);
    setName(wh.name);
    setUrl(wh.url);
    setSecret(wh.secret || '');
    setIsActive(wh.isActive);
    setSelectedEvents(wh.events || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      addToast('Validation Error', 'Webhook Name and Destination URL are required', 'error');
      return;
    }
    if (selectedEvents.length === 0) {
      addToast('Validation Error', 'Please select at least one subscribed event', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        url: url.trim(),
        secret: secret.trim(),
        events: selectedEvents,
        isActive
      };

      const isEdit = !!selectedWebhook;
      const method = isEdit ? 'PUT' : 'POST';
      const endpoint = isEdit ? `/api/webhooks/${selectedWebhook._id}` : '/api/webhooks';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        addToast(
          isEdit ? 'Webhook Updated' : 'Webhook Registered',
          `Successfully saved integration endpoint "${name}"`,
          'success'
        );
        handleResetForm();
        fetchWebhooks();
      } else {
        addToast('Save Failed', json.message || 'Could not save webhook subscription', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Communication failure with backend server', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (whId, whName) => {
    if (!window.confirm(`Are you sure you want to delete the webhook integration "${whName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/webhooks/${whId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        addToast('Webhook Deleted', `Removed integration endpoint "${whName}"`, 'success');
        if (selectedWebhook?._id === whId) {
          handleResetForm();
        }
        fetchWebhooks();
      } else {
        addToast('Delete Failed', json.message || 'Could not delete webhook subscription', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Could not delete webhook', 'error');
    }
  };

  const handleTestPing = async (whId, whName) => {
    try {
      setTestingId(whId);
      const res = await fetch(`/api/webhooks/${whId}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        addToast('Webhook Test Success', json.message || 'Test ping succeeded', 'success');
      } else {
        addToast('Webhook Test Failed', json.message || 'Test ping returned error status', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Failed to communicate with mock testing engine', 'error');
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Grid configuration panel */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        
        {/* List Panel */}
        <div className="form-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={18} className="text-accent" />
            <span>Active Webhook Subscriptions</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
            Configure HTTP POST callbacks to send real-time ticket update events to developer endpoints or services like Slack, Zapier, and Teams.
          </p>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <RefreshCw size={24} className="text-accent" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : webhooks.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 16px',
              border: '1px dashed var(--border-color)',
              borderRadius: '12px',
              color: 'var(--text-secondary)'
            }}>
              <Globe size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>No Webhooks Configured Yet</span>
              <span style={{ fontSize: '11px', textAlign: 'center', marginTop: '4px', maxWidth: '280px' }}>
                Add a destination URL on the right to start receiving real-time event payloads.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {webhooks.map((wh) => (
                <div 
                  key={wh._id}
                  style={{
                    border: selectedWebhook?._id === wh._id ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    background: selectedWebhook?._id === wh._id ? 'rgba(99, 102, 241, 0.02)' : 'var(--bg-secondary)',
                    borderRadius: '10px',
                    padding: '16px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedWebhook?._id === wh._id ? '0 4px 12px var(--accent-glow)' : 'none'
                  }}
                >
                  {/* Header info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {wh.name}
                        <span style={{
                          padding: '2px 6px',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          borderRadius: '4px',
                          background: wh.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: wh.isActive ? '#10b981' : '#ef4444'
                        }}>
                          {wh.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </h3>
                      <code style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px', wordBreak: 'break-all' }}>
                        {wh.url}
                      </code>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleTestPing(wh._id, wh.name)}
                        disabled={testingId === wh._id}
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 700
                        }}
                        title="Send test payload"
                      >
                        {testingId === wh._id ? (
                          <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <Activity size={11} />
                        )}
                        <span>{testingId === wh._id ? 'Testing...' : 'Test'}</span>
                      </button>
                      
                      <button
                        onClick={() => handleSelectWebhook(wh)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 8px' }}
                        title="Edit endpoint"
                      >
                        <Edit2 size={12} />
                      </button>

                      <button
                        onClick={() => handleDelete(wh._id, wh.name)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 8px', color: 'var(--status-rejected, #ef4444)' }}
                        title="Remove integration"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Subscribed events list */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                    {wh.events.map((evt) => (
                      <span 
                        key={evt}
                        style={{
                          fontSize: '10px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        {evt === '*' ? 'all events (*)' : evt}
                      </span>
                    ))}
                    {wh.secret && (
                      <span 
                        style={{
                          fontSize: '10px',
                          background: 'rgba(245, 158, 11, 0.05)',
                          border: '1px solid rgba(245, 158, 11, 0.15)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          color: '#f59e0b',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title="Payloads are HMAC signed"
                      >
                        <Lock size={9} /> Signed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor Form Card */}
        <div className="form-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
              {selectedWebhook ? 'Modify Integration Endpoint' : 'Register Webhook Endpoint'}
            </h2>
            {selectedWebhook && (
              <button 
                onClick={handleResetForm}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontWeight: 700
                }}
              >
                <Plus size={12} /> Add New instead
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div className="form-group">
              <label className="form-label">Integration / Endpoint Name *</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="e.g., Slack Alerts Channel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Destination URL *</label>
              <input 
                type="url" 
                className="form-control"
                placeholder="https://yourserver.com/webhooks"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                URL must begin with https:// and accept HTTP POST payloads in JSON format.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Secret Token (Optional HMAC signature validation)</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Leave blank for unsigned payloads, or input secret"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                If provided, payloads are signed with an HMAC hex hash generated via SHA-256 and sent in the header <code>X-ApexResolve-Signature</code>.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Subscribed Events *</label>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px',
                background: 'var(--bg-secondary)'
              }}>
                {availableEvents.map(evt => (
                  <label 
                    key={evt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      padding: '4px 0'
                    }}
                  >
                    <input 
                      type="checkbox"
                      checked={selectedEvents.includes(evt.id)}
                      onChange={() => handleEventToggle(evt.id)}
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>
                        {evt.label}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>
                        {evt.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Toggle Active status */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-secondary)' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, display: 'block' }}>Subscription Status</span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Send live triggers for this endpoint</span>
              </div>
              <label className="bs-registration-checkbox-label" style={{ padding: 0, border: 'none', background: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {isActive ? (
                    <Unlock size={16} className="bs-status-active-icon" style={{ marginRight: '6px' }} />
                  ) : (
                    <Lock size={16} className="bs-status-locked-icon" style={{ marginRight: '6px' }} />
                  )}
                  <span style={{ fontSize: '12px', fontWeight: 600, marginRight: '12px' }}>
                    {isActive ? 'Enabled' : 'Disabled'}
                  </span>
                  <input 
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button 
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 700
                }}
              >
                <Save size={16} />
                <span>{submitting ? 'Saving endpoint...' : (selectedWebhook ? 'Update Subscription' : 'Create Subscription')}</span>
              </button>
              {selectedWebhook && (
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetForm}
                  style={{ fontWeight: 700 }}
                >
                  Cancel
                </button>
              )}
            </div>

          </form>
        </div>

      </div>

      {/* Developer API & Webhooks Collapsible Guide (Full Width at Bottom) */}
      <div className="form-card" style={{ padding: '24px', border: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setShowGuide(!showGuide)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={20} className="text-accent" />
            <span style={{ fontSize: '15px', fontWeight: 800 }}>📖 Developers Integration & API Guide</span>
          </div>
          {showGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showGuide && (
          <div style={{ marginTop: '24px', animation: 'fadeIn 0.25s ease-out' }}>
            
            {/* Guide Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setActiveGuideTab('inbound')}
                style={{
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeGuideTab === 'inbound' ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeGuideTab === 'inbound' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease'
                }}
              >
                Inbound Sales API (POST)
              </button>
              <button
                type="button"
                onClick={() => setActiveGuideTab('outbound')}
                style={{
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeGuideTab === 'outbound' ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeGuideTab === 'outbound' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease'
                }}
              >
                Outbound HMAC Signature
              </button>
              <button
                type="button"
                onClick={() => setActiveGuideTab('payloads')}
                style={{
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeGuideTab === 'payloads' ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeGuideTab === 'payloads' ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.2s ease'
                }}
              >
                Event Payloads (JSON)
              </button>
            </div>

            {/* Inbound Sales API Tab */}
            {activeGuideTab === 'inbound' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Call this endpoint from your external checkout, CRM (Salesforce), or e-commerce shop (Shopify/Stripe) to automatically register sold items into the Asset Management registry.
                </p>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                  <code style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>POST /api/assets/purchase/:typeName</code>
                  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <strong>URL Parameter:</strong> <code>typeName</code> (e.g. <code>Laptop</code>, <code>Server</code>). Matches the Asset Type (schema template) defining the custom fields.
                  </div>
                </div>
                
                <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '8px 0 2px 0' }}>Request Headers</h4>
                <pre style={{ margin: 0, padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-primary)', overflowX: 'auto' }}>
{`Content-Type: application/json
Authorization: Bearer <ADMIN_JWT_TOKEN>`}
                </pre>

                <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '8px 0 2px 0' }}>Example Request Payload</h4>
                <pre style={{ margin: 0, padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-primary)', overflowX: 'auto' }}>
{`{
  "customerName": "Alice Johnson",
  "customerEmail": "alice.johnson@example.com",
  "productName": "MacBook Pro 14-inch M3",
  "productSku": "MBP-M3-14",
  "serialNumber": "CN-MBPM3-9988",
  "warrantyMonths": 24,
  
  // Custom properties configured in Asset Type:
  "ram_size": "24GB Unified Memory",
  "cpu": "Apple M3 8-Core"
}`}
                </pre>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  * Note: If custom fields like <code>ram_size</code> or <code>cpu</code> are configured as "Inbound Mapping Keys" in the Asset Type configuration, they map automatically to the dynamic asset fields.
                </span>
              </div>
            )}

            {/* Outbound Verification Tab */}
            {activeGuideTab === 'outbound' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  To ensure incoming webhook requests from ApexResolve are authentic and have not been tampered with, calculate and match the signature hex hash.
                </p>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                    <strong>Headers Dispatched:</strong>
                    <ul style={{ paddingLeft: '20px', margin: '6px 0 0 0' }}>
                      <li><code>X-ApexResolve-Event</code>: The event type name (e.g. <code>ticket.created</code>)</li>
                      <li><code>X-ApexResolve-Signature</code>: SHA-256 HMAC hexadecimal hash generated using your client secret</li>
                    </ul>
                  </div>
                </div>

                <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '8px 0 2px 0' }}>Node.js Verification Example</h4>
                <pre style={{ margin: 0, padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-primary)', overflowX: 'auto' }}>
{`const crypto = require('crypto');

app.post('/webhook-receiver', (req, res) => {
  const receivedSignature = req.headers['x-apexresolve-signature'];
  const secretKey = 'YOUR_REGISTERED_CLIENT_SECRET';

  const computedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (receivedSignature !== computedSignature) {
    console.error('Signature invalid! Payload ignored.');
    return res.status(401).send('Forbidden');
  }

  console.log('Payload verified! Event type:', req.headers['x-apexresolve-event']);
  res.status(200).send('Verified');
});`}
                </pre>
              </div>
            )}

            {/* Event Payloads Tab */}
            {activeGuideTab === 'payloads' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Payload schema structures sent in the POST body to your endpoints:
                </p>
                
                <h4 style={{ fontSize: '12px', fontWeight: 800, margin: '4px 0 0 0' }}>Event: ticket.created / ticket.status_changed</h4>
                <pre style={{ margin: 0, padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-primary)', overflowX: 'auto' }}>
{`{
  "event": "ticket.created",
  "tenantId": "my-org-tenant",
  "timestamp": "2026-07-01T12:00:00.000Z",
  "data": {
    "trackingId": "CMP-000104",
    "title": "Broken AC Unit",
    "priority": "Medium",
    "status": "Pending",
    "assignedDepartment": "Facilities"
  }
}`}
                </pre>

                <h4 style={{ fontSize: '12px', fontWeight: 800, margin: '8px 0 0 0' }}>Event: sla.breached / sla.warning</h4>
                <pre style={{ margin: 0, padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-primary)', overflowX: 'auto' }}>
{`{
  "event": "sla.breached",
  "tenantId": "my-org-tenant",
  "timestamp": "2026-07-01T14:30:00.000Z",
  "data": {
    "ticket": {
      "trackingId": "CMP-000104",
      "title": "Broken AC Unit",
      "priority": "Medium"
    },
    "slaEvent": {
      "type": "RESPONSE_SLA_BREACH",
      "breachedAt": "2026-07-01T14:30:00.000Z"
    }
  }
}`}
                </pre>
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
};

export default WebhookManagement;
