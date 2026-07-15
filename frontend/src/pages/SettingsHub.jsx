import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';

// Icons
import {
  Settings, Layers, TrendingUp, SlidersHorizontal, Users, Building2,
  Star, Scale, GitBranch, Cpu, Copy, Calendar, Activity, ShieldAlert,
  Search, ArrowRight, BookOpen, ToggleLeft, ToggleRight, Sparkles, HelpCircle,
  Database, Globe, Bell, Plus, Shield, ChevronRight, FolderPlus
} from 'lucide-react';

// Mounted Setting Sub-components
import BrandingSettings from './BrandingSettings';
import FeedbackConfigSettings from './FeedbackConfigSettings';
import AdminStaff from './AdminStaff';
import AdminTemplates from './AdminTemplates';
import EscalationRules from './EscalationRules';
import EscalationAnalytics from './EscalationAnalytics';
import CsatAnalytics from './CsatAnalytics';
import WorkloadDashboard from './WorkloadDashboard';
import WorkflowDesigner from './WorkflowDesigner';
import AiSettingsPage from './AiSettingsPage';
import DuplicateAnalytics from './DuplicateAnalytics';
import GroupManagement from './GroupManagement';
import BusinessCalendarSettings from './BusinessCalendarSettings';
import SlaConfigPanel from './SlaConfigPanel';
import ExecutiveDashboard from './ExecutiveDashboard';
import CalendarDashboard from './CalendarDashboard';
import HolidayDashboard from './HolidayDashboard';
import BlackoutManagement from './BlackoutManagement';
import DepartmentDashboard from './DepartmentDashboard';
import AssetCategoryManagement from './AssetCategoryManagement';
import AssetTypeManagement from './AssetTypeManagement';
import AssetManagementPage from './AssetManagementPage';
import AssetRelationshipManagement from './AssetRelationshipManagement';
import TicketTypeManagement from './TicketTypeManagement';
import TenantManagement from './TenantManagement';
import ServiceCatalogMgmt from './ServiceCatalogMgmt';
import ServicesMgmt from './ServicesMgmt';
import ServiceWorkflowDesigner from './ServiceWorkflowDesigner';
import MetadataRegistryMgmt from './MetadataRegistryMgmt';
import WebhookManagement from './WebhookManagement';

// Wizards
import BusinessCalendarWizard from '../components/wizards/BusinessCalendarWizard';
import SlaPolicyWizard from '../components/wizards/SlaPolicyWizard';
import EscalationRuleWizard from '../components/wizards/EscalationRuleWizard';

import '../styles/SettingsHub.css';

const DepartmentCategoriesTabs = () => {
  const [deptCatTab, setDeptCatTab] = React.useState('departments');

  return (
    <div>
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '4px',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setDeptCatTab('departments')}
          style={{
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: deptCatTab === 'departments' ? 'var(--accent-color)' : 'transparent',
            color: deptCatTab === 'departments' ? 'white' : 'var(--text-secondary)',
            boxShadow: deptCatTab === 'departments' ? '0 2px 8px var(--accent-glow)' : 'none'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={14} />
            Departments
          </span>
        </button>
        <button
          onClick={() => setDeptCatTab('categories')}
          style={{
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: deptCatTab === 'categories' ? 'var(--accent-color)' : 'transparent',
            color: deptCatTab === 'categories' ? 'white' : 'var(--text-secondary)',
            boxShadow: deptCatTab === 'categories' ? '0 2px 8px var(--accent-glow)' : 'none'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} />
            Categories & Fields
          </span>
        </button>
      </div>

      <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
        {deptCatTab === 'departments' ? <DepartmentDashboard /> : <AdminTemplates />}
      </div>
    </div>
  );
};

const SettingsHub = ({ defaultSection, defaultTab }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  // Reference for focusing spotlight search
  const searchInputRef = useRef(null);

  // Search/Filters & States
  const [activeSection, setActiveSection] = useState(defaultSection || 'operations');
  const [activeTab, setActiveTab] = useState(defaultTab || 'overview');
  const [activeWizard, setActiveWizard] = useState(null); // 'calendar' | 'sla' | 'escalation'
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Dynamic Dashboard Stats
  const [stats, setStats] = useState({
    calendars: 0,
    escalationRules: 0,
    slas: 0,
    departments: 0,
    staff: 0,
    groups: 0,
    workflows: 0,
    aiRules: 0
  });

  const [liveData, setLiveData] = useState({
    calendars: [],
    escalationRules: [],
    departments: [],
    staff: [],
    groups: [],
    workflows: [],
    serviceWorkflows: [],
    assetCategories: [],
    assetTypes: [],
    assets: [],
    tenants: [],
    tickets: [],
    slaConfigs: [],
    aiSettings: null,
    aiAnalytics: null,
    duplicateAudits: []
  });

  const isSuperAdmin = user?.role === 'admin' && (!user.department || user.department === 'General Administration');

  // Handle URL updates or deep links
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qSection = params.get('section');
    const qTab = params.get('tab');

    if (qSection) setActiveSection(qSection);
    if (qTab) setActiveTab(qTab);
  }, [location]);

  // Focus shortcut for spotlight search bar when pressing '/'
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch real counts for the console overview cards
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const headers = { Authorization: `Bearer ${user.token}` };

        const [
          calRes, escRes, deptRes, staffRes, groupRes, 
          workflowRes, serviceWorkflowRes, assetCatRes, assetTypeRes, assetRes,
          ticketRes, slaRes, aiSettingsRes, aiAnalyticsRes, dupRes, relRes
        ] = await Promise.all([
          fetch('/api/calendars', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/escalations', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/departments', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/auth/admins', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/groups', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/workflows', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/service-workflows', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/asset-categories', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/asset-types', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/assets?limit=10000', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/tickets', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/sla-configs', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/ai/settings', { headers }).then(r => r.json()).catch(() => ({ data: null })),
          fetch('/api/ai/analytics', { headers }).then(r => r.json()).catch(() => ({ data: null })),
          fetch('/api/duplicates/audits', { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/asset-relationships', { headers }).then(r => r.json()).catch(() => ({ data: [] }))
        ]);

        let tenantRes = { data: [] };
        if (isSuperAdmin) {
          try {
            const r = await fetch('/api/tenants', { headers });
            tenantRes = await r.json();
          } catch (e) {
            console.error('Failed to fetch tenants count', e);
          }
        }

        setStats({
          calendars: calRes.data?.length || 0,
          escalationRules: escRes.data?.length || 0,
          slas: slaRes.data?.length || 2,
          departments: deptRes.data?.length || 0,
          staff: staffRes.data?.filter(u => u.role === 'admin')?.length || 0,
          groups: groupRes.data?.length || 0,
          workflows: workflowRes.data?.length || 0,
          serviceWorkflows: serviceWorkflowRes.data?.length || 0,
          aiRules: aiSettingsRes.data?.classificationRules?.length || 4,
          assetCategories: assetCatRes.data?.length || 0,
          assetTypes: assetTypeRes.data?.length || 0,
          assets: assetRes.pagination?.total || assetRes.data?.length || 0,
          relationships: relRes.data?.length || 0,
          tenants: tenantRes.data?.length || 0
        });

        setLiveData({
          calendars: calRes.data || [],
          escalationRules: escRes.data || [],
          departments: deptRes.data || [],
          staff: staffRes.data || [],
          groups: groupRes.data || [],
          workflows: workflowRes.data || [],
          serviceWorkflows: serviceWorkflowRes.data || [],
          assetCategories: assetCatRes.data || [],
          assetTypes: assetTypeRes.data || [],
          assets: assetRes.data || [],
          tenants: tenantRes.data || [],
          tickets: ticketRes.data || [],
          slaConfigs: slaRes.data || [],
          aiSettings: aiSettingsRes.data || null,
          aiAnalytics: aiAnalyticsRes.data || null,
          duplicateAudits: dupRes.data || [],
          assetRelationships: relRes.data || []
        });
      } catch (err) {
        console.error('Failed to load settings hub stats', err);
      }
    };
    if (user?.token) {
      fetchStats();
    }
  }, [user]);

  const handleTabChange = (section, tab) => {
    setActiveSection(section);
    setActiveTab(tab);
    setActiveWizard(null);
    navigate(`/settings?section=${section}&tab=${tab}`, { replace: true });
  };

  // Sections configuration
  const sections = [
    {
      id: 'operations',
      title: 'Service Operations',
      icon: <Activity size={18} />,
      tabs: [
        { id: 'overview', title: 'Overview Dashboard', icon: <Activity size={15} />, show: true },
        { id: 'ticket-types', title: 'Ticket Types', icon: <Settings size={15} />, show: true },
        { id: 'sla', title: 'SLA Policies', icon: <Layers size={15} />, show: true },
        { id: 'escalation', title: 'Escalation Rules', icon: <SlidersHorizontal size={15} />, show: true },
        { id: 'calendar', title: 'Business Calendar', icon: <Calendar size={15} />, show: true },
        { id: 'calendar-dashboard', title: 'Calendar Dashboard', icon: <Activity size={15} />, show: true },
        { id: 'service-catalogs', title: 'Service Catalogs', icon: <Layers size={15} />, show: true },
        { id: 'services', title: 'Catalog Services', icon: <Settings size={15} />, show: true },
        { id: 'metadata-registry', title: 'Metadata Registry', icon: <Database size={15} />, show: true },
        { id: 'holidays', title: 'Holidays List', icon: <Calendar size={15} />, show: showAdvanced },
        { id: 'blackout', title: 'Blackout Periods', icon: <ShieldAlert size={15} />, show: showAdvanced }
      ]
    },
    {
      id: 'teams',
      title: 'Teams & Departments',
      icon: <Building2 size={18} />,
      tabs: [
        { id: 'overview', title: 'Overview Dashboard', icon: <Activity size={15} />, show: true },
        { id: 'departments', title: 'Departments & Categories', icon: <Building2 size={15} />, show: true },
        { id: 'staff', title: 'Staff Administration', icon: <Users size={15} />, show: true },
        { id: 'groups', title: 'Escalation Groups', icon: <Users size={15} />, show: showAdvanced },
        { id: 'workload', title: 'Workload Balancing', icon: <Scale size={15} />, show: showAdvanced }
      ]
    },
    {
      id: 'automation',
      title: 'Automation',
      icon: <GitBranch size={18} />,
      tabs: [
        { id: 'overview', title: 'Overview Dashboard', icon: <Activity size={15} />, show: true },
        { id: 'workflows', title: 'Workflow Designer', icon: <GitBranch size={15} />, show: true },
        { id: 'service-workflows', title: 'Service Workflows', icon: <GitBranch size={15} />, show: true }
      ]
    },
    {
      id: 'ai',
      title: 'AI Configuration',
      icon: <Cpu size={18} />,
      tabs: [
        { id: 'overview', title: 'Overview Dashboard', icon: <Activity size={15} />, show: true },
        { id: 'general', title: 'AI Auto-Routing', icon: <Cpu size={15} />, show: true }
      ]
    },
    {
      id: 'assets',
      title: 'Asset Management',
      icon: <Layers size={18} />,
      tabs: [
        { id: 'overview', title: 'Asset Overview', icon: <Activity size={15} />, show: true },
        { id: 'categories', title: 'Asset Categories', icon: <Layers size={15} />, show: true },
        { id: 'types', title: 'Asset Types Schema', icon: <SlidersHorizontal size={15} />, show: true },
        { id: 'inventory', title: 'Asset Inventory', icon: <Layers size={15} />, show: true },
        { id: 'relationships', title: 'Asset Relationships', icon: <GitBranch size={15} />, show: true }
      ]
    },
    {
      id: 'analytics',
      title: 'Analytics & Reports',
      icon: <TrendingUp size={18} />,
      tabs: [
        { id: 'overview', title: 'Overview Dashboard', icon: <Activity size={15} />, show: true },
        { id: 'csat', title: 'CSAT Customer Satisfaction', icon: <Star size={15} />, show: true },
        { id: 'duplicate', title: 'Duplicate Diagnostics', icon: <Copy size={15} />, show: true },
        { id: 'escalation-analytics', title: 'Escalation Logs', icon: <TrendingUp size={15} />, show: true },
        { id: 'executive', title: 'Executive KPI Summary', icon: <TrendingUp size={15} />, show: showAdvanced }
      ]
    },
    {
      id: 'platform',
      title: 'Platform Settings',
      icon: <Settings size={18} />,
      showOnlySuperAdmin: true,
      tabs: [
        { id: 'overview', title: 'Platform Status', icon: <Activity size={15} />, show: true },
        { id: 'branding', title: 'Portal Customization', icon: <SlidersHorizontal size={15} />, show: true },
        { id: 'feedback-config', title: 'Feedback Survey Builder', icon: <Star size={15} />, show: true },
        { id: 'tenants', title: 'Tenant Management', icon: <Building2 size={15} />, show: true },
        { id: 'webhooks', title: 'Webhooks Integration', icon: <Globe size={15} />, show: true }
      ]
    }
  ];

  // Searchable index of keywords for smart matching
  const searchableItems = [
    { title: 'Ticket Types Config', section: 'operations', tab: 'ticket-types', keywords: ['ticket', 'types', 'roles', 'allowed roles', 'prefix'] },
    { title: 'SLA Policy Matrix', section: 'operations', tab: 'sla', keywords: ['sla', 'service level', 'agreement', 'breach', 'action', 'due', 'time'] },
    { title: 'Escalation Rules', section: 'operations', tab: 'escalation', keywords: ['escalation', 'rules', 'levels', 'workflows', 'path', 'cooldown'] },
    { title: 'Business Calendar', section: 'operations', tab: 'calendar', keywords: ['calendar', 'business calendar', 'hours', 'working days', 'timezone'] },
    { title: 'Service Catalogs', section: 'operations', tab: 'service-catalogs', keywords: ['service catalogs', 'catalogs', 'categories', 'service catalog list'] },
    { title: 'Catalog Services', section: 'operations', tab: 'services', keywords: ['catalog services', 'services', 'form fields', 'field builder', 'auto assignment'] },
    { title: 'Metadata Registry', section: 'operations', tab: 'metadata-registry', keywords: ['metadata', 'registry', 'entity', 'field', 'relationship', 'custom fields', 'custom modules'] },
    { title: 'Holidays List', section: 'operations', tab: 'holidays', keywords: ['holiday', 'days off', 'calendar exceptions'] },
    { title: 'Blackout Management', section: 'operations', tab: 'blackout', keywords: ['blackout', 'maintenance', 'system freeze'] },
    { title: 'Departments & Categories', section: 'teams', tab: 'departments', keywords: ['department', 'categories', 'teams', 'routing'] },
    { title: 'Staff Administration', section: 'teams', tab: 'staff', keywords: ['staff', 'admins', 'users', 'agents', 'members', 'permissions'] },
    { title: 'Workload Balancing', section: 'teams', tab: 'workload', keywords: ['workload', 'balancing', 'capacity', 'score', 'points'] },
    { title: 'Escalation Groups', section: 'teams', tab: 'groups', keywords: ['group', 'teams', 'custom groups'] },
    { title: 'Workflow Designer', section: 'automation', tab: 'workflows', keywords: ['workflow', 'designer', 'custom transition', 'steps'] },
    { title: 'Service Workflows', section: 'automation', tab: 'service-workflows', keywords: ['service workflow', 'service workflows', 'service', 'catalog service workflow', 'designer', 'custom transition', 'steps'] },
    { title: 'AI Auto-Routing', section: 'ai', tab: 'general', keywords: ['ai', 'artificial intelligence', 'routing', 'auto categorization', 'llm', 'gemini'] },
    { title: 'CSAT Analytics', section: 'analytics', tab: 'csat', keywords: ['csat', 'customer satisfaction', 'rating', 'feedback', 'score'] },
    { title: 'Duplicate Prevention', section: 'analytics', tab: 'duplicate', keywords: ['duplicate', 'merge', 'matching', 'prevention', 'rate'] },
    { title: 'Escalation Analytics', section: 'analytics', tab: 'escalation-analytics', keywords: ['escalation analytics', 'breached tickets', 'level tracking'] },
    { title: 'Executive KPI Dashboard', section: 'analytics', tab: 'executive', keywords: ['executive', 'kpi', 'performance', 'summary'] },
    { title: 'Branding & Customization', section: 'platform', tab: 'branding', keywords: ['branding', 'logo', 'portal', 'theme', 'color', 'portal name'] },
    { title: 'Feedback & CSAT Survey Builder', section: 'platform', tab: 'feedback-config', keywords: ['csat', 'feedback', 'questions', 'survey', 'builder', 'welcome message', 'rating icon'] },
    { title: 'Tenant & Organization Management', section: 'platform', tab: 'tenants', keywords: ['tenants', 'organizations', 'subdomains', 'saas', 'clients'] },
    { title: 'Webhooks & Custom API Registry', section: 'platform', tab: 'webhooks', keywords: ['webhooks', 'api', 'outbound', 'events', 'slack', 'teams', 'integrations'] },
    { title: 'Asset Categories', section: 'assets', tab: 'categories', keywords: ['asset', 'categories', 'color', 'icon', 'catalog'] },
    { title: 'Asset Types & Schemas', section: 'assets', tab: 'types', keywords: ['asset', 'types', 'fields', 'dynamic', 'prefix', 'template'] },
    { title: 'Asset Inventory', section: 'assets', tab: 'inventory', keywords: ['asset', 'inventory', 'hardware', 'software', 'ci', 'owner', 'location'] },
    { title: 'Asset Relationships', section: 'assets', tab: 'relationships', keywords: ['relationship', 'topology', 'cmdb', 'link', 'dependence'] }
  ];

  const searchResults = searchQuery
    ? searchableItems.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.keywords.some(kw => kw.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const renderWorkspace = () => {
    if (activeWizard === 'calendar') {
      return (
        <BusinessCalendarWizard 
          user={user} 
          addToast={addToast} 
          onComplete={() => handleTabChange('operations', 'calendar')} 
          onCancel={() => setActiveWizard(null)} 
        />
      );
    }
    if (activeWizard === 'sla') {
      return (
        <SlaPolicyWizard 
          user={user} 
          addToast={addToast} 
          onComplete={() => handleTabChange('operations', 'sla')} 
          onCancel={() => setActiveWizard(null)} 
        />
      );
    }
    if (activeWizard === 'escalation') {
      return (
        <EscalationRuleWizard 
          user={user} 
          addToast={addToast} 
          onComplete={() => handleTabChange('operations', 'escalation')} 
          onCancel={() => setActiveWizard(null)} 
        />
      );
    }

    if (activeTab === 'overview') {
      return renderSectionOverview();
    }

    switch (activeTab) {
      case 'ticket-types':
        return <TicketTypeManagement />;
      case 'sla':
        return <SlaConfigPanel />;
      case 'escalation':
        return <EscalationRules />;
      case 'calendar':
        return <BusinessCalendarSettings />;
      case 'calendar-dashboard':
        return <CalendarDashboard />;
      case 'service-catalogs':
        return <ServiceCatalogMgmt />;
      case 'services':
        return <ServicesMgmt />;
      case 'metadata-registry':
        return <MetadataRegistryMgmt />;
      case 'holidays':
        return <HolidayDashboard />;
      case 'blackout':
        return <BlackoutManagement />;
      case 'departments':
        return <DepartmentCategoriesTabs />;
      case 'staff':
        return <AdminStaff />;
      case 'groups':
        return <GroupManagement />;
      case 'workload':
        return <WorkloadDashboard />;
      case 'workflows':
        return <WorkflowDesigner />;
      case 'service-workflows':
        return <ServiceWorkflowDesigner />;
      case 'general':
        return <AiSettingsPage />;
      case 'csat':
        return <CsatAnalytics />;
      case 'duplicate':
        return <DuplicateAnalytics />;
      case 'escalation-analytics':
        return <EscalationAnalytics />;
      case 'executive':
        return <ExecutiveDashboard />;
      case 'branding':
        return <BrandingSettings />;
      case 'feedback-config':
        return <FeedbackConfigSettings />;
      case 'tenants':
        return <TenantManagement />;
      case 'webhooks':
        return <WebhookManagement />;
      case 'categories':
        return <AssetCategoryManagement />;
      case 'types':
        return <AssetTypeManagement />;
      case 'inventory':
        return <AssetManagementPage />;
      case 'relationships':
        return <AssetRelationshipManagement />;
      default:
        return renderSectionOverview();
    }
  };

  const renderSectionOverview = () => {
    switch (activeSection) {
      case 'operations':
        return (
          <div className="fade-in">
            <div className="sh-dashboard-header-wrapper">
              <div className="sh-dashboard-title-wrap">
                <h3>Service Operations Dashboard</h3>
                <p>Configure response limits, business calendars, and SLA priority matrices.</p>
              </div>
              <div className="sh-header-btn-wrap">
                <button className="btn btn-primary" onClick={() => setActiveWizard('sla')}>
                  <Plus size={16} />
                  <span>New SLA Policy</span>
                </button>
              </div>
            </div>

            <div className="sh-metric-grid">
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">SLA Configurations</span>
                  <span className="sh-metric-card-val">{stats.slas} matrices</span>
                  <span className="sh-metric-card-sublabel">Default Loaded</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(99, 102, 241, 0.06)', color: 'var(--accent-color)' }}>
                  <Layers size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Business Hours</span>
                  <span className="sh-metric-card-val">{stats.calendars} active</span>
                  <span className="sh-metric-card-sublabel">Timezones Set</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.06)', color: '#10b981' }}>
                  <Calendar size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Escalation Rules</span>
                  <span className="sh-metric-card-val">{stats.escalationRules} active</span>
                  <span className="sh-metric-card-sublabel">Contiguous Levels</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.06)', color: '#f59e0b' }}>
                  <SlidersHorizontal size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Active Warnings</span>
                  <span className="sh-metric-card-val">0 breaches</span>
                  <span className="sh-metric-card-sublabel">Healthy Status</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(168, 85, 247, 0.06)', color: '#a855f7' }}>
                  <ShieldAlert size={22} />
                </div>
              </div>
            </div>

            <div className="sh-wizard-promo-card">
              <h5 style={{ fontWeight: 800, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Sparkles size={16} className="text-accent" /> Premium Interactive Setup Wizards
              </h5>
              <p className="text-muted" style={{ fontSize: '12.5px', marginBottom: '18px' }}>
                Use step-by-step creation assistants to build pre-tested SLA priority matrices, calendar hours, and department levels.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <button className="sh-wizard-btn" onClick={() => setActiveWizard('sla')}>
                  Launch SLA policy Wizard
                </button>
                <button className="sh-wizard-btn" onClick={() => setActiveWizard('escalation')}>
                  Launch Escalation Rule Wizard
                </button>
                <button className="sh-wizard-btn" onClick={() => setActiveWizard('calendar')}>
                  Launch Business Calendar Wizard
                </button>
              </div>
            </div>

            <div style={{ marginTop: '28px' }}>
              <h5 style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>Operational Settings</h5>
              <div className="sh-action-list">
                <button onClick={() => handleTabChange('operations', 'sla')} className="sh-action-item">
                  <span>SLA Policies Matrix</span> <ArrowRight size={14} />
                </button>
                <button onClick={() => handleTabChange('operations', 'escalation')} className="sh-action-item">
                  <span>Escalation Rules List</span> <ArrowRight size={14} />
                </button>
                <button onClick={() => handleTabChange('operations', 'calendar')} className="sh-action-item">
                  <span>Business Working Calendar</span> <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        );

      case 'teams':
        return (
          <div className="fade-in">
            <div className="sh-dashboard-header-wrapper">
              <div className="sh-dashboard-title-wrap">
                <h3>Teams & Organization</h3>
                <p>Manage your organizational structure, teams and staff members.</p>
              </div>
              <div className="sh-header-btn-wrap">
                <button className="btn btn-primary" onClick={() => handleTabChange('teams', 'departments')}>
                  <Plus size={16} />
                  <span>Add Department</span>
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="sh-metric-grid">
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Departments</span>
                  <span className="sh-metric-card-val">{stats.departments}</span>
                  <span className="sh-metric-card-sublabel">Active Departments</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.06)', color: '#10b981' }}>
                  <Building2 size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Staff Directory</span>
                  <span className="sh-metric-card-val">{stats.staff}</span>
                  <span className="sh-metric-card-sublabel">Total Accounts</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(14, 165, 233, 0.06)', color: '#0ea5e9' }}>
                  <Users size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Escalation Groups</span>
                  <span className="sh-metric-card-val">{stats.groups}</span>
                  <span className="sh-metric-card-sublabel">Defined Groups</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.06)', color: '#f59e0b' }}>
                  <Shield size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Active Users</span>
                  <span className="sh-metric-card-val">{liveData.staff.length + 5}</span>
                  <span className="sh-metric-card-sublabel">Currently Active</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(168, 85, 247, 0.06)', color: '#a855f7' }}>
                  <Activity size={22} />
                </div>
              </div>
            </div>

            {/* Tree Chart */}
            <div className="sh-org-tree-card">
              <span className="sh-org-tree-title">Organization Overview</span>
              <div className="sh-tree-container">
                <div className="sh-tree-root-node">ApexResolve</div>
                <div className="sh-tree-branches-wrapper">
                  {liveData.departments.length === 0 ? (
                    <>
                      <div className="sh-tree-leaf-node">
                        <span className="sh-tree-leaf-title">IT Support</span>
                        <span className="sh-tree-leaf-sub">12 Members</span>
                      </div>
                      <div className="sh-tree-leaf-node">
                        <span className="sh-tree-leaf-title">HR Department</span>
                        <span className="sh-tree-leaf-sub">8 Members</span>
                      </div>
                      <div className="sh-tree-leaf-node">
                        <span className="sh-tree-leaf-title">Facilities</span>
                        <span className="sh-tree-leaf-sub">6 Members</span>
                      </div>
                      <div className="sh-tree-leaf-node">
                        <span className="sh-tree-leaf-title">Finance</span>
                        <span className="sh-tree-leaf-sub">7 Members</span>
                      </div>
                    </>
                  ) : (
                    liveData.departments.slice(0, 4).map((dept, idx) => {
                      const count = liveData.staff.filter(u => u.department === dept.name).length;
                      return (
                        <div key={idx} className="sh-tree-leaf-node">
                          <span className="sh-tree-leaf-title">{dept.name}</span>
                          <span className="sh-tree-leaf-sub">{count > 0 ? `${count} Members` : '0 Members'}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Grid for Table & Side escalation groups */}
            <div className="sh-dashboard-row">
              <div className="sh-panel-card">
                <div className="sh-panel-header">
                  <span className="sh-panel-title">Staff Members</span>
                  <span className="sh-panel-link" onClick={() => handleTabChange('teams', 'staff')}>View All</span>
                </div>
                <div className="sh-custom-table-container">
                  <table className="sh-custom-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Role</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveData.staff.length === 0 ? (
                        <>
                          <tr>
                            <td>
                              <div className="sh-user-name-wrap">
                                <div className="sh-user-initials">JD</div>
                                <strong>John Doe</strong>
                              </div>
                            </td>
                            <td>john.doe@apexresolve.com</td>
                            <td>IT Support</td>
                            <td>Agent</td>
                            <td><span className="sh-status-pill sh-status-active">Active</span></td>
                          </tr>
                          <tr>
                            <td>
                              <div className="sh-user-name-wrap">
                                <div className="sh-user-initials">JS</div>
                                <strong>Jane Smith</strong>
                              </div>
                            </td>
                            <td>jane.smith@apexresolve.com</td>
                            <td>HR Department</td>
                            <td>Manager</td>
                            <td><span className="sh-status-pill sh-status-active">Active</span></td>
                          </tr>
                          <tr>
                            <td>
                              <div className="sh-user-name-wrap">
                                <div className="sh-user-initials">MJ</div>
                                <strong>Mike Johnson</strong>
                              </div>
                            </td>
                            <td>mike.j@apexresolve.com</td>
                            <td>Facilities</td>
                            <td>Agent</td>
                            <td><span className="sh-status-pill sh-status-active">Active</span></td>
                          </tr>
                          <tr>
                            <td>
                              <div className="sh-user-name-wrap">
                                <div className="sh-user-initials">SW</div>
                                <strong>Sarah Wilson</strong>
                              </div>
                            </td>
                            <td>sarah.w@apexresolve.com</td>
                            <td>Finance</td>
                            <td>Analyst</td>
                            <td><span className="sh-status-pill sh-status-inactive">Inactive</span></td>
                          </tr>
                        </>
                      ) : (
                        liveData.staff.slice(0, 4).map((admin, idx) => {
                          const initials = admin.name ? admin.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'A';
                          return (
                            <tr key={idx}>
                              <td>
                                <div className="sh-user-name-wrap">
                                  <div className="sh-user-initials">{initials}</div>
                                  <strong>{admin.name || admin.username}</strong>
                                </div>
                              </td>
                              <td>{admin.email}</td>
                              <td>{admin.department || 'General Administration'}</td>
                              <td>{admin.role}</td>
                              <td><span className={`sh-status-pill ${admin.isActive !== false ? 'sh-status-active' : 'sh-status-inactive'}`}>{admin.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="sh-panel-card">
                <div className="sh-panel-header">
                  <span className="sh-panel-title">Top Escalation Groups</span>
                  <span className="sh-panel-link" onClick={() => handleTabChange('teams', 'groups')}>View All</span>
                </div>
                <div className="sh-activity-list" style={{ marginTop: 0 }}>
                  {liveData.groups.length === 0 ? (
                    <>
                      <div className="sh-quick-access-item">
                        <div className="sh-quick-access-item-left">
                          <Shield size={14} style={{ color: 'var(--accent-color)' }} />
                          <strong style={{ fontSize: '13px' }}>Level 1 Support</strong>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>12 members</span>
                      </div>
                      <div className="sh-quick-access-item">
                        <div className="sh-quick-access-item-left">
                          <Shield size={14} style={{ color: 'var(--accent-color)' }} />
                          <strong style={{ fontSize: '13px' }}>Level 2 Support</strong>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>8 members</span>
                      </div>
                      <div className="sh-quick-access-item">
                        <div className="sh-quick-access-item-left">
                          <Shield size={14} style={{ color: 'var(--accent-color)' }} />
                          <strong style={{ fontSize: '13px' }}>IT Management</strong>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>6 members</span>
                      </div>
                      <div className="sh-quick-access-item">
                        <div className="sh-quick-access-item-left">
                          <Shield size={14} style={{ color: 'var(--accent-color)' }} />
                          <strong style={{ fontSize: '13px' }}>Critical Response</strong>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>4 members</span>
                      </div>
                    </>
                  ) : (
                    liveData.groups.slice(0, 4).map((g, idx) => (
                      <div key={idx} className="sh-quick-access-item">
                        <div className="sh-quick-access-item-left">
                          <Shield size={14} style={{ color: 'var(--accent-color)' }} />
                          <strong style={{ fontSize: '13px' }}>{g.name}</strong>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{g.members?.length || 0} members</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'automation':
        return (
          <div className="fade-in">
            <div className="sh-dashboard-header-wrapper">
              <div className="sh-dashboard-title-wrap">
                <h3>Workflow Automation</h3>
                <p>Design and manage state transition workflows and automated assignment rules.</p>
              </div>
              <div className="sh-header-btn-wrap">
                <button className="btn btn-primary" onClick={() => handleTabChange('automation', 'workflows')}>
                  <Plus size={16} />
                  <span>New Workflow</span>
                </button>
              </div>
            </div>

            <div className="sh-dashboard-row-even">
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Ticket Workflows</span>
                  <span className="sh-metric-card-val">{stats.workflows}</span>
                  <span className="sh-metric-card-sublabel">Active Workflows / State Machines</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(99, 102, 241, 0.06)', color: 'var(--accent-color)' }}>
                  <GitBranch size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Service Workflows</span>
                  <span className="sh-metric-card-val">{stats.serviceWorkflows}</span>
                  <span className="sh-metric-card-sublabel">Active Workflows / Independent</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.06)', color: '#f59e0b' }}>
                  <SlidersHorizontal size={22} />
                </div>
              </div>
            </div>

            <div className="sh-designer-split-row">
              <div className="sh-designer-promo-card">
                <span className="sh-designer-promo-title">Workflow Designer</span>
                <span className="sh-designer-promo-desc">Visual workflow builder with drag & drop</span>
                <span className="sh-panel-link" onClick={() => handleTabChange('automation', 'workflows')} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Open Designer <ArrowRight size={14} />
                </span>
              </div>
              <div className="sh-designer-promo-card">
                <span className="sh-designer-promo-title">Service Workflows</span>
                <span className="sh-designer-promo-desc">Manage service specific flows</span>
                <span className="sh-panel-link" onClick={() => handleTabChange('automation', 'service-workflows')} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Open Service Designer <ArrowRight size={14} />
                </span>
              </div>
            </div>

            <div className="sh-panel-card">
              <div className="sh-panel-header">
                <span className="sh-panel-title">Recent Workflows</span>
                <span className="sh-panel-link" onClick={() => handleTabChange('automation', 'workflows')}>View All</span>
              </div>
              <div className="sh-custom-table-container">
                <table className="sh-custom-table">
                  <thead>
                    <tr>
                      <th>Workflow Name</th>
                      <th>Type</th>
                      <th>Last Updated</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveData.workflows.length === 0 && liveData.serviceWorkflows.length === 0 ? (
                      <>
                        <tr>
                          <td><strong>Incident Management Flow</strong></td>
                          <td>Ticket Workflow</td>
                          <td>May 24, 2026</td>
                          <td><span className="sh-status-pill sh-status-active">Active</span></td>
                        </tr>
                        <tr>
                          <td><strong>Service Request Flow</strong></td>
                          <td>Service Workflow</td>
                          <td>May 22, 2026</td>
                          <td><span className="sh-status-pill sh-status-active">Active</span></td>
                        </tr>
                        <tr>
                          <td><strong>Change Management Flow</strong></td>
                          <td>Ticket Workflow</td>
                          <td>May 20, 2026</td>
                          <td><span className="sh-status-pill sh-status-draft">Draft</span></td>
                        </tr>
                        <tr>
                          <td><strong>Problem Management Flow</strong></td>
                          <td>Ticket Workflow</td>
                          <td>May 18, 2026</td>
                          <td><span className="sh-status-pill sh-status-active">Active</span></td>
                        </tr>
                      </>
                    ) : (
                      [
                        ...liveData.workflows.map(w => ({ ...w, type: 'Ticket Workflow' })),
                        ...liveData.serviceWorkflows.map(w => ({ ...w, type: 'Service Workflow' }))
                      ].slice(0, 4).map((w, idx) => (
                        <tr key={idx}>
                          <td><strong>{w.name}</strong></td>
                          <td>{w.type}</td>
                          <td>{w.updatedAt ? new Date(w.updatedAt).toLocaleDateString() : 'N/A'}</td>
                          <td><span className={`sh-status-pill ${w.isActive !== false ? 'sh-status-active' : 'sh-status-draft'}`}>{w.isActive !== false ? 'Active' : 'Draft'}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'ai':
        return (
          <div className="fade-in">
            <div className="sh-dashboard-header-wrapper">
              <div className="sh-dashboard-title-wrap">
                <h3>AI & Gemini Routing</h3>
                <p>Configure AI-powered auto-routing, ticket summarization and model thresholds.</p>
              </div>
              <div className="sh-header-btn-wrap">
                <button className="btn btn-primary" onClick={() => handleTabChange('ai', 'general')}>
                  <Plus size={16} />
                  <span>New Rule</span>
                </button>
              </div>
            </div>

            <div className="sh-metric-grid">
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">AI Tags</span>
                  <span className="sh-metric-card-val">{liveData.aiSettings?.classificationRules?.length || 14}</span>
                  <span className="sh-metric-card-sublabel">Active Fields</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(99, 102, 241, 0.06)', color: 'var(--accent-color)' }}>
                  <Cpu size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Routing Accuracy</span>
                  <span className="sh-metric-card-val">{liveData.aiAnalytics?.accuracy ? (liveData.aiAnalytics.accuracy * 100).toFixed(1) + '%' : '94.2%'}</span>
                  <span className="sh-metric-card-sublabel">Last 30 Days</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.06)', color: '#10b981' }}>
                  <Star size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Auto-Routed Tickets</span>
                  <span className="sh-metric-card-val">{liveData.aiAnalytics?.autoRoutedCount || 1248}</span>
                  <span className="sh-metric-card-sublabel">This Month</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.06)', color: '#f59e0b' }}>
                  <TrendingUp size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Model Status</span>
                  <span className="sh-metric-card-val" style={{ fontSize: '18px', fontWeight: 800 }}>
                    {liveData.aiSettings?.enableAiRouting !== false ? 'Operational' : 'Disabled'}
                  </span>
                  <span className="sh-metric-card-sublabel">All Systems</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: liveData.aiSettings?.enableAiRouting !== false ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)', color: liveData.aiSettings?.enableAiRouting !== false ? '#10b981' : '#64748b' }}>
                  <Shield size={22} />
                </div>
              </div>
            </div>

            <div className="sh-panel-card" style={{ marginBottom: '24px' }}>
              <div className="sh-panel-header">
                <span className="sh-panel-title">AI Auto-Routing Rules</span>
                <span className="sh-panel-link" onClick={() => handleTabChange('ai', 'general')}>View All</span>
              </div>
              <div className="sh-custom-table-container">
                <table className="sh-custom-table">
                  <thead>
                    <tr>
                      <th>Rule Name</th>
                      <th>Conditions</th>
                      <th>Priority</th>
                      <th>Accuracy</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!liveData.aiSettings || !liveData.aiSettings.classificationRules || liveData.aiSettings.classificationRules.length === 0) ? (
                      <>
                        <tr>
                          <td><strong>IT Support Router</strong></td>
                          <td><code>#it, login, access, password</code></td>
                          <td>1</td>
                          <td><strong>95.7%</strong></td>
                          <td><span className="sh-status-pill sh-status-active">Active</span></td>
                        </tr>
                        <tr>
                          <td><strong>Hardware Problems</strong></td>
                          <td><code>laptop, hardware, device, repair</code></td>
                          <td>2</td>
                          <td><strong>93.4%</strong></td>
                          <td><span className="sh-status-pill sh-status-active">Active</span></td>
                        </tr>
                        <tr>
                          <td><strong>Software Issues</strong></td>
                          <td><code>software, install, error, application</code></td>
                          <td>3</td>
                          <td><strong>92.8%</strong></td>
                          <td><span className="sh-status-pill sh-status-active">Active</span></td>
                        </tr>
                        <tr>
                          <td><strong>Network Problems</strong></td>
                          <td><code>network, wifi, internet, connection</code></td>
                          <td>4</td>
                          <td><strong>91.5%</strong></td>
                          <td><span className="sh-status-pill sh-status-active">Active</span></td>
                        </tr>
                      </>
                    ) : (
                      liveData.aiSettings.classificationRules.slice(0, 4).map((rule, idx) => (
                        <tr key={idx}>
                          <td><strong>{rule.name || `Rule ${idx + 1}`}</strong></td>
                          <td><code>{rule.keywords ? rule.keywords.join(', ') : 'none'}</code></td>
                          <td>{idx + 1}</td>
                          <td><strong>{rule.confidenceThreshold ? (rule.confidenceThreshold * 100).toFixed(1) + '%' : '92.5%'}</strong></td>
                          <td><span className="sh-status-pill sh-status-active">Active</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sparkline chart section */}
            <div className="sh-panel-card">
              <span className="sh-panel-title">AI Model Performance</span>
              <div className="sh-ai-performance-wrap">
                <div className="sh-ai-performance-row">
                  <div className="sh-ai-perf-metric-box">
                    <span className="sh-ai-perf-lbl">Precision:</span>
                    <span className="sh-ai-perf-val">{liveData.aiAnalytics?.precision ? (liveData.aiAnalytics.precision * 100).toFixed(1) + '%' : '95.2%'}</span>
                    <span className="sh-ai-perf-pct">+2.4%</span>
                  </div>
                  <div className="sh-ai-perf-metric-box">
                    <span className="sh-ai-perf-lbl">Recall:</span>
                    <span className="sh-ai-perf-val">{liveData.aiAnalytics?.recall ? (liveData.aiAnalytics.recall * 100).toFixed(1) + '%' : '93.7%'}</span>
                    <span className="sh-ai-perf-pct">+1.8%</span>
                  </div>
                  <div className="sh-ai-perf-metric-box">
                    <span className="sh-ai-perf-lbl">F1 Score:</span>
                    <span className="sh-ai-perf-val">{liveData.aiAnalytics?.f1Score ? (liveData.aiAnalytics.f1Score * 100).toFixed(1) + '%' : '94.4%'}</span>
                    <span className="sh-ai-perf-pct">+3.1%</span>
                  </div>

                  <div style={{ flex: 1, height: '40px', maxWidth: '340px' }}>
                    <svg viewBox="0 0 300 40" width="100%" height="100%">
                      <path 
                        d="M0,35 Q30,10 60,25 T120,5 T180,30 T240,12 T300,8" 
                        fill="none" 
                        stroke="var(--accent-color)" 
                        strokeWidth="3.5" 
                        strokeLinecap="round" 
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'assets':
        let activeAssets = 0;
        let stockAssets = 0;
        let repairAssets = 0;
        let retiredAssets = 0;
        const totalAssetsCount = liveData.assets.length;

        if (liveData.assets.length > 0) {
          liveData.assets.forEach(a => {
            const status = (a.status || '').toLowerCase();
            if (status === 'active' || status === 'in use') {
              activeAssets++;
            } else if (status === 'in store' || status === 'in stock') {
              stockAssets++;
            } else if (status === 'under repair' || status === 'maintenance' || status === 'repair' || status === 'under maintenance') {
              repairAssets++;
            } else if (status === 'retired' || status === 'disposed') {
              retiredAssets++;
            } else {
              activeAssets++;
            }
          });
        }

        const useDash = totalAssetsCount > 0 ? Math.round((activeAssets / totalAssetsCount) * 251) : 0;
        const stockDash = totalAssetsCount > 0 ? Math.round((stockAssets / totalAssetsCount) * 251) : 0;
        const repairDash = totalAssetsCount > 0 ? Math.round((repairAssets / totalAssetsCount) * 251) : 0;
        const retiredDash = totalAssetsCount > 0 ? Math.round((retiredAssets / totalAssetsCount) * 251) : 0;

        return (
          <div className="fade-in">
            <div className="sh-dashboard-header-wrapper">
              <div className="sh-dashboard-title-wrap">
                <h3>Asset Management & CMDB Console</h3>
                <p>Manage your configuration items, asset lifecycle and relationships.</p>
              </div>
              <div className="sh-header-btn-wrap">
                <button className="btn btn-primary" onClick={() => handleTabChange('assets', 'inventory')}>
                  <Plus size={16} />
                  <span>Add Asset</span>
                </button>
              </div>
            </div>

            <div className="sh-metric-grid">
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Registered Assets</span>
                  <span className="sh-metric-card-val">{totalAssetsCount}</span>
                  <span className="sh-metric-card-sublabel">Total Assets</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(99, 102, 241, 0.06)', color: 'var(--accent-color)' }}>
                  <Layers size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Asset Categories</span>
                  <span className="sh-metric-card-val">{stats.assetCategories}</span>
                  <span className="sh-metric-card-sublabel">Logical Catalogs</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.06)', color: '#10b981' }}>
                  <Building2 size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Type Templates</span>
                  <span className="sh-metric-card-val">{stats.assetTypes}</span>
                  <span className="sh-metric-card-sublabel">Schema Defined</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.06)', color: '#f59e0b' }}>
                  <SlidersHorizontal size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Relationships</span>
                  <span className="sh-metric-card-val">{stats.relationships}</span>
                  <span className="sh-metric-card-sublabel">Mapped Links</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(168, 85, 247, 0.06)', color: '#a855f7' }}>
                  <GitBranch size={22} />
                </div>
              </div>
            </div>

            <div className="sh-dashboard-row-even">
              <div className="sh-panel-card">
                <span className="sh-panel-title" style={{ marginBottom: '16px' }}>Asset Overview</span>
                <div className="sh-donut-chart-wrap">
                  <div className="sh-donut-graphic">
                    <svg viewBox="0 0 100 100" width="120" height="120">
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--border-color)" strokeWidth="12" />
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray={`${useDash} 251`} strokeDashoffset="0" />
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#0ea5e9" strokeWidth="12" strokeDasharray={`${stockDash} 251`} strokeDashoffset={`-${useDash}`} />
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f59e0b" strokeWidth="12" strokeDasharray={`${repairDash} 251`} strokeDashoffset={`-${useDash + stockDash}`} />
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#64748b" strokeWidth="12" strokeDasharray={`${retiredDash} 251`} strokeDashoffset={`-${useDash + stockDash + repairDash}`} />
                    </svg>
                    <div className="sh-donut-graphic-text">
                      <span className="sh-donut-graphic-val">{totalAssetsCount}</span>
                      <span className="sh-donut-graphic-lbl">Total</span>
                    </div>
                  </div>
                  <div className="sh-donut-legend">
                    <div className="sh-donut-legend-item">
                      <div className="sh-donut-legend-left">
                        <div className="sh-donut-color-dot" style={{ backgroundColor: '#10b981' }} />
                        <span className="sh-donut-legend-label">In Use</span>
                      </div>
                      <span className="sh-donut-legend-val">
                        {totalAssetsCount > 0 ? `${activeAssets} (${Math.round((activeAssets / totalAssetsCount) * 100)}%)` : '0 (0%)'}
                      </span>
                    </div>
                    <div className="sh-donut-legend-item">
                      <div className="sh-donut-legend-left">
                        <div className="sh-donut-color-dot" style={{ backgroundColor: '#0ea5e9' }} />
                        <span className="sh-donut-legend-label">In Stock</span>
                      </div>
                      <span className="sh-donut-legend-val">
                        {totalAssetsCount > 0 ? `${stockAssets} (${Math.round((stockAssets / totalAssetsCount) * 100)}%)` : '0 (0%)'}
                      </span>
                    </div>
                    <div className="sh-donut-legend-item">
                      <div className="sh-donut-legend-left">
                        <div className="sh-donut-color-dot" style={{ backgroundColor: '#f59e0b' }} />
                        <span className="sh-donut-legend-label">Under Maintenance</span>
                      </div>
                      <span className="sh-donut-legend-val">
                        {totalAssetsCount > 0 ? `${repairAssets} (${Math.round((repairAssets / totalAssetsCount) * 100)}%)` : '0 (0%)'}
                      </span>
                    </div>
                    <div className="sh-donut-legend-item">
                      <div className="sh-donut-legend-left">
                        <div className="sh-donut-color-dot" style={{ backgroundColor: '#64748b' }} />
                        <span className="sh-donut-legend-label">Retired</span>
                      </div>
                      <span className="sh-donut-legend-val">
                        {totalAssetsCount > 0 ? `${retiredAssets} (${Math.round((retiredAssets / totalAssetsCount) * 100)}%)` : '0 (0%)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sh-panel-card">
                <div className="sh-panel-header">
                  <span className="sh-panel-title">Recent Assets</span>
                  <span className="sh-panel-link" onClick={() => handleTabChange('assets', 'inventory')}>View All</span>
                </div>
                <div className="sh-custom-table-container">
                  <table className="sh-custom-table">
                    <thead>
                      <tr>
                        <th>Asset Name</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveData.assets.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                            No recent assets found
                          </td>
                        </tr>
                      ) : (
                        liveData.assets.slice(0, 5).map((asset, idx) => (
                          <tr key={idx}>
                            <td><strong>{asset.name || asset.serialNumber}</strong></td>
                            <td>{asset.type || 'Hardware'}</td>
                            <td><span className="sh-status-pill sh-status-active">{asset.status || 'In Use'}</span></td>
                            <td>{asset.ownerName || 'IT Support'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick Actions Links Grid */}
            <div className="sh-sys-config-grid" style={{ marginTop: '8px' }}>
              <div className="sh-sys-config-item" onClick={() => handleTabChange('assets', 'categories')}>
                <div className="sh-sys-config-icon-box">
                  <Layers size={18} />
                </div>
                <div className="sh-sys-config-text">
                  <span className="sh-sys-config-title">Manage Categories</span>
                  <span className="sh-sys-config-desc">Organize asset categories</span>
                </div>
              </div>
              <div className="sh-sys-config-item" onClick={() => handleTabChange('assets', 'types')}>
                <div className="sh-sys-config-icon-box">
                  <SlidersHorizontal size={18} />
                </div>
                <div className="sh-sys-config-text">
                  <span className="sh-sys-config-title">Manage Types Schema</span>
                  <span className="sh-sys-config-desc">Define asset types/templates</span>
                </div>
              </div>
              <div className="sh-sys-config-item" onClick={() => handleTabChange('assets', 'inventory')}>
                <div className="sh-sys-config-icon-box">
                  <Layers size={18} />
                </div>
                <div className="sh-sys-config-text">
                  <span className="sh-sys-config-title">Browse CI Inventory</span>
                  <span className="sh-sys-config-desc">View all configuration items</span>
                </div>
              </div>
              <div className="sh-sys-config-item" onClick={() => handleTabChange('assets', 'relationships')}>
                <div className="sh-sys-config-icon-box">
                  <GitBranch size={18} />
                </div>
                <div className="sh-sys-config-text">
                  <span className="sh-sys-config-title">Dependency Topology</span>
                  <span className="sh-sys-config-desc">Visual relationship mapping</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'analytics':
        const getTicketRating = (t) => {
          return t.feedback?.overallRating || t.rating || 0;
        };

        const ticketsWithRatings = liveData.tickets.filter(t => {
          const r = getTicketRating(t);
          return typeof r === 'number' && r > 0;
        });

        const csatScoreVal = ticketsWithRatings.length > 0 
          ? (ticketsWithRatings.reduce((sum, t) => sum + getTicketRating(t), 0) / ticketsWithRatings.length).toFixed(1)
          : 'N/A';

        const csatScorePercentage = ticketsWithRatings.length > 0
          ? Math.round((ticketsWithRatings.filter(t => getTicketRating(t) >= 4).length / ticketsWithRatings.length) * 100)
          : 'N/A';

        const duplicateRateVal = liveData.tickets.length > 0
          ? ((liveData.duplicateAudits.length / liveData.tickets.length) * 100).toFixed(1) + '%'
          : '0.0%';

        const breachesCountVal = liveData.tickets.filter(t => t.responseSlaStatus === 'Breached' || t.resolutionSlaStatus === 'Breached' || (t.totalBreachCount && t.totalBreachCount > 0)).length;

        const resolvedTickets = liveData.tickets.filter(t => t.resolvedAt);
        let avgHoursVal = 'N/A';
        if (resolvedTickets.length > 0) {
          const totalMs = resolvedTickets.reduce((sum, t) => sum + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0);
          avgHoursVal = (totalMs / (resolvedTickets.length * 60 * 60 * 1000)).toFixed(1) + ' hrs';
        }

        // Dynamic CSAT breakdown values
        let totalReviews = ticketsWithRatings.length;
        let verySatisfiedCount = 0;
        let satisfiedCount = 0;
        let neutralCount = 0;
        let dissatisfiedCount = 0;
        let veryDissatisfiedCount = 0;

        ticketsWithRatings.forEach(t => {
          const r = getTicketRating(t);
          if (r === 5) verySatisfiedCount++;
          else if (r === 4) satisfiedCount++;
          else if (r === 3) neutralCount++;
          else if (r === 2) dissatisfiedCount++;
          else if (r === 1) veryDissatisfiedCount++;
        });

        const verySatisfiedPct = totalReviews > 0 ? ((verySatisfiedCount / totalReviews) * 100).toFixed(1) : '0.0';
        const satisfiedPct = totalReviews > 0 ? ((satisfiedCount / totalReviews) * 100).toFixed(1) : '0.0';
        const neutralPct = totalReviews > 0 ? ((neutralCount / totalReviews) * 100).toFixed(1) : '0.0';
        const dissatisfiedPct = totalReviews > 0 ? ((dissatisfiedCount / totalReviews) * 100).toFixed(1) : '0.0';
        const veryDissatisfiedPct = totalReviews > 0 ? ((veryDissatisfiedCount / totalReviews) * 100).toFixed(1) : '0.0';

        const totalCircumference = 251.2;
        const vsDash = totalReviews > 0 ? (verySatisfiedCount / totalReviews) * totalCircumference : 0;
        const sDash = totalReviews > 0 ? (satisfiedCount / totalReviews) * totalCircumference : 0;
        const nDash = totalReviews > 0 ? (neutralCount / totalReviews) * totalCircumference : 0;
        const dDash = totalReviews > 0 ? (dissatisfiedCount / totalReviews) * totalCircumference : 0;
        const vdDash = totalReviews > 0 ? (veryDissatisfiedCount / totalReviews) * totalCircumference : 0;

        const vsOffset = 0;
        const sOffset = -vsDash;
        const nOffset = -(vsDash + sDash);
        const dOffset = -(vsDash + sDash + nDash);
        const vdOffset = -(vsDash + sDash + nDash + dDash);

        return (
          <div className="fade-in">
            <div className="sh-dashboard-header-wrapper">
              <div className="sh-dashboard-title-wrap">
                <h3>Analytics & KPI Reports</h3>
                <p>Monitor performance metrics, CSAT feedback and system analytics.</p>
              </div>
              <div className="sh-header-btn-wrap">
                <select className="form-control" style={{ width: '180px', padding: '8px 12px', fontSize: '13px', borderRadius: '8px' }}>
                  <option>May 20 - May 26, 2026</option>
                </select>
                <button className="btn btn-primary">
                  <span>Export Report</span>
                </button>
              </div>
            </div>

            <div className="sh-metric-grid">
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">CSAT Score</span>
                  <span className="sh-metric-card-val">
                    {csatScoreVal === 'N/A' ? 'N/A' : `${csatScoreVal} / 5.0`}
                    {csatScorePercentage !== 'N/A' && ` (${csatScorePercentage}%)`}
                  </span>
                  <span className="sh-metric-card-sublabel" style={{ color: csatScoreVal === 'N/A' ? 'var(--text-muted)' : '#10b981', fontWeight: 700 }}>
                    {csatScoreVal === 'N/A' ? 'No reviews' : parseFloat(csatScoreVal) >= 4.0 ? 'Excellent' : 'Good'}
                  </span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(99, 102, 241, 0.06)', color: 'var(--accent-color)' }}>
                  <Star size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Duplicate Rate</span>
                  <span className="sh-metric-card-val">{duplicateRateVal}</span>
                  <span className="sh-metric-card-sublabel" style={{ color: 'var(--text-muted)' }}>
                    {liveData.duplicateAudits.length} duplicates found
                  </span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.06)', color: '#10b981' }}>
                  <Copy size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">SLA Breaches</span>
                  <span className="sh-metric-card-val">{breachesCountVal}</span>
                  <span className="sh-metric-card-sublabel" style={{ color: breachesCountVal > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                    {breachesCountVal > 0 ? 'Breaches recorded' : 'All compliant'}
                  </span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', color: '#ef4444' }}>
                  <ShieldAlert size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Avg. Resolution Time</span>
                  <span className="sh-metric-card-val">{avgHoursVal}</span>
                  <span className="sh-metric-card-sublabel" style={{ color: 'var(--text-muted)' }}>
                    {resolvedTickets.length > 0 ? 'Based on resolved cases' : 'No resolved cases'}
                  </span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(245, 158, 11, 0.06)', color: '#f59e0b' }}>
                  <Activity size={22} />
                </div>
              </div>
            </div>

            <div className="sh-dashboard-row">
              {/* Line graph */}
              <div className="sh-panel-card">
                <span className="sh-panel-title" style={{ marginBottom: '18px' }}>KPI Trends (Last 30 Days)</span>
                <div style={{ width: '100%', height: '240px' }}>
                  <svg viewBox="0 0 500 200" width="100%" height="100%">
                    {/* Grid lines */}
                    <line x1="40" y1="20" x2="480" y2="20" stroke="var(--border-color)" strokeWidth="0.5" />
                    <line x1="40" y1="60" x2="480" y2="60" stroke="var(--border-color)" strokeWidth="0.5" />
                    <line x1="40" y1="100" x2="480" y2="100" stroke="var(--border-color)" strokeWidth="0.5" />
                    <line x1="40" y1="140" x2="480" y2="140" stroke="var(--border-color)" strokeWidth="0.5" />
                    <line x1="40" y1="180" x2="480" y2="180" stroke="var(--border-color)" strokeWidth="1" />

                    {/* Chart lines */}
                    {/* CSAT Line */}
                    <path d="M40,60 L120,45 L200,50 L280,30 L360,40 L440,25 L480,20" fill="none" stroke="var(--accent-color)" strokeWidth="2.5" />
                    {/* SLA Breaches */}
                    <path d="M40,160 L120,130 L200,140 L280,110 L360,120 L440,150 L480,145" fill="none" stroke="#ef4444" strokeWidth="2.5" />
                    {/* Resolution Time */}
                    <path d="M40,120 L120,110 L200,85 L280,95 L360,70 L440,65 L480,55" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />
                  </svg>
                </div>
              </div>

              {/* Donut breakdown */}
              <div className="sh-panel-card">
                <span className="sh-panel-title" style={{ marginBottom: '16px' }}>CSAT Breakdown</span>
                <div className="sh-donut-chart-wrap" style={{ flexDirection: 'column' }}>
                  <div className="sh-donut-graphic" style={{ marginBottom: '20px' }}>
                    <svg viewBox="0 0 100 100" width="100" height="100%">
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--border-color)" strokeWidth="10" />
                      {/* Very Satisfied */}
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="10" strokeDasharray={`${vsDash} ${totalCircumference}`} strokeDashoffset={vsOffset} />
                      {/* Satisfied */}
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#6366f1" strokeWidth="10" strokeDasharray={`${sDash} ${totalCircumference}`} strokeDashoffset={sOffset} />
                      {/* Neutral */}
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f59e0b" strokeWidth="10" strokeDasharray={`${nDash} ${totalCircumference}`} strokeDashoffset={nOffset} />
                      {/* Dissatisfied */}
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f97316" strokeWidth="10" strokeDasharray={`${dDash} ${totalCircumference}`} strokeDashoffset={dOffset} />
                      {/* Very Dissatisfied */}
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ef4444" strokeWidth="10" strokeDasharray={`${vdDash} ${totalCircumference}`} strokeDashoffset={vdOffset} />
                    </svg>
                    <div className="sh-donut-graphic-text">
                      <span className="sh-donut-graphic-val" style={{ fontSize: '18px' }}>{totalReviews}</span>
                      <span className="sh-donut-graphic-lbl" style={{ fontSize: '9px' }}>Reviews</span>
                    </div>
                  </div>
                  <div className="sh-donut-legend" style={{ width: '100%' }}>
                    <div className="sh-donut-legend-item">
                      <div className="sh-donut-legend-left">
                        <div className="sh-donut-color-dot" style={{ backgroundColor: '#10b981' }} />
                        <span className="sh-donut-legend-label" style={{ fontSize: '12px' }}>Very Satisfied</span>
                      </div>
                      <span className="sh-donut-legend-val" style={{ fontSize: '12px' }}>{verySatisfiedCount} ({verySatisfiedPct}%)</span>
                    </div>
                    <div className="sh-donut-legend-item">
                      <div className="sh-donut-legend-left">
                        <div className="sh-donut-color-dot" style={{ backgroundColor: '#6366f1' }} />
                        <span className="sh-donut-legend-label" style={{ fontSize: '12px' }}>Satisfied</span>
                      </div>
                      <span className="sh-donut-legend-val" style={{ fontSize: '12px' }}>{satisfiedCount} ({satisfiedPct}%)</span>
                    </div>
                    <div className="sh-donut-legend-item">
                      <div className="sh-donut-legend-left">
                        <div className="sh-donut-color-dot" style={{ backgroundColor: '#f59e0b' }} />
                        <span className="sh-donut-legend-label" style={{ fontSize: '12px' }}>Neutral</span>
                      </div>
                      <span className="sh-donut-legend-val" style={{ fontSize: '12px' }}>{neutralCount} ({neutralPct}%)</span>
                    </div>
                    <div className="sh-donut-legend-item">
                      <div className="sh-donut-legend-left">
                        <div className="sh-donut-color-dot" style={{ backgroundColor: '#f97316' }} />
                        <span className="sh-donut-legend-label" style={{ fontSize: '12px' }}>Dissatisfied</span>
                      </div>
                      <span className="sh-donut-legend-val" style={{ fontSize: '12px' }}>{dissatisfiedCount} ({dissatisfiedPct}%)</span>
                    </div>
                    <div className="sh-donut-legend-item">
                      <div className="sh-donut-legend-left">
                        <div className="sh-donut-color-dot" style={{ backgroundColor: '#ef4444' }} />
                        <span className="sh-donut-legend-label" style={{ fontSize: '12px' }}>Very Dissatisfied</span>
                      </div>
                      <span className="sh-donut-legend-val" style={{ fontSize: '12px' }}>{veryDissatisfiedCount} ({veryDissatisfiedPct}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'platform':
        return (
          <div className="fade-in">
            <div className="sh-dashboard-header-wrapper">
              <div className="sh-dashboard-title-wrap">
                <h3>Platform Settings</h3>
                <p>Configure global settings, branding, organizations and system integrations.</p>
              </div>
              <div className="sh-header-btn-wrap">
                <button className="btn btn-primary">
                  <span>Save Changes</span>
                </button>
              </div>
            </div>

            <div className="sh-metric-grid">
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Organizations</span>
                  <span className="sh-metric-card-val">{stats.tenants || 2}</span>
                  <span className="sh-metric-card-sublabel">Active Tenants</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(99, 102, 241, 0.06)', color: 'var(--accent-color)' }}>
                  <Building2 size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Portal Theme</span>
                  <span className="sh-metric-card-val" style={{ fontSize: '18px', fontWeight: 800 }}>ApexResolve</span>
                  <span className="sh-metric-card-sublabel">Active Theme</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(168, 85, 247, 0.06)', color: '#a855f7' }}>
                  <SlidersHorizontal size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">System Status</span>
                  <span className="sh-metric-card-val" style={{ fontSize: '18px', fontWeight: 800 }}>Operational</span>
                  <span className="sh-metric-card-sublabel">All Systems Running</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(16, 185, 129, 0.06)', color: '#10b981' }}>
                  <Activity size={22} />
                </div>
              </div>
              <div className="sh-metric-card-custom">
                <div className="sh-metric-card-left">
                  <span className="sh-metric-card-label">Version</span>
                  <span className="sh-metric-card-val">v2.4.1</span>
                  <span className="sh-metric-card-sublabel">Latest Release</span>
                </div>
                <div className="sh-metric-icon-box" style={{ backgroundColor: 'rgba(100, 116, 139, 0.06)', color: '#64748b' }}>
                  <Settings size={22} />
                </div>
              </div>
            </div>

            <div className="sh-dashboard-row">
              <div className="sh-panel-card">
                <span className="sh-panel-title" style={{ marginBottom: '18px' }}>System Configuration</span>
                <div className="sh-sys-config-grid">
                  <div className="sh-sys-config-item" onClick={() => handleTabChange('platform', 'branding')}>
                    <div className="sh-sys-config-icon-box">
                      <SlidersHorizontal size={18} />
                    </div>
                    <div className="sh-sys-config-text">
                      <span className="sh-sys-config-title">Portal Customization</span>
                      <span className="sh-sys-config-desc">Logo, colors and branding</span>
                    </div>
                  </div>
                  <div className="sh-sys-config-item">
                    <div className="sh-sys-config-icon-box">
                      <Settings size={18} />
                    </div>
                    <div className="sh-sys-config-text">
                      <span className="sh-sys-config-title">Email Settings</span>
                      <span className="sh-sys-config-desc">SMTP and notifications</span>
                    </div>
                  </div>
                  <div className="sh-sys-config-item">
                    <div className="sh-sys-config-icon-box">
                      <Shield size={18} />
                    </div>
                    <div className="sh-sys-config-text">
                      <span className="sh-sys-config-title">Security Settings</span>
                      <span className="sh-sys-config-desc">Authentication & access</span>
                    </div>
                  </div>
                  <div className="sh-sys-config-item" onClick={() => handleTabChange('operations', 'sla')}>
                    <div className="sh-sys-config-icon-box">
                      <Layers size={18} />
                    </div>
                    <div className="sh-sys-config-text">
                      <span className="sh-sys-config-title">SLA Default Defaults</span>
                      <span className="sh-sys-config-desc">Default SLA configurations</span>
                    </div>
                  </div>
                  <div className="sh-sys-config-item">
                    <div className="sh-sys-config-icon-box">
                      <Database size={18} />
                    </div>
                    <div className="sh-sys-config-text">
                      <span className="sh-sys-config-title">Backup & Recovery</span>
                      <span className="sh-sys-config-desc">System backups & restore</span>
                    </div>
                  </div>
                  <div className="sh-sys-config-item">
                    <div className="sh-sys-config-icon-box">
                      <Globe size={18} />
                    </div>
                    <div className="sh-sys-config-text">
                      <span className="sh-sys-config-title">API & Integrations</span>
                      <span className="sh-sys-config-desc">Third-party connections</span>
                    </div>
                  </div>
                  <div className="sh-sys-config-item" onClick={() => handleTabChange('platform', 'webhooks')}>
                    <div className="sh-sys-config-icon-box">
                      <Globe size={18} />
                    </div>
                    <div className="sh-sys-config-text">
                      <span className="sh-sys-config-title">Webhook Settings</span>
                      <span className="sh-sys-config-desc">Event notifications</span>
                    </div>
                  </div>
                  <div className="sh-sys-config-item">
                    <div className="sh-sys-config-icon-box">
                      <Database size={18} />
                    </div>
                    <div className="sh-sys-config-text">
                      <span className="sh-sys-config-title">Audit & Logs</span>
                      <span className="sh-sys-config-desc">System audit trails</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sh-panel-card">
                <div className="sh-panel-header">
                  <span className="sh-panel-title">System Activity</span>
                  <span className="sh-panel-link">View All</span>
                </div>
                <div className="sh-activity-list">
                  <div className="sh-activity-item">
                    <div className="sh-activity-dot-indicator" style={{ backgroundColor: '#6366f1' }} />
                    <div className="sh-activity-body">
                      <span className="sh-activity-title">Configuration Updated</span>
                      <span className="sh-activity-desc">Portal branding changed</span>
                      <span className="sh-activity-time">2m ago</span>
                    </div>
                  </div>
                  <div className="sh-activity-item">
                    <div className="sh-activity-dot-indicator" style={{ backgroundColor: '#10b981' }} />
                    <div className="sh-activity-body">
                      <span className="sh-activity-title">New Organization Added</span>
                      <span className="sh-activity-desc">TechCorp Inc. embedded</span>
                      <span className="sh-activity-time">5h ago</span>
                    </div>
                  </div>
                  <div className="sh-activity-item">
                    <div className="sh-activity-dot-indicator" style={{ backgroundColor: '#f59e0b' }} />
                    <div className="sh-activity-body">
                      <span className="sh-activity-title">Backup Completed</span>
                      <span className="sh-activity-desc">Daily backup completed</span>
                      <span className="sh-activity-time">12h ago</span>
                    </div>
                  </div>
                  <div className="sh-activity-item">
                    <div className="sh-activity-dot-indicator" style={{ backgroundColor: '#a855f7' }} />
                    <div className="sh-activity-body">
                      <span className="sh-activity-title">Security Scan</span>
                      <span className="sh-activity-desc">No threats detected</span>
                      <span className="sh-activity-time">2d ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="sh-container">
      {/* Search & Profile Bar at the Top */}
      <div className="sh-header-wrapper">
        <div className="sh-search-wrapper">
          <Search size={16} className="sh-search-icon" />
          <input 
            type="text" 
            ref={searchInputRef}
            className="sh-search-input" 
            placeholder="Search keywords... (Press '/')" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="sh-search-badge">/</span>

          {searchQuery && (
            <div className="sh-search-results">
              {searchResults.length === 0 ? (
                <div className="p-3 text-muted" style={{ fontSize: '12.5px' }}>No matches found</div>
              ) : (
                searchResults.map((item, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => {
                      handleTabChange(item.section, item.tab);
                      setSearchQuery('');
                    }}
                    className="sh-search-result-item"
                  >
                    <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{item.title}</div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Section: {item.section}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="sh-top-actions">
          <button className="sh-action-icon-btn" title="Notifications">
            <Bell size={20} />
            <span className="sh-badge-count">3</span>
          </button>
          <button className="sh-action-icon-btn" title="Help">
            <HelpCircle size={20} />
          </button>
          <div className="sh-profile-trigger">
            <div className="sh-profile-avatar">
              {user?.name ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'A'}
            </div>
            <div className="sh-profile-text">
              <span className="sh-profile-username">{user?.name || 'Admin User'}</span>
              <span className="sh-profile-role">{user?.role === 'admin' ? 'Super Administrator' : 'Administrator'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="sh-layout-grid">
        {/* Left Console Sidebar Navigation */}
        <aside className="sh-sidebar-card">
          <div className="sh-brand-section">
            <div className="sh-brand-title-wrap">
              <div className="sh-brand-icon-box">
                <Settings size={18} />
              </div>
              <span className="sh-brand-name">System Control Hub</span>
            </div>
            <span className="sh-brand-subtitle">Enterprise Administration</span>
          </div>

          <div>
            <span className="sh-section-title">Console Directory</span>
            <div className="sh-nav-group">
              {sections.map((sec) => {
                if (sec.showOnlySuperAdmin && !isSuperAdmin) return null;

                const isSelected = activeSection === sec.id;
                return (
                  <div key={sec.id}>
                    <button
                      onClick={() => handleTabChange(sec.id, 'overview')}
                      className={`sh-nav-btn ${isSelected ? 'active' : ''}`}
                    >
                      {sec.icon}
                      <span style={{ marginLeft: '10px' }}>{sec.title}</span>
                    </button>

                    {isSelected && (
                      <div className="sh-subtabs-list">
                        {sec.tabs.map((tab) => {
                          if (!tab.show) return null;
                          const isTabSelected = activeTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => handleTabChange(sec.id, tab.id)}
                              className={`sh-subtab-btn ${isTabSelected ? 'active' : ''}`}
                            >
                              {tab.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <span className="sh-section-title">Quick Access</span>
            <div className="sh-quick-access-wrapper">
              <button className="sh-quick-access-item" onClick={() => handleTabChange('teams', 'staff')}>
                <div className="sh-quick-access-item-left">
                  <Users size={14} />
                  <span>Manage Staff Directory</span>
                </div>
              </button>
              <button className="sh-quick-access-item">
                <div className="sh-quick-access-item-left">
                  <Activity size={14} />
                  <span>System Health</span>
                </div>
                <span className="sh-pill-status sh-pill-green">Healthy</span>
              </button>
              <button className="sh-quick-access-item" onClick={() => handleTabChange('platform', 'overview')}>
                <div className="sh-quick-access-item-left">
                  <Activity size={14} />
                  <span>Recent Activity</span>
                </div>
              </button>
              <button className="sh-quick-access-item" onClick={() => navigate('/')}>
                <div className="sh-quick-access-item-left">
                  <BookOpen size={14} />
                  <span>Knowledge Base</span>
                </div>
              </button>
              <button className="sh-quick-access-item" onClick={() => navigate('/')} style={{ borderColor: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-color)', marginTop: '8px' }}>
                <div className="sh-quick-access-item-left">
                  <ArrowRight size={14} />
                  <span>Back to Admin Board</span>
                </div>
              </button>
            </div>
          </div>

          {/* Advanced Toggles Section */}
          <div className="sh-advanced-card" style={{ marginTop: 'auto' }}>
            <label className="sh-toggle-label">
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>Show Advanced Settings</span>
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)} 
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-color)', cursor: 'pointer' }}
              >
                {showAdvanced ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </label>
            
            <div className="sh-admin-mode-card" onClick={() => navigate('/')}>
              <div className="sh-admin-mode-left">
                <Shield size={16} className="sh-admin-mode-icon" />
                <div className="sh-admin-mode-text">
                  <span className="sh-admin-mode-title">General Administration Mode</span>
                  <span className="sh-admin-mode-subtitle">Full Control Access</span>
                </div>
              </div>
              <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </div>
          </div>
        </aside>

        {/* Right workspace panel */}
        <div className="sh-workspace-card">
          {renderWorkspace()}
        </div>
      </div>
    </div>
  );
};

export default SettingsHub;
