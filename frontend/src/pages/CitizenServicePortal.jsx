import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Folder, ArrowLeft, Send, MessageSquare, ClipboardList, CheckCircle2, History, AlertCircle, Wrench } from 'lucide-react';
import '../styles/CitizenServicePortal.css';

const CitizenServicePortal = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'my-requests'
  const [catalogs, setCatalogs] = useState([]);
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [requests, setRequests] = useState([]);

  // Form states
  const [formValues, setFormValues] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Asset selection states
  const [availableAssets, setAvailableAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');

  const [searchParams] = useSearchParams();
  const preselectedAssetId = searchParams.get('assetId');
  const preselectedSerialNumber = searchParams.get('serialNumber');

  // Selected request detail view (for comment & history popup)
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  useEffect(() => {
    if (user?.token) {
      if (activeTab === 'browse') {
        fetchCatalogs();
      } else {
        fetchRequests();
      }
    }
  }, [user, activeTab]);

  const fetchCatalogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/service-catalogs', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setCatalogs(json.data || []);
      }
    } catch (err) {
      addToast('Error', 'Failed to retrieve service catalogs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchServicesInCatalog = async (catalog) => {
    try {
      setLoading(true);
      setSelectedCatalog(catalog);
      const res = await fetch(`/api/services?catalog=${catalog._id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setServices(json.data || []);
      }
    } catch (err) {
      addToast('Error', 'Failed to retrieve services in this catalog', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/service-requests', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setRequests(json.data || []);
      }
    } catch (err) {
      addToast('Error', 'Failed to retrieve service requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await fetch('/api/assets?limit=100', {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        const json = await res.json();
        if (json.success) {
          setAvailableAssets(json.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch assets', err);
      }
    };
    if (user?.token) {
      fetchAssets();
    }
  }, [user]);

  useEffect(() => {
    if (availableAssets.length > 0) {
      if (preselectedAssetId) {
        const found = availableAssets.find(a => a._id === preselectedAssetId);
        if (found) setSelectedAsset(found);
      } else if (preselectedSerialNumber) {
        const found = availableAssets.find(a => a.serialNumber?.toLowerCase() === preselectedSerialNumber.toLowerCase());
        if (found) setSelectedAsset(found);
      }
    }
  }, [availableAssets, preselectedAssetId, preselectedSerialNumber]);

  const handleSelectService = (service) => {
    setSelectedService(service);
    const initialFormValues = {};
    service.fields.forEach(f => {
      initialFormValues[f.label] = f.type === 'checkbox' ? false : '';
    });
    setFormValues(initialFormValues);
  };

  const handleFormChange = (label, val) => {
    setFormValues({
      ...formValues,
      [label]: val
    });
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();

    // Verify required fields
    for (const field of selectedService.fields) {
      if (field.required) {
        const val = formValues[field.label];
        if (val === undefined || val === '' || val === null) {
          addToast('Validation Error', `"${field.label}" field is mandatory`, 'error');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          serviceId: selectedService._id,
          customFields: formValues,
          assetId: selectedAsset ? selectedAsset._id : null
        })
      });
      const json = await res.json();
      if (json.success) {
        addToast(
          'Request Filed',
          `Service Request filed successfully. Tracking ID: ${json.data.trackingId}`,
          'success'
        );
        setSelectedService(null);
        setSelectedCatalog(null);
        setFormValues({});
        setSelectedAsset(null);
        setAssetSearchQuery('');
        setActiveTab('my-requests');
      } else {
        addToast('Error', json.message || 'Failed to file service request', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToCatalogs = () => {
    setSelectedCatalog(null);
    setServices([]);
  };

  const handleBackToServices = () => {
    setSelectedService(null);
    setFormValues({});
    setSelectedAsset(null);
    setAssetSearchQuery('');
  };

  const fetchRequestDetails = async (reqId) => {
    try {
      const res = await fetch(`/api/service-requests/${reqId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setSelectedRequest(json.data);
      }
    } catch (err) {
      addToast('Error', 'Failed to retrieve request details', 'error');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsCommenting(true);
    try {
      const res = await fetch(`/api/service-requests/${selectedRequest._id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ message: commentText.trim() })
      });
      const json = await res.json();
      if (json.success) {
        setCommentText('');
        fetchRequestDetails(selectedRequest._id);
        fetchRequests();
      } else {
        addToast('Error', json.message || 'Failed to submit comment', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection error', 'error');
    } finally {
      setIsCommenting(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Pending': return 'csp-status-pending';
      case 'In Progress': return 'csp-status-progress';
      case 'Resolved': return 'csp-status-resolved';
      case 'Rejected': return 'csp-status-rejected';
      default: return '';
    }
  };

  return (
    <div className="csp-container">
      {/* Tab Menu */}
      <div className="csp-tabs">
        <button
          onClick={() => {
            setActiveTab('browse');
            setSelectedRequest(null);
          }}
          className={`csp-tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
        >
          Browse Services
        </button>
        <button
          onClick={() => {
            setActiveTab('my-requests');
            setSelectedRequest(null);
          }}
          className={`csp-tab-btn ${activeTab === 'my-requests' ? 'active' : ''}`}
        >
          My Requests
        </button>
      </div>

      {activeTab === 'browse' ? (
        /* BROWSE AND FILE SERVICES */
        <div>
          {/* Back Buttons */}
          {selectedService ? (
            <button onClick={handleBackToServices} className="csp-back-btn">
              <ArrowLeft size={16} /> Back to Services list
            </button>
          ) : selectedCatalog ? (
            <button onClick={handleBackToCatalogs} className="csp-back-btn">
              <ArrowLeft size={16} /> Back to Catalogs
            </button>
          ) : null}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
              Loading services portal...
            </div>
          ) : selectedService ? (
            /* STEP 3: FILL FORM */
            <div className="csp-form-container">
              <div className="csp-form-header">
                <h3 className="csp-form-title">{selectedService.name}</h3>
                <p className="csp-form-desc">{selectedService.description || 'Fill in the information below to request this service.'}</p>
              </div>

              <form onSubmit={handleSubmitRequest}>
                {selectedService.fields?.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '24px' }}>
                    This service does not require any additional custom details. Press submit below to request fulfillment.
                  </div>
                ) : (
                  selectedService.fields.map((field, idx) => (
                    <div key={idx} className="csp-input-group">
                      <label>
                        {field.label}
                        {field.required && <span className="csp-required">*</span>}
                      </label>
                      
                      {field.type === 'text' && (
                        <input
                          type="text"
                          className="csp-input"
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          value={formValues[field.label] || ''}
                          onChange={(e) => handleFormChange(field.label, e.target.value)}
                          required={field.required}
                        />
                      )}

                      {field.type === 'number' && (
                        <input
                          type="number"
                          className="csp-input"
                          placeholder="e.g. 100"
                          value={formValues[field.label] || ''}
                          onChange={(e) => handleFormChange(field.label, e.target.value)}
                          required={field.required}
                        />
                      )}

                      {field.type === 'select' && (
                        <select
                          className="csp-select"
                          value={formValues[field.label] || ''}
                          onChange={(e) => handleFormChange(field.label, e.target.value)}
                          required={field.required}
                        >
                          <option value="">-- Choose Option --</option>
                          {field.options?.map((opt, oIdx) => (
                            <option key={oIdx} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.type === 'textarea' && (
                        <textarea
                          className="csp-textarea"
                          rows={4}
                          placeholder={`Provide details regarding ${field.label.toLowerCase()}...`}
                          value={formValues[field.label] || ''}
                          onChange={(e) => handleFormChange(field.label, e.target.value)}
                          required={field.required}
                        />
                      )}

                      {field.type === 'checkbox' && (
                        <label className="csp-checkbox-label" style={{ display: 'flex', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={formValues[field.label] || false}
                            onChange={(e) => handleFormChange(field.label, e.target.checked)}
                          />
                          <span>Confirm / Agree to "{field.label}"</span>
                        </label>
                      )}
                    </div>
                  ))
                )}

                {/* Optional Asset Linking */}
                <div className="csp-input-group" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Link Asset (Optional)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      className="csp-input"
                      placeholder="Search asset by code, name, or serial number..."
                      value={assetSearchQuery}
                      onChange={(e) => setAssetSearchQuery(e.target.value)}
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  {assetSearchQuery.trim() !== '' && (
                    <div style={{
                      maxHeight: '180px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-sm)',
                      backgroundColor: 'var(--bg-secondary)',
                      marginBottom: '12px',
                      boxShadow: 'var(--box-shadow-sm)'
                    }}>
                      {availableAssets
                        .filter(a => 
                          (!selectedAsset || selectedAsset._id !== a._id) &&
                          (a.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) || 
                           a.assetCode.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
                           (a.serialNumber && a.serialNumber.toLowerCase().includes(assetSearchQuery.toLowerCase())))
                        )
                        .map(a => (
                          <div key={a._id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderBottom: '1px solid var(--border-color)',
                            fontSize: '12.5px'
                          }}>
                            <div>
                              <strong style={{ color: 'var(--accent-color)' }}>{a.assetCode}</strong> - {a.name}
                              {a.serialNumber && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>(S/N: {a.serialNumber})</span>}
                            </div>
                            <button
                              type="button"
                              className="csp-btn csp-btn-secondary"
                              onClick={() => {
                                setSelectedAsset(a);
                                setAssetSearchQuery('');
                              }}
                              style={{ padding: '2px 8px', fontSize: '11.5px', height: 'auto' }}
                            >
                              Link
                            </button>
                          </div>
                        ))}
                      {availableAssets.filter(a => 
                        (!selectedAsset || selectedAsset._id !== a._id) &&
                        (a.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) || 
                         a.assetCode.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
                         (a.serialNumber && a.serialNumber.toLowerCase().includes(assetSearchQuery.toLowerCase())))
                      ).length === 0 && (
                        <div style={{ padding: '8px 12px', fontSize: '12.5px', color: 'var(--text-muted)' }}>No matching assets found</div>
                      )}
                    </div>
                  )}

                  {selectedAsset && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      marginTop: '8px'
                    }}>
                      <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                        Linked: {selectedAsset.assetCode} - {selectedAsset.name} {selectedAsset.serialNumber ? `(S/N: ${selectedAsset.serialNumber})` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedAsset(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '12px'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div className="csp-form-actions">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="csp-btn csp-btn-primary"
                  >
                    {isSubmitting ? 'Submitting Request...' : 'Submit Request'}
                  </button>
                  <button
                    type="button"
                    onClick={handleBackToServices}
                    className="csp-btn csp-btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : selectedCatalog ? (
            /* STEP 2: SELECT SERVICE IN CATALOG */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: selectedCatalog.color }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                  Services under "{selectedCatalog.name}"
                </h3>
              </div>

              {services.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  No services configured under this catalog category yet. Check back soon.
                </div>
              ) : (
                <div className="csp-services-list">
                  {services.map((service) => (
                    <div
                      key={service._id}
                      onClick={() => handleSelectService(service)}
                      className="csp-service-card"
                    >
                      <span className="csp-service-name">{service.name}</span>
                      <span className="csp-service-desc">
                        {service.description || 'Access dynamic request workflows.'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* STEP 1: SELECT CATALOG */
            <div>
              {catalogs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No Service Catalogs available. Contact administrator to define catalog categories.
                </div>
              ) : (
                <div className="csp-catalog-grid">
                  {catalogs.map((catalog) => (
                    <div
                      key={catalog._id}
                      onClick={() => fetchServicesInCatalog(catalog)}
                      className="csp-catalog-card"
                    >
                      <div className="csp-catalog-icon-wrapper" style={{ backgroundColor: catalog.color }}>
                        <Folder size={22} />
                      </div>
                      <span className="csp-catalog-name">{catalog.name}</span>
                      <span className="csp-catalog-desc">
                        {catalog.description || 'Explore service options catalog.'}
                      </span>
                      <div className="csp-catalog-footer">
                        <span>Browse Services</span>
                        <span>&rarr;</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* MY REQUESTS STATUS PORTAL */
        <div>
          {selectedRequest ? (
            /* DETAILED POPUP / SIDE BY SIDE FOR CITIZEN COMPLAINT DETAIL */
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px', alignItems: 'start' }}>
              <div className="csp-form-container" style={{ margin: 0, maxWidth: 'none' }}>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="csp-back-btn"
                >
                  <ArrowLeft size={16} /> Back to Request Queue
                </button>

                <div className="csp-request-header">
                  <div className="csp-req-title-row">
                    <span className="csp-tracking-id">{selectedRequest.trackingId}</span>
                    <span className="csp-service-name-label">{selectedRequest.service?.name}</span>
                  </div>
                  <span className={`csp-status-badge ${getStatusClass(selectedRequest.status)}`}>
                    {selectedRequest.status}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Request Form Values
                    </h4>
                    <div className="csp-fields-answers">
                      {Object.keys(selectedRequest.customFields || {}).length === 0 ? (
                        <div style={{ gridColumn: 'span 2', color: 'var(--text-muted)', fontSize: '13px' }}>
                          No specific custom fields submitted.
                        </div>
                      ) : (
                        Object.entries(selectedRequest.customFields).map(([label, val]) => (
                          <div key={label} className="csp-answer-item">
                            <span className="csp-answer-label">{label}</span>
                            <span className="csp-answer-value">{typeof val === 'boolean' ? (val ? 'Yes / Agreed' : 'No') : val.toString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {selectedRequest.asset && (
                    <div>
                      <h4 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Linked Asset
                      </h4>
                      <div className="csp-fields-answers" style={{ border: '1px solid rgba(99, 102, 241, 0.2)', padding: '12px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.05)', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '16px' }}>
                        <div className="csp-answer-item">
                          <span className="csp-answer-label">Asset Code</span>
                          <span className="csp-answer-value" style={{ fontWeight: 700, color: 'var(--accent-color)' }}>
                            {selectedRequest.asset.assetCode}
                          </span>
                        </div>
                        <div className="csp-answer-item">
                          <span className="csp-answer-label">Asset Name</span>
                          <span className="csp-answer-value">{selectedRequest.asset.name}</span>
                        </div>
                        {selectedRequest.asset.serialNumber && (
                          <div className="csp-answer-item">
                            <span className="csp-answer-label">Serial Number</span>
                            <span className="csp-answer-value" style={{ fontWeight: 600 }}>{selectedRequest.asset.serialNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <History size={13} /> Process Timeline History
                    </h4>
                    <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      {selectedRequest.history?.map((hist, hIdx) => (
                        <div key={hIdx} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12.5px', padding: '6px 0', borderBottom: hIdx < selectedRequest.history.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{hist.action}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(hist.createdAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* COMMENTS PANEL */}
              <div className="csp-form-container" style={{ margin: 0, maxWidth: 'none' }}>
                <h3 className="csp-form-title" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={16} /> Comments & Officer Discussion
                </h3>
                <p className="csp-card-subtitle" style={{ fontSize: '12.5px', marginBottom: '16px' }}>
                  Discuss this request with assigned staff.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px',
                    background: 'rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {selectedRequest.comments?.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        No comments posted yet.
                      </div>
                    ) : (
                      selectedRequest.comments?.map((comment) => (
                        <div
                          key={comment._id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            maxWidth: '85%',
                            alignSelf: comment.sender?.role === 'citizen' ? 'flex-end' : 'flex-start',
                            background: comment.sender?.role === 'citizen' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                            border: comment.sender?.role === 'citizen' ? '1px solid rgba(99, 102, 241, 0.15)' : '1px solid var(--border-color)'
                          }}
                        >
                          <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '2px' }}>
                            {comment.senderName} ({comment.sender?.role === 'admin' ? 'Officer' : 'You'})
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                            {comment.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Type a message to officer..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--border-radius-sm)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontSize: '13px'
                      }}
                      required
                    />
                    <button
                      type="submit"
                      disabled={isCommenting}
                      className="csp-btn csp-btn-primary"
                      style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            /* ACCORDION/LIST OF ALL REQUESTS */
            <div className="csp-request-list">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  Loading filed requests...
                </div>
              ) : requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  You have not submitted any service requests yet.
                </div>
              ) : (
                requests.map((req) => (
                  <div key={req._id} className="csp-request-card">
                    <div className="csp-request-header">
                      <div className="csp-req-title-row">
                        <span className="csp-tracking-id">{req.trackingId}</span>
                        <span className="csp-service-name-label">{req.service?.name}</span>
                      </div>
                      <span className={`csp-status-badge ${getStatusClass(req.status)}`}>
                        {req.status}
                      </span>
                    </div>

                    <div className="csp-request-details">
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                          Submitted Fields
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                          {Object.entries(req.customFields || {}).slice(0, 3).map(([label, val]) => (
                            <div key={label} style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                              <strong style={{ color: 'var(--text-muted)' }}>{label}:</strong>{' '}
                              <span style={{ color: 'var(--text-primary)' }}>{typeof val === 'boolean' ? (val ? 'Yes' : 'No') : val.toString()}</span>
                            </div>
                          ))}
                          {Object.keys(req.customFields || {}).length > 3 && (
                            <span style={{ fontSize: '11.5px', color: 'var(--accent-color)', alignSelf: 'center' }}>
                              +{Object.keys(req.customFields).length - 3} more fields
                            </span>
                          )}
                          {Object.keys(req.customFields || {}).length === 0 && (
                            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>No dynamic field answers.</span>
                          )}
                        </div>
                      </div>

                      <div className="csp-assignment-info">
                        <div>
                          <strong style={{ color: 'var(--text-muted)' }}>Assigned Department:</strong>{' '}
                          <span style={{ color: 'var(--text-primary)' }}>{req.assignedDepartment?.name || 'General Administration'}</span>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--text-muted)' }}>Assigned Group:</strong>{' '}
                          <span style={{ color: 'var(--text-primary)' }}>{req.assignedGroup?.name || 'Unassigned'}</span>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--text-muted)' }}>Fulfillment Staff:</strong>{' '}
                          <span style={{ color: 'var(--text-primary)' }}>{req.assignedTo?.name || 'Pending assignment'}</span>
                        </div>
                        
                        <button
                          onClick={() => fetchRequestDetails(req._id)}
                          className="csp-btn csp-btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '11px', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', width: 'fit-content' }}
                        >
                          <ClipboardList size={12} /> View Comments & History
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CitizenServicePortal;
