import React, { useState, useEffect } from 'react';
import { X, Search, AlertTriangle, HelpCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const DuplicateMergeModal = ({ isOpen, onClose, masterComplaint, token, onMergeSuccess, initialSelectedIds }) => {
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [reason, setReason] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Sync selectedIds and reset inputs when the modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds || []);
      setReason('');
      setSearchQuery('');
    }
  }, [isOpen, initialSelectedIds]);

  // Search for complaints to merge
  useEffect(() => {
    if (!isOpen) return;

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (searchQuery.trim()) {
          const queryParams = new URLSearchParams();
          queryParams.append('search', searchQuery);
          
          // Fetch complaints globally
          const res = await fetch(`/api/tickets?${queryParams.toString()}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          const json = await res.json();
          
          if (json.success && json.data) {
            // Filter out:
            // 1. The master complaint itself
            // 2. Already merged duplicate tickets (isDuplicate: true)
            // 3. Closed tickets
            const filtered = json.data.filter(c => 
              c._id !== masterComplaint._id && 
              !c.isDuplicate && 
              c.status !== 'Closed'
            );
            setSearchResults(filtered);
          } else {
            setSearchResults([]);
          }
        } else {
          // Fetch only potential duplicate tickets relative to the master ticket
          const categoryId = masterComplaint.category
            ? (typeof masterComplaint.category === 'object' ? masterComplaint.category._id : masterComplaint.category)
            : undefined;
          
          const res = await fetch('/api/duplicates/check', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              title: masterComplaint.title,
              description: masterComplaint.description,
              categoryId,
              departmentName: masterComplaint.assignedDepartment
            })
          });
          const json = await res.json();
          
          if (json.success && json.data) {
            // Map duplicate check format to standard complaint schema expected by the render layout
            const mapped = json.data.map(item => ({
              _id: item.complaintId,
              trackingId: item.trackingId,
              title: item.title,
              status: item.status,
              priority: item.priority || 'Low',
              assignedDepartment: item.department,
              createdAt: item.createdAt,
              isDuplicate: false
            }));
            
            // Filter out master complaint and closed tickets
            const filtered = mapped.filter(c => 
              c._id !== masterComplaint._id && 
              c.status !== 'Closed'
            );
            setSearchResults(filtered);
          } else {
            setSearchResults([]);
          }
        }
      } catch (err) {
        console.error('Failed to search complaints:', err);
        addToast('Search Error', 'Could not retrieve complaints for merging', 'error');
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isOpen, masterComplaint, token]);

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleMergeSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      addToast('Validation Error', 'Please select at least one duplicate complaint to merge.', 'error');
      return;
    }
    if (!reason.trim()) {
      addToast('Validation Error', 'Please specify a reason for merging these complaints.', 'error');
      return;
    }

    setIsMerging(true);
    try {
      const res = await fetch('/api/duplicates/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          masterComplaintId: masterComplaint._id,
          duplicateComplaintIds: selectedIds,
          reason: reason
        })
      });

      const json = await res.json();
      if (json.success) {
        addToast('Merge Successful', json.message || 'Complaints merged successfully', 'success');
        onMergeSuccess(json.data);
        onClose();
        // Reset states
        setSelectedIds([]);
        setReason('');
        setSearchQuery('');
      } else {
        addToast('Merge Failed', json.message || 'Error occurred while merging', 'error');
      }
    } catch (err) {
      console.error('Merge error:', err);
      addToast('Error', 'Communication failure with server', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--border-radius-lg)',
        width: '90%',
        maxWidth: '650px',
        maxHeight: '85vh',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '20px 24px', 
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Merge Duplicate Complaints
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Consolidate secondary reports into a master ticket.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleMergeSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Scrollable Body */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Master Ticket Info Card */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.03)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              padding: '12px 16px',
              borderRadius: 'var(--border-radius-md)'
            }}>
              <span style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                Master Ticket (Destination)
              </span>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)', marginRight: '8px' }}>
                {masterComplaint.trackingId}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                {masterComplaint.title}
              </span>
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Dept: <strong>{masterComplaint.assignedDepartment}</strong></span>
                <span>Priority: <strong style={{ color: 'var(--priority-high)' }}>{masterComplaint.priority}</strong></span>
                <span>Status: <strong>{masterComplaint.status}</strong></span>
              </div>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative' }}>
              <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Search tickets to merge</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by Tracking ID, Title, or Description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                />
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            {/* Search Results list */}
            <div style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--border-radius-md)', 
              background: 'var(--bg-primary)',
              padding: '8px',
              minHeight: '150px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {isSearching ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Searching complaints...
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {searchQuery ? 'No matching open complaints found.' : 'No potential duplicate complaints found.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {searchResults.map(c => (
                    <label
                      key={c._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: 'var(--border-radius-sm)',
                        background: selectedIds.includes(c._id) ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                        border: selectedIds.includes(c._id) ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontSize: '13px',
                        margin: 0
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c._id)}
                        onChange={() => handleToggleSelect(c._id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <strong style={{ color: 'var(--accent-color)', marginRight: '8px' }}>{c.trackingId}</strong>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.title}</span>
                          </div>
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)'
                          }}>
                            {c.priority}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Dept: {c.assignedDepartment} | Filed on: {new Date(c.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Merge Warnings Banner */}
            {selectedIds.length > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 'var(--border-radius-md)',
                padding: '12px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start'
              }}>
                <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong>Important:</strong> You have selected <strong>{selectedIds.length}</strong> ticket(s) to merge. The selected tickets will be closed and marked as duplicates of <strong>{masterComplaint.trackingId}</strong>. All comments, files, and supporters will be moved to this master ticket. This action is audited and irreversible.
                </div>
              </div>
            )}

            {/* Reason Field */}
            <div>
              <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Reason for merging *</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Provide a reason for audits (e.g. Confirmed duplicate reports of same AC outage in Block B Room 301)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                style={{ fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '12px', 
            borderTop: '1px solid var(--border-color)', 
            padding: '16px 24px',
            background: 'var(--bg-secondary)',
            zIndex: 10
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isMerging}
              style={{ padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isMerging || selectedIds.length === 0}
              style={{ padding: '8px 16px' }}
            >
              {isMerging ? 'Merging Tickets...' : `Merge ${selectedIds.length} Tickets`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DuplicateMergeModal;
