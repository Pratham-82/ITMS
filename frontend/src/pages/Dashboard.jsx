import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import '../styles/Dashboard.css';
import * as LucideIcons from 'lucide-react';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Search, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Inbox,
  Layout,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Plus,
  Trash2,
  Edit,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Users,
  Layers,
  Settings,
  LayoutGrid
} from 'lucide-react';

// Chart.js imports
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement,
  LineElement,
  RadialLinearScale,
  Title as ChartTitle 
} from 'chart.js';
import { Doughnut, Bar, Line, Pie, PolarArea, Radar } from 'react-chartjs-2';

ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement,
  LineElement,
  RadialLinearScale,
  ChartTitle
);

const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

const getSlaFlag = (c) => {
  if (c.status === 'Resolved' || c.status === 'Closed' || c.status === 'Rejected') {
    return null;
  }
  
  // 1. Purple: Executive Escalated
  if (c.executiveEscalated) {
    return (
      <span className="badge" style={{ backgroundColor: '#a855f7', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <ShieldAlert size={10} />
        Exec Escalated
      </span>
    );
  }

  // 2. Dark Red: Repeated Breaches
  if (c.totalBreachCount > 1) {
    return (
      <span className="badge" style={{ backgroundColor: '#7f1d1d', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <AlertTriangle size={10} />
        Repeated Breach ({c.totalBreachCount})
      </span>
    );
  }

  // 3. Red: SLA Breached
  if (c.responseSlaStatus === 'Breached' || c.resolutionSlaStatus === 'Breached') {
    return (
      <span className="badge" style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <AlertTriangle size={10} />
        SLA Breached
      </span>
    );
  }

  // 4. Orange: Approaching Breach (Warning approaching due time or due in < 2 hours)
  const isApproaching = (() => {
    if (!c.nextEscalationDueAt) return false;
    const due = new Date(c.nextEscalationDueAt).getTime();
    const diffMs = due - Date.now();
    return diffMs > 0 && diffMs < 2 * 60 * 60 * 1000; // within 2 hours
  })();

  if (isApproaching) {
    return (
      <span className="badge" style={{ backgroundColor: '#f97316', color: 'white', fontWeight: 'bold', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '6px', borderRadius: '4px', padding: '2px 6px' }}>
        <Clock size={10} />
        Approaching Breach
      </span>
    );
  }

  // 5. Yellow: SLA Warning
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

const Dashboard = () => {
  const { user, setUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [citizenAssets, setCitizenAssets] = useState([]);
  
  // Date filters
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [recurringIssues, setRecurringIssues] = useState([]);

  // Load recurring issues for admin
  useEffect(() => {
    const fetchRecurring = async () => {
      try {
        const res = await fetch('/api/duplicates/recurring', {
          headers: {
            Authorization: `Bearer ${user.token}`
          }
        });
        const json = await res.json();
        if (json.success) {
          setRecurringIssues(json.data || []);
        }
      } catch (err) {
        console.error('Error fetching recurring issues:', err);
      }
    };

    if (user?.role === 'admin' && user?.token) {
      fetchRecurring();
    }
  }, [user]);

  const handleDateRangeChange = (val) => {
    setDateRangeFilter(val);
    if (val !== 'custom') {
      setStartDateFilter('');
      setEndDateFilter('');
    }
  };

  // Dashboard configuration (from user profile)
  const [config, setConfig] = useState({
    showStatusChart: true,
    showCategoryChart: true,
    showPriorityStats: true,
  });

  // Load user dashboard configuration
  useEffect(() => {
    if (user?.dashboardConfig) {
      setConfig(user.dashboardConfig);
    }
  }, [user]);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
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

      // Date range filtering parameters
      const { start, end } = getDateRange(dateRangeFilter, startDateFilter, endDateFilter);
      if (start && isValidDate(start)) params.push(`startDate=${encodeURIComponent(start.toISOString())}`);
      if (end && isValidDate(end)) params.push(`endDate=${encodeURIComponent(end.toISOString())}`);

      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });

      if (!response.ok) {
        const errText = response.status === 404
          ? 'Complaints API not found — restart the backend server (port 5001).'
          : `Failed to load complaints (HTTP ${response.status})`;
        addToast('Error', errText, 'error');
        setComplaints([]);
        return;
      }

      const result = await response.json();

      if (result.success) {
        setComplaints(result.data);
      } else {
        addToast('Error', result.message || 'Failed to fetch complaints', 'error');
        setComplaints([]);
      }
    } catch (error) {
      console.error(error);
      addToast('Error', 'Server connection failure', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCitizenAssets = async () => {
    try {
      const response = await fetch('/api/assets', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      const result = await response.json();
      if (result.success) {
        setCitizenAssets(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch citizen assets:', err);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchCategories();
      fetchComplaints();
      if (user.role === 'citizen') {
        fetchCitizenAssets();
      }
    }
  }, [user, dateRangeFilter, startDateFilter, endDateFilter]);

  const handleSaveConfig = async (newConfig, quiet = false) => {
    try {
      const response = await fetch('/api/auth/dashboard-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(newConfig)
      });
      const result = await response.json();
      if (result.success) {
        setConfig(newConfig);
        setUser(prev => ({ ...prev, dashboardConfig: newConfig }));
        if (!quiet) {
          addToast('Layout Saved', 'Dashboard configurations persisted to MongoDB', 'success');
        }
      }
    } catch (err) {
      if (!quiet) {
        addToast('Error', 'Failed to save widget layout', 'error');
      }
    }
  };

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status === 'Pending').length,
    active: complaints.filter(c => ['Investigating', 'Assigned', 'Escalated', 'Reopen Requested', 'On Hold'].includes(c.status)).length,
    resolved: complaints.filter(c => ['Resolved', 'Awaiting Feedback', 'Closed'].includes(c.status)).length,
    rejected: complaints.filter(c => c.status === 'Rejected').length,
  };

  if (loading && complaints.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <div 
          className="spinner"
          style={{
            width: '32px',
            height: '32px',
            border: '2px solid var(--border-color)',
            borderTopColor: 'var(--accent-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
      </div>
    );
  }

  const departmentFilterActive =
    user?.role === 'admin' &&
    user?.department &&
    user.department !== 'General Administration';

  return user?.role === 'admin' ? (
    <AdminDashboard 
      departmentFilterActive={departmentFilterActive}
      departmentName={user?.department}
      complaints={complaints} 
      categories={categories}
      stats={stats}
      dateRangeFilter={dateRangeFilter}
      setDateRangeFilter={handleDateRangeChange}
      startDateFilter={startDateFilter}
      setStartDateFilter={setStartDateFilter}
      endDateFilter={endDateFilter}
      setEndDateFilter={setEndDateFilter}
      navigate={navigate}
      config={config}
      saveConfig={handleSaveConfig}
      recurringIssues={recurringIssues}
    />
  ) : (
    <CitizenDashboard 
      stats={stats}
      navigate={navigate}
      citizenAssets={citizenAssets}
      user={user}
    />
  );
};

// ==========================================
// CITIZEN DASHBOARD
// ==========================================
const CitizenDashboard = ({ 
  stats, 
  navigate,
  citizenAssets = [],
  user
}) => {
  return (
    <div className="db-container">
      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper db-stat-icon-indigo">
            <FileText size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Filed</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper db-stat-icon-pending">
            <Clock size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.pending + stats.active}</span>
            <span className="stat-label">In Progress</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper db-stat-icon-resolved">
            <CheckCircle size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.resolved}</span>
            <span className="stat-label">Resolved</span>
          </div>
        </div>
      </div>

      {/* Citizen Registered Assets Panel */}
      <div className="dashboard-panel" style={{ marginTop: '24px' }}>
        <div className="panel-header">
          <h2 className="panel-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent" style={{ color: 'var(--accent-color)' }}>
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span>My Registered Assets ({citizenAssets.length})</span>
          </h2>
        </div>
        
        {citizenAssets.length === 0 ? (
          <div className="db-table-empty">
            No assets registered or linked to your email ({user?.email}).
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Asset Code</th>
                  <th>Name</th>
                  <th>Category & Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {citizenAssets.map((asset) => {
                  const isOwner = asset.ownerEmail?.toLowerCase() === user?.email?.toLowerCase() || asset.ownerUserId?._id === user?._id || asset.ownerUserId === user?._id;
                  return (
                    <tr key={asset._id} style={{ cursor: 'default' }}>
                      <td className="detail-id">{asset.assetCode}</td>
                      <td style={{ fontWeight: 600 }}>{asset.name}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{asset.assetTypeId?.name || 'Unknown Type'}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>{asset.categoryId?.name}</div>
                      </td>
                      <td>
                        <span className={`badge`} style={{
                          backgroundColor: asset.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: asset.status === 'Active' ? '#10b981' : '#f59e0b',
                          border: `1px solid ${asset.status === 'Active' ? '#10b98130' : '#f59e0b30'}`
                        }}>
                          {asset.status}
                        </span>
                      </td>
                      <td>{asset.location || 'N/A'}</td>
                      <td>
                        <span className="badge" style={{
                          backgroundColor: isOwner ? 'rgba(99, 102, 241, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                          color: isOwner ? 'var(--accent-color)' : '#0ea5e9',
                          border: `1px solid ${isOwner ? 'rgba(99, 102, 241, 0.2)' : 'rgba(14, 165, 233, 0.2)'}`
                        }}>
                          {isOwner ? 'Primary Owner' : 'Secondary Custodian'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// CONFIGURABLE DASHBOARD HELPER UTILITIES
// ==========================================
const getFieldValue = (obj, path) => {
  if (!obj || !path) return '';
  if (path === 'assignedTo') {
    return obj.assignedTo?.name || obj.assignedTo || 'Unassigned';
  }
  if (path === 'assignedGroup') {
    return obj.assignedGroup?.name || obj.assignedGroup || 'Unassigned';
  }
  if (path === 'categoryName') {
    return obj.categoryName || obj.category?.name || 'General';
  }
  if (path === 'department') {
    return obj.department?.name || obj.department || 'General';
  }
  if (path === 'ticketType') {
    return obj.ticketType?.name || obj.ticketType || 'Complaint';
  }
  
  const parts = path.split('.');
  let current = obj;
  for (let part of parts) {
    if (current == null) return '';
    current = current[part];
  }

  // Robust check: if value is a populated object, retrieve its name/label/title
  if (current && typeof current === 'object' && !(current instanceof Date)) {
    if (Array.isArray(current)) {
      return current.map(item => (typeof item === 'object' ? (item.name || item.label || item.title || '') : item)).join(', ');
    }
    return current.name || current.label || current.title || '';
  }

  return current !== undefined && current !== null ? current : '';
};

const evaluateFilters = (record, filters) => {
  if (!filters || filters.length === 0) return true;
  return filters.every(f => {
    let recordVal = getFieldValue(record, f.field);
    let filterVal = f.value;

    if (f.operator === 'exists') {
      return recordVal !== undefined && recordVal !== null && recordVal !== '';
    }

    // Ignore empty/unspecified filter values so they don't block all records
    if (filterVal === undefined || filterVal === null || filterVal === '' || (Array.isArray(filterVal) && filterVal.length === 0)) {
      return true;
    }

    // Normalize null/undefined record values dynamically based on filter value/operator
    if (recordVal === null || recordVal === undefined) {
      if (f.operator === 'greater_than' || f.operator === 'less_than' || (filterVal !== '' && !isNaN(Number(filterVal)))) {
        recordVal = 0;
      } else {
        recordVal = '';
      }
    }

    // Convert values to compare
    if (typeof recordVal === 'string') recordVal = recordVal.toLowerCase();

    const isRecordBlank = recordVal === null || recordVal === undefined || recordVal === '';

    if (Array.isArray(filterVal)) {
      const lowerVals = filterVal.map(v => String(v).toLowerCase());
      const hasBlankOther = lowerVals.includes('blank/other');
      
      if (hasBlankOther && isRecordBlank) {
        return f.operator !== 'not_equals';
      }
      
      const matchesStandard = lowerVals.includes(String(recordVal));
      if (f.operator === 'not_equals') {
        return !matchesStandard;
      }
      return matchesStandard;
    }

    if (typeof filterVal === 'string') filterVal = filterVal.toLowerCase();

    if (filterVal === 'blank/other' && isRecordBlank) {
      return f.operator !== 'not_equals';
    }

    switch (f.operator) {
      case 'equals':
        return String(recordVal) === String(filterVal);
      case 'not_equals':
        return String(recordVal) !== String(filterVal);
      case 'contains':
        return String(recordVal).includes(String(filterVal));
      case 'starts_with':
        return String(recordVal).startsWith(String(filterVal));
      case 'greater_than':
        return Number(recordVal) > Number(filterVal);
      case 'less_than':
        return Number(recordVal) < Number(filterVal);
      default:
        return true;
    }
  });
};


const applyGlobalFilters = (record, dataSource, globalDateRange, deptFilterActive, departmentName) => {
  if (dataSource !== 'tickets') return true;

  // 1. Date Range Filter
  if (record.createdAt) {
    const createdTime = new Date(record.createdAt).getTime();
    if (globalDateRange.start) {
      if (createdTime < new Date(globalDateRange.start).getTime()) return false;
    }
    if (globalDateRange.end) {
      if (createdTime > new Date(globalDateRange.end).getTime()) return false;
    }
  }

  // 2. Department filter (if admin is department-restricted)
  if (deptFilterActive && departmentName) {
    const recordDept = record.department?.name || record.department || '';
    if (String(recordDept).toLowerCase() !== String(departmentName).toLowerCase()) {
      return false;
    }
  }

  return true;
};

const prepareChartData = (records, groupByField, widgetTitle, chartType, groupByMonth = false) => {
  const counts = {};
  records.forEach(r => {
    let val = getFieldValue(r, groupByField);
    if (val === null || val === undefined || val === '') {
      val = 'Unspecified';
    } else if (groupByMonth) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        val = `${year}-${month}`;
      } else {
        val = 'Unspecified';
      }
    }
    counts[val] = (counts[val] || 0) + 1;
  });

  let sortedKeys;
  if (groupByMonth) {
    sortedKeys = Object.keys(counts).sort((a, b) => {
      if (a === 'Unspecified') return 1;
      if (b === 'Unspecified') return -1;
      return a.localeCompare(b);
    });
  } else {
    // Sort descending by value (count) to highlight highest columns
    sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }

  const formatFriendlyMonth = (yyyyMmStr) => {
    if (yyyyMmStr === 'Unspecified') return 'Unspecified';
    const parts = yyyyMmStr.split('-');
    if (parts.length !== 2) return yyyyMmStr;
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[monthIndex] || parts[1]} ${year}`;
  };

  const labels = sortedKeys.map(key => groupByMonth ? formatFriendlyMonth(key) : key);
  const data = sortedKeys.map(key => counts[key]);

  const baseColors = [
    '#6366f1', // Indigo
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#a855f7', // Purple
    '#64748b', // Slate
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#84cc16'  // Lime
  ];

  const colors = labels.map((_, index) => baseColors[index % baseColors.length]);

  return {
    labels,
    datasets: [{
      label: widgetTitle || 'Count',
      data,
      backgroundColor: chartType === 'line' || chartType === 'radar' ? colors[0] + '33' : colors,
      borderColor: chartType === 'line' || chartType === 'radar' ? colors[0] : 'var(--bg-secondary)',
      borderWidth: chartType === 'line' || chartType === 'radar' ? 2 : 2,
      fill: chartType === 'line' || chartType === 'radar' ? true : false,
      borderRadius: chartType === 'bar' ? 6 : 0
    }]
  };
};

const DEFAULT_WIDGETS = [
  {
    id: 'widget-status-breakdown',
    title: 'Status Breakdown',
    type: 'chart',
    chartType: 'bar',
    dataSource: 'tickets',
    groupBy: 'status',
    width: '6',
    respectGlobalFilters: true,
    filters: []
  },
  {
    id: 'widget-category-volume',
    title: 'Category Volume',
    type: 'chart',
    chartType: 'doughnut',
    dataSource: 'tickets',
    groupBy: 'categoryName',
    width: '6',
    respectGlobalFilters: true,
    filters: []
  },
  {
    id: 'widget-sla-breaches-metric',
    title: 'Active SLA Breaches',
    type: 'metric',
    dataSource: 'tickets',
    aggregation: 'count',
    icon: 'AlertTriangle',
    colorClass: 'bg-rose-glow',
    width: '3',
    respectGlobalFilters: true,
    filters: [
      { field: 'status', operator: 'not_equals', value: 'Resolved' },
      { field: 'status', operator: 'not_equals', value: 'Closed' },
      { field: 'status', operator: 'not_equals', value: 'Rejected' },
      { field: 'totalBreachCount', operator: 'greater_than', value: '0' }
    ]
  },
  {
    id: 'widget-prevented-duplicates-metric',
    title: 'Duplicates Prevented',
    type: 'metric',
    dataSource: 'tickets',
    aggregation: 'sum',
    targetField: 'duplicateCount',
    icon: 'Layers',
    colorClass: 'bg-indigo-glow',
    width: '3',
    respectGlobalFilters: true,
    filters: []
  },
  {
    id: 'widget-staff-load',
    title: 'Officer Workload (Active Tickets)',
    type: 'chart',
    chartType: 'bar',
    dataSource: 'tickets',
    groupBy: 'assignedTo',
    width: '6',
    respectGlobalFilters: true,
    filters: [
      { field: 'status', operator: 'not_equals', value: 'Resolved' },
      { field: 'status', operator: 'not_equals', value: 'Closed' },
      { field: 'status', operator: 'not_equals', value: 'Rejected' }
    ]
  },
  {
    id: 'widget-critical-table',
    title: 'Critical Tickets Queue',
    type: 'table',
    dataSource: 'tickets',
    limit: 5,
    sortField: 'createdAt',
    sortDirection: 'desc',
    width: '6',
    respectGlobalFilters: true,
    filters: [
      { field: 'priority', operator: 'equals', value: 'Critical' }
    ]
  }
];

// ==========================================
// STATIC WIDGET INLINE SCHEMA HELPERS
// ==========================================
const getFieldsForDataSource = (dataSource) => {
  switch (dataSource) {
    case 'tickets':
      return [
        { value: 'status', label: 'Status' },
        { value: 'priority', label: 'Priority' },
        { value: 'categoryName', label: 'Category' },
        { value: 'department', label: 'Department' },
        { value: 'riskScore', label: 'Risk Score' },
        { value: 'totalBreachCount', label: 'Breach Count' },
        { value: 'duplicateCount', label: 'Duplicates Count' },
        { value: 'assignedTo', label: 'Assigned Officer' },
        { value: 'isEscalated', label: 'Is Escalated' },
        { value: 'isDuplicate', label: 'Is Duplicate' },
        { value: 'attentionRequired', label: 'Attention Required' },
        { value: 'createdAt', label: 'Creation Date' },
        { value: 'assignedGroup', label: 'Assigned Group' }
      ];
    case 'assets':
      return [
        { value: 'status', label: 'Status' },
        { value: 'location', label: 'Location' },
        { value: 'name', label: 'Asset Name' },
        { value: 'assetCode', label: 'Asset Code' },
        { value: 'categoryId', label: 'Category' },
        { value: 'assetTypeId', label: 'Asset Type' },
        { value: 'departmentId', label: 'Department' },
        { value: 'createdAt', label: 'Creation Date' }
      ];
    case 'users':
      return [
        { value: 'role', label: 'Role' },
        { value: 'availabilityStatus', label: 'Availability Status' },
        { value: 'department', label: 'Department' }
      ];
    case 'serviceRequests':
      return [
        { value: 'status', label: 'Status' },
        { value: 'service', label: 'Service Name' },
        { value: 'assignedDepartment', label: 'Assigned Department' },
        { value: 'assignedTo', label: 'Assigned Officer' },
        { value: 'createdAt', label: 'Creation Date' },
        { value: 'assignedGroup', label: 'Assigned Group' }
      ];
    default:
      return [];
  }
};

const getChoicesForField = (field, dataSource, categories, departments) => {
  if (field === 'status') {
    if (dataSource === 'tickets') return ['Pending', 'Investigating', 'Assigned', 'Escalated', 'On Hold', 'Awaiting Feedback', 'Reopen Requested', 'Closed', 'Rejected'];
    if (dataSource === 'assets') return ['Active', 'Under Maintenance', 'Retired'];
    if (dataSource === 'users') return [];
    if (dataSource === 'serviceRequests') return ['Pending', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
  }
  if (field === 'priority') {
    return ['Low', 'Medium', 'High', 'Critical'];
  }
  if (field === 'role' && dataSource === 'users') {
    return ['admin', 'citizen'];
  }
  if (field === 'availabilityStatus' && dataSource === 'users') {
    return ['Available', 'Busy', 'On Leave', 'Unavailable'];
  }
  if (field === 'isEscalated' || field === 'isDuplicate' || field === 'attentionRequired') {
    return ['true', 'false'];
  }
  if (field === 'categoryName') {
    return (categories || []).map(c => c.name);
  }
  if (field === 'department' || field === 'departmentId' || field === 'assignedDepartment') {
    return (departments || []).map(d => d.name);
  }
  return null;
};

// ==========================================
// INTERACTIVE WIDGET INLINE FILTER BAR
// ==========================================
const InlineFilterBar = ({ widget, onUpdateFilters, categories, departments, rawData }) => {
  const [activeDropdownIdx, setActiveDropdownIdx] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveDropdownIdx(null);
      setSearchQuery('');
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveDropdownIdx(null);
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filters = widget.filters || [];

  // Memoize fields config
  const fields = useMemo(() => getFieldsForDataSource(widget.dataSource), [widget.dataSource]);

  // Memoize unique values to optimize performance and apply cascade filtering
  const uniqueValuesMap = useMemo(() => {
    const map = {};
    fields.forEach(f => {
      const fallback = getChoicesForField(f.value, widget.dataSource, categories, departments) || [];
      if (!rawData || rawData.length === 0) {
        map[f.value] = fallback;
        return;
      }
      
      // Cascade filtering: filter the dynamic options list by all other active widget filters
      const otherFilters = filters.filter(fFilter => fFilter.field !== f.value);
      const filteredRawData = rawData.filter(item => evaluateFilters(item, otherFilters));

      const values = new Set();
      let hasBlank = false;
      filteredRawData.forEach(item => {
        let val = getFieldValue(item, f.value);
        if (val === undefined || val === null || val === '') {
          hasBlank = true;
        } else {
          values.add(String(val));
        }
      });
      
      const uniqueList = Array.from(values).sort((a, b) => a.localeCompare(b));
      if (hasBlank) {
        uniqueList.push('Blank/Other');
      }
      
      map[f.value] = uniqueList.length > 0 ? uniqueList : fallback;
    });
    return map;
  }, [rawData, fields, widget.dataSource, categories, departments, filters]);

  const handleAddFilter = () => {
    const defaultField = fields[0]?.value || 'status';
    onUpdateFilters([...filters, { field: defaultField, operator: 'equals', value: [] }]);
  };

  const handleRemoveFilter = (idx) => {
    onUpdateFilters(filters.filter((_, i) => i !== idx));
  };

  const handleFieldChange = (idx, newField) => {
    onUpdateFilters(filters.map((f, i) => {
      if (i === idx) {
        return { ...f, field: newField, value: [] };
      }
      return f;
    }));
  };

  const handleValueToggle = (idx, val) => {
    const filter = filters[idx];
    let nextVal = Array.isArray(filter.value) ? [...filter.value] : [filter.value].filter(Boolean);
    if (nextVal.includes(val)) {
      nextVal = nextVal.filter(v => v !== val);
    } else {
      nextVal.push(val);
    }
    onUpdateFilters(filters.map((f, i) => {
      if (i === idx) {
        return { ...f, value: nextVal };
      }
      return f;
    }));
  };

  const handleSelectAllToggle = (idx, allOptions) => {
    const filter = filters[idx];
    const isAllSelected = allOptions.every(opt => (Array.isArray(filter.value) ? filter.value : []).includes(opt));
    
    onUpdateFilters(filters.map((f, i) => {
      if (i === idx) {
        return { ...f, value: isAllSelected ? [] : [...allOptions] };
      }
      return f;
    }));
  };

  return (
    <div className="widget-filter-bar">
      {filters.map((f, idx) => {
        const allOptions = uniqueValuesMap[f.field] || [];
        const filteredOptions = allOptions.filter(opt =>
          opt.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const selectedValues = Array.isArray(f.value) ? f.value : [f.value].filter(Boolean);
        const isAllSelected = allOptions.length > 0 && allOptions.every(opt => selectedValues.includes(opt));
        
        let triggerText = 'Select...';
        if (selectedValues.length === 1) {
          triggerText = selectedValues[0];
        } else if (selectedValues.length > 1) {
          triggerText = `${selectedValues.length} Selected`;
        }

        return (
          <div key={idx} className="widget-filter-item">
            {/* Field Select */}
            <select
              className="widget-filter-field-select"
              value={f.field}
              onChange={(e) => handleFieldChange(idx, e.target.value)}
            >
              {fields.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Value Selector Dropdown */}
            <div className="widget-filter-value-dropdown" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="widget-filter-value-trigger"
                onClick={() => {
                  setActiveDropdownIdx(activeDropdownIdx === idx ? null : idx);
                  setSearchQuery('');
                }}
              >
                <span>{triggerText}</span>
                <LucideIcons.ChevronDown size={12} />
              </button>

              {activeDropdownIdx === idx && (
                <div className="widget-filter-dropdown-panel">
                  <input
                    type="text"
                    className="widget-filter-search-input"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  
                  <div className="widget-filter-options-list">
                    <label className="widget-filter-option-item">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={() => handleSelectAllToggle(idx, allOptions)}
                      />
                      <span style={{ fontWeight: 'bold' }}>Select All</span>
                    </label>
                    {filteredOptions.map((opt) => {
                      const checked = selectedValues.includes(opt);
                      return (
                        <label key={opt} className="widget-filter-option-item" title={opt}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleValueToggle(idx, opt)}
                          />
                          <span className="text-truncate">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Remove Filter Button */}
            <button
              type="button"
              className="widget-filter-remove-btn"
              onClick={() => handleRemoveFilter(idx)}
              title="Remove filter"
            >
              <LucideIcons.X size={12} />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        className="widget-filter-add-btn"
        onClick={handleAddFilter}
      >
        <LucideIcons.Plus size={12} />
        <span>Filter</span>
      </button>
    </div>
  );
};

// ==========================================
// MEMOIZED WIDGET CARD CONTAINER
// ==========================================
const WidgetCardContainer = React.memo(({
  widget,
  idx,
  showCustomizer,
  activeWidgetsLength,
  rawData,
  globalDateRange,
  departmentFilterActive,
  departmentName,
  categories,
  departments,
  handleMoveWidget,
  setEditingWidget,
  setShowWidgetModal,
  handleSaveWidgetToLibrary,
  handleDeleteWidget,
  handleUpdateWidgetFilters,
  handleMetricClick,
  handleChartClick,
  barOptions,
  lineOptions,
  chartOptions,
  radarOptions,
  renderTableWidgetContent,
  renderWidgetIcon
}) => {
  // 1. Apply global respect filters
  const globalFilteredData = useMemo(() => {
    let filteredData = rawData;
    if (widget.respectGlobalFilters) {
      filteredData = rawData.filter(r => 
        applyGlobalFilters(r, widget.dataSource, globalDateRange, departmentFilterActive, departmentName)
      );
    }
    return filteredData;
  }, [rawData, widget.respectGlobalFilters, widget.dataSource, globalDateRange, departmentFilterActive, departmentName]);

  // 2. Apply widget local filters
  const filtered = useMemo(() => {
    return globalFilteredData.filter(r => evaluateFilters(r, widget.filters));
  }, [globalFilteredData, widget.filters]);

  // 3. Render Widget Content
  const content = useMemo(() => {
    if (widget.type === 'chart') {
      const chartData = prepareChartData(filtered, widget.groupBy || 'status', widget.title, widget.chartType, widget.groupByMonth);
      
      return (
        <div className="db-chart-wrapper">
          {widget.chartType === 'bar' && (
            <Bar 
              data={chartData} 
              options={{
                ...barOptions,
                onHover: (event, chartElement) => {
                  if (event.native && event.native.target) {
                    event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
                  }
                },
                onClick: (event, elements) => {
                  handleChartClick(elements, chartData.labels, widget, filtered);
                }
              }} 
            />
          )}
          {widget.chartType === 'line' && (
            <Line 
              data={chartData} 
              options={{
                ...lineOptions,
                onHover: (event, chartElement) => {
                  if (event.native && event.native.target) {
                    event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
                  }
                },
                onClick: (event, elements) => {
                  handleChartClick(elements, chartData.labels, widget, filtered);
                }
              }} 
            />
          )}
          {widget.chartType === 'doughnut' && (
            <Doughnut 
              data={chartData} 
              options={{
                ...chartOptions,
                onHover: (event, chartElement) => {
                  if (event.native && event.native.target) {
                    event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
                  }
                },
                onClick: (event, elements) => {
                  handleChartClick(elements, chartData.labels, widget, filtered);
                }
              }} 
            />
          )}
          {widget.chartType === 'pie' && (
            <Pie 
              data={chartData} 
              options={{
                ...chartOptions,
                onHover: (event, chartElement) => {
                  if (event.native && event.native.target) {
                    event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
                  }
                },
                onClick: (event, elements) => {
                  handleChartClick(elements, chartData.labels, widget, filtered);
                }
              }} 
            />
          )}
          {widget.chartType === 'polarArea' && (
            <PolarArea 
              data={chartData} 
              options={{
                ...chartOptions,
                onHover: (event, chartElement) => {
                  if (event.native && event.native.target) {
                    event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
                  }
                },
                onClick: (event, elements) => {
                  handleChartClick(elements, chartData.labels, widget, filtered);
                }
              }} 
            />
          )}
          {widget.chartType === 'radar' && (
            <Radar 
              data={chartData} 
              options={{
                ...radarOptions,
                onHover: (event, chartElement) => {
                  if (event.native && event.native.target) {
                    event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
                  }
                },
                onClick: (event, elements) => {
                  handleChartClick(elements, chartData.labels, widget, filtered);
                }
              }} 
            />
          )}
        </div>
      );
    } else if (widget.type === 'metric') {
      let metricVal = 0;
      if (widget.aggregation === 'count') {
        metricVal = filtered.length;
      } else if (widget.aggregation === 'sum' && widget.targetField) {
        metricVal = filtered.reduce((sum, r) => sum + (Number(getFieldValue(r, widget.targetField)) || 0), 0);
      } else if (widget.aggregation === 'avg' && widget.targetField) {
        const total = filtered.reduce((sum, r) => sum + (Number(getFieldValue(r, widget.targetField)) || 0), 0);
        metricVal = filtered.length > 0 ? Math.round((total / filtered.length) * 10) / 10 : 0;
      }

      return (
        <div className="metric-widget-body">
          <div className="metric-text-group">
            <span className="metric-value-large">{metricVal}</span>
            <span className="metric-label-sub">
              Matches: {filtered.length} total records
            </span>
          </div>
          {renderWidgetIcon(widget.icon || 'FileText', widget.colorClass)}
        </div>
      );
    } else if (widget.type === 'table') {
      const sorted = [...filtered].sort((a, b) => {
        let valA = getFieldValue(a, widget.sortField || 'createdAt');
        let valB = getFieldValue(b, widget.sortField || 'createdAt');
        
        if (!isNaN(Date.parse(valA)) && !isNaN(Date.parse(valB))) {
          return widget.sortDirection === 'desc' 
            ? new Date(valB) - new Date(valA)
            : new Date(valA) - new Date(valB);
        }
        
        if (typeof valA === 'number' && typeof valB === 'number') {
          return widget.sortDirection === 'desc' ? valB - valA : valA - valB;
        }
        
        return widget.sortDirection === 'desc'
          ? String(valB).localeCompare(String(valA))
          : String(valA).localeCompare(String(valB));
      }).slice(0, widget.limit || 5);

      return (
        <div className="table-widget-container">
          {renderTableWidgetContent(sorted, widget.dataSource)}
        </div>
      );
    }
    return null;
  }, [filtered, widget.type, widget.chartType, widget.groupBy, widget.groupByMonth, widget.title, widget.aggregation, widget.targetField, widget.icon, widget.colorClass, widget.sortField, widget.sortDirection, widget.limit, widget.dataSource, barOptions, lineOptions, chartOptions, radarOptions, renderTableWidgetContent, renderWidgetIcon]);

  const gridColSpan = `span ${widget.width || '6'}`;

  return (
    <div 
      className={`widget-card ${widget.type === 'metric' && !showCustomizer ? 'clickable-card' : ''}`}
      style={{ gridColumn: gridColSpan }}
      onClick={(e) => {
        if (widget.type === 'metric' && !showCustomizer) {
          if (e.target.closest('.widget-actions') || e.target.closest('.widget-filter-bar')) {
            return;
          }
          handleMetricClick(widget, filtered);
        }
      }}
    >
      <div className="widget-header">
        <h4 className="widget-title">
          {widget.type === 'chart' && <SlidersHorizontal size={14} style={{ color: 'var(--accent-color)' }} />}
          {widget.type === 'metric' && <TrendingUp size={14} style={{ color: '#10b981' }} />}
          {widget.type === 'table' && <Inbox size={14} style={{ color: '#f59e0b' }} />}
          <span>{widget.title}</span>
        </h4>
        
        {showCustomizer && (
          <div className="widget-actions">
            <button 
              type="button" 
              onClick={() => handleMoveWidget(idx, -1)} 
              disabled={idx === 0} 
              className="widget-action-btn"
              title="Move Left"
            >
              <ArrowUp size={13} style={{ transform: 'rotate(-90deg)' }} />
            </button>
            <button 
              type="button" 
              onClick={() => handleMoveWidget(idx, 1)} 
              disabled={idx === activeWidgetsLength - 1} 
              className="widget-action-btn"
              title="Move Right"
            >
              <ArrowDown size={13} style={{ transform: 'rotate(-90deg)' }} />
            </button>
            <button 
              type="button" 
              onClick={() => { setEditingWidget(widget); setShowWidgetModal(true); }} 
              className="widget-action-btn"
              title="Edit Settings"
            >
              <Edit size={13} />
            </button>
            <button 
              type="button" 
              onClick={() => handleSaveWidgetToLibrary(widget)} 
              className="widget-action-btn"
              style={{ color: 'var(--accent-color)' }}
              title="Save to Library"
            >
              <LucideIcons.Bookmark size={13} />
            </button>
            <button 
              type="button" 
              onClick={() => handleDeleteWidget(widget.id)} 
              className="widget-action-btn delete"
              title="Delete Widget"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      <InlineFilterBar 
        widget={widget}
        onUpdateFilters={(newFilters) => handleUpdateWidgetFilters(widget.id, newFilters)}
        categories={categories}
        departments={departments}
        rawData={globalFilteredData}
      />

      <div className="widget-content">
        {content}
      </div>
    </div>
  );
});

// ==========================================
// ADMIN DASHBOARD (CUSTOMIZABLE)
// ==========================================
const AdminDashboard = ({ 
  complaints, 
  categories,
  stats, 
  dateRangeFilter,
  setDateRangeFilter,
  startDateFilter,
  setStartDateFilter,
  endDateFilter,
  setEndDateFilter,
  navigate,
  config,
  saveConfig,
  departmentFilterActive,
  departmentName,
  recurringIssues
}) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Customizer Visibility
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [selectedComplaintsFilter, setSelectedComplaintsFilter] = useState(null);

  // Saved Widgets
  const savedWidgets = useMemo(() => {
    return config?.savedWidgets || [];
  }, [config?.savedWidgets]);

  // Lazy Loaded Datasets
  const [assets, setAssets] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingServiceRequests, setLoadingServiceRequests] = useState(false);

  // Dismissed AI alerts
  const [dismissedIssues, setDismissedIssues] = useState(() => {
    try {
      const saved = localStorage.getItem('dismissed_recurring_issues');
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      return [];
    }
  });
  const [expandedIssueIdxs, setExpandedIssueIdxs] = useState([]);

  // Fetch functions for lazy data sources
  const fetchAssets = async () => {
    try {
      setLoadingAssets(true);
      const res = await fetch('/api/assets', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) setAssets(data.data || []);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) setUsersList(data.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchServiceRequests = async () => {
    try {
      setLoadingServiceRequests(true);
      const res = await fetch('/api/service-requests', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) setServiceRequests(data.data || []);
    } catch (err) {
      console.error('Failed to fetch service requests:', err);
    } finally {
      setLoadingServiceRequests(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) setDepartments(data.data || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  // Determine active widgets configuration
  const activeWidgets = useMemo(() => {
    return config?.widgets && config.widgets.length > 0 ? config.widgets : DEFAULT_WIDGETS;
  }, [config?.widgets]);

  // Load lazy datasets based on widgets contents
  useEffect(() => {
    if (!user?.token) return;
    
    // Always load departments for filter builders
    fetchDepartments();

    const hasAssets = activeWidgets.some(w => w.dataSource === 'assets');
    if (hasAssets && assets.length === 0 && !loadingAssets) {
      fetchAssets();
    }

    const hasUsers = activeWidgets.some(w => w.dataSource === 'users');
    if (hasUsers && usersList.length === 0 && !loadingUsers) {
      fetchUsers();
    }

    const hasSRs = activeWidgets.some(w => w.dataSource === 'serviceRequests');
    if (hasSRs && serviceRequests.length === 0 && !loadingServiceRequests) {
      fetchServiceRequests();
    }
  }, [activeWidgets, user?.token]);

  // Handle widget actions
  const handleSaveWidget = (updatedWidget, saveToLib = false) => {
    let newWidgets = [];
    let widgetToSave = null;
    if (updatedWidget.id) {
      // Edit mode
      newWidgets = activeWidgets.map(w => w.id === updatedWidget.id ? updatedWidget : w);
      addToast('Widget Updated', `Widget "${updatedWidget.title}" configurations modified successfully.`, 'success');
      widgetToSave = updatedWidget;
    } else {
      // Add mode
      const newWidgetObj = { ...updatedWidget, id: 'widget-' + Date.now() };
      newWidgets = [...activeWidgets, newWidgetObj];
      addToast('Widget Added', `Widget "${updatedWidget.title}" added to dashboard.`, 'success');
      widgetToSave = newWidgetObj;
    }

    let nextConfig = { ...config, widgets: newWidgets };

    if (saveToLib && widgetToSave) {
      const libraryWidget = {
        ...widgetToSave,
        id: 'template-' + Date.now()
      };
      const currentSaved = config?.savedWidgets || [];
      nextConfig.savedWidgets = [...currentSaved.filter(w => w.title.toLowerCase() !== libraryWidget.title.toLowerCase()), libraryWidget];
      addToast('Saved to Library', `Widget "${libraryWidget.title}" also saved to your library!`, 'success');
    }

    saveConfig(nextConfig);
    setShowWidgetModal(false);
    setEditingWidget(null);
  };

  const handleSaveWidgetToLibrary = (widget) => {
    const libraryWidget = {
      ...widget,
      id: 'template-' + Date.now()
    };
    delete libraryWidget.layout; // remove layout details if any

    const currentSaved = config?.savedWidgets || [];
    if (currentSaved.some(w => w.title.toLowerCase() === widget.title.toLowerCase())) {
      if (!window.confirm(`A widget named "${widget.title}" already exists in your library. Do you want to save it as a duplicate?`)) {
        return;
      }
    }

    const newSaved = [...currentSaved, libraryWidget];
    saveConfig({ ...config, savedWidgets: newSaved });
    addToast('Saved to Library', `Widget "${widget.title}" successfully added to your library!`, 'success');
  };

  const handleAddWidgetFromLibrary = (libraryWidget) => {
    const newWidgetObj = { 
      ...libraryWidget, 
      id: 'widget-' + Date.now() // generate a new layout ID
    };
    
    const newWidgets = [...activeWidgets, newWidgetObj];
    saveConfig({ ...config, widgets: newWidgets });
    addToast('Widget Added', `Widget "${libraryWidget.title}" added to dashboard.`, 'success');
  };

  const handleDeleteWidgetFromLibrary = (templateId) => {
    if (window.confirm('Are you sure you want to remove this widget from your library?')) {
      const currentSaved = config?.savedWidgets || [];
      const newSaved = currentSaved.filter(w => w.id !== templateId);
      saveConfig({ ...config, savedWidgets: newSaved });
      addToast('Removed from Library', 'Widget removed from your library.', 'success');
    }
  };

  const handleDeleteWidget = (widgetId) => {
    if (window.confirm('Are you sure you want to delete this widget?')) {
      const newWidgets = activeWidgets.filter(w => w.id !== widgetId);
      saveConfig({ ...config, widgets: newWidgets });
      addToast('Widget Removed', 'Widget deleted from your configurations.', 'success');
    }
  };

  const handleMoveWidget = (index, direction) => {
    const newWidgets = [...activeWidgets];
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < newWidgets.length) {
      const temp = newWidgets[index];
      newWidgets[index] = newWidgets[targetIndex];
      newWidgets[targetIndex] = temp;
      saveConfig({ ...config, widgets: newWidgets });
    }
  };

  const handleResetDashboard = () => {
    if (window.confirm('Are you sure you want to reset your dashboard layout to defaults?')) {
      saveConfig({ ...config, widgets: DEFAULT_WIDGETS });
      addToast('Dashboard Reset', 'Dashboard layout reverted to default widgets.', 'success');
    }
  };

  const handleChartClick = (elements, labels, widget, filtered) => {
    if (!elements || elements.length === 0) return;
    const index = elements[0].index;
    const label = labels[index];
    const groupByField = widget.groupBy || 'status';

    const matchedComplaints = filtered.filter(r => {
      let val = getFieldValue(r, groupByField);
      if (val === null || val === undefined || val === '') {
        val = 'Unspecified';
      }
      return String(val).trim().toLowerCase() === String(label).trim().toLowerCase();
    });

    setSelectedComplaintsFilter({
      title: `${widget.title}: ${label}`,
      complaints: matchedComplaints
    });
  };

  const handleMetricClick = (widget, filtered) => {
    let displayComplaints = filtered;
    if (widget.aggregation === 'sum' && widget.targetField) {
      displayComplaints = filtered.filter(r => Number(getFieldValue(r, widget.targetField)) > 0);
    }

    setSelectedComplaintsFilter({
      title: widget.title,
      complaints: displayComplaints
    });
  };

  const handleUpdateWidgetFilters = (widgetId, updatedFilters) => {
    const newWidgets = activeWidgets.map(w => {
      if (w.id === widgetId) {
        return { ...w, filters: updatedFilters };
      }
      return w;
    });
    saveConfig({ ...config, widgets: newWidgets }, true);
  };

  const handleDismissIssue = (categoryName, location) => {
    const key = `${categoryName}::${location}`;
    setDismissedIssues(prev => {
      const updated = [...prev, key];
      localStorage.setItem('dismissed_recurring_issues', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleExpandIssue = (idx) => {
    setExpandedIssueIdxs(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const activeRecurringIssues = (recurringIssues || []).filter(
    issue => !dismissedIssues.includes(`${issue.categoryName}::${issue.location}`)
  );

  // Global Date filters context
  const globalDateRange = useMemo(() => {
    return getDateRange(dateRangeFilter, startDateFilter, endDateFilter);
  }, [dateRangeFilter, startDateFilter, endDateFilter]);

  // Chart configuration constants
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: 'var(--text-secondary)',
          font: { family: 'Plus Jakarta Sans', size: 10 }
        }
      }
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'var(--text-secondary)', font: { family: 'Plus Jakarta Sans', size: 10 } }
      },
      y: {
        grid: { color: 'var(--border-color)' },
        ticks: { color: 'var(--text-secondary)', font: { family: 'Plus Jakarta Sans', size: 10 } }
      }
    }
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'var(--text-secondary)', font: { family: 'Plus Jakarta Sans', size: 10 } }
      },
      y: {
        grid: { color: 'var(--border-color)' },
        ticks: { color: 'var(--text-secondary)', font: { family: 'Plus Jakarta Sans', size: 10 } }
      }
    }
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: 'var(--text-secondary)', font: { family: 'Plus Jakarta Sans', size: 10 } }
      }
    },
    scales: {
      r: {
        grid: { color: 'var(--border-color)' },
        angleLines: { color: 'var(--border-color)' },
        pointLabels: { color: 'var(--text-secondary)', font: { family: 'Plus Jakarta Sans', size: 10 } },
        ticks: { display: false }
      }
    }
  };

  // Render Table content inside Widget
  const renderTableWidgetContent = (sortedData, dataSource) => {
    if (sortedData.length === 0) {
      return <div className="db-table-empty">No matching records found.</div>;
    }
    
    switch (dataSource) {
      case 'tickets':
        return (
          <table className="table-widget-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map(t => (
                <tr key={t._id} onClick={() => navigate(`/complaints/${t._id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 650, textDecoration: 'underline', color: 'var(--accent-color)' }}>{t.title}</td>
                  <td>{t.categoryName || t.category?.name || 'General'}</td>
                  <td>
                    <span className="badge" style={{
                      backgroundColor: t.priority === 'Critical' || t.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                      color: t.priority === 'Critical' || t.priority === 'High' ? '#ef4444' : 'var(--text-secondary)'
                    }}>{t.priority}</span>
                  </td>
                  <td>
                    <span className="badge" style={{
                      backgroundColor: t.status === 'Resolved' || t.status === 'Closed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: t.status === 'Resolved' || t.status === 'Closed' ? '#10b981' : '#f59e0b'
                    }}>{t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'assets':
        return (
          <table className="table-widget-table">
            <thead>
              <tr>
                <th>Asset Code</th>
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map(a => (
                <tr key={a._id}>
                  <td style={{ fontWeight: 650 }}>{a.assetCode}</td>
                  <td>{a.name}</td>
                  <td>{a.location || 'N/A'}</td>
                  <td>
                    <span className="badge" style={{
                      backgroundColor: a.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: a.status === 'Active' ? '#10b981' : '#f59e0b'
                    }}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'users':
        return (
          <table className="table-widget-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Availability</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map(u => (
                <tr key={u._id}>
                  <td style={{ fontWeight: 650 }}>{u.name}</td>
                  <td>{u.role}</td>
                  <td>
                    <span className="badge" style={{
                      backgroundColor: u.availabilityStatus === 'Available' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: u.availabilityStatus === 'Available' ? '#10b981' : '#ef4444'
                    }}>{u.availabilityStatus}</span>
                  </td>
                  <td>{u.department || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case 'serviceRequests':
        return (
          <table className="table-widget-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map(sr => (
                <tr key={sr._id}>
                  <td style={{ fontWeight: 650 }}>{sr.title}</td>
                  <td>
                    <span className="badge" style={{
                      backgroundColor: sr.priority === 'Critical' || sr.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                      color: sr.priority === 'Critical' || sr.priority === 'High' ? '#ef4444' : 'var(--text-secondary)'
                    }}>{sr.priority}</span>
                  </td>
                  <td>
                    <span className="badge" style={{
                      backgroundColor: sr.status === 'Resolved' || sr.status === 'Closed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: sr.status === 'Resolved' || sr.status === 'Closed' ? '#10b981' : '#f59e0b'
                    }}>{sr.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      default:
        return null;
    }
  };

  // Render dynamic Widget Icons for Metric cards
  const renderWidgetIcon = (iconName, colorClass) => {
    const IconComponent = LucideIcons[iconName] || LucideIcons.FileText;
    return (
      <div className={`metric-icon-box ${colorClass || 'bg-indigo-glow'}`}>
        <IconComponent size={24} />
      </div>
    );
  };

  return (
    <div className="db-container">
      
      {/* Dashboard Control Toolbar */}
      <div className="db-customizer-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setShowCustomizer(!showCustomizer)} 
            className="btn btn-secondary db-customizer-btn"
          >
            <Layout size={15} />
            <span>Customize Dashboard</span>
          </button>

          {showCustomizer && (
            <>
              <button 
                onClick={() => { setEditingWidget(null); setShowWidgetModal(true); }} 
                className="btn btn-primary db-customizer-btn"
                style={{ background: 'var(--accent-color)', color: 'white' }}
              >
                <Plus size={15} />
                <span>Add Custom Widget</span>
              </button>

              <button 
                onClick={() => setShowLibraryModal(true)} 
                className="btn btn-secondary db-customizer-btn"
                style={{ border: '1px solid var(--accent-color)', color: 'var(--accent-color)', background: 'transparent' }}
              >
                <LucideIcons.Bookmark size={15} style={{ marginRight: '6px' }} />
                <span>Add from Library</span>
              </button>

              <button 
                onClick={handleResetDashboard} 
                className="btn btn-secondary db-customizer-btn"
                style={{ borderStyle: 'dashed' }}
              >
                <RefreshCw size={15} />
                <span>Reset to Defaults</span>
              </button>
            </>
          )}
        </div>
        
        <div className="date-filter-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Global Date Range:</span>
          <select 
            className="form-control select-filter" 
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(e.target.value)}
            style={{ width: '160px', height: '36px', padding: '0 12px', fontSize: '13px' }}
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

          {dateRangeFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="date" 
                className="form-control date-filter"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                style={{ height: '36px', fontSize: '13px' }}
                placeholder="Start Date"
              />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>to</span>
              <input 
                type="date" 
                className="form-control date-filter"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                style={{ height: '36px', fontSize: '13px' }}
                placeholder="End Date"
              />
            </div>
          )}
        </div>
      </div>

      {showCustomizer && (
        <div className="dashboard-panel db-customizer-panel" style={{ padding: '16px 20px', marginBottom: '24px' }}>
          <h3 className="db-customizer-title" style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>Customizer Mode Activated</h3>
          <p className="db-customizer-desc" style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
            Click "Edit", "Move", or "Delete" on any widget card below. You can also add dynamic Metric summaries, multi-axis Charts, or specific query Data Queues.
          </p>
        </div>
      )}

      {/* DYNAMIC WIDGETS GRID */}
      <div className="db-widgets-grid">
        {activeWidgets.map((widget, idx) => {
          // 1. Resolve Dataset
          let rawData = [];
          if (widget.dataSource === 'tickets') rawData = complaints;
          else if (widget.dataSource === 'assets') rawData = assets;
          else if (widget.dataSource === 'users') rawData = usersList;
          else if (widget.dataSource === 'serviceRequests') rawData = serviceRequests;

          return (
            <WidgetCardContainer
              key={widget.id || idx}
              widget={widget}
              idx={idx}
              showCustomizer={showCustomizer}
              activeWidgetsLength={activeWidgets.length}
              rawData={rawData}
              globalDateRange={globalDateRange}
              departmentFilterActive={departmentFilterActive}
              departmentName={departmentName}
              categories={categories}
              departments={departments}
              handleMoveWidget={handleMoveWidget}
              setEditingWidget={setEditingWidget}
              setShowWidgetModal={setShowWidgetModal}
              handleSaveWidgetToLibrary={handleSaveWidgetToLibrary}
              handleDeleteWidget={handleDeleteWidget}
              handleUpdateWidgetFilters={handleUpdateWidgetFilters}
              handleMetricClick={handleMetricClick}
              handleChartClick={handleChartClick}
              barOptions={barOptions}
              lineOptions={lineOptions}
              chartOptions={chartOptions}
              radarOptions={radarOptions}
              renderTableWidgetContent={renderTableWidgetContent}
              renderWidgetIcon={renderWidgetIcon}
            />
          );
        })}
      </div>

      {/* AI Recurring Issues Alerts */}
      {activeRecurringIssues && activeRecurringIssues.length > 0 && (
        <div style={{
          marginTop: '32px',
          padding: '20px',
          borderRadius: 'var(--border-radius-md)',
          background: 'rgba(239, 68, 68, 0.03)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          boxShadow: 'var(--box-shadow-sm)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ef4444', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>AI Alerts: Recurring Issues Detected ({activeRecurringIssues.length})</span>
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            AI has detected repeating patterns of unresolved complaints. Please review the recommended actions below to deploy proactive maintenance teams.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {activeRecurringIssues.map((issue, idx) => (
              <div key={idx} style={{
                padding: '12px 16px',
                borderRadius: 'var(--border-radius-sm)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{issue.categoryName}</strong>
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    color: '#ef4444',
                    fontWeight: 700
                  }}>
                    {issue.ticketCount} recent reports
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>
                  Location: <strong>{issue.location}</strong>
                </div>
                <div style={{ 
                  padding: '8px 10px', 
                  background: 'rgba(99, 102, 241, 0.05)', 
                  borderRadius: '4px',
                  color: 'var(--accent-color)', 
                  fontSize: '12px',
                  borderLeft: '3px solid var(--accent-color)',
                  lineHeight: '1.4'
                }}>
                  <strong>AI Recommendation:</strong> {issue.recommendation}
                </div>

                {/* Affected Tickets collapsible list */}
                {expandedIssueIdxs.includes(idx) && (
                  <div style={{
                    marginTop: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '8px',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid var(--border-color)',
                    maxHeight: '120px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '2px' }}>
                      Recent Unresolved Reports:
                    </div>
                    {issue.recentTickets.map(t => (
                      <div
                        key={t.id}
                        onClick={() => navigate(`/complaints/${t.id}`)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: 'var(--accent-color)',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontWeight: 600, textDecoration: 'underline' }}>{t.title}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{t.trackingId}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions row */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginTop: 'auto', 
                  borderTop: '1px solid var(--border-color)', 
                  paddingTop: '8px' 
                }}>
                  <button
                    type="button"
                    onClick={() => toggleExpandIssue(idx)}
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      height: '28px',
                      lineHeight: '1',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {expandedIssueIdxs.includes(idx) ? 'Hide Tickets' : 'View Tickets'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tickets = issue.recentTickets;
                      if (tickets && tickets.length > 0) {
                        const masterId = tickets[0].id;
                        const otherIds = tickets.slice(1).map(t => t.id).join(',');
                        navigate(`/complaints/${masterId}?triggerMerge=true&mergeIds=${otherIds}`);
                      }
                    }}
                    className="btn btn-primary"
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      height: '28px',
                      lineHeight: '1',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    Merge Tickets
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismissIssue(issue.categoryName, issue.location)}
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      height: '28px',
                      lineHeight: '1',
                      marginLeft: 'auto',
                      color: 'var(--text-muted)',
                      border: 'none',
                      background: 'transparent'
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Widget Builder Modal */}
      <WidgetBuilderModal 
        isOpen={showWidgetModal}
        onClose={() => { setShowWidgetModal(false); setEditingWidget(null); }}
        onSave={handleSaveWidget}
        editingWidget={editingWidget}
        categories={categories}
        departments={departments}
      />

      {/* Widget Library Modal */}
      <WidgetLibraryModal 
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        savedWidgets={savedWidgets}
        onAddWidget={handleAddWidgetFromLibrary}
        onDeleteFromLibrary={handleDeleteWidgetFromLibrary}
        activeWidgets={activeWidgets}
      />

      {/* Complaints List Filter Modal */}
      <ComplaintsListModal
        isOpen={!!selectedComplaintsFilter}
        onClose={() => setSelectedComplaintsFilter(null)}
        filterTitle={selectedComplaintsFilter?.title || ''}
        complaints={selectedComplaintsFilter?.complaints || []}
        navigate={navigate}
      />
    </div>
  );
};

// ==========================================
// CONFIGURABLE WIDGET BUILDER MODAL DIALOG
// ==========================================
const WidgetBuilderModal = ({ isOpen, onClose, onSave, editingWidget, categories, departments }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('chart');
  const [chartType, setChartType] = useState('bar');
  const [dataSource, setDataSource] = useState('tickets');
  const [groupBy, setGroupBy] = useState('status');
  const [width, setWidth] = useState('6');
  const [respectGlobalFilters, setRespectGlobalFilters] = useState(true);
  const [aggregation, setAggregation] = useState('count');
  const [targetField, setTargetField] = useState('');
  const [icon, setIcon] = useState('FileText');
  const [colorClass, setColorClass] = useState('bg-indigo-glow');
  const [limit, setLimit] = useState(5);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filters, setFilters] = useState([]);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [groupByMonth, setGroupByMonth] = useState(false);

  // Load editing widget if any
  useEffect(() => {
    if (editingWidget) {
      setTitle(editingWidget.title || '');
      setType(editingWidget.type || 'chart');
      setChartType(editingWidget.chartType || 'bar');
      setDataSource(editingWidget.dataSource || 'tickets');
      setGroupBy(editingWidget.groupBy || 'status');
      setWidth(editingWidget.width || '6');
      setRespectGlobalFilters(editingWidget.respectGlobalFilters !== false);
      setAggregation(editingWidget.aggregation || 'count');
      setTargetField(editingWidget.targetField || '');
      setIcon(editingWidget.icon || 'FileText');
      setColorClass(editingWidget.colorClass || 'bg-indigo-glow');
      setLimit(editingWidget.limit || 5);
      setSortField(editingWidget.sortField || 'createdAt');
      setSortDirection(editingWidget.sortDirection || 'desc');
      setFilters(editingWidget.filters || []);
      setSaveToLibrary(false);
      setGroupByMonth(editingWidget.groupByMonth || false);
    } else {
      setTitle('');
      setType('chart');
      setChartType('bar');
      setDataSource('tickets');
      setGroupBy('status');
      setWidth('6');
      setRespectGlobalFilters(true);
      setAggregation('count');
      setTargetField('');
      setIcon('FileText');
      setColorClass('bg-indigo-glow');
      setLimit(5);
      setSortField('createdAt');
      setSortDirection('desc');
      setFilters([]);
      setSaveToLibrary(false);
      setGroupByMonth(false);
    }
  }, [editingWidget, isOpen]);

  // Adjust defaults when dataSource changes
  useEffect(() => {
    if (editingWidget) return;
    if (dataSource === 'tickets') {
      setGroupBy('status');
      setSortField('createdAt');
    } else if (dataSource === 'assets') {
      setGroupBy('status');
      setSortField('createdAt');
    } else if (dataSource === 'users') {
      setGroupBy('availabilityStatus');
      setSortField('name');
    } else if (dataSource === 'serviceRequests') {
      setGroupBy('status');
      setSortField('createdAt');
    }
  }, [dataSource]);

  if (!isOpen) return null;

  const handleAddFilter = () => {
    const defaultField = getFieldsForDataSource()[0]?.value || 'status';
    const choices = getChoicesForField(defaultField);
    setFilters([...filters, { field: defaultField, operator: 'equals', value: choices && choices.length > 0 ? choices[0] : '' }]);
  };

  const handleRemoveFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleFilterChange = (index, keyOrUpdates, val) => {
    setFilters(prev => prev.map((f, i) => {
      if (i !== index) return f;
      if (typeof keyOrUpdates === 'object') {
        return { ...f, ...keyOrUpdates };
      }
      return { ...f, [keyOrUpdates]: val };
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return alert('Please enter a widget title');
    
    onSave({
      id: editingWidget?.id,
      title: title.trim(),
      type,
      chartType: type === 'chart' ? chartType : undefined,
      dataSource,
      groupBy: type !== 'table' ? groupBy : undefined,
      groupByMonth: type === 'chart' && (groupBy === 'createdAt' || groupBy?.endsWith('At') || groupBy?.endsWith('Date')) ? groupByMonth : undefined,
      width,
      respectGlobalFilters,
      aggregation: type === 'metric' ? aggregation : undefined,
      targetField: (type === 'metric' && aggregation !== 'count') || type === 'table' ? targetField : undefined,
      icon: type === 'metric' ? icon : undefined,
      colorClass: type === 'metric' ? colorClass : undefined,
      limit: type === 'table' ? limit : undefined,
      sortField: type === 'table' ? sortField : undefined,
      sortDirection: type === 'table' ? sortDirection : undefined,
      filters
    }, saveToLibrary);
  };

  // Field lists by datasource
  const getFieldsForDataSource = () => {
    switch (dataSource) {
      case 'tickets':
        return [
          { value: 'status', label: 'Status' },
          { value: 'priority', label: 'Priority' },
          { value: 'categoryName', label: 'Category' },
          { value: 'department', label: 'Department' },
          { value: 'riskScore', label: 'Risk Score' },
          { value: 'totalBreachCount', label: 'Breach Count' },
          { value: 'duplicateCount', label: 'Duplicates Count' },
          { value: 'assignedTo', label: 'Assigned Officer' },
          { value: 'isEscalated', label: 'Is Escalated' },
          { value: 'isDuplicate', label: 'Is Duplicate' },
          { value: 'attentionRequired', label: 'Attention Required' },
          { value: 'createdAt', label: 'Creation Date' },
          { value: 'assignedGroup', label: 'Assigned Group' }
        ];
      case 'assets':
        return [
          { value: 'status', label: 'Status' },
          { value: 'location', label: 'Location' },
          { value: 'name', label: 'Asset Name' },
          { value: 'assetCode', label: 'Asset Code' },
          { value: 'categoryId', label: 'Category' },
          { value: 'assetTypeId', label: 'Asset Type' },
          { value: 'departmentId', label: 'Department' },
          { value: 'createdAt', label: 'Creation Date' }
        ];
      case 'users':
        return [
          { value: 'role', label: 'Role' },
          { value: 'availabilityStatus', label: 'Availability Status' },
          { value: 'department', label: 'Department' }
        ];
      case 'serviceRequests':
        return [
          { value: 'status', label: 'Status' },
          { value: 'service', label: 'Service Name' },
          { value: 'assignedDepartment', label: 'Assigned Department' },
          { value: 'assignedTo', label: 'Assigned Officer' },
          { value: 'createdAt', label: 'Creation Date' },
          { value: 'assignedGroup', label: 'Assigned Group' }
        ];
      default:
        return [];
    }
  };

  const getChoicesForField = (field) => {
    if (field === 'status') {
      if (dataSource === 'tickets') return ['Pending', 'Investigating', 'Assigned', 'Escalated', 'On Hold', 'Awaiting Feedback', 'Reopen Requested', 'Closed', 'Rejected'];
      if (dataSource === 'assets') return ['Active', 'Under Maintenance', 'Retired'];
      if (dataSource === 'users') return [];
      if (dataSource === 'serviceRequests') return ['Pending', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
    }
    if (field === 'priority') {
      return ['Low', 'Medium', 'High', 'Critical'];
    }
    if (field === 'role' && dataSource === 'users') {
      return ['admin', 'citizen'];
    }
    if (field === 'availabilityStatus' && dataSource === 'users') {
      return ['Available', 'Busy', 'On Leave', 'Unavailable'];
    }
    if (field === 'isEscalated' || field === 'isDuplicate' || field === 'attentionRequired') {
      return ['true', 'false'];
    }
    if (field === 'categoryName') {
      return (categories || []).map(c => c.name);
    }
    if (field === 'department' || field === 'departmentId' || field === 'assignedDepartment') {
      return (departments || []).map(d => d.name);
    }
    return null;
  };

  const fields = getFieldsForDataSource();

  return (
    <div className="builder-modal-overlay">
      <form onSubmit={handleSubmit} className="builder-modal" onClick={e => e.stopPropagation()}>
        <div className="builder-modal-header">
          <h3 className="builder-modal-title">{editingWidget ? 'Edit Dashboard Widget' : 'Add Custom Dashboard Widget'}</h3>
          <button type="button" onClick={onClose} className="widget-action-btn">
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="builder-modal-body">
          <div className="builder-form-group">
            <label className="builder-label">Widget Title</label>
            <input 
              type="text" 
              className="form-control" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="e.g. Incidents by Category" 
              required 
            />
          </div>

          <div className="builder-form-row">
            <div className="builder-form-group">
              <label className="builder-label">Data Source</label>
              <select className="form-control" value={dataSource} onChange={e => setDataSource(e.target.value)}>
                <option value="tickets">Tickets (Complaints)</option>
                <option value="assets">Assets</option>
                <option value="users">System Users</option>
                <option value="serviceRequests">Service Requests</option>
              </select>
            </div>

            <div className="builder-form-group">
              <label className="builder-label">Widget Type</label>
              <select className="form-control" value={type} onChange={e => setType(e.target.value)}>
                <option value="chart">Data Visualization Chart</option>
                <option value="metric">Single Metric Summary Card</option>
                <option value="table">Data Table / Queue List</option>
              </select>
            </div>
          </div>

          <div className="builder-form-row">
            <div className="builder-form-group">
              <label className="builder-label">Widget Width (Column Span)</label>
              <select className="form-control" value={width} onChange={e => setWidth(e.target.value)}>
                <option value="3">1/4 Width (3 cols)</option>
                <option value="4">1/3 Width (4 cols)</option>
                <option value="6">Half Width (6 cols)</option>
                <option value="8">2/3 Width (8 cols)</option>
                <option value="12">Full Width (12 cols)</option>
              </select>
            </div>

            <div className="builder-form-group" style={{ justifyContent: 'center', paddingTop: '16px' }}>
              <label className="db-customizer-label">
                <input 
                  type="checkbox" 
                  checked={respectGlobalFilters} 
                  onChange={e => setRespectGlobalFilters(e.target.checked)} 
                />
                <span>Respect global date & dept filters</span>
              </label>
            </div>

            <div className="builder-form-group" style={{ justifyContent: 'center', paddingTop: '16px' }}>
              <label className="db-customizer-label">
                <input 
                  type="checkbox" 
                  checked={saveToLibrary} 
                  onChange={e => setSaveToLibrary(e.target.checked)} 
                />
                <span>Save this widget to my Library</span>
              </label>
            </div>
          </div>

          {/* Type Specific Forms */}
          {type === 'chart' && (
            <div className="builder-form-row">
              <div className="builder-form-group">
                <label className="builder-label">Chart Type</label>
                <select className="form-control" value={chartType} onChange={e => setChartType(e.target.value)}>
                  <option value="bar">Bar Chart (Vertical)</option>
                  <option value="line">Line Chart (Trends)</option>
                  <option value="doughnut">Doughnut Chart (Proportions)</option>
                  <option value="pie">Pie Chart (Shares)</option>
                  <option value="polarArea">Polar Area Chart</option>
                  <option value="radar">Radar Chart</option>
                </select>
              </div>

              <div className="builder-form-group">
                <label className="builder-label">Group By Field</label>
                <select className="form-control" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                  {fields.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                  {dataSource === 'tickets' && <option value="assignedTo">Assigned Officer</option>}
                </select>
              </div>
            </div>
          )}

          {type === 'chart' && (groupBy === 'createdAt' || groupBy?.endsWith('At') || groupBy?.endsWith('Date')) && (
            <div className="builder-form-group" style={{ marginTop: '-8px' }}>
              <label className="db-customizer-label">
                <input 
                  type="checkbox" 
                  checked={groupByMonth} 
                  onChange={e => setGroupByMonth(e.target.checked)} 
                />
                <span>Group date values month-wise (and sort chronologically)</span>
              </label>
            </div>
          )}

          {type === 'metric' && (
            <div className="builder-form-row">
              <div className="builder-form-group">
                <label className="builder-label">Calculation Mode</label>
                <select className="form-control" value={aggregation} onChange={e => setAggregation(e.target.value)}>
                  <option value="count">Record Count (Volume)</option>
                  <option value="sum">Sum values of field</option>
                  <option value="avg">Average values of field</option>
                </select>
              </div>

              {aggregation !== 'count' && (
                <div className="builder-form-group">
                  <label className="builder-label">Target Field (Numeric)</label>
                  <select className="form-control" value={targetField} onChange={e => setTargetField(e.target.value)}>
                    <option value="">-- Select Field --</option>
                    {dataSource === 'tickets' && (
                      <>
                        <option value="riskScore">Risk Score</option>
                        <option value="totalBreachCount">SLA Breach Count</option>
                        <option value="duplicateCount">Duplicates prevention count</option>
                      </>
                    )}
                    {dataSource === 'users' && (
                      <>
                        <option value="maxCapacity">Max Capacity</option>
                        <option value="capacityPercentage">Current Capacity %</option>
                      </>
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          {type === 'metric' && (
            <div className="builder-form-row">
              <div className="builder-form-group">
                <label className="builder-label">Visual Icon</label>
                <select className="form-control" value={icon} onChange={e => setIcon(e.target.value)}>
                  <option value="FileText">FileText (Doc)</option>
                  <option value="AlertTriangle">AlertTriangle (Warning)</option>
                  <option value="Clock">Clock (Pending/Due)</option>
                  <option value="CheckCircle">CheckCircle (Completed)</option>
                  <option value="TrendingUp">TrendingUp (Analytics)</option>
                  <option value="Users">Users (Staff/Customers)</option>
                  <option value="Layers">Layers (Duplicates)</option>
                  <option value="Activity">Activity (Performance)</option>
                </select>
              </div>

              <div className="builder-form-group">
                <label className="builder-label">Color Card Theme</label>
                <select className="form-control" value={colorClass} onChange={e => setColorClass(e.target.value)}>
                  <option value="bg-indigo-glow">Sleek Indigo Glow</option>
                  <option value="bg-emerald-glow">Vibrant Emerald Green</option>
                  <option value="bg-amber-glow">Warning Amber Yellow</option>
                  <option value="bg-rose-glow">Critical Rose Red</option>
                  <option value="bg-cyan-glow">Cool Cyan Blue</option>
                  <option value="bg-purple-glow">Amethyst Purple Glow</option>
                </select>
              </div>
            </div>
          )}

          {type === 'table' && (
            <div className="builder-form-row">
              <div className="builder-form-group">
                <label className="builder-label">Max Row Count</label>
                <select className="form-control" value={limit} onChange={e => setLimit(Number(e.target.value))}>
                  <option value="3">Top 3 Rows</option>
                  <option value="5">Top 5 Rows</option>
                  <option value="10">Top 10 Rows</option>
                  <option value="15">Top 15 Rows</option>
                </select>
              </div>

              <div className="builder-form-group">
                <label className="builder-label">Sort Field</label>
                <select className="form-control" value={sortField} onChange={e => setSortField(e.target.value)}>
                  {fields.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {type === 'table' && (
            <div className="builder-form-group">
              <label className="builder-label">Sort Order Direction</label>
              <select className="form-control" value={sortDirection} onChange={e => setSortDirection(e.target.value)}>
                <option value="desc">Descending (High to Low / Newest First)</option>
                <option value="asc">Ascending (Low to High / Oldest First)</option>
              </select>
            </div>
          )}

          {/* Filters List */}
          <div className="builder-form-group">
            <label className="builder-label">Widget Data Filters ({filters.length})</label>
            <div className="filters-builder-container">
              {filters.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No local filters added. This widget will load all records.
                </div>
              ) : (
                filters.map((f, i) => {
                  const choices = getChoicesForField(f.field);
                  return (
                    <div key={i} className="filter-rule-row">
                      <select 
                        className="form-control" 
                        value={f.field} 
                        onChange={e => {
                          const fld = e.target.value;
                          const chcs = getChoicesForField(fld);
                          handleFilterChange(i, {
                            field: fld,
                            value: chcs && chcs.length > 0 ? chcs[0] : ''
                          });
                        }}
                        style={{ height: '36px', fontSize: '12.5px' }}
                      >
                        {fields.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>

                      <select 
                        className="form-control" 
                        value={f.operator} 
                        onChange={e => handleFilterChange(i, 'operator', e.target.value)}
                        style={{ height: '36px', fontSize: '12.5px' }}
                      >
                        <option value="equals">Equals</option>
                        <option value="not_equals">Does Not Equal</option>
                        <option value="contains">Contains</option>
                        <option value="starts_with">Starts With</option>
                        <option value="greater_than">Greater Than (&gt;)</option>
                        <option value="less_than">Less Than (&lt;)</option>
                        <option value="exists">Is Populated (Exists)</option>
                      </select>

                      {f.operator !== 'exists' && (
                        (choices && choices.length > 0) ? (
                          <select
                            className="form-control"
                            value={f.value}
                            onChange={e => handleFilterChange(i, 'value', e.target.value)}
                            style={{ height: '36px', fontSize: '12.5px' }}
                          >
                            <option value="">-- Choose Option --</option>
                            {choices.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : (
                          <input 
                            type="text" 
                            className="form-control"
                            value={f.value}
                            onChange={e => handleFilterChange(i, 'value', e.target.value)}
                            placeholder="value..."
                            style={{ height: '36px', fontSize: '12.5px' }}
                          />
                        )
                      )}

                      {f.operator === 'exists' && <div />}

                      <button 
                        type="button" 
                        onClick={() => handleRemoveFilter(i)} 
                        className="widget-action-btn delete"
                        style={{ color: '#ef4444' }}
                      >
                        <LucideIcons.Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}

              <button type="button" onClick={handleAddFilter} className="filter-add-btn">
                <LucideIcons.Plus size={12} />
                <span>Add Filter Condition</span>
              </button>
            </div>
          </div>
        </div>

        <div className="builder-modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary">Save Widget</button>
        </div>
      </form>
    </div>
  );
};

// ==========================================
// CONFIGURABLE WIDGET LIBRARY MODAL DIALOG
// ==========================================
const WidgetLibraryModal = ({ isOpen, onClose, savedWidgets, onAddWidget, onDeleteFromLibrary, activeWidgets }) => {
  const [activeTab, setActiveTab] = React.useState('system'); // 'system' or 'saved'
  const [searchQuery, setSearchQuery] = React.useState('');

  if (!isOpen) return null;

  // System preset templates
  const systemPresets = [
    {
      id: 'template-status-breakdown',
      title: 'Status Breakdown',
      type: 'chart',
      chartType: 'bar',
      dataSource: 'tickets',
      groupBy: 'status',
      width: '6',
      respectGlobalFilters: true,
      filters: [],
      description: 'A bar chart displaying tickets grouped by their current workflow status (e.g. Pending, Investigating).'
    },
    {
      id: 'template-category-volume',
      title: 'Category Volume',
      type: 'chart',
      chartType: 'doughnut',
      dataSource: 'tickets',
      groupBy: 'categoryName',
      width: '6',
      respectGlobalFilters: true,
      filters: [],
      description: 'A doughnut chart displaying the distribution of tickets across different categories.'
    },
    {
      id: 'template-sla-breaches-metric',
      title: 'Active SLA Breaches',
      type: 'metric',
      dataSource: 'tickets',
      aggregation: 'count',
      icon: 'AlertTriangle',
      colorClass: 'bg-rose-glow',
      width: '3',
      respectGlobalFilters: true,
      filters: [
        { field: 'status', operator: 'not_equals', value: 'Resolved' },
        { field: 'status', operator: 'not_equals', value: 'Closed' },
        { field: 'status', operator: 'not_equals', value: 'Rejected' },
        { field: 'totalBreachCount', operator: 'greater_than', value: '0' }
      ],
      description: 'A metric card showing the number of active (non-closed) tickets with one or more SLA breaches.'
    },
    {
      id: 'template-prevented-duplicates-metric',
      title: 'Duplicates Prevented',
      type: 'metric',
      dataSource: 'tickets',
      aggregation: 'sum',
      targetField: 'duplicateCount',
      icon: 'Layers',
      colorClass: 'bg-indigo-glow',
      width: '3',
      respectGlobalFilters: true,
      filters: [],
      description: 'A metric card showing the total count of duplicate tickets flagged and merged.'
    },
    {
      id: 'template-staff-load',
      title: 'Officer Workload (Active Tickets)',
      type: 'chart',
      chartType: 'bar',
      dataSource: 'tickets',
      groupBy: 'assignedTo',
      width: '6',
      respectGlobalFilters: true,
      filters: [
        { field: 'status', operator: 'not_equals', value: 'Resolved' },
        { field: 'status', operator: 'not_equals', value: 'Closed' },
        { field: 'status', operator: 'not_equals', value: 'Rejected' }
      ],
      description: 'A bar chart displaying the number of active tickets currently assigned to each staff officer.'
    },
    {
      id: 'template-critical-table',
      title: 'Critical Tickets Queue',
      type: 'table',
      dataSource: 'tickets',
      limit: 5,
      sortField: 'createdAt',
      sortDirection: 'desc',
      width: '6',
      respectGlobalFilters: true,
      filters: [
        { field: 'priority', operator: 'equals', value: 'Critical' }
      ],
      description: 'A list table displaying the most recent tickets flagged with Critical priority.'
    }
  ];

  const items = activeTab === 'system' ? systemPresets : savedWidgets;

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    item.dataSource.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="builder-modal-overlay" onClick={onClose}>
      <div className="builder-modal library-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
        <div className="builder-modal-header">
          <h3 className="builder-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LucideIcons.Bookmark size={20} style={{ color: 'var(--accent-color)' }} />
            <span>Widget Library</span>
          </h3>
          <button type="button" onClick={onClose} className="widget-action-btn">
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="library-tabs-row" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 24px', gap: '20px' }}>
          <button 
            type="button"
            className={`library-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => { setActiveTab('system'); setSearchQuery(''); }}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'system' ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: activeTab === 'system' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            System Templates
          </button>
          <button 
            type="button"
            className={`library-tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => { setActiveTab('saved'); setSearchQuery(''); }}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'saved' ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: activeTab === 'saved' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            My Saved Widgets ({savedWidgets.length})
          </button>
        </div>

        <div className="builder-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '20px 24px' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
              <LucideIcons.Search size={15} />
            </span>
            <input 
              type="text" 
              className="form-control"
              placeholder="Search widgets by title, type, or data source..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
            />
          </div>

          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <LucideIcons.Inbox size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
                {searchQuery ? 'No widgets match your search.' : activeTab === 'system' ? 'No system templates available.' : 'Your library is empty.'}
              </p>
              {!searchQuery && activeTab === 'saved' && (
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', opacity: 0.8 }}>
                  Click the bookmark icon on any customized widget card on your dashboard to save it here.
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {filteredItems.map((item) => {
                // Determine if already present on active dashboard
                const isAdded = activeWidgets.some(w => 
                  w.title.toLowerCase() === item.title.toLowerCase() &&
                  w.type === item.type &&
                  w.dataSource === item.dataSource
                );

                return (
                  <div 
                    key={item.id} 
                    className="widget-library-card"
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-md)',
                      padding: '16px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.title}
                        </h4>
                        <span 
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: item.type === 'chart' ? 'rgba(99, 102, 241, 0.15)' : item.type === 'metric' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: item.type === 'chart' ? '#818cf8' : item.type === 'metric' ? '#34d399' : '#fbbf24',
                            textTransform: 'capitalize'
                          }}
                        >
                          {item.type}
                        </span>
                      </div>

                      <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {item.description || `Custom configured ${item.type} widget analyzing ${item.dataSource} data.`}
                      </p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                          Source: {item.dataSource}
                        </span>
                        {item.groupBy && (
                          <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                            Group By: {item.groupBy}
                          </span>
                        )}
                        {item.filters && item.filters.length > 0 && (
                          <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent-color)' }}>
                            {item.filters.length} Filter{item.filters.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: '8px' }}>
                      {activeTab === 'saved' ? (
                        <button 
                          type="button" 
                          onClick={() => onDeleteFromLibrary(item.id)}
                          className="btn btn-secondary"
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            color: '#ef4444',
                            borderColor: 'rgba(239, 68, 68, 0.2)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            height: '32px'
                          }}
                          title="Remove from Library"
                        >
                          <LucideIcons.Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      ) : <div />}

                      <button 
                        type="button" 
                        onClick={() => onAddWidget(item)}
                        className={`btn ${isAdded ? 'btn-secondary' : 'btn-primary'}`}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          height: '32px',
                          marginLeft: 'auto'
                        }}
                      >
                        {isAdded ? (
                          <>
                            <LucideIcons.Check size={13} style={{ color: '#10b981' }} />
                            <span>Add Copy</span>
                          </>
                        ) : (
                          <>
                            <LucideIcons.Plus size={13} />
                            <span>Add to Dashboard</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="builder-modal-footer" style={{ padding: '16px 24px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">Close Library</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// COMPLAINTS LIST MODAL DIALOG
// ==========================================
const ComplaintsListModal = ({ isOpen, onClose, filterTitle, complaints, navigate }) => {
  if (!isOpen) return null;

  return (
    <div className="builder-modal-overlay" onClick={onClose}>
      <div 
        className="builder-modal" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '850px', width: '95%', maxHeight: '85vh' }}
      >
        <div className="builder-modal-header">
          <h3 className="builder-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Inbox size={18} style={{ color: 'var(--accent-color)' }} />
            <span>{filterTitle} ({complaints?.length || 0})</span>
          </h3>
          <button type="button" onClick={onClose} className="widget-action-btn" title="Close Dialog">
            <LucideIcons.X size={16} />
          </button>
        </div>

        <div className="builder-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '20px 24px' }}>
          {complaints && complaints.length > 0 ? (
            <div className="table-widget-container" style={{ overflowX: 'auto' }}>
              <table className="table-widget-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map(t => (
                    <tr 
                      key={t._id || t.id} 
                      onClick={() => {
                        navigate(`/complaints/${t._id || t.id}`);
                        onClose();
                      }} 
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 650, textDecoration: 'underline', color: 'var(--accent-color)' }}>
                        {t.title}
                      </td>
                      <td>{t.categoryName || t.category?.name || 'General'}</td>
                      <td>
                        <span className="badge" style={{
                          backgroundColor: t.priority === 'Critical' || t.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                          color: t.priority === 'Critical' || t.priority === 'High' ? '#ef4444' : 'var(--text-secondary)'
                        }}>{t.priority}</span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          backgroundColor: t.status === 'Resolved' || t.status === 'Closed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: t.status === 'Resolved' || t.status === 'Closed' ? '#10b981' : '#f59e0b'
                        }}>{t.status}</span>
                      </td>
                      <td>{t.assignedTo?.name || t.assignedTo || 'Unassigned'}</td>
                      <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="db-table-empty" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              No complaints found matching this criteria.
            </div>
          )}
        </div>

        <div className="builder-modal-footer" style={{ padding: '16px 24px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

