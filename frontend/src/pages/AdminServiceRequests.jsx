import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ClipboardList, User, Send, History, Building2, Users, MessageSquare } from 'lucide-react';
import '../styles/AdminServiceRequests.css';

const AdminServiceRequests = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [requests, setRequests] = useState([]);
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Lists for reassignments
  const [staffList, setStaffList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);

  // Form/Input States
  const [filterStatus, setFilterStatus] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (user?.token) {
      fetchRequests();
      fetchAssignmentOptions();
    }
  }, [user, filterStatus]);

  useEffect(() => {
    if (selectedReqId) {
      fetchRequestDetails(selectedReqId);
    } else {
      setSelectedRequest(null);
    }
  }, [selectedReqId]);

  const fetchRequests = async () => {
    try {
      setLoadingList(true);
      const url = filterStatus ? `/api/service-requests?status=${filterStatus}` : '/api/service-requests';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setRequests(json.data || []);
        if (json.data?.length > 0 && !selectedReqId) {
          setSelectedReqId(json.data[0]._id);
        }
      }
    } catch (err) {
      addToast('Error', 'Failed to retrieve service request queue', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchAssignmentOptions = async () => {
    try {
      const headers = { Authorization: `Bearer ${user.token}` };
      const [staffRes, groupRes] = await Promise.all([
        fetch('/api/auth/admins', { headers }).then(r => r.json()),
        fetch('/api/groups', { headers }).then(r => r.json())
      ]);
      if (staffRes.success) setStaffList(staffRes.data || []);
      if (groupRes.success) setGroupsList(groupRes.data || []);
    } catch (err) {
      console.error('Failed to load reassignment lists:', err);
    }
  };

  const fetchRequestDetails = async (id) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/service-requests/${id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const json = await res.json();
      if (json.success) {
        setSelectedRequest(json.data);
      }
    } catch (err) {
      addToast('Error', 'Failed to load request detail', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedRequest) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/service-requests/${selectedRequest._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ status })
      });
      const json = await res.json();
      if (json.success) {
        addToast('Status Updated', `Request status changed to ${status}`, 'success');
        fetchRequests();
        setSelectedRequest(json.data);
      } else {
        addToast('Error', json.message || 'Failed to update status', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReassignStaff = async (staffId) => {
    if (!selectedRequest) return;
    try {
      const res = await fetch(`/api/service-requests/${selectedRequest._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ assignedTo: staffId || null })
      });
      const json = await res.json();
      if (json.success) {
        addToast('Assigned Staff Updated', 'Fulfillment staff assigned successfully', 'success');
        fetchRequests();
        setSelectedRequest(json.data);
      } else {
        addToast('Error', json.message || 'Failed to reassign staff', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection error', 'error');
    }
  };

  const handleReassignGroup = async (groupId) => {
    if (!selectedRequest) return;
    try {
      const res = await fetch(`/api/service-requests/${selectedRequest._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ assignedGroup: groupId || null })
      });
      const json = await res.json();
      if (json.success) {
        addToast('Assigned Group Updated', 'Fulfillment group assigned successfully', 'success');
        fetchRequests();
        setSelectedRequest(json.data);
      } else {
        addToast('Error', json.message || 'Failed to reassign group', 'error');
      }
    } catch (err) {
      addToast('Error', 'Server connection error', 'error');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedRequest) return;

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
        addToast('Error', json.message || 'Failed to save comment', 'error');
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
    <div className="asr-container">
      {/* LEFT SIDEBAR: REQUESTS QUEUE */}
      <div className="asr-sidebar-list">
        <div className="asr-list-header">
          <div className="asr-list-title">Service Requests Queue</div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="asr-filter-select"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {loadingList ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading queue...
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No requests in queue.
          </div>
        ) : (
          <div className="asr-requests-scroll">
            {requests.map((req) => (
              <div
                key={req._id}
                onClick={() => setSelectedReqId(req._id)}
                className={`asr-queue-card ${selectedReqId === req._id ? 'active' : ''}`}
              >
                <div className="asr-queue-header">
                  <span className="asr-queue-tracking">{req.trackingId}</span>
                  <span className={`csp-status-badge ${getStatusClass(req.status)}`} style={{ padding: '2px 6px', fontSize: '9.5px' }}>
                    {req.status}
                  </span>
                </div>
                <div className="asr-queue-name">{req.service?.name}</div>
                <div className="asr-queue-meta">
                  <span>By: {req.citizen?.name || 'Citizen'}</span>
                  <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT PANE: DETAIL VIEW */}
      <div className="asr-detail-pane">
        {loadingDetail ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            Loading request details...
          </div>
        ) : !selectedRequest ? (
          <div className="asr-detail-empty">
            <ClipboardList size={40} className="text-muted" style={{ opacity: 0.3 }} />
            <span>Select a service request from the queue to manage.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div className="asr-detail-header">
              <div className="asr-detail-title-wrapper">
                <div className="asr-detail-title">
                  <span className="csp-tracking-id" style={{ fontSize: '15px' }}>{selectedRequest.trackingId}</span>
                  <span>{selectedRequest.service?.name}</span>
                </div>
                <span className="asr-detail-citizen">
                  Citizen Requester: <strong>{selectedRequest.citizen?.name}</strong> ({selectedRequest.citizen?.email})
                </span>
              </div>

              {/* Status Controls */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedRequest.service?.workflow ? (
                  <>
                    {selectedRequest.service.workflow.transitions
                      ?.filter(t => t.fromState === selectedRequest.status && (t.allowedRole === 'admin' || t.allowedRole === 'any'))
                      .map((trans, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleUpdateStatus(trans.toState)}
                          disabled={isUpdatingStatus}
                          className="scm-btn scm-btn-primary"
                          style={{ padding: '8px 14px', fontSize: '12px' }}
                        >
                          {trans.label}
                        </button>
                      ))
                    }
                    {selectedRequest.service.workflow.transitions?.filter(t => t.fromState === selectedRequest.status && (t.allowedRole === 'admin' || t.allowedRole === 'any')).length === 0 && (
                      <span className={`csp-status-badge ${getStatusClass(selectedRequest.status)}`} style={{ padding: '8px 16px', fontSize: '12px' }}>
                        {selectedRequest.status} (Terminal State)
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {selectedRequest.status !== 'Resolved' && selectedRequest.status !== 'Rejected' && (
                      <>
                        {selectedRequest.status === 'Pending' && (
                          <button
                            onClick={() => handleUpdateStatus('In Progress')}
                            disabled={isUpdatingStatus}
                            className="scm-btn scm-btn-primary"
                            style={{ padding: '8px 14px', fontSize: '12px' }}
                          >
                            Start Processing
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateStatus('Resolved')}
                          disabled={isUpdatingStatus}
                          className="scm-btn"
                          style={{ padding: '8px 14px', fontSize: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'rgb(16, 185, 129)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                        >
                          Resolve Request
                        </button>
                        <button
                          onClick={() => handleUpdateStatus('Rejected')}
                          disabled={isUpdatingStatus}
                          className="scm-btn"
                          style={{ padding: '8px 14px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        >
                          Reject Request
                        </button>
                      </>
                    )}
                    {(selectedRequest.status === 'Resolved' || selectedRequest.status === 'Rejected') && (
                      <span className={`csp-status-badge ${getStatusClass(selectedRequest.status)}`} style={{ padding: '8px 16px', fontSize: '12px' }}>
                        Request {selectedRequest.status}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Scrollable details */}
            <div className="asr-detail-scroll">
              <div className="asr-info-section">
                {/* Form answers */}
                <div className="asr-section-card">
                  <div className="asr-section-title">Submitted Custom Form</div>
                  <div className="asr-fields-grid">
                    {Object.keys(selectedRequest.customFields || {}).length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        No specific custom details were required for this service.
                      </div>
                    ) : (
                      Object.entries(selectedRequest.customFields).map(([label, val]) => (
                        <div key={label} className="asr-field-block">
                          <span className="asr-field-label">{label}</span>
                          <span className="asr-field-val">
                            {typeof val === 'boolean' ? (val ? 'Yes / Confirmed' : 'No') : val.toString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Linked Asset */}
                {selectedRequest.asset && (
                  <div className="asr-section-card">
                    <div className="asr-section-title">Linked Asset</div>
                    <div className="asr-fields-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <div className="asr-field-block">
                        <span className="asr-field-label">Asset Code</span>
                        <span className="asr-field-val" style={{ fontWeight: 700, color: 'var(--accent-color)' }}>
                          {selectedRequest.asset.assetCode}
                        </span>
                      </div>
                      <div className="asr-field-block">
                        <span className="asr-field-label">Asset Name</span>
                        <span className="asr-field-val">
                          {selectedRequest.asset.name}
                        </span>
                      </div>
                      {selectedRequest.asset.serialNumber && (
                        <div className="asr-field-block" style={{ gridColumn: 'span 2' }}>
                          <span className="asr-field-label">Serial Number</span>
                          <span className="asr-field-val" style={{ fontWeight: 600 }}>
                            {selectedRequest.asset.serialNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="asr-section-card">
                  <div className="asr-section-title">Workflow Lifecycle History</div>
                  <div className="asr-timeline">
                    {selectedRequest.history?.map((hist, idx) => (
                      <div key={idx} className="asr-timeline-item">
                        <div className="asr-timeline-dot" />
                        <div className="asr-timeline-content">
                          <span className="asr-timeline-action">{hist.action}</span>
                          <span className="asr-timeline-meta">
                            By {hist.actor} | {new Date(hist.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="asr-info-section">
                {/* Reassignment Panel */}
                <div className="asr-section-card">
                  <div className="asr-section-title">Ownership & Routing Assignments</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span className="asr-field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={13} /> Target Department
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {selectedRequest.assignedDepartment?.name || 'General Administration'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label className="asr-field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={13} /> Support Team / Group
                      </label>
                      <select
                        value={selectedRequest.assignedGroup?._id || selectedRequest.assignedGroup || ''}
                        onChange={(e) => handleReassignGroup(e.target.value)}
                        className="asr-filter-select"
                        style={{ padding: '10px 12px' }}
                      >
                        <option value="">-- Unassigned (No group) --</option>
                        {groupsList.map((grp) => (
                          <option key={grp._id} value={grp._id}>
                            {grp.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label className="asr-field-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={13} /> Assigned Officer (Staff)
                      </label>
                      <select
                        value={selectedRequest.assignedTo?._id || selectedRequest.assignedTo || ''}
                        onChange={(e) => handleReassignStaff(e.target.value)}
                        className="asr-filter-select"
                        style={{ padding: '10px 12px' }}
                      >
                        <option value="">-- Unassigned (General Pool) --</option>
                        {staffList.map((st) => (
                          <option key={st._id} value={st._id}>
                            {st.name} ({st.department || 'General Administration'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Discussion */}
                <div className="asr-section-card">
                  <div className="asr-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={13} /> Citizen Discussion Chat
                  </div>
                  <div className="asr-chat-box">
                    <div className="asr-chat-messages">
                      {selectedRequest.comments?.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          No messages yet. Send a response below to initiate conversation.
                        </div>
                      ) : (
                        selectedRequest.comments?.map((comment) => (
                          <div
                            key={comment._id}
                            className={`asr-msg ${comment.sender?.role === 'admin' ? 'officer-msg' : 'citizen-msg'}`}
                          >
                            <span className="asr-msg-sender">
                              {comment.senderName} ({comment.sender?.role === 'admin' ? 'You' : 'Citizen'})
                            </span>
                            <span className="asr-msg-text">{comment.message}</span>
                            <span className="asr-msg-time">{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleAddComment} className="asr-chat-input-row">
                      <input
                        type="text"
                        placeholder="Send response to citizen..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="asr-chat-input"
                      />
                      <button
                        type="submit"
                        disabled={isCommenting}
                        className="scm-btn scm-btn-primary"
                        style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Send size={14} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminServiceRequests;
