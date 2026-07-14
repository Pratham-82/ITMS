import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import '../styles/Dashboard.css';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Search, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Inbox,
  AlertTriangle,
  ShieldAlert,
  Settings,
  Filter,
  X
} from 'lucide-react';

const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

const getSlaFlag = (c) => {
  if (c.status === 'Resolved' || c.status === 'Closed' || c.status === 'Rejected') {
    return null;
  }
  
  if (c.executiveEscalated) {
    return (
      <span className="badge" style={{ backgroundColor: '#a855f7', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <ShieldAlert size={10} />
        Exec Escalated
      </span>
    );
  }

  if (c.totalBreachCount > 1) {
    return (
      <span className="badge" style={{ backgroundColor: '#7f1d1d', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <AlertTriangle size={10} />
        Repeated Breach ({c.totalBreachCount})
      </span>
    );
  }

  if (c.responseSlaStatus === 'Breached' || c.resolutionSlaStatus === 'Breached') {
    return (
      <span className="badge" style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <AlertTriangle size={10} />
        SLA Breached
      </span>
    );
  }

  const isApproaching = (() => {
    if (!c.nextEscalationDueAt) return false;
    const due = new Date(c.nextEscalationDueAt).getTime();
    const diffMs = due - Date.now();
    return diffMs > 0 && diffMs < 2 * 60 * 60 * 1000;
  })();

  if (isApproaching) {
    return (
      <span className="badge" style={{ backgroundColor: '#f97316', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <Clock size={10} />
        Approaching Breach
      </span>
    );
  }

  if (c.responseSlaStatus === 'Warning' || c.resolutionSlaStatus === 'Warning') {
    return (
      <span className="badge" style={{ backgroundColor: '#eab308', color: 'black', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <Clock size={10} />
        SLA Warning
      </span>
    );
  }

  return null;
};

const getDateRange = (preset, customStart, customEnd) => {
  const now = new Date();
  let start = null;
  let end = null;

  switch (preset) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    case 'yesterday':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      break;
    case '7days':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = now;
      break;
    case '30days':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = now;
      break;
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case 'custom':
      if (customStart) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      }
      break;
    default:
      break;
  }

  return { start, end };
};

const Pagination = ({ currentPage, totalEntries, pageSize, setPageSize, setCurrentPage }) => {
  const totalPages = Math.ceil(totalEntries / pageSize);
  if (totalPages <= 1 && pageSize >= totalEntries) return null;

  const startEntry = totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalEntries);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="db-pagination-container">
      <div className="db-pagination-info">
        Showing <strong>{startEntry}</strong> to <strong>{endEntry}</strong> of <strong>{totalEntries}</strong> entries
      </div>
      <div className="db-pagination-controls">
        <button 
          className="btn btn-secondary db-pagination-btn"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          type="button"
        >
          <ChevronLeft size={14} />
          <span>Prev</span>
        </button>
        
        <div className="db-pagination-pages">
          {getPageNumbers().map((p, idx) => (
            <button
              key={idx}
              className={`btn db-pagination-page-btn ${p === currentPage ? 'btn-primary' : 'btn-secondary'} ${p === '...' ? 'disabled' : ''}`}
              disabled={p === '...'}
              onClick={() => typeof p === 'number' && setCurrentPage(p)}
              type="button"
            >
              {p}
            </button>
          ))}
        </div>

        <button 
          className="btn btn-secondary db-pagination-btn"
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          type="button"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
        
        <select
          className="form-control db-pagination-select"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
        >
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
        </select>
      </div>
    </div>
  );
};

const TicketsPage = ({ groupOnly = false }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const isSuperAdmin = user?.role === 'admin' && (
    (user.groups && user.groups.length > 0 && user.groups.some(g => g.department && (g.department.name === 'General Administration' || g.department === 'General Administration' || (g.department._id && g.department.name === 'General Administration')))) ||
    ((!user.groups || user.groups.length === 0) && (!user.department || user.department === 'General Administration'))
  );

  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filtering and searching states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  // Date filters
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Advanced operational filters & customization states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showConfigPopover, setShowConfigPopover] = useState(false);
  const [visibleFilters, setVisibleFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('tickets_queue_visible_filters');
      return saved ? JSON.parse(saved) : ['status', 'priority', 'category', 'dateRange', 'sortBy'];
    } catch (e) {
      return ['status', 'priority', 'category', 'dateRange', 'sortBy'];
    }
  });

  const [slaFilter, setSlaFilter] = useState('');
  const [escalationFilter, setEscalationFilter] = useState('');
  const [duplicateFilter, setDuplicateFilter] = useState('');
  const [attentionFilter, setAttentionFilter] = useState('');

  const toggleFilterVisibility = (optId) => {
    setVisibleFilters(prev => {
      const next = prev.includes(optId) ? prev.filter(x => x !== optId) : [...prev, optId];
      localStorage.setItem('tickets_queue_visible_filters', JSON.stringify(next));
      return next;
    });
  };

  const handleClearAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setDateRangeFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
    setSlaFilter('');
    setEscalationFilter('');
    setDuplicateFilter('');
    setAttentionFilter('');
  };

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    statusFilter, priorityFilter, categoryFilter, debouncedSearch, 
    dateRangeFilter, startDateFilter, endDateFilter, sortBy,
    slaFilter, escalationFilter, duplicateFilter, attentionFilter
  ]);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setCategories(result.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch complaints
  const fetchComplaints = async () => {
    try {
      setLoading(true);
      let url = '/api/tickets';
      const params = [];
      if (groupOnly) {
        params.push('groupOnly=true');
      } else if (user?.role === 'admin' && !isSuperAdmin) {
        params.push('assignedToMe=true');
      }
      if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`);
      if (priorityFilter) params.push(`priority=${encodeURIComponent(priorityFilter)}`);
      if (categoryFilter) params.push(`category=${encodeURIComponent(categoryFilter)}`);
      if (debouncedSearch) params.push(`search=${encodeURIComponent(debouncedSearch)}`);
      if (sortBy) params.push(`sort=${encodeURIComponent(sortBy)}`);

      // Date range filtering parameters
      const { start, end } = getDateRange(dateRangeFilter, startDateFilter, endDateFilter);
      if (start && isValidDate(start)) params.push(`startDate=${encodeURIComponent(start.toISOString())}`);
      if (end && isValidDate(end)) params.push(`endDate=${encodeURIComponent(end.toISOString())}`);

      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${user.token}` }
      });

      if (!response.ok) {
        addToast('Error', `Failed to load tickets (HTTP ${response.status})`, 'error');
        setComplaints([]);
        return;
      }

      const result = await response.json();
      if (result.success) {
        setComplaints(result.data);
      } else {
        addToast('Error', result.message || 'Failed to fetch tickets', 'error');
        setComplaints([]);
      }
    } catch (error) {
      console.error(error);
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchCategories();
      fetchComplaints();
    }
  }, [user, statusFilter, priorityFilter, categoryFilter, sortBy, dateRangeFilter, startDateFilter, endDateFilter, debouncedSearch, groupOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchComplaints();
  };

  const getPriorityBadge = (priority) => {
    return <span className={`badge badge-priority-${priority.toLowerCase()}`}>{priority}</span>;
  };

  const getStatusBadge = (status) => {
    if (!status) return null;
    const statusClass = status.toLowerCase().replace(/\s+/g, '-');
    return <span className={`badge badge-status-${statusClass}`}>{status}</span>;
  };

  const filteredComplaints = complaints.filter(c => {
    // 1. SLA Filter
    if (slaFilter) {
      if (slaFilter === 'breached') {
        if (c.responseSlaStatus !== 'Breached' && c.resolutionSlaStatus !== 'Breached') return false;
      } else if (slaFilter === 'warning') {
        if (c.responseSlaStatus !== 'Warning' && c.resolutionSlaStatus !== 'Warning') return false;
      } else if (slaFilter === 'approaching') {
        if (!c.nextEscalationDueAt) return false;
        const due = new Date(c.nextEscalationDueAt).getTime();
        const diffMs = due - Date.now();
        const isApproaching = diffMs > 0 && diffMs < 2 * 60 * 60 * 1000;
        if (!isApproaching) return false;
      }
    }

    // 2. Escalation Filter
    if (escalationFilter) {
      if (escalationFilter === 'escalated' && !c.isEscalated) return false;
      if (escalationFilter === 'execEscalated' && !c.executiveEscalated) return false;
      if (escalationFilter === 'none' && (c.isEscalated || c.executiveEscalated)) return false;
    }

    // 3. Duplicate Filter
    if (duplicateFilter) {
      if (duplicateFilter === 'duplicate' && !c.isDuplicate) return false;
      if (duplicateFilter === 'nonduplicate' && c.isDuplicate) return false;
    }

    // 4. Attention Filter
    if (attentionFilter) {
      if (attentionFilter === 'required' && !c.attentionRequired) return false;
      if (attentionFilter === 'normal' && c.attentionRequired) return false;
    }

    return true;
  });

  const paginatedComplaints = filteredComplaints.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const uniqueCategoryNames = Array.from(new Set(categories.map((c) => c.name))).sort();

  if (loading && complaints.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <div className="spinner" style={{ width: '32px', height: '32px', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="db-container" style={{ padding: '0 8px' }}>
      {user?.role === 'admin' ? (
        <div className="dashboard-panel" style={{ position: 'relative' }}>
          <div className="panel-header" style={{ marginBottom: '20px' }}>
            <h2 className="panel-title">
              <Filter size={20} className="text-accent" />
              <span>{groupOnly ? "Group Complaints Queue" : (isSuperAdmin ? "Master Operations Tickets Queue" : "My Assigned Tickets Queue")}</span>
            </h2>
          </div>

          {/* Admin Configurable Filters Toolbar */}
          <div className="tickets-filter-container" style={{ marginBottom: '20px', position: 'relative' }}>
            <div className="filter-main-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
              <div className="search-input-wrapper" style={{ flex: 1, minWidth: '250px' }}>
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search by ID, title, details..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button 
                type="button" 
                className={`btn btn-secondary filter-toggle-btn ${showAdvancedFilters ? 'active' : ''}`}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  height: '38px', 
                  padding: '0 16px', 
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: showAdvancedFilters ? 'rgba(79, 70, 229, 0.1)' : 'var(--bg-card)', 
                  borderColor: showAdvancedFilters ? 'var(--accent-color)' : 'var(--border-color)', 
                  color: showAdvancedFilters ? 'var(--accent-color)' : 'var(--text-primary)',
                  boxShadow: 'var(--box-shadow-xs)'
                }}
              >
                <SlidersHorizontal size={15} />
                <span>Filters</span>
                {(statusFilter || priorityFilter || categoryFilter || dateRangeFilter !== 'all' || slaFilter || escalationFilter || duplicateFilter || attentionFilter) && (
                  <span className="filter-count-badge" style={{ backgroundColor: 'var(--accent-color)', color: 'white', fontSize: '10px', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginLeft: '4px' }}>
                    {
                      (statusFilter ? 1 : 0) + 
                      (priorityFilter ? 1 : 0) + 
                      (categoryFilter ? 1 : 0) + 
                      (dateRangeFilter !== 'all' ? 1 : 0) + 
                      (slaFilter ? 1 : 0) + 
                      (escalationFilter ? 1 : 0) + 
                      (duplicateFilter ? 1 : 0) + 
                      (attentionFilter ? 1 : 0)
                    }
                  </span>
                )}
              </button>

              <button 
                type="button" 
                className="btn btn-secondary filter-config-btn"
                onClick={() => {
                  setShowConfigPopover(!showConfigPopover);
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  height: '38px', 
                  width: '38px',
                  padding: 0, 
                  borderRadius: '6px',
                  background: 'var(--bg-card)', 
                  borderColor: 'var(--border-color)',
                  boxShadow: 'var(--box-shadow-xs)'
                }}
                title="Configure Filters"
              >
                <Settings size={15} />
              </button>

              {(statusFilter || priorityFilter || categoryFilter || dateRangeFilter !== 'all' || slaFilter || escalationFilter || duplicateFilter || attentionFilter || search) && (
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={handleClearAllFilters}
                  style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', textDecoration: 'none' }}
                >
                  <X size={14} />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* Filter Configuration Popover */}
            {showConfigPopover && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }} onClick={() => setShowConfigPopover(false)} />
                <div className="filter-config-popover" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', marginTop: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '10px', width: '280px', position: 'absolute', right: '0px', zIndex: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '4px' }}>Toggle Visible Filters</div>
                  {[
                    { id: 'status', label: 'Status' },
                    { id: 'priority', label: 'Priority' },
                    { id: 'category', label: 'Category' },
                    { id: 'dateRange', label: 'Date Range' },
                    { id: 'sortBy', label: 'Sort Order' },
                    { id: 'sla', label: 'SLA Status' },
                    { id: 'escalation', label: 'Escalation' },
                    { id: 'duplicate', label: 'Duplicate Status' },
                    { id: 'attention', label: 'Attention Flag' }
                  ].map(opt => (
                    <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', cursor: 'pointer', userSelect: 'none', padding: '4px 0', margin: 0 }}>
                      <input 
                        type="checkbox" 
                        checked={visibleFilters.includes(opt.id)}
                        onChange={() => toggleFilterVisibility(opt.id)}
                        style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="advanced-filters-panel" style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                
                {visibleFilters.includes('status') && (
                  <div className="filter-control-group">
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</label>
                    <select className="form-control" style={{ height: '36px', fontSize: '12.5px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                      <option value="">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Investigating">Investigating</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Escalated">Escalated</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Awaiting Feedback">Awaiting Feedback</option>
                      <option value="Reopen Requested">Reopen Requested</option>
                      <option value="Closed">Closed</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                )}

                {visibleFilters.includes('priority') && (
                  <div className="filter-control-group">
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority</label>
                    <select className="form-control" style={{ height: '36px', fontSize: '12.5px' }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
                      <option value="">All Priorities</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                )}

                {visibleFilters.includes('category') && (
                  <div className="filter-control-group">
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</label>
                    <select className="form-control" style={{ height: '36px', fontSize: '12.5px' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                      <option value="">All Categories</option>
                      {uniqueCategoryNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {visibleFilters.includes('dateRange') && (
                  <div className="filter-control-group">
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date Range</label>
                    <select className="form-control" style={{ height: '36px', fontSize: '12.5px' }} value={dateRangeFilter} onChange={e => setDateRangeFilter(e.target.value)}>
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="30days">Last 30 Days</option>
                      <option value="thisMonth">This Month</option>
                      <option value="lastMonth">Last Month</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                )}

                {visibleFilters.includes('sortBy') && (
                  <div className="filter-control-group">
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sort Order</label>
                    <select className="form-control" style={{ height: '36px', fontSize: '12.5px' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="priority">Priority</option>
                      <option value="impact">Highest Impact Score</option>
                    </select>
                  </div>
                )}

                {visibleFilters.includes('sla') && (
                  <div className="filter-control-group">
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SLA Status</label>
                    <select className="form-control" style={{ height: '36px', fontSize: '12.5px' }} value={slaFilter} onChange={e => setSlaFilter(e.target.value)}>
                      <option value="">All SLA Statuses</option>
                      <option value="breached">SLA Breached</option>
                      <option value="warning">SLA Warning</option>
                      <option value="approaching">Approaching Breach</option>
                    </select>
                  </div>
                )}

                {visibleFilters.includes('escalation') && (
                  <div className="filter-control-group">
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Escalation</label>
                    <select className="form-control" style={{ height: '36px', fontSize: '12.5px' }} value={escalationFilter} onChange={e => setEscalationFilter(e.target.value)}>
                      <option value="">All Tickets</option>
                      <option value="escalated">Escalated</option>
                      <option value="execEscalated">Executive Escalated</option>
                      <option value="none">Not Escalated</option>
                    </select>
                  </div>
                )}

                {visibleFilters.includes('duplicate') && (
                  <div className="filter-control-group">
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Duplicate Status</label>
                    <select className="form-control" style={{ height: '36px', fontSize: '12.5px' }} value={duplicateFilter} onChange={e => setDuplicateFilter(e.target.value)}>
                      <option value="">All Tickets</option>
                      <option value="duplicate">Is Duplicate</option>
                      <option value="nonduplicate">Not Duplicate</option>
                    </select>
                  </div>
                )}

                {visibleFilters.includes('attention') && (
                  <div className="filter-control-group">
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attention Flag</label>
                    <select className="form-control" style={{ height: '36px', fontSize: '12.5px' }} value={attentionFilter} onChange={e => setAttentionFilter(e.target.value)}>
                      <option value="">All Tickets</option>
                      <option value="required">Attention Required</option>
                      <option value="normal">Normal</option>
                    </select>
                  </div>
                )}

                {dateRangeFilter === 'custom' && (
                  <div className="filter-control-group" style={{ gridColumn: '1 / -1', display: 'flex', gap: '16px', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Start Date</label>
                      <input 
                        type="date" 
                        className="form-control"
                        style={{ height: '36px', fontSize: '12.5px' }}
                        value={startDateFilter}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>End Date</label>
                      <input 
                        type="date" 
                        className="form-control"
                        style={{ height: '36px', fontSize: '12.5px' }}
                        value={endDateFilter}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                      />
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Admin Table */}
          <div className="table-container">
            {filteredComplaints.length === 0 ? (
              <div className="db-table-empty">
                No tickets assigned or match the filter parameters.
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Citizen</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedComplaints.map((c) => (
                    <tr key={c._id} onClick={() => navigate(`/complaints/${c._id}`)}>
                      <td className="detail-id">{c.trackingId}</td>
                      <td className="db-table-title">
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{c.title}</span>
                          <span className="badge" style={{ 
                            backgroundColor: c.ticketType?.color || '#f59e0b', 
                            color: 'white', 
                            fontSize: '10px', 
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginLeft: '6px',
                            display: 'inline-block'
                          }}>
                            {c.ticketType?.name || 'Complaint'}
                          </span>
                          {getSlaFlag(c)}
                        </div>
                        {c.nextEscalationDueAt && c.status !== 'Resolved' && c.status !== 'Rejected' && (
                          <div className="db-escalation-due">
                            <Clock size={11} />
                            <span>Escalation: {new Date(c.nextEscalationDueAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                      </td>
                      <td>{c.citizen?.name || 'Citizen'}</td>
                      <td>{c.categoryName}</td>
                      <td>{getPriorityBadge(c.priority)}</td>
                      <td>{getStatusBadge(c.status)}</td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td>
                        <ChevronRight size={16} className="text-muted" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalEntries={filteredComplaints.length}
            pageSize={pageSize}
            setPageSize={setPageSize}
            setCurrentPage={setCurrentPage}
          />
        </div>
      ) : (
        <div className="dashboard-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <Inbox size={20} className="text-accent" />
              <span>My Filed Tickets History</span>
            </h2>
            <button className="btn btn-primary" onClick={() => navigate('/file-complaint')}>
              File New Ticket / Complaint
            </button>
          </div>

          {/* Citizen Filters */}
          <form onSubmit={handleSearchSubmit} className="filter-bar">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search by ID, title..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <select 
              className="form-control select-filter" 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Investigating">Investigating</option>
              <option value="Assigned">Assigned</option>
              <option value="Escalated">Escalated</option>
              <option value="On Hold">On Hold</option>
              <option value="Awaiting Feedback">Awaiting Feedback</option>
              <option value="Reopen Requested">Reopen Requested</option>
              <option value="Closed">Closed</option>
              <option value="Rejected">Rejected</option>
            </select>

            <select 
              className="form-control select-filter" 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>

            <select 
              className="form-control select-filter" 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {uniqueCategoryNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <select 
              className="form-control select-filter" 
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>

            <select
              className="form-control select-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            {dateRangeFilter === 'custom' && (
              <>
                <input 
                  type="date" 
                  className="form-control date-filter"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  placeholder="Start Date"
                />
                <input 
                  type="date" 
                  className="form-control date-filter"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  placeholder="End Date"
                />
              </>
            )}
          </form>

          {/* Citizen Table */}
          <div className="table-container">
            {filteredComplaints.length === 0 ? (
              <div className="db-table-empty">
                No tickets filed yet.
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Tracking ID</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Date Filed</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedComplaints.map((c) => (
                    <tr key={c._id} onClick={() => navigate(`/complaints/${c._id}`)}>
                      <td className="detail-id">{c.trackingId}</td>
                      <td className="db-table-title">
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{c.title}</span>
                          <span className="badge" style={{ 
                            backgroundColor: c.ticketType?.color || '#f59e0b', 
                            color: 'white', 
                            fontSize: '10px', 
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginLeft: '6px',
                            display: 'inline-block'
                          }}>
                            {c.ticketType?.name || 'Complaint'}
                          </span>
                          {getSlaFlag(c)}
                        </div>
                        {c.nextEscalationDueAt && c.status !== 'Resolved' && c.status !== 'Rejected' && (
                          <div className="db-escalation-due">
                            <Clock size={11} />
                            <span>Escalation: {new Date(c.nextEscalationDueAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                      </td>
                      <td>{c.categoryName}</td>
                      <td>{getPriorityBadge(c.priority)}</td>
                      <td>{getStatusBadge(c.status)}</td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td>
                        <ChevronRight size={16} className="text-muted" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalEntries={filteredComplaints.length}
            pageSize={pageSize}
            setPageSize={setPageSize}
            setCurrentPage={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
};

export default TicketsPage;
