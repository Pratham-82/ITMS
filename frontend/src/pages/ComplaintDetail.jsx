import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  Briefcase, 
  Paperclip, 
  Send, 
  Activity, 
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Smile,
  Star,
  Scale,
  Save,
  Heart,
  ThumbsUp
} from 'lucide-react';
import '../styles/ComplaintDetail.css';
import DuplicateMergeModal from '../components/DuplicateMergeModal';
import AssetEditModal from '../components/AssetEditModal';

const ComplaintDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { settings } = useSettings();
  const [initialMergeIds, setInitialMergeIds] = useState([]);

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);

  const isSuperAdmin = user?.role === 'admin' && (!user.department || user.department === 'General Administration');
  const isAssignedToMe = complaint?.assignedTo?._id === user?._id || complaint?.assignedTo === user?._id;
  const isReadOnly = user?.role === 'admin' && !isSuperAdmin && !isAssignedToMe;
  
  // Admin Action States
  const [status, setStatus] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [departmentStaff, setDepartmentStaff] = useState([]);
  const [targetStaff, setTargetStaff] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferringOwner, setTransferringOwner] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showAssetEditModal, setShowAssetEditModal] = useState(false);
  const [selectedAssetToEdit, setSelectedAssetToEdit] = useState(null);
  const [holdDuration, setHoldDuration] = useState('4');
  const [holdUntilCustom, setHoldUntilCustom] = useState('');

  const fetchStaff = async (deptName) => {
    try {
      const response = await fetch(`/api/workload/staff?department=${encodeURIComponent(deptName)}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setDepartmentStaff(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch department staff:', err);
    }
  };
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);

  // Discussion State
  const [message, setMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Escalation State
  const [escalationReason, setEscalationReason] = useState('');
  const [isEscalating, setIsEscalating] = useState(false);

  // Auto/Manual Escalation States
  const [rule, setRule] = useState(null);
  const [hasMoreLevels, setHasMoreLevels] = useState(false);
  const [showManualEscalateForm, setShowManualEscalateForm] = useState(false);
  const [manualEscalateReason, setManualEscalateReason] = useState('');
  const [isManualEscalating, setIsManualEscalating] = useState(false);
  const [allAdmins, setAllAdmins] = useState([]);
  const [escalateTargetStaff, setEscalateTargetStaff] = useState('');

  const fetchAllAdmins = async () => {
    try {
      const response = await fetch('/api/workload/staff?all=true', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setAllAdmins(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch all admins:', err);
    }
  };

  // CSAT Feedback Form States
  const feedbackConfig = useMemo(() => {
    const defaultQuestions = [
      { id: 'overallRating', label: 'Overall Satisfaction', type: 'rating', required: true, order: 1, isActive: true },
      { id: 'responseTimeRating', label: 'Response Time Satisfaction', type: 'rating', required: true, order: 2, isActive: true },
      { id: 'communicationRating', label: 'Staff Communication', type: 'rating', required: true, order: 3, isActive: true },
      { id: 'resolutionQualityRating', label: 'Resolution Quality', type: 'rating', required: true, order: 4, isActive: true },
      { id: 'resolvedCompletely', label: 'Was the issue fully resolved?', type: 'boolean', required: true, order: 5, isActive: true },
      { id: 'recommendation', label: 'Would you recommend this service to others?', type: 'boolean', required: true, order: 6, isActive: true },
      { id: 'comment', label: 'Additional Comments or Feedback', type: 'text', required: false, order: 7, isActive: true }
    ];

    return {
      welcomeMessage: settings?.feedbackWelcomeMessage || 'Please take a moment to rate your satisfaction with how we resolved your complaint. Your feedback helps us improve our public services.',
      successMessage: settings?.feedbackSuccessMessage || 'Thank you for your feedback! It helps us improve our services.',
      ratingIcon: settings?.feedbackRatingIcon || 'star',
      questions: settings?.feedbackQuestions && settings.feedbackQuestions.length > 0
        ? settings.feedbackQuestions.filter(q => q.isActive)
        : defaultQuestions
    };
  }, [settings]);

  const [feedbackResponses, setFeedbackResponses] = useState({});
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (feedbackConfig.questions) {
      const initial = {};
      feedbackConfig.questions.forEach(q => {
        if (q.type === 'rating') {
          initial[q.id] = 5;
        } else if (q.type === 'boolean') {
          initial[q.id] = q.id === 'resolvedCompletely' ? 'Yes' : true;
        } else if (q.type === 'choice') {
          initial[q.id] = q.choices && q.choices.length > 0 ? q.choices[0] : '';
        } else {
          initial[q.id] = '';
        }
      });
      setFeedbackResponses(initial);
    }
  }, [feedbackConfig.questions]);

  const RatingIconComponent = ({ size, fill, stroke }) => {
    const icon = feedbackConfig.ratingIcon;
    if (icon === 'heart') return <Heart size={size} fill={fill} stroke={stroke} />;
    if (icon === 'smile') return <Smile size={size} fill={fill} stroke={stroke} />;
    if (icon === 'thumb') return <ThumbsUp size={size} fill={fill} stroke={stroke} />;
    return <Star size={size} fill={fill} stroke={stroke} />;
  };

  // Escalation Route States
  const [escalationType, setEscalationType] = useState('department');
  const [escalationGroupId, setEscalationGroupId] = useState('');
  const [escalationGroups, setEscalationGroups] = useState([]);

  // Filter out the currently assigned group so escalation always moves forward
  const availableGroups = useMemo(() => {
    const currentGroupId = complaint?.assignedGroup?._id || complaint?.assignedGroup;
    return escalationGroups.filter(g => {
      if (!g.isActive) return false;
      if (currentGroupId && (g._id === currentGroupId || g._id === currentGroupId?.toString())) return false;
      return true;
    });
  }, [escalationGroups, complaint]);

  useEffect(() => {
    if (status === 'Escalated' && availableGroups.length > 0) {
      const isCurrentValid = availableGroups.some(g => g._id === escalationGroupId);
      if (!isCurrentValid) {
        setEscalationGroupId(availableGroups[0]._id);
      }
    }
  }, [status, availableGroups, escalationGroupId]);

  // Reopen States
  const [reopenReason, setReopenReason] = useState('');
  const [isReopening, setIsReopening] = useState(false);
  const [showReopenForm, setShowReopenForm] = useState(false);

  const messagesEndRef = useRef(null);

  const fetchComplaintDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tickets/${id}`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setComplaint(result.data);
        setStatus(result.data.status);
        setAssignedTo(result.data.assignedDepartment || '');
        setTargetStaff(result.data.assignedTo?._id || result.data.assignedTo || '');
        if (user.role === 'admin' && result.data.assignedDepartment) {
          fetchStaff(result.data.assignedDepartment);
        }
        // Fetch active category workflow
        fetchCategoryWorkflow(result.data.category);
      } else {
        addToast('Error', result.message || 'Failed to retrieve complaint', 'error');
        navigate('/');
      }
    } catch (error) {
      console.error(error);
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryWorkflow = async (categoryId) => {
    if (!categoryId) return;
    try {
      const response = await fetch(`/api/workflows/category/${categoryId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success && !result.data.isDefaultFallback) {
        setActiveWorkflow(result.data);
      } else {
        setActiveWorkflow(null);
      }
    } catch (err) {
      console.error('Error fetching category workflow:', err);
    }
  };

  const handleExecuteTransition = async (targetStatus) => {
    setIsAdminSubmitting(true);
    try {
      const response = await fetch(`/api/tickets/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Workflow Action', `Transitioned status to "${targetStatus}"`, 'success');
        fetchComplaintDetails();
      } else {
        addToast('Transition Failed', result.message || 'Failed to update ticket status', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setDepartments(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  const fetchEscalationGroups = async () => {
    try {
      const response = await fetch('/api/groups', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setEscalationGroups(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch escalation groups:', err);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchDepartments();
      fetchEscalationGroups();
      if (user.role === 'admin') {
        fetchAllAdmins();
      }
    }
  }, [user]);

  useEffect(() => {
    if (user?.token && id) {
      fetchComplaintDetails();
    }
  }, [user, id]);

  useEffect(() => {
    if (location.search && complaint) {
      const params = new URLSearchParams(location.search);
      if (params.get('triggerMerge') === 'true') {
        const ids = params.get('mergeIds');
        if (ids) {
          setInitialMergeIds(ids.split(','));
          setShowMergeModal(true);
        }
      }
    }
  }, [location.search, complaint]);

  useEffect(() => {
    if (user?.token && complaint?.category) {
      const fetchActiveRule = async () => {
        try {
          const response = await fetch('/api/escalations', {
            headers: { Authorization: `Bearer ${user.token}` }
          });
          const result = await response.json();
          if (result.success) {
            const activeRule = result.data.find(r => {
              const ruleDeptId = r.departmentId?._id || r.departmentId;
              const ruleCatId = r.categoryId?._id || r.categoryId;
              const compDeptId = complaint.department?._id || complaint.department;
              const compCatId = complaint.category?._id || complaint.category;
              return ruleDeptId === compDeptId && ruleCatId === compCatId && r.isActive;
            });
            setRule(activeRule);
            if (activeRule && activeRule.levels) {
              const currentLvl = complaint.currentEscalationLevel || 0;
              const nextLvl = currentLvl + 1;
              const exists = activeRule.levels.some(l => l.level === nextLvl);
              setHasMoreLevels(exists);
            }
          }
        } catch (err) {
          console.error('Error loading escalation rule:', err);
        }
      };
      
      fetchActiveRule();
    }
  }, [user, complaint]);

  const handleManualEscalate = async () => {
    if (!escalateTargetStaff) {
      addToast('Validation', 'Please select an administrator to assign this escalation to.', 'error');
      return;
    }
    setIsManualEscalating(true);
    try {
      const response = await fetch(`/api/tickets/${id}/escalate-manual`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ 
          reason: manualEscalateReason.trim(),
          assigneeId: escalateTargetStaff
        })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Ticket Escalated', result.message || 'Complaint successfully escalated', 'success');
        setShowManualEscalateForm(false);
        setManualEscalateReason('');
        setEscalateTargetStaff('');
        fetchComplaintDetails();
      } else {
        addToast('Escalation Failed', result.message || 'Could not escalate ticket', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsManualEscalating(false);
    }
  };

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [complaint?.comments]);

  const renderHoldSection = () => {
    return (
      <div className="form-group animate-slide-down" style={{ marginTop: '12px' }}>
        <label className="form-label" style={{ fontWeight: 600 }}>Hold Duration</label>
        <select 
          className="form-control"
          value={holdDuration}
          onChange={(e) => setHoldDuration(e.target.value)}
        >
          <option value="1">1 Hour</option>
          <option value="2">2 Hours</option>
          <option value="4">4 Hours</option>
          <option value="8">8 Hours</option>
          <option value="24">24 Hours</option>
          <option value="48">48 Hours</option>
          <option value="72">72 Hours</option>
          <option value="custom">Custom Date & Time</option>
        </select>
        {holdDuration === 'custom' && (
          <div style={{ marginTop: '10px' }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Resume At (Date & Time)</label>
            <input 
              type="datetime-local" 
              className="form-control"
              value={holdUntilCustom}
              onChange={(e) => setHoldUntilCustom(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
        )}
      </div>
    );
  };

  const renderEscalationSection = () => {
    return (
      <>
        <div className="form-group animate-slide-down">
          <label className="form-label" style={{ fontWeight: 600 }}>Escalation Route Type</label>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
              <input 
                type="radio" 
                name="escalationType" 
                value="department" 
                checked={escalationType === 'department'} 
                onChange={() => setEscalationType('department')} 
              />
              <span>Department / Team</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
              <input 
                type="radio" 
                name="escalationType" 
                value="group" 
                checked={escalationType === 'group'} 
                onChange={() => setEscalationType('group')} 
              />
              <span>Escalation Group</span>
            </label>
          </div>
        </div>

        {escalationType === 'department' ? (
          <div className="form-group animate-slide-down">
            <label className="form-label">Assigned Department / Team</label>
            <select 
              className="form-control"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="General Administration">General Administration (Super Admin)</option>
              {departments.filter(d => d.isActive && d.name !== 'General Administration').map((d) => (
                <option key={d._id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-group animate-slide-down">
            <label className="form-label">Assigned Escalation Group</label>
            {complaint?.assignedGroup && (
              <div style={{ fontSize: '11px', color: 'var(--accent-color)', marginBottom: '8px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Currently at:</span>
                <strong>{complaint.assignedGroup.name || 'Unknown Group'}</strong>
              </div>
            )}
            <select 
              className="form-control"
              value={escalationGroupId}
              onChange={(e) => setEscalationGroupId(e.target.value)}
            >
              {availableGroups.map((g) => (
                <option key={g._id} value={g._id}>{g.name} ({g.members?.length || 0} members)</option>
              ))}
              {availableGroups.length === 0 && (
                <option value="">No Further Escalation Groups Available</option>
              )}
            </select>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4, margin: '6px 0 0 0' }}>
              💡 The ticket will be auto-assigned to the officer in this group with the lowest workload of open tickets.
            </p>
          </div>
        )}
      </>
    );
  };

  const handleAdminActionSubmit = async (e) => {
    e.preventDefault();
    setIsAdminSubmitting(true);
    try {
      const response = await fetch(`/api/tickets/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ 
          status, 
          assignedTo,
          escalationType,
          escalationGroupId,
          holdDuration: status === 'On Hold' ? holdDuration : undefined,
          holdUntilCustom: status === 'On Hold' && holdDuration === 'custom' ? holdUntilCustom : undefined
        })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Ticket Updated', 'Status and assignments saved successfully', 'success');
        // Reload details to show updated history
        fetchComplaintDetails();
      } else {
        addToast('Update Failed', result.message || 'Failed to update ticket', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingFeedback(true);
    try {
      const responsesList = feedbackConfig.questions.map(q => ({
        questionId: q.id,
        label: q.label,
        type: q.type,
        value: feedbackResponses[q.id]
      }));

      const bodyData = {
        overallRating: feedbackResponses.overallRating,
        responseTimeRating: feedbackResponses.responseTimeRating,
        communicationRating: feedbackResponses.communicationRating,
        resolutionQualityRating: feedbackResponses.resolutionQualityRating,
        resolvedCompletely: feedbackResponses.resolvedCompletely,
        recommendation: feedbackResponses.recommendation,
        comment: feedbackResponses.comment || '',
        responses: responsesList
      };

      const response = await fetch(`/api/tickets/${id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(bodyData)
      });
      const result = await response.json();
      if (result.success) {
        addToast('Feedback Submitted', feedbackConfig.successMessage, 'success');
        fetchComplaintDetails();
      } else {
        addToast('Submission Failed', result.message || 'Could not submit feedback', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;
    setIsReopening(true);
    try {
      const response = await fetch(`/api/tickets/${id}/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ reason: reopenReason.trim() })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Reopen Requested', 'Reopen request has been submitted for admin approval', 'success');
        setReopenReason('');
        setShowReopenForm(false);
        fetchComplaintDetails();
      } else {
        addToast('Reopen Failed', result.message || 'Could not reopen complaint', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsReopening(false);
    }
  };

  const [reopenReviewComment, setReopenReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const submitReopenReview = async (action) => {
    setIsSubmittingReview(true);
    try {
      const response = await fetch(`/api/tickets/${id}/reopen/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ action, comment: reopenReviewComment.trim() })
      });
      const result = await response.json();
      if (result.success) {
        addToast(
          action === 'approve' ? 'Reopen Approved' : 'Reopen Rejected',
          action === 'approve' ? 'Complaint has been reopened and set back to Investigating' : 'Reopen request has been rejected',
          'success'
        );
        setReopenReviewComment('');
        fetchComplaintDetails();
      } else {
        addToast('Review Failed', result.message || 'Could not process review', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleEscalateSubmit = async (e) => {
    e.preventDefault();
    if (!escalationReason.trim()) return;

    setIsEscalating(true);
    try {
      const response = await fetch(`/api/tickets/${id}/escalate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ reason: escalationReason.trim() })
      });
      const result = await response.json();
      if (result.success) {
        addToast('Ticket Escalated', 'Complaint has been escalated to General Administration', 'success');
        setEscalationReason('');
        fetchComplaintDetails();
      } else {
        addToast('Escalation Failed', result.message || 'Could not escalate complaint', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with server', 'error');
    } finally {
      setIsEscalating(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSendingMessage(true);
    try {
      const response = await fetch(`/api/tickets/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ message })
      });
      const result = await response.json();
      if (result.success) {
        setMessage('');
        // Update comments in state directly
        setComplaint((prev) => ({
          ...prev,
          comments: result.data,
          // Append new message log to history dynamically
          history: [
            ...prev.history,
            {
              action: `New response added by ${user.role === 'admin' ? 'Officer' : 'Citizen'} (${user.name})`,
              actor: user.name,
              createdAt: new Date()
            }
          ]
        }));
      } else {
        addToast('Message Failed', result.message || 'Could not post response', 'error');
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to send message', 'error');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getPriorityBadge = (priority) => {
    if (!priority) return null;
    return <span className={`badge badge-priority-${priority.toLowerCase()}`}>{priority} Priority</span>;
  };

  const getStatusBadge = (status) => {
    if (!status) return null;
    const statusClass = status.toLowerCase().replace(/\s+/g, '-');
    return <span className={`badge badge-status-${statusClass}`}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="cd-loading-container">
        <div className="spinner cd-spinner" />
      </div>
    );
  }

  if (!complaint) {
    return <div className="cd-not-found">Complaint not found.</div>;
  }

  return (
    <div className="cd-container">
      {/* Back Button */}
      <div className="cd-back-container">
        <button onClick={() => navigate('/')} className="btn btn-secondary cd-back-btn">
          <ArrowLeft size={16} />
          <span>Back to Queue</span>
        </button>
      </div>

      <div className="detail-grid">
        {/* Main Details and Discussion */}
        <div className="cd-main-col">
          
          {/* Main Details Card */}
          <div className="detail-main">
            <div className="detail-header">
              <div className="cd-header-top">
                <span className="detail-id">{complaint.trackingId}</span>
                <div className="cd-header-badges">
                  <span className="badge" style={{ 
                    backgroundColor: complaint.ticketType?.color || '#f59e0b', 
                    color: 'white', 
                    fontSize: '11px', 
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '4px'
                  }}>
                    {complaint.ticketType?.name || 'Complaint'}
                  </span>
                  {getPriorityBadge(complaint.priority)}
                  {getStatusBadge(complaint.status)}
                </div>
              </div>
              <h2 className="cd-title">{complaint.title}</h2>
              
              <div className="detail-meta-row">
                <div className="cd-meta-row">
                  <User size={14} />
                  <span>Filed by: <strong>{complaint.citizen?.name || 'Citizen'}</strong></span>
                </div>
                <span className="cd-meta-dot">•</span>
                <div className="cd-meta-row">
                  <Clock size={14} />
                  <span>Filed on: {new Date(complaint.createdAt).toLocaleDateString()}</span>
                </div>
                <span className="cd-meta-dot">•</span>
                <div className="cd-meta-row">
                  <Briefcase size={14} />
                  <span>Dept: {complaint.assignedDepartment || complaint.categoryName}</span>
                </div>
                <span className="cd-meta-dot">•</span>
                <div className="cd-meta-row">
                  <User size={14} />
                  <span>Owner: <strong>{complaint.assignedTo?.name || 'Unassigned'}</strong></span>
                </div>
              </div>
            </div>

            {complaint.status === 'On Hold' ? (
              <div className="cd-escalation-rule-banner" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div className="cd-escalation-header">
                  <div className="cd-escalation-status-active" style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={16} />
                    <span>SLA Timer Paused (On Hold)</span>
                  </div>
                  {complaint.holdUntil && (
                    <div className="cd-escalation-deadline" style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} />
                      <span>Resumes At: {new Date(complaint.holdUntil).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : complaint.nextEscalationDueAt && complaint.status !== 'Resolved' && complaint.status !== 'Rejected' ? (
              <div className="cd-escalation-rule-banner">
                <div 
                  className="cd-escalation-header"
                  style={{ marginBottom: complaint.currentEscalationLevel > 0 ? '14px' : '0px' }}
                >
                  <div className="cd-escalation-status-active">
                    <ShieldAlert size={16} />
                    <span>Escalation Rule Engine Active {complaint.currentEscalationLevel > 0 ? `(Level ${complaint.currentEscalationLevel})` : '(Monitoring SLA)'}</span>
                  </div>
                  <div className="cd-escalation-deadline">
                    <Clock size={14} />
                    <span>Next SLA Deadline: {new Date(complaint.nextEscalationDueAt).toLocaleString()}</span>
                  </div>
                </div>

                {complaint.currentEscalationLevel === 0 && rule && rule.levels && rule.levels.find(l => l.level === 1) && (
                  <p className="cd-escalation-rule-description">
                    If unresolved by the deadline, this ticket will automatically escalate to <strong>Level 1 ({rule.levels.find(l => l.level === 1)?.department})</strong>.
                  </p>
                )}

                {complaint.currentEscalationLevel > 0 && (
                  <div className="cd-escalation-log-container">
                    <div className="cd-escalation-log-title">
                      Escalation Sequence Log
                    </div>
                    
                    <div className="cd-escalation-log-path">
                      {complaint.escalationPath && complaint.escalationPath.map((pathItem, idx) => (
                        <div key={idx} className="cd-escalation-path-item">
                          <div className="cd-escalation-path-dot" />
                          
                          <div className="cd-escalation-path-header">
                            <span className="cd-escalation-path-level">
                              Level {pathItem.level}: {pathItem.department}
                            </span>
                            <span className="cd-escalation-path-time">
                              {new Date(pathItem.escalatedAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="cd-escalation-path-reason">
                            Reason: "{pathItem.reason || 'SLA breach escalation'}"
                          </div>
                          <div className="cd-escalation-path-actor">
                            Triggered by: {pathItem.escalatedBy}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : complaint.isEscalated ? (
              <div className="cd-escalated-banner">
                <div className="cd-escalated-title">
                  <ShieldAlert size={16} />
                  <span>Escalated Complaint</span>
                </div>
                {complaint.escalationReason && (
                  <div>
                    <strong>Escalation Reason:</strong> {complaint.escalationReason}
                  </div>
                )}
                {complaint.escalatedAt && (
                  <div className="cd-escalated-time">
                    Escalated on: {new Date(complaint.escalatedAt).toLocaleString()}
                  </div>
                )}
              </div>
            ) : complaint.reopenRequest && complaint.reopenRequest.status === 'rejected' ? (
              <div className="cd-escalated-banner" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div className="cd-escalated-title" style={{ color: '#ef4444' }}>
                  <ShieldAlert size={16} />
                  <span>Reopen Request Rejected</span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <strong>Citizen Reason:</strong> "{complaint.reopenRequest.reason}"
                </div>
                {complaint.reopenRequest.reviewComment && (
                  <div style={{ marginTop: '4px' }}>
                    <strong>Admin Note:</strong> "{complaint.reopenRequest.reviewComment}"
                  </div>
                )}
                <div className="cd-escalated-time">
                  Reviewed on: {new Date(complaint.reopenRequest.reviewedAt).toLocaleString()}
                </div>
              </div>
            ) : null}

            <div className="detail-body">
              {complaint.description}
            </div>

            {/* Dynamic Custom Fields Responses */}
            {complaint.customFields && Object.keys(complaint.customFields).length > 0 && (
              <div className="cd-custom-fields-container">
                <div className="cd-custom-fields-title">
                  Dynamic Form Field Responses
                </div>
                {Object.entries(complaint.customFields).map(([key, val]) => (
                  <div key={key}>
                    <span className="cd-custom-field-label">{key}</span>
                    <strong className="cd-custom-field-value">{val !== null && val !== undefined ? val.toString() : 'N/A'}</strong>
                  </div>
                ))}
              </div>
            )}

            {/* Related Assets Card Section */}
            {complaint.relatedAssets && complaint.relatedAssets.length > 0 && (
              <div style={{
                marginTop: '24px',
                padding: '24px',
                borderRadius: 'var(--border-radius-md)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent" style={{ flexShrink: 0 }}>
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                  <span>Linked Affected Asset(s) ({complaint.relatedAssets.length})</span>
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  {complaint.relatedAssets.map((asset) => {
                    const statusColor = asset.status?.toLowerCase().includes('active') ? '#10b981' : asset.status?.toLowerCase().includes('repair') ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={asset._id} style={{
                        padding: '16px',
                        borderRadius: 'var(--border-radius-sm)',
                        background: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid var(--border-color)',
                        fontSize: '13px'
                      }}>
                        {/* Header details */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', alignItems: 'center' }}>
                          <div>
                            <strong style={{ color: 'var(--accent-color)', fontSize: '14px' }}>{asset.assetCode}</strong>
                            <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
                            <span style={{ fontWeight: 700 }}>{asset.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {user?.role === 'admin' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAssetToEdit(asset);
                                  setShowAssetEditModal(true);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-color)',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                                }}
                              >
                                Edit Asset
                              </button>
                            )}
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: `${statusColor}15`,
                              color: statusColor,
                              border: `1px solid ${statusColor}30`
                            }}>
                              {asset.status}
                            </span>
                          </div>
                        </div>

                        {/* Inventory specs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Category & Type Schema</span>
                            <strong>{asset.categoryId?.name || 'Category'} &raquo; {asset.assetTypeId?.name || 'Type'}</strong>
                          </div>
                          {asset.location && (
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Location / Office</span>
                              <strong>{asset.location}</strong>
                            </div>
                          )}
                          {asset.serialNumber && (
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Serial Number</span>
                              <strong>{asset.serialNumber}</strong>
                            </div>
                          )}
                          {asset.ownerUserId && (
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Owner</span>
                              <strong>{asset.ownerUserId.name}</strong>
                            </div>
                          )}
                        </div>

                        {/* Dynamic values rendering */}
                        {asset.assetTypeId?.dynamicFields && asset.assetTypeId.dynamicFields.length > 0 && asset.dynamicValues && Object.keys(asset.dynamicValues).length > 0 && (
                          <div style={{
                            marginTop: '10px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '12px'
                          }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, display: 'block', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Dynamic Specifications
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                              {asset.assetTypeId.dynamicFields.map((field) => {
                                const val = asset.dynamicValues[field.fieldKey];
                                if (val === undefined || val === null || val === '') return null;
                                return (
                                  <div key={field.fieldKey} style={{ fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>{field.label}:</span>
                                    <strong>{val.toString()}</strong>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attachments Section */}
            {complaint.attachments && complaint.attachments.length > 0 && (
              <div className="attachments-section">
                <h3 className="cd-attachments-header">
                  <Paperclip size={16} />
                  <span>Supporting Attachments ({complaint.attachments.length})</span>
                </h3>
                <div className="attachment-list">
                  {complaint.attachments.map((url, idx) => {
                    const filename = url.split('/').pop();
                    const isImg = /\.(jpg|jpeg|png)$/i.test(filename);
                    return (
                      <a 
                        key={idx} 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="attachment-card"
                      >
                        {isImg ? (
                          <img 
                            src={url} 
                            alt={filename} 
                            className="cd-attachment-thumb-img"
                          />
                        ) : (
                          <div className="cd-attachment-thumb-icon">
                            <Paperclip size={18} />
                          </div>
                        )}
                        <div className="attachment-details">
                          <div className="attachment-name" title={filename}>{filename}</div>
                          <span className="cd-attachment-view-meta">Click to view</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Merged Duplicate Complaints Card */}
          {complaint.mergedComplaints && complaint.mergedComplaints.length > 0 && (
            <div style={{
              marginTop: '24px',
              padding: '24px',
              borderRadius: 'var(--border-radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                  <path d="M12 18V6"/>
                  <path d="M8 10l4-4 4 4"/>
                </svg>
                <span>Merged Duplicate Tickets ({complaint.mergedComplaints.length})</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {complaint.mergedComplaints.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '12px 16px',
                    borderRadius: 'var(--border-radius-sm)',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--border-color)',
                    fontSize: '13px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent-color)' }}>
                        {item.trackingId}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Merged on {new Date(item.mergedAt).toLocaleDateString()} by {item.mergedBy}
                      </span>
                    </div>
                    {item.reason && (
                      <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Reason: "{item.reason}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected Supporters Card */}
          {complaint.supporters && complaint.supporters.length > 0 && (
            <div style={{
              marginTop: '24px',
              padding: '24px',
              borderRadius: 'var(--border-radius-md)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <User size={18} className="text-accent" />
                <span>Affected Supporters ({complaint.supporters.length})</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {complaint.supporters.map((sup, idx) => (
                  <div key={idx} style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--border-radius-sm)',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--border-color)',
                    fontSize: '13px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{sup.userName}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Joined on {new Date(sup.joinDate).toLocaleDateString()}
                      </span>
                    </div>
                    {sup.remarks && (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        Remarks: "{sup.remarks}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CSAT Satisfaction Feedback Card */}
          {((user.role === 'citizen' && (complaint.status === 'Awaiting Feedback' || complaint.status === 'Resolved')) || complaint.feedbackSubmitted) && (
            <div className="chat-container" style={{ marginTop: '24px', padding: '24px', height: 'auto', overflow: 'visible' }}>
              <div className="chat-header" style={{ marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                <span className="cd-chat-header-span">
                  <Smile size={18} className="text-accent" />
                  Citizen Satisfaction Rating (CSAT)
                </span>
              </div>

              {user.role === 'citizen' && !complaint.feedbackSubmitted ? (
                <form onSubmit={handleFeedbackSubmit}>
                  <p className="cd-escalate-description" style={{ marginBottom: '20px' }}>
                    {feedbackConfig.welcomeMessage}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {feedbackConfig.questions.map((q) => (
                      <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>
                          {q.label} {q.required && '*'}
                        </label>
                        
                        {q.type === 'rating' && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                onClick={() => setFeedbackResponses(prev => ({ ...prev, [q.id]: star }))}
                              >
                                {feedbackConfig.ratingIcon === 'heart' && (
                                  <Heart 
                                    size={24} 
                                    fill={star <= (feedbackResponses[q.id] || 5) ? "#fbbf24" : "none"} 
                                    stroke={star <= (feedbackResponses[q.id] || 5) ? "#fbbf24" : "rgba(255, 255, 255, 0.3)"}
                                  />
                                )}
                                {feedbackConfig.ratingIcon === 'smile' && (
                                  <Smile 
                                    size={24} 
                                    fill={star <= (feedbackResponses[q.id] || 5) ? "#fbbf24" : "none"} 
                                    stroke={star <= (feedbackResponses[q.id] || 5) ? "#fbbf24" : "rgba(255, 255, 255, 0.3)"}
                                  />
                                )}
                                {feedbackConfig.ratingIcon === 'thumb' && (
                                  <ThumbsUp 
                                    size={24} 
                                    fill={star <= (feedbackResponses[q.id] || 5) ? "#fbbf24" : "none"} 
                                    stroke={star <= (feedbackResponses[q.id] || 5) ? "#fbbf24" : "rgba(255, 255, 255, 0.3)"}
                                  />
                                )}
                                {feedbackConfig.ratingIcon === 'star' && (
                                  <Star 
                                    size={24} 
                                    fill={star <= (feedbackResponses[q.id] || 5) ? "#fbbf24" : "none"} 
                                    stroke={star <= (feedbackResponses[q.id] || 5) ? "#fbbf24" : "rgba(255, 255, 255, 0.3)"}
                                  />
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {q.type === 'boolean' && (
                          <div style={{ display: 'flex', gap: '24px', marginTop: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                              <input 
                                type="radio" 
                                name={q.id} 
                                value="Yes" 
                                checked={feedbackResponses[q.id] === 'Yes' || feedbackResponses[q.id] === true}
                                onChange={() => setFeedbackResponses(prev => ({ ...prev, [q.id]: q.id === 'resolvedCompletely' ? 'Yes' : true }))} 
                              /> Yes
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                              <input 
                                type="radio" 
                                name={q.id} 
                                value="No" 
                                checked={feedbackResponses[q.id] === 'No' || feedbackResponses[q.id] === false}
                                onChange={() => setFeedbackResponses(prev => ({ ...prev, [q.id]: q.id === 'resolvedCompletely' ? 'No' : false }))} 
                              /> No
                            </label>
                            {q.id === 'resolvedCompletely' && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                <input 
                                  type="radio" 
                                  name={q.id} 
                                  value="Partially" 
                                  checked={feedbackResponses[q.id] === 'Partially'}
                                  onChange={() => setFeedbackResponses(prev => ({ ...prev, [q.id]: 'Partially' }))} 
                                /> Partially
                              </label>
                            )}
                          </div>
                        )}

                        {q.type === 'choice' && (
                          <select 
                            className="form-control"
                            value={feedbackResponses[q.id] || ''}
                            onChange={(e) => setFeedbackResponses(prev => ({ ...prev, [q.id]: e.target.value }))}
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', maxWidth: '400px', height: '38px', fontSize: '13px' }}
                          >
                            {q.choices && q.choices.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        )}

                        {q.type === 'text' && (
                          <textarea 
                            className="form-control"
                            rows="3"
                            placeholder="Write your response here..."
                            value={feedbackResponses[q.id] || ''}
                            onChange={(e) => setFeedbackResponses(prev => ({ ...prev, [q.id]: e.target.value }))}
                            required={q.required}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ marginTop: '24px', width: '100%' }}
                    disabled={isSubmittingFeedback}
                  >
                    {isSubmittingFeedback ? 'Submitting Feedback...' : 'Submit Satisfaction Survey'}
                  </button>
                </form>
              ) : (
                <div>
                  <div style={{ background: 'var(--accent-glow, rgba(99, 102, 241, 0.05))', border: '1px dashed var(--accent-color, #6366f1)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Feedback Submitted On:</span>
                      <strong style={{ fontSize: '13px' }}>{new Date(complaint.feedback?.submittedAt).toLocaleDateString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Feedback Submitted By:</span>
                      <strong style={{ fontSize: '13px' }}>{complaint.feedback?.submittedBy?.name || 'Anonymous'}</strong>
                    </div>
                    {complaint.closureType && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Closure Type:</span>
                        <strong style={{ fontSize: '13px', color: 'var(--accent-color)' }}>{complaint.closureType}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{feedbackConfig.overallRatingLabel}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '18px' }}>{complaint.feedback?.overallRating} / 5</strong>
                        <div className="rating-stars">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              size={12} 
                              fill={i < complaint.feedback?.overallRating ? "#fbbf24" : "none"} 
                              stroke={i < complaint.feedback?.overallRating ? "#fbbf24" : "rgba(255, 255, 255, 0.2)"}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {feedbackConfig.showResponseTimeRating && (
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{feedbackConfig.responseTimeRatingLabel}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '18px' }}>{complaint.feedback?.responseTimeRating} / 5</strong>
                          <div className="rating-stars">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                size={12} 
                                fill={i < complaint.feedback?.responseTimeRating ? "#fbbf24" : "none"} 
                                stroke={i < complaint.feedback?.responseTimeRating ? "#fbbf24" : "rgba(255, 255, 255, 0.2)"}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {feedbackConfig.showCommunicationRating && (
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{feedbackConfig.communicationRatingLabel}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '18px' }}>{complaint.feedback?.communicationRating} / 5</strong>
                          <div className="rating-stars">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                size={12} 
                                fill={i < complaint.feedback?.communicationRating ? "#fbbf24" : "none"} 
                                stroke={i < complaint.feedback?.communicationRating ? "#fbbf24" : "rgba(255, 255, 255, 0.2)"}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {feedbackConfig.showResolutionQualityRating && (
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>{feedbackConfig.resolutionQualityRatingLabel}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '18px' }}>{complaint.feedback?.resolutionQualityRating} / 5</strong>
                          <div className="rating-stars">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                size={12} 
                                fill={i < complaint.feedback?.resolutionQualityRating ? "#fbbf24" : "none"} 
                                stroke={i < complaint.feedback?.resolutionQualityRating ? "#fbbf24" : "rgba(255, 255, 255, 0.2)"}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {(feedbackConfig.showResolvedCompletely || feedbackConfig.showRecommendation) && (
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
                      {feedbackConfig.showResolvedCompletely && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: feedbackConfig.showRecommendation ? '1px solid rgba(255,255,255,0.04)' : 'none', paddingBottom: '8px', marginBottom: feedbackConfig.showRecommendation ? '8px' : '0' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Issue Fully Resolved?</span>
                          <strong style={{ fontSize: '13px' }}>{complaint.feedback?.resolvedCompletely}</strong>
                        </div>
                      )}
                      {feedbackConfig.showRecommendation && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Would Recommend Service?</span>
                          <strong style={{ fontSize: '13px' }}>{complaint.feedback?.recommendation ? 'Yes' : 'No'}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {feedbackConfig.showComment && complaint.feedback?.comment && (
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>{feedbackConfig.commentLabel}</span>
                      <p style={{ margin: 0, fontSize: '13px', fontStyle: 'italic', lineHeight: 1.4 }}>
                        "{complaint.feedback?.comment}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Discussion Card */}
          <div className="chat-container">
            <div className="chat-header">
              <span className="cd-chat-header-span">
                <MessageSquare size={18} className="text-accent" />
                Discussion Thread
              </span>
            </div>
            
            <div className="chat-messages">
              {complaint.comments.length === 0 ? (
                <div className="cd-chat-empty">
                  No messages exchanged yet. Send a response below to start conversation.
                </div>
              ) : (
                complaint.comments.map((c) => {
                  const isOwnMessage = c.sender._id ? c.sender._id === user._id : c.sender === user._id;
                  return (
                    <div 
                      key={c._id} 
                      className={`message-bubble ${isOwnMessage ? 'outgoing' : 'incoming'}`}
                    >
                      <div className="message-info">
                        <span className="cd-message-sender">{c.senderName}</span>
                        <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="message-text">
                        {c.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-area">
              <input 
                type="text" 
                className="chat-input" 
                placeholder={isReadOnly ? "You are viewing this ticket in read-only mode." : (complaint.status === 'Resolved' || complaint.status === 'Rejected' ? "This ticket is closed. No further comments are allowed." : "Type your response here...")} 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                disabled={isReadOnly || complaint.status === 'Resolved' || complaint.status === 'Rejected'}
              />
              <button 
                type="submit" 
                className="btn-send"
                disabled={isReadOnly || isSendingMessage || complaint.status === 'Resolved' || complaint.status === 'Rejected'}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* Side Panel: Timeline and Actions */}
        <div className="cd-side-col">
          
          {/* Citizen Action Card */}
          {user.role === 'citizen' && (
            <div className="admin-action-card">
              <h3 className="cd-card-header">
                <ShieldAlert size={18} className="text-accent" />
                {complaint.status === 'Awaiting Feedback' || complaint.status === 'Resolved' ? 'Unsatisfied?' : complaint.status === 'Reopen Requested' ? 'Reopen Requested' : complaint.isEscalated ? 'Ticket Escalated' : 'Citizen Actions'}
              </h3>
              
              {complaint.status === 'Awaiting Feedback' || complaint.status === 'Resolved' ? (
                <div>
                  {!showReopenForm ? (
                    <div>
                      <p className="cd-escalate-description">
                        If the resolution did not fully solve your issue, you can reopen this complaint. It will move back to Investigating.
                      </p>
                      <button
                        type="button"
                        className="btn btn-danger btn-block"
                        onClick={() => setShowReopenForm(true)}
                      >
                        Reopen Complaint
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleReopenSubmit}>
                      <div className="form-group">
                        <label className="form-label">Reason for Reopening *</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="Please explain why you are reopening this ticket..."
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          required
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button
                          type="submit"
                          className="btn btn-danger"
                          style={{ flex: 1 }}
                          disabled={isReopening}
                        >
                          {isReopening ? 'Reopening...' : 'Confirm Reopen'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowReopenForm(false);
                            setReopenReason('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : complaint.status === 'Reopen Requested' ? (
                <div>
                  <div className="cd-citizen-escalated-status" style={{ color: '#f59e0b', borderColor: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: '1px solid', marginBottom: '12px' }}>
                    <Clock size={16} />
                    <span>Reopen Pending Approval</span>
                  </div>
                  <p className="cd-escalate-description">
                    Your request to reopen this complaint is pending administrative review.
                  </p>
                  <div className="cd-citizen-escalated-reason" style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', fontStyle: 'italic' }}>
                    <strong>Reason:</strong> "{complaint.reopenRequest?.reason}"
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                    Requested: {new Date(complaint.reopenRequest?.requestedAt).toLocaleString()}
                  </span>
                </div>
              ) : complaint.isEscalated ? (
                <div>
                  <div className="cd-citizen-escalated-status">
                    <ShieldAlert size={16} />
                    <span>Escalated to General Admin</span>
                  </div>
                  {complaint.escalationReason && (
                    <div className="cd-citizen-escalated-reason">
                      <strong>Reason:</strong> {complaint.escalationReason}
                    </div>
                  )}
                </div>
              ) : complaint.status === 'Rejected' || complaint.status === 'Closed' ? (
                <p className="cd-closed-message">
                  This complaint is closed ({complaint.status.toLowerCase()}). Actions are not available for closed tickets.
                </p>
              ) : (
                <form onSubmit={handleEscalateSubmit}>
                  <p className="cd-escalate-description">
                    If this complaint is delayed or not being resolved properly, escalate it directly to Super Admin.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Reason for Escalation *</label>
                    <textarea 
                      className="form-control cd-escalate-textarea"
                      rows="3"
                      placeholder="Explain why you are escalating this complaint..."
                      value={escalationReason}
                      onChange={(e) => setEscalationReason(e.target.value)}
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-danger btn-block"
                    disabled={isEscalating}
                  >
                    {isEscalating ? 'Escalating...' : 'Submit Escalation'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Admin Action Card */}
          {user.role === 'admin' && (
            <div className="admin-action-card">
              <h3 className="cd-card-header">
                <ShieldCheck size={18} className="text-accent" />
                Officer Audit Actions
              </h3>
              
              {isReadOnly ? (
                <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '16px', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.4 }}>
                  🛡️ <strong>Read-Only Access</strong>
                  <p style={{ margin: '8px 0 0 0' }}>
                    This complaint is assigned to your group/team (<strong>{complaint.assignedGroup?.name || complaint.assignedDepartment}</strong>). You can monitor and view its details, but only the assigned officer can execute actions.
                  </p>
                </div>
              ) : complaint.status === 'Reopen Requested' ? (
                <div>
                  <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', marginBottom: '8px' }}>
                      <Clock size={15} /> Reopen Request Pending
                    </div>
                    <p style={{ fontSize: '13px', margin: '0 0 8px 0', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                      The citizen has requested to reopen this complaint:
                    </p>
                    <div style={{ fontSize: '13px', fontStyle: 'italic', background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                      "{complaint.reopenRequest?.reason}"
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Requested: {new Date(complaint.reopenRequest?.requestedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Review Comment / Note</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Provide notes on approval or reason for rejection (optional)..."
                      value={reopenReviewComment}
                      onChange={(e) => setReopenReviewComment(e.target.value)}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      onClick={() => submitReopenReview('approve')}
                      disabled={isSubmittingReview}
                    >
                      {isSubmittingReview ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ flex: 1 }}
                      onClick={() => submitReopenReview('reject')}
                      disabled={isSubmittingReview}
                    >
                      {isSubmittingReview ? 'Processing...' : 'Reject'}
                    </button>
                  </div>
                </div>
              ) : activeWorkflow ? (
                <form onSubmit={handleAdminActionSubmit}>
                  <div className="form-group">
                    <label className="form-label">Audit Status (Workflow)</label>
                    <select 
                      className="form-control"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {activeWorkflow.states
                        .filter((s) => {
                          const isCurrent = s.name === complaint.status;
                          const transitions = activeWorkflow.transitions || [];
                          const transition = transitions.find(
                            (t) => t.fromState === complaint.status && t.toState === s.name
                          );
                          const isAllowedRole = !transition || 
                            transition.allowedRole === 'any' || 
                            transition.allowedRole === user?.role;
                          return isCurrent || (transition && isAllowedRole);
                        })
                        .map((s) => {
                          const isCurrent = s.name === complaint.status;
                          const transitions = activeWorkflow.transitions || [];
                          const transition = transitions.find(
                            (t) => t.fromState === complaint.status && t.toState === s.name
                          );
                          
                          let optionLabel = s.name;
                          if (isCurrent) {
                            optionLabel += ' (Current)';
                          } else if (transition) {
                            optionLabel += ` (➔ ${transition.label})`;
                          }
                          
                          return (
                            <option 
                              key={s.name} 
                              value={s.name} 
                            >
                              {optionLabel}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  {status === 'Escalated' && renderEscalationSection()}
                  {status === 'On Hold' && renderHoldSection()}

                  <button 
                    type="submit" 
                    className="btn btn-primary btn-block"
                    disabled={isAdminSubmitting || status === complaint.status}
                  >
                    {isAdminSubmitting ? 'Updating status...' : 'Save Audit Updates'}
                  </button>
                </form>
              ) : complaint.status === 'Resolved' || complaint.status === 'Rejected' || complaint.status === 'Awaiting Feedback' || complaint.status === 'Closed' ? (
                <p className="cd-closed-message">
                  This complaint is resolved, rejected, or closed and cannot be modified further.
                </p>
              ) : (
                <form onSubmit={handleAdminActionSubmit}>
                  <div className="form-group">
                    <label className="form-label">Audit Status</label>
                    <select 
                      className="form-control"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="Pending">Pending Audit</option>
                      <option value="Investigating">Investigating</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Escalated">Escalated</option>
                      <option value="Resolved">Resolved Issue</option>
                      <option value="Rejected">Rejected Issue</option>
                    </select>
                  </div>

                  {status === 'Escalated' && renderEscalationSection()}
                  {status === 'On Hold' && renderHoldSection()}

                  <button 
                    type="submit" 
                    className="btn btn-primary btn-block"
                    disabled={isAdminSubmitting}
                  >
                    {isAdminSubmitting ? 'Updating status...' : 'Save Audit Updates'}
                  </button>
                </form>
              )}

              {/* Manual Owner Reassignment Section */}
              {user.role === 'admin' && !['Resolved', 'Rejected', 'Awaiting Feedback', 'Closed'].includes(complaint.status) && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Scale size={14} />
                    <span>Reassign Ticket Owner</span>
                  </h4>
                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label className="form-label">Assignee</label>
                    <select 
                      className="form-control"
                      value={targetStaff}
                      onChange={(e) => setTargetStaff(e.target.value)}
                    >
                      <option value="">Unassigned Queue</option>
                      {departmentStaff.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} (Workload Score: {s.workloadScore} | {s.availabilityStatus})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Transfer Reason</label>
                    <input 
                      type="text"
                      className="form-control"
                      placeholder="e.g. Vacation coverage, expertise shift..."
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                    />
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-block"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    disabled={transferringOwner}
                    onClick={async () => {
                      setTransferringOwner(true);
                      try {
                        const response = await fetch('/api/workload/transfer', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${user.token}`
                          },
                          body: JSON.stringify({
                            complaintId: complaint._id,
                            targetStaffId: targetStaff || null,
                            reason: transferReason || 'Manual Reassignment override'
                          })
                        });
                        const result = await response.json();
                        if (result.success) {
                          addToast('Owner Reassigned', 'Complaint owner updated successfully.', 'success');
                          setTransferReason('');
                          fetchComplaintDetails();
                        } else {
                          addToast('Error', result.message || 'Failed to reassign owner', 'error');
                        }
                      } catch (err) {
                        console.error(err);
                        addToast('Error', 'Connection failed while transferring ticket', 'error');
                      } finally {
                        setTransferringOwner(false);
                      }
                    }}
                  >
                    <Save size={14} />
                    <span>Apply Owner Reassignment</span>
                  </button>
                </div>
              )}

              {user.role === 'admin' && !['Resolved', 'Rejected', 'Awaiting Feedback', 'Closed'].includes(complaint.status) && (
                <div className="cd-manual-escalate-section" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 className="cd-manual-escalate-header" style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldAlert size={15} /> General Manual Escalation
                  </h4>
                  <p className="cd-manual-escalate-desc" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Mark this complaint as Escalated, set priority to High, and assign it to any administrator.
                  </p>
                  
                  {!showManualEscalateForm ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-block cd-manual-escalate-btn"
                      onClick={() => setShowManualEscalateForm(true)}
                    >
                      Manually Escalate Ticket
                    </button>
                  ) : (
                    <div className="cd-manual-form-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 550, color: 'var(--text-muted)' }}>Assign Escalation To (Anyone)</label>
                        <select 
                          className="form-control"
                          value={escalateTargetStaff}
                          onChange={(e) => setEscalateTargetStaff(e.target.value)}
                        >
                          <option value="">-- Select Admin/Staff --</option>
                          {allAdmins.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.name} ({s.department || 'General Admin'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 550, color: 'var(--text-muted)' }}>Escalation Reason</label>
                        <textarea
                          className="form-control cd-manual-textarea"
                          rows="2"
                          placeholder="Enter manual escalation reason..."
                          value={manualEscalateReason}
                          onChange={(e) => setManualEscalateReason(e.target.value)}
                        />
                      </div>

                      <div className="cd-manual-action-row" style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn btn-danger cd-manual-submit-btn"
                          style={{ flex: 1 }}
                          onClick={handleManualEscalate}
                          disabled={isManualEscalating}
                        >
                          {isManualEscalating ? 'Escalating...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary cd-manual-cancel-btn"
                          style={{ flex: 1 }}
                          onClick={() => {
                            setShowManualEscalateForm(false);
                            setManualEscalateReason('');
                            setEscalateTargetStaff('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Duplicate Management Section */}
              {user.role === 'admin' && !['Resolved', 'Rejected', 'Awaiting Feedback', 'Closed'].includes(complaint.status) && (
                <div className="cd-duplicate-merge-section" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                      <path d="M12 18V6"/>
                      <path d="M8 10l4-4 4 4"/>
                    </svg>
                    <span>Duplicate Ticket Management</span>
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Merge identical or recurring reports into this ticket.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-block"
                    onClick={() => setShowMergeModal(true)}
                  >
                    Merge Duplicates into this Ticket
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Timeline Card */}
          <div className="timeline-card">
            <h3 className="cd-timeline-title">
              <Activity size={18} className="text-accent" />
              Progress Logs
            </h3>
            
            <div className="timeline">
              {complaint.history.map((h, index) => (
                <div key={index} className={`timeline-item ${index === complaint.history.length - 1 ? 'active' : ''}`}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <span className="timeline-action">{h.action}</span>
                    <span className="timeline-meta">By {h.actor} • {new Date(h.createdAt).toLocaleDateString()} {new Date(h.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Duplicate Merge Modal */}
      {complaint && (
        <DuplicateMergeModal
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          masterComplaint={complaint}
          token={user.token}
          onMergeSuccess={() => {
            fetchComplaintDetails();
          }}
          initialSelectedIds={initialMergeIds}
        />
      )}

      {/* Asset Edit Modal */}
      {selectedAssetToEdit && (
        <AssetEditModal
          isOpen={showAssetEditModal}
          onClose={() => {
            setShowAssetEditModal(false);
            setSelectedAssetToEdit(null);
          }}
          asset={selectedAssetToEdit}
          token={user.token}
          onSaveSuccess={() => {
            fetchComplaintDetails();
          }}
        />
      )}
    </div>
  );
};

export default ComplaintDetail;
