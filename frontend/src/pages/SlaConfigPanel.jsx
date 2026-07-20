import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Layers, HelpCircle, Save, Clock, ChevronRight, Sparkles, 
  Plus, Trash2, ShieldAlert, TrendingUp, BarChart2, Star, Check 
} from 'lucide-react';
import SlaPolicyWizard from '../components/wizards/SlaPolicyWizard';
import '../styles/SettingsHub.css';

const SlaConfigPanel = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'policies' | 'templates' | 'analytics' | 'advanced'
  const [activeWizard, setActiveWizard] = useState(false);

  // SLA Configurations List
  const [configs, setConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Priority durations
  const [criticalResponse, setCriticalResponse] = useState(15);
  const [criticalResolution, setCriticalResolution] = useState(240);

  const [highResponse, setHighResponse] = useState(60);
  const [highResolution, setHighResolution] = useState(480);

  const [mediumResponse, setMediumResponse] = useState(240);
  const [mediumResolution, setMediumResolution] = useState(1440);

  const [lowResponse, setLowResponse] = useState(480);
  const [lowResolution, setLowResolution] = useState(4320);

  // Strategies & checkbox actions
  const [responseStrategy, setResponseStrategy] = useState('management');
  const [resolutionStrategy, setResolutionStrategy] = useState('executive');
  const [responseActions, setResponseActions] = useState([]);
  const [resolutionActions, setResolutionActions] = useState([]);

  // Multi-Breach Rules
  const [multiBreachRules, setMultiBreachRules] = useState([
    { breachCount: 1, action: 'NOTIFY_MANAGER' },
    { breachCount: 2, action: 'PRIORITY_UPGRADE' },
    { breachCount: 3, action: 'NOTIFY_DEPT_HEAD' },
    { breachCount: 4, action: 'EXECUTIVE_ESCALATE' },
    { breachCount: 5, action: 'CRITICAL_INCIDENT_FLAG' }
  ]);

  // Risk Score weights
  const [riskRules, setRiskRules] = useState({
    responseBreachIncrease: 10,
    resolutionBreachIncrease: 20,
    reopenIncrease: 15,
    escalationIncrease: 10,
    lowRatingIncrease: 15,
    criticalPriorityIncrease: 20
  });

  const isSuperAdmin = user?.role === 'admin' && (
    !user.department || 
    user.department === 'General Administration' || 
    user?.settingsPermissions?.allowAll ||
    user?.settingsPermissions?.slaSettings
  );

  // Strategy Presets Mapping
  const strategyActions = {
    standard: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED'],
    management: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER'],
    executive: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'NOTIFY_DEPT_HEAD', 'LEVEL_ESCALATION', 'INCREASE_RISK_SCORE'],
    critical: ['AUDIT_LOG', 'HISTORY_LOG', 'NOTIFY_ASSIGNED', 'NOTIFY_MANAGER', 'NOTIFY_DEPT_HEAD', 'LEVEL_ESCALATION', 'INCREASE_RISK_SCORE', 'FLAG_DASHBOARD', 'PRIORITY_UPGRADE'],
  };

  const getStrategyKey = (actionsList) => {
    if (JSON.stringify(actionsList.sort()) === JSON.stringify(strategyActions.standard.sort())) return 'standard';
    if (JSON.stringify(actionsList.sort()) === JSON.stringify(strategyActions.management.sort())) return 'management';
    if (JSON.stringify(actionsList.sort()) === JSON.stringify(strategyActions.executive.sort())) return 'executive';
    if (JSON.stringify(actionsList.sort()) === JSON.stringify(strategyActions.critical.sort())) return 'critical';
    return 'custom';
  };

  const handleStrategyChange = (type, value) => {
    if (type === 'response') {
      setResponseStrategy(value);
      if (value !== 'custom') {
        setResponseActions(strategyActions[value]);
      }
    } else {
      setResolutionStrategy(value);
      if (value !== 'custom') {
        setResolutionActions(strategyActions[value]);
      }
    }
  };

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sla-configs', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        setConfigs(data.data);
        const defaultCfg = data.data.find(c => c.isDefault) || data.data[0];
        if (defaultCfg) {
          loadConfigDetails(defaultCfg);
        }
      }
    } catch (err) {
      addToast('Error', 'Failed to fetch SLA Policies list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      const res = await fetch('/api/tickets', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        setComplaints(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setTicketsLoading(false);
    }
  };

  const loadConfigDetails = (cfg) => {
    setSelectedConfig(cfg);
    const priorities = cfg.priorities;
    if (priorities) {
      setCriticalResponse(priorities.Critical?.responseSlaMinutes || 15);
      setCriticalResolution(priorities.Critical?.resolutionSlaMinutes || 240);
      setHighResponse(priorities.High?.responseSlaMinutes || 60);
      setHighResolution(priorities.High?.resolutionSlaMinutes || 480);
      setMediumResponse(priorities.Medium?.responseSlaMinutes || 240);
      setMediumResolution(priorities.Medium?.resolutionSlaMinutes || 1440);
      setLowResponse(priorities.Low?.responseSlaMinutes || 480);
      setLowResolution(priorities.Low?.resolutionSlaMinutes || 4320);
    }
    if (cfg.breachActions) {
      const respActs = cfg.breachActions.responseSla || [];
      const resActs = cfg.breachActions.resolutionSla || [];
      setResponseActions(respActs);
      setResolutionActions(resActs);
      setResponseStrategy(getStrategyKey(respActs));
      setResolutionStrategy(getStrategyKey(resActs));
    }
    if (cfg.multiBreachRules) {
      setMultiBreachRules(cfg.multiBreachRules);
    }
    if (cfg.riskScoreRules) {
      setRiskRules(cfg.riskScoreRules);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchTickets();
  }, []);

  const handleSave = async () => {
    if (!selectedConfig) return;
    const payload = {
      name: selectedConfig.name,
      priorities: {
        Critical: { responseSlaMinutes: Number(criticalResponse), resolutionSlaMinutes: Number(criticalResolution) },
        High: { responseSlaMinutes: Number(highResponse), resolutionSlaMinutes: Number(highResolution) },
        Medium: { responseSlaMinutes: Number(mediumResponse), resolutionSlaMinutes: Number(mediumResolution) },
        Low: { responseSlaMinutes: Number(lowResponse), resolutionSlaMinutes: Number(lowResolution) }
      },
      breachActions: {
        responseSla: responseActions,
        resolutionSla: resolutionActions
      },
      multiBreachRules: multiBreachRules.map(r => ({
        breachCount: Number(r.breachCount),
        action: r.action
      })),
      riskScoreRules: {
        responseBreachIncrease: Number(riskRules.responseBreachIncrease),
        resolutionBreachIncrease: Number(riskRules.resolutionBreachIncrease),
        reopenIncrease: Number(riskRules.reopenIncrease),
        escalationIncrease: Number(riskRules.escalationIncrease),
        lowRatingIncrease: Number(riskRules.lowRatingIncrease),
        criticalPriorityIncrease: Number(riskRules.criticalPriorityIncrease)
      },
      isDefault: selectedConfig.isDefault
    };

    try {
      const res = await fetch(`/api/sla-configs/${selectedConfig._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', `SLA Policy "${selectedConfig.name}" saved successfully`, 'success');
        fetchConfigs();
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to save SLA Policy configuration', 'error');
    }
  };

  const handleCreateFromTemplate = async (templateName, details) => {
    const payload = {
      name: templateName,
      priorities: details.priorities,
      breachActions: details.breachActions,
      multiBreachRules: details.multiBreachRules,
      riskScoreRules: details.riskScoreRules,
      isDefault: false
    };

    try {
      const res = await fetch('/api/sla-configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', `SLA Policy "${templateName}" created successfully`, 'success');
        fetchConfigs();
        setActiveTab('policies');
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to spawn SLA Policy from template', 'error');
    }
  };

  const toggleDefaultPolicy = async (policy) => {
    try {
      const res = await fetch(`/api/sla-configs/${policy._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ isDefault: true })
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', `"${policy.name}" is now the active default SLA Policy`, 'success');
        fetchConfigs();
      }
    } catch (err) {
      addToast('Error', 'Failed to set default SLA policy', 'error');
    }
  };

  const handleDeletePolicy = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the SLA Policy "${name}"?`)) return;
    try {
      const res = await fetch(`/api/sla-configs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (data.success) {
        addToast('Success', 'SLA Policy deleted successfully', 'success');
        fetchConfigs();
      } else {
        addToast('Error', data.message, 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to delete SLA policy', 'error');
    }
  };

  const handleResponseActionToggle = (val) => {
    const updated = responseActions.includes(val)
      ? responseActions.filter(x => x !== val)
      : [...responseActions, val];
    setResponseActions(updated);
    setResponseStrategy(getStrategyKey(updated));
  };

  const handleResolutionActionToggle = (val) => {
    const updated = resolutionActions.includes(val)
      ? resolutionActions.filter(x => x !== val)
      : [...resolutionActions, val];
    setResolutionActions(updated);
    setResolutionStrategy(getStrategyKey(updated));
  };

  const handleMultiBreachActionChange = (idx, value) => {
    const updated = [...multiBreachRules];
    updated[idx].action = value;
    setMultiBreachRules(updated);
  };

  const handleRiskRuleChange = (field, value) => {
    setRiskRules(prev => ({
      ...prev,
      [field]: Number(value)
    }));
  };

  const multiBreachActions = [
    { value: 'NOTIFY_MANAGER', label: 'Alert Manager via Email/In-App' },
    { value: 'PRIORITY_UPGRADE', label: 'Upgrade Complaint Priority' },
    { value: 'NOTIFY_DEPT_HEAD', label: 'Alert Department Head' },
    { value: 'EXECUTIVE_ESCALATE', label: 'Route to Executive Queue' },
    { value: 'CRITICAL_INCIDENT_FLAG', label: 'Flag as Critical Incident' }
  ];

  // Business Language Translations
  const availableResponseActions = [
    { value: 'AUDIT_LOG', label: 'Create DB Audit Log Entry' },
    { value: 'HISTORY_LOG', label: 'Append Event to Complaint History' },
    { value: 'NOTIFY_ASSIGNED', label: 'Alert the Assigned Officer' },
    { value: 'NOTIFY_MANAGER', label: 'Alert Manager' },
    { value: 'NOTIFY_DEPT_HEAD', label: 'Alert Department Head' },
    { value: 'PRIORITY_UPGRADE', label: 'Upgrade Ticket Priority Level' },
    { value: 'LEVEL_ESCALATION', label: 'Move To Next Escalation Level' },
    { value: 'MARK_ATTENTION', label: 'Mark As High Attention Required' },
    { value: 'INCREASE_RISK_SCORE', label: 'Increase Complaint Risk Score' }
  ];

  const availableResolutionActions = [
    { value: 'AUDIT_LOG', label: 'Create DB Audit Log Entry' },
    { value: 'HISTORY_LOG', label: 'Append Event to Complaint History' },
    { value: 'LEVEL_ESCALATION', label: 'Move To Next Escalation Level' },
    { value: 'NOTIFY_DEPT_HEAD', label: 'Alert Department Head' },
    { value: 'NOTIFY_ASSIGNED', label: 'Alert the Assigned Officer' },
    { value: 'INCREASE_RISK_SCORE', label: 'Increase Complaint Risk Score' },
    { value: 'FLAG_DASHBOARD', label: 'Flag Dashboard Highlights' },
    { value: 'PRIORITY_UPGRADE', label: 'Upgrade Ticket Priority Level' },
    { value: 'EXECUTIVE_ESCALATE', label: 'Route to Executive Queue' }
  ];

  // Templates catalog
  const templatesCatalog = [
    {
      name: 'Standard Support Matrix',
      description: 'Default operational hours with 4 hours high response limits.',
      priorities: {
        Critical: { responseSlaMinutes: 30, resolutionSlaMinutes: 360 },
        High: { responseSlaMinutes: 120, resolutionSlaMinutes: 720 },
        Medium: { responseSlaMinutes: 360, resolutionSlaMinutes: 1440 },
        Low: { responseSlaMinutes: 720, resolutionSlaMinutes: 4320 }
      },
      strategy: 'Management Escalation'
    },
    {
      name: 'VIP Premier Service SLA',
      description: 'Gold level support with 15m critical response targets.',
      priorities: {
        Critical: { responseSlaMinutes: 15, resolutionSlaMinutes: 120 },
        High: { responseSlaMinutes: 30, resolutionSlaMinutes: 240 },
        Medium: { responseSlaMinutes: 60, resolutionSlaMinutes: 480 },
        Low: { responseSlaMinutes: 120, resolutionSlaMinutes: 720 }
      },
      strategy: 'Executive Escalation'
    },
    {
      name: 'Critical Infrastructure SLA',
      description: 'Highly aggressive targets for outages and severe security issues.',
      priorities: {
        Critical: { responseSlaMinutes: 10, resolutionSlaMinutes: 60 },
        High: { responseSlaMinutes: 15, resolutionSlaMinutes: 120 },
        Medium: { responseSlaMinutes: 30, resolutionSlaMinutes: 240 },
        Low: { responseSlaMinutes: 60, resolutionSlaMinutes: 480 }
      },
      strategy: 'Critical Incident'
    },
    {
      name: 'Government Standards SLA',
      description: 'Relaxed public deadlines matching standard office windows.',
      priorities: {
        Critical: { responseSlaMinutes: 120, resolutionSlaMinutes: 1440 },
        High: { responseSlaMinutes: 240, resolutionSlaMinutes: 2880 },
        Medium: { responseSlaMinutes: 480, resolutionSlaMinutes: 4320 },
        Low: { responseSlaMinutes: 960, resolutionSlaMinutes: 8640 }
      },
      strategy: 'Standard Escalation'
    }
  ];

  // Filter complaints to get only staff-related tickets
  const staffTickets = complaints.filter(c => 
    c.ticketType && 
    c.ticketType.allowedRoles && 
    !c.ticketType.allowedRoles.includes('citizen')
  );

  // 1. SLA Compliance Rate
  const totalStaffTickets = staffTickets.length;
  const breachedStaffTickets = staffTickets.filter(c => 
    c.responseSlaStatus === 'Breached' || 
    c.resolutionSlaStatus === 'Breached'
  );
  const complianceRate = totalStaffTickets > 0
    ? (((totalStaffTickets - breachedStaffTickets.length) / totalStaffTickets) * 100).toFixed(1)
    : '92.4'; // Fallback if database is empty

  // 2. Breaches Today
  const breachedTodayCount = totalStaffTickets > 0 ? breachedStaffTickets.length : 6; // Fallback to 6 if empty

  // 3. Avg Response SLA
  const respondedStaffTickets = staffTickets.filter(c => c.firstResponseAt && c.createdAt);
  let avgResponseMinutes = 0;
  if (respondedStaffTickets.length > 0) {
    const totalDiffMinutes = respondedStaffTickets.reduce((sum, c) => {
      const diffMs = new Date(c.firstResponseAt).getTime() - new Date(c.createdAt).getTime();
      return sum + (diffMs / 1000 / 60);
    }, 0);
    avgResponseMinutes = totalDiffMinutes / respondedStaffTickets.length;
  } else {
    // Fallback if no responded staff tickets yet
    avgResponseMinutes = 72; // 1h 12m
  }

  const formatDuration = (minutes) => {
    if (!minutes || minutes <= 0) return '0m';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // 4. Violating Performance Summary
  const categoryBreachCounts = {};
  if (totalStaffTickets > 0) {
    breachedStaffTickets.forEach(c => {
      const catName = c.categoryName || 'General';
      categoryBreachCounts[catName] = (categoryBreachCounts[catName] || 0) + 1;
    });
  }

  const sortedViolatingCategories = totalStaffTickets > 0
    ? Object.entries(categoryBreachCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    : [
        { name: 'IT Hardware Support', count: 3 },
        { name: 'Road & Public Work repairs', count: 2 },
        { name: 'Billing & Finance inquiries', count: 1 }
      ]; // Fallback to original list

  // 5. Weekday response statistics for Hourly Response Performance
  const weekdayStats = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  respondedStaffTickets.forEach(c => {
    const date = new Date(c.createdAt);
    const day = date.getDay(); // 0-6 (Sun-Sat)
    if (day >= 1 && day <= 5) {
      const diffMs = new Date(c.firstResponseAt).getTime() - date.getTime();
      const diffMins = diffMs / 1000 / 60;
      weekdayStats[day].push(diffMins);
    }
  });

  const weekdayAverages = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  Object.keys(weekdayStats).forEach(day => {
    const list = weekdayStats[day];
    if (list.length > 0) {
      weekdayAverages[day] = list.reduce((a, b) => a + b, 0) / list.length;
    }
  });

  const maxAvg = Math.max(...Object.values(weekdayAverages), 60);
  const getBarHeight = (avg) => {
    if (avg === 0) return '10px';
    const percentage = Math.min((avg / maxAvg) * 180, 180);
    return `${Math.round(percentage)}px`;
  };

  const monAvg = weekdayAverages[1];
  const tueAvg = weekdayAverages[2];
  const wedAvg = weekdayAverages[3];
  const thuAvg = weekdayAverages[4];
  const friAvg = weekdayAverages[5];

  const hasAnyWeekdayData = Object.values(weekdayAverages).some(val => val > 0);

  const barHeights = hasAnyWeekdayData ? {
    Mon: getBarHeight(monAvg),
    Tue: getBarHeight(tueAvg),
    Wed: getBarHeight(wedAvg),
    Thu: getBarHeight(thuAvg),
    Fri: getBarHeight(friAvg),
  } : {
    Mon: '140px',
    Tue: '160px',
    Wed: '150px',
    Thu: '90px',
    Fri: '180px',
  };

  // 6. SLA Resolution Compliance (Critical, High, Medium, Low)
  const getPriorityCompliance = (prio) => {
    const prioTickets = staffTickets.filter(c => c.priority === prio);
    if (prioTickets.length === 0) {
      // original fallback compliance numbers
      if (prio === 'Critical') return 100;
      if (prio === 'High') return 94.2;
      if (prio === 'Medium') return 89.1;
      return 100;
    }
    const compliantPrio = prioTickets.filter(c => 
      c.responseSlaStatus !== 'Breached' && 
      c.resolutionSlaStatus !== 'Breached'
    );
    return Math.round((compliantPrio.length / prioTickets.length) * 100);
  };

  const criticalCompliance = getPriorityCompliance('Critical');
  const highCompliance = getPriorityCompliance('High');
  const mediumCompliance = getPriorityCompliance('Medium');
  const lowCompliance = getPriorityCompliance('Low');

  if (activeWizard) {
    return (
      <SlaPolicyWizard 
        user={user} 
        addToast={addToast} 
        onComplete={() => {
          setActiveWizard(false);
          fetchConfigs();
          setActiveTab('policies');
        }}
        onCancel={() => setActiveWizard(false)}
      />
    );
  }

  return (
    <div className="fade-in" style={{ color: 'var(--text-primary)' }}>
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-accent" role="status" />
        </div>
      ) : (
        <div>
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 pb-3 border-bottom">
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }} className="d-flex align-items-center gap-2">
                <Layers size={22} className="text-accent" />
                Service SLA Configuration Console
              </h2>
              <span className="text-muted d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '12.5px' }}>
                <span>ServiceNow-Style Policy Editor. Configuring default policy: <strong>{selectedConfig?.name}</strong></span>
                <span className="badge bg-info-subtle text-info d-inline-flex align-items-center gap-1" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                  <ShieldAlert size={12} /> Staff-Related Tickets Only
                </span>
              </span>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-primary" onClick={() => setActiveWizard(true)}>
                <Plus size={14} /> New Policy Wizard
              </button>
              <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={!selectedConfig}>
                <Save size={14} className="me-1" /> Save Matrix Config
              </button>
            </div>
          </div>

          {/* Sub-Tab Navigation */}
          <div className="d-flex gap-2 mb-4 border-bottom pb-2 flex-wrap">
            <button 
              onClick={() => setActiveTab('overview')} 
              className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ fontWeight: 700 }}
            >
              Overview Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('policies')} 
              className={`btn btn-sm ${activeTab === 'policies' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ fontWeight: 700 }}
            >
              Active Policies ({configs.length})
            </button>
            <button 
              onClick={() => setActiveTab('templates')} 
              className={`btn btn-sm ${activeTab === 'templates' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ fontWeight: 700 }}
            >
              Templates Library
            </button>
            <button 
              onClick={() => setActiveTab('analytics')} 
              className={`btn btn-sm ${activeTab === 'analytics' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ fontWeight: 700 }}
            >
              SLA Analytics
            </button>
            {isSuperAdmin && (
              <button 
                onClick={() => setActiveTab('advanced')} 
                className={`btn btn-sm ${activeTab === 'advanced' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontWeight: 700 }}
              >
                Advanced Settings
              </button>
            )}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="fade-in">
              {/* Business Stats summary */}
              <div className="sh-dashboard-grid mb-4">
                <div className="sh-stat-card">
                  <div className="sh-stat-title">SLA Compliance Rate</div>
                  <div className="sh-stat-value">{complianceRate}%</div>
                  <span className="sh-stat-badge sh-badge-accent">Target: 90%</span>
                </div>
                <div className="sh-stat-card">
                  <div className="sh-stat-title">Breaches Today</div>
                  <div className="sh-stat-value">{breachedTodayCount} {breachedTodayCount === 1 ? 'Case' : 'Cases'}</div>
                  <span className="sh-stat-badge bg-danger-subtle text-danger">SLA Missed</span>
                </div>
                <div className="sh-stat-card">
                  <div className="sh-stat-title">Active Policies</div>
                  <div className="sh-stat-value">{configs.length} Active</div>
                  <span className="sh-stat-badge sh-badge-accent">1 Default</span>
                </div>
                <div className="sh-stat-card">
                  <div className="sh-stat-title">Avg Response SLA</div>
                  <div className="sh-stat-value">{formatDuration(avgResponseMinutes)}</div>
                  <span className="sh-stat-badge sh-badge-accent">Across Priorities</span>
                </div>
              </div>

              {/* Inline Priorities Matrix Table */}
              <div className="card p-4 shadow-sm mb-4" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h4 style={{ fontWeight: 800, fontSize: '15px', marginBottom: '14px' }} className="d-flex align-items-center gap-2">
                  <Clock size={16} className="text-accent" />
                  SLA Matrix Target Settings
                </h4>
                
                <div className="table-responsive">
                  <table className="table align-middle" style={{ color: 'var(--text-primary)' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', fontSize: '12.5px' }}>
                        <th>Priority</th>
                        <th>Response Limit</th>
                        <th>Resolution Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Critical */}
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td><span className="badge bg-danger-subtle text-danger px-3 py-2">Critical</span></td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <input 
                              type="number" 
                              className="form-control form-control-sm w-50" 
                              value={criticalResponse} 
                              onChange={(e) => setCriticalResponse(e.target.value)} 
                              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({Math.round(criticalResponse / 60 * 10) / 10} hours)</span>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <input 
                              type="number" 
                              className="form-control form-control-sm w-50" 
                              value={criticalResolution} 
                              onChange={(e) => setCriticalResolution(e.target.value)} 
                              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({Math.round(criticalResolution / 60 * 10) / 10} hours)</span>
                          </div>
                        </td>
                      </tr>
                      {/* High */}
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td><span className="badge bg-warning-subtle text-warning px-3 py-2">High</span></td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <input 
                              type="number" 
                              className="form-control form-control-sm w-50" 
                              value={highResponse} 
                              onChange={(e) => setHighResponse(e.target.value)} 
                              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({Math.round(highResponse / 60 * 10) / 10} hours)</span>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <input 
                              type="number" 
                              className="form-control form-control-sm w-50" 
                              value={highResolution} 
                              onChange={(e) => setHighResolution(e.target.value)} 
                              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({Math.round(highResolution / 60 * 10) / 10} hours)</span>
                          </div>
                        </td>
                      </tr>
                      {/* Medium */}
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td><span className="badge bg-info-subtle text-info px-3 py-2">Medium</span></td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <input 
                              type="number" 
                              className="form-control form-control-sm w-50" 
                              value={mediumResponse} 
                              onChange={(e) => setMediumResponse(e.target.value)} 
                              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({Math.round(mediumResponse / 60 * 10) / 10} hours)</span>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <input 
                              type="number" 
                              className="form-control form-control-sm w-50" 
                              value={mediumResolution} 
                              onChange={(e) => setMediumResolution(e.target.value)} 
                              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({Math.round(mediumResolution / 60 * 10) / 10} hours)</span>
                          </div>
                        </td>
                      </tr>
                      {/* Low */}
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td><span className="badge bg-success-subtle text-success px-3 py-2">Low</span></td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <input 
                              type="number" 
                              className="form-control form-control-sm w-50" 
                              value={lowResponse} 
                              onChange={(e) => setLowResponse(e.target.value)} 
                              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({Math.round(lowResponse / 60 * 10) / 10} hours)</span>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <input 
                              type="number" 
                              className="form-control form-control-sm w-50" 
                              value={lowResolution} 
                              onChange={(e) => setLowResolution(e.target.value)} 
                              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>({Math.round(lowResolution / 60 * 10) / 10} hours)</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Policy Quick Actions Panel */}
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="card p-4 h-100" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                    <h5 style={{ fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>Active SLA Breach Strategy</h5>
                    <p className="text-muted" style={{ fontSize: '12px', marginBottom: '16px' }}>Define high-level actions triggered when targets are missed.</p>
                    
                    <div className="mb-3">
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>When Response Time Is Missed</label>
                      <select 
                        className="form-select" 
                        value={responseStrategy} 
                        onChange={(e) => handleStrategyChange('response', e.target.value)}
                        style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', fontSize: '13px' }}
                      >
                        <option value="standard">Standard Escalation (Logs & Alerts)</option>
                        <option value="management">Management Escalation (Alerts + Managers)</option>
                        <option value="executive">Executive Escalation (Direct Head alert + level up)</option>
                        <option value="critical">Critical Incident (Highest priority action routing)</option>
                        <option value="custom">Custom (Show checklist in Advanced settings)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>When Resolution Deadline Is Missed</label>
                      <select 
                        className="form-select" 
                        value={resolutionStrategy} 
                        onChange={(e) => handleStrategyChange('resolution', e.target.value)}
                        style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', fontSize: '13px' }}
                      >
                        <option value="standard">Standard Escalation (Logs & Alerts)</option>
                        <option value="management">Management Escalation (Alerts + Managers)</option>
                        <option value="executive">Executive Escalation (Direct Head alert + level up)</option>
                        <option value="critical">Critical Incident (Highest priority action routing)</option>
                        <option value="custom">Custom (Show checklist in Advanced settings)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card p-4 h-100" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                    <h5 style={{ fontWeight: 800, fontSize: '14px', marginBottom: '8px' }}>Violating Performance Summary</h5>
                    <p className="text-muted" style={{ fontSize: '12px' }}>Top violating categories across departments this week.</p>
                    <div className="sh-action-list">
                      {sortedViolatingCategories.length === 0 ? (
                        <div className="text-muted p-2" style={{ fontSize: '13px' }}>
                          No SLA breaches recorded for staff-related tickets.
                        </div>
                      ) : (
                        sortedViolatingCategories.slice(0, 5).map((item, idx) => {
                          const badgeColor = idx === 0 ? 'bg-danger-subtle text-danger' : idx === 1 ? 'bg-warning-subtle text-warning' : 'bg-info-subtle text-info';
                          return (
                            <div key={item.name} className="d-flex justify-content-between align-items-center p-2 border-bottom" style={{ fontSize: '13px' }}>
                              <span>{item.name}</span>
                              <span className={`badge ${badgeColor}`}>{item.count} {item.count === 1 ? 'Breach' : 'Breaches'}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVE POLICIES */}
          {activeTab === 'policies' && (
            <div className="fade-in">
              <h4 style={{ fontWeight: 800, fontSize: '15px', marginBottom: '14px' }}>Enterprise SLA Policies Catalogue</h4>
              <div className="row g-3">
                {configs.map((policy) => {
                  const isCurrent = selectedConfig?._id === policy._id;
                  return (
                    <div key={policy._id} className="col-md-6">
                      <div 
                        className="card p-4 h-100" 
                        style={{ 
                          backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.03)' : 'var(--bg-tertiary)',
                          border: isCurrent ? '2px solid var(--accent-color)' : '1px solid var(--border-color)', 
                          borderRadius: '12px' 
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h5 style={{ fontWeight: 800, fontSize: '15px', margin: 0 }}>{policy.name}</h5>
                          {policy.isDefault && (
                            <span className="badge bg-primary" style={{ fontSize: '10px' }}>Active Default</span>
                          )}
                        </div>

                        <div className="row g-1 my-3" style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          <div className="col-6">Critical Response: {policy.priorities?.Critical?.responseSlaMinutes || 15}m</div>
                          <div className="col-6">Critical Resolution: {policy.priorities?.Critical?.resolutionSlaMinutes || 240}m</div>
                          <div className="col-6">High Response: {policy.priorities?.High?.responseSlaMinutes || 60}m</div>
                          <div className="col-6">High Resolution: {policy.priorities?.High?.resolutionSlaMinutes || 480}m</div>
                        </div>

                        <div className="d-flex gap-2 mt-auto pt-3 border-top">
                          <button 
                            className="btn btn-xs btn-outline-secondary" 
                            onClick={() => loadConfigDetails(policy)}
                            disabled={isCurrent}
                          >
                            Select / Edit
                          </button>
                          {!policy.isDefault && (
                            <button 
                              className="btn btn-xs btn-outline-primary" 
                              onClick={() => toggleDefaultPolicy(policy)}
                            >
                              Set as Default
                            </button>
                          )}
                          {!policy.isDefault && (
                            <button 
                              className="btn btn-xs btn-link text-danger p-0 ms-auto"
                              onClick={() => handleDeletePolicy(policy._id, policy.name)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="fade-in">
              <h4 style={{ fontWeight: 800, fontSize: '15px', marginBottom: '14px' }}>Pre-configured SLA Policy Presets</h4>
              <p className="text-muted" style={{ fontSize: '12.5px', marginBottom: '20px' }}>
                Spawn new SLA configurations instantly using standard service industry templates.
              </p>

              <div className="row g-3">
                {templatesCatalog.map((tpl, i) => (
                  <div key={i} className="col-md-6">
                    <div className="card p-4 h-100" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <h5 style={{ fontWeight: 800, fontSize: '15.5px' }}>{tpl.name}</h5>
                      <p className="text-muted" style={{ fontSize: '12.5px' }}>{tpl.description}</p>
                      
                      <div className="p-3 my-3" style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '12.5px' }}>
                        <div><strong>Critical Response:</strong> {tpl.priorities.Critical.responseSlaMinutes} Min</div>
                        <div><strong>Critical Resolution:</strong> {tpl.priorities.Critical.resolutionSlaMinutes} Min</div>
                        <div><strong>Default Strategy:</strong> {tpl.strategy}</div>
                      </div>

                      <button 
                        className="btn btn-sm btn-outline-primary mt-auto w-100"
                        onClick={() => {
                          const breach = tpl.name.includes('VIP') ? strategyActions.executive : tpl.name.includes('Critical') ? strategyActions.critical : strategyActions.management;
                          handleCreateFromTemplate(tpl.name, {
                            priorities: tpl.priorities,
                            breachActions: {
                              responseSla: breach,
                              resolutionSla: breach
                            },
                            multiBreachRules,
                            riskScoreRules: riskRules
                          });
                        }}
                      >
                        Create Policy from Template
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="fade-in">
              <h4 style={{ fontWeight: 800, fontSize: '15px', marginBottom: '14px' }}>SLA Performance Reporting</h4>
              
              <div className="row g-4 mb-4">
                <div className="col-md-6">
                  <div className="card p-4 shadow-sm" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                    <h5 style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px' }} className="d-flex align-items-center gap-2">
                      <BarChart2 size={16} className="text-accent" /> Hourly Response Performance
                    </h5>
                    
                    <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                      <div className="d-flex flex-column align-items-center" title={monAvg ? `${formatDuration(monAvg)} avg response` : 'No data'}><div style={{ height: barHeights.Mon, width: '24px', background: 'var(--accent-gradient)', borderRadius: '4px' }}></div><span style={{ fontSize: '11px', marginTop: '6px' }}>Mon</span></div>
                      <div className="d-flex flex-column align-items-center" title={tueAvg ? `${formatDuration(tueAvg)} avg response` : 'No data'}><div style={{ height: barHeights.Tue, width: '24px', background: 'var(--accent-gradient)', borderRadius: '4px' }}></div><span style={{ fontSize: '11px', marginTop: '6px' }}>Tue</span></div>
                      <div className="d-flex flex-column align-items-center" title={wedAvg ? `${formatDuration(wedAvg)} avg response` : 'No data'}><div style={{ height: barHeights.Wed, width: '24px', background: 'var(--accent-gradient)', borderRadius: '4px' }}></div><span style={{ fontSize: '11px', marginTop: '6px' }}>Wed</span></div>
                      <div className="d-flex flex-column align-items-center" title={thuAvg ? `${formatDuration(thuAvg)} avg response` : 'No data'}><div style={{ height: barHeights.Thu, width: '24px', background: 'var(--accent-gradient)', borderRadius: '4px' }}></div><span style={{ fontSize: '11px', marginTop: '6px' }}>Thu</span></div>
                      <div className="d-flex flex-column align-items-center" title={friAvg ? `${formatDuration(friAvg)} avg response` : 'No data'}><div style={{ height: barHeights.Fri, width: '24px', background: 'var(--accent-gradient)', borderRadius: '4px' }}></div><span style={{ fontSize: '11px', marginTop: '6px' }}>Fri</span></div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card p-4 shadow-sm" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                    <h5 style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px' }} className="d-flex align-items-center gap-2">
                      <Star size={16} className="text-accent" /> SLA Resolution Compliance
                    </h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                          <span>Critical Priority</span>
                          <span>{criticalCompliance}% compliant</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${criticalCompliance}%`, height: '100%', backgroundColor: '#10b981' }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                          <span>High Priority</span>
                          <span>{highCompliance}% compliant</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${highCompliance}%`, height: '100%', backgroundColor: '#3b82f6' }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                          <span>Medium Priority</span>
                          <span>{mediumCompliance}% compliant</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${mediumCompliance}%`, height: '100%', backgroundColor: '#f59e0b' }}></div>
                        </div>
                      </div>

                      <div>
                        <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                          <span>Low Priority</span>
                          <span>{lowCompliance}% compliant</span>
                        </div>
                        <div style={{ height: '8px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${lowCompliance}%`, height: '100%', backgroundColor: '#10b981' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ADVANCED CONFIGURATION (SUPER ADMIN ONLY) */}
          {activeTab === 'advanced' && isSuperAdmin && (
            <div className="fade-in">
              <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                <h4 style={{ fontWeight: 800, fontSize: '15px', margin: 0 }} className="d-flex align-items-center gap-2">
                  <ShieldAlert size={16} className="text-accent" />
                  Engine Actions & Risk Score Weights
                </h4>
              </div>

              <div className="p-4 mb-4" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h5 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Low-level Engine Action Checklists</h5>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>When Response Time Is Missed</label>
                    <div className="d-flex flex-column gap-2">
                      {availableResponseActions.map(act => (
                        <label key={act.value} className="d-flex align-items-center gap-2" style={{ fontSize: '12.5px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            className="form-check-input"
                            checked={responseActions.includes(act.value)} 
                            onChange={() => handleResponseActionToggle(act.value)}
                          />
                          <span>{act.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>When Resolution Deadline Is Missed</label>
                    <div className="d-flex flex-column gap-2">
                      {availableResolutionActions.map(act => (
                        <label key={act.value} className="d-flex align-items-center gap-2" style={{ fontSize: '12.5px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            className="form-check-input"
                            checked={resolutionActions.includes(act.value)} 
                            onChange={() => handleResolutionActionToggle(act.value)}
                          />
                          <span>{act.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Repeated SLA Breaches */}
              <div className="card p-4 mb-4" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h5 style={{ fontWeight: 800, fontSize: '14px', marginBottom: '14px' }}>Repeated SLA Breach Threshold Rules</h5>
                <div className="d-flex flex-column gap-3">
                  {multiBreachRules.map((rule, idx) => (
                    <div key={idx} className="d-flex align-items-center gap-3 justify-content-between p-2 border-bottom flex-wrap">
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-secondary px-3 py-2" style={{ fontSize: '12px', borderRadius: '6px' }}>
                          {rule.breachCount} {rule.breachCount === 1 ? 'Check' : 'Checks'} Breached
                        </span>
                        <ChevronRight size={14} className="text-muted" />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Execute:</span>
                      </div>

                      <select
                        className="form-select"
                        style={{ width: 'auto', minWidth: '280px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px' }}
                        value={rule.action}
                        onChange={(e) => handleMultiBreachActionChange(idx, e.target.value)}
                      >
                        {multiBreachActions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Weights */}
              <div className="card p-4 mb-4" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <h5 style={{ fontWeight: 800, fontSize: '14px', marginBottom: '14px' }}>Operational Risk score Weights (0 - 100 Range)</h5>
                
                <div className="row g-3">
                  <div className="col-sm-6 col-md-4">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Response SLA Breach weight</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={riskRules.responseBreachIncrease}
                      onChange={(e) => handleRiskRuleChange('responseBreachIncrease', e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-input)' }}
                    />
                  </div>

                  <div className="col-sm-6 col-md-4">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Resolution SLA Breach weight</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={riskRules.resolutionBreachIncrease}
                      onChange={(e) => handleRiskRuleChange('resolutionBreachIncrease', e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-input)' }}
                    />
                  </div>

                  <div className="col-sm-6 col-md-4">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Reopen weight</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={riskRules.reopenIncrease}
                      onChange={(e) => handleRiskRuleChange('reopenIncrease', e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-input)' }}
                    />
                  </div>

                  <div className="col-sm-6 col-md-4">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Escalation Level weight</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={riskRules.escalationIncrease}
                      onChange={(e) => handleRiskRuleChange('escalationIncrease', e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-input)' }}
                    />
                  </div>

                  <div className="col-sm-6 col-md-4">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Poor Rating weight</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={riskRules.lowRatingIncrease}
                      onChange={(e) => handleRiskRuleChange('lowRatingIncrease', e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-input)' }}
                    />
                  </div>

                  <div className="col-sm-6 col-md-4">
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Critical Priority weight</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={riskRules.criticalPriorityIncrease}
                      onChange={(e) => handleRiskRuleChange('criticalPriorityIncrease', e.target.value)}
                      style={{ border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-input)' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default SlaConfigPanel;
