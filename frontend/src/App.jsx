import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import { LayoutGrid, Check, Menu } from 'lucide-react';

// Pages (Lazy loaded for optimal initial chunk load size)
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const RegisterTenant = React.lazy(() => import('./pages/RegisterTenant'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const FileComplaint = React.lazy(() => import('./pages/FileComplaint'));
const ComplaintDetail = React.lazy(() => import('./pages/ComplaintDetail'));
const BrandingSettings = React.lazy(() => import('./pages/BrandingSettings'));
const SettingsHub = React.lazy(() => import('./pages/SettingsHub'));
const AdminStaff = React.lazy(() => import('./pages/AdminStaff'));
const AdminTemplates = React.lazy(() => import('./pages/AdminTemplates'));
const DepartmentDashboard = React.lazy(() => import('./pages/DepartmentDashboard'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const EscalationRules = React.lazy(() => import('./pages/EscalationRules'));
const EscalationAnalytics = React.lazy(() => import('./pages/EscalationAnalytics'));
const Profile = React.lazy(() => import('./pages/Profile'));
const CsatAnalytics = React.lazy(() => import('./pages/CsatAnalytics'));
const WorkloadDashboard = React.lazy(() => import('./pages/WorkloadDashboard'));
const WorkflowDesigner = React.lazy(() => import('./pages/WorkflowDesigner'));
const AiSettingsPage = React.lazy(() => import('./pages/AiSettingsPage'));
const DuplicateAnalytics = React.lazy(() => import('./pages/DuplicateAnalytics'));
const GroupManagement = React.lazy(() => import('./pages/GroupManagement'));
const BusinessCalendarSettings = React.lazy(() => import('./pages/BusinessCalendarSettings'));
const SlaConfigPanel = React.lazy(() => import('./pages/SlaConfigPanel'));
const ExecutiveDashboard = React.lazy(() => import('./pages/ExecutiveDashboard'));
const CalendarDashboard = React.lazy(() => import('./pages/CalendarDashboard'));
const HolidayDashboard = React.lazy(() => import('./pages/HolidayDashboard'));
const BlackoutManagement = React.lazy(() => import('./pages/BlackoutManagement'));
const CitizenServicePortal = React.lazy(() => import('./pages/CitizenServicePortal'));
const AdminServiceRequests = React.lazy(() => import('./pages/AdminServiceRequests'));
const TicketsPage = React.lazy(() => import('./pages/TicketsPage'));
import { SettingsProvider, useSettings } from './context/SettingsContext';

const AppLayout = ({ children }) => {
  const { user } = useAuth();
  const { settings, isSidebarEditMode, setIsSidebarEditMode } = useSettings();
  const location = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

  // Reset customization mode if the user navigates away from settings
  React.useEffect(() => {
    if (location.pathname !== '/settings' && isSidebarEditMode) {
      setIsSidebarEditMode(false);
    }
  }, [location.pathname, isSidebarEditMode, setIsSidebarEditMode]);

  const getHeaderTitle = () => {
    const path = location.pathname;
    if (path === '/') {
      return user?.role === 'admin' ? 'Control Center' : 'Citizen Portal';
    }
    if (path === '/file-complaint') {
      return 'File a New Complaint';
    }
    if (path === '/tickets') {
      return user?.role === 'admin' ? 'Master Operations Tickets Queue' : 'My Tickets History';
    }
    if (path === '/service-portal') {
      return 'Service Catalog Portal';
    }
    if (path.startsWith('/complaints/')) {
      return 'Complaint Reference Detail';
    }
    if (path === '/profile') {
      return 'User Account Profile';
    }
    if (path === '/admin/service-requests') {
      return 'Service Request Queue';
    }
    if (path === '/manage-fields') {
      return 'Dynamic Fields Designer';
    }
    if (path === '/departments') {
      return 'Departments & Categories';
    }
    if (path === '/staff') {
      return 'Staff Administration';
    }
    if (path.startsWith('/settings')) {
      return 'System Settings Console';
    }
    if (path === '/escalation-rules') {
      return 'Escalation Policy Settings';
    }
    if (path === '/escalation-analytics') {
      return 'Escalation Analytics Dashboard';
    }
    return 'Portal';
  };

  const getHeaderSubtitle = () => {
    const path = location.pathname;
    if (path === '/') {
      return user?.role === 'admin' && user?.department 
        ? `Department Assignment: ${user.department}` 
        : settings.websiteDescription;
    }
    if (path === '/file-complaint') {
      return 'Submit a new complaint ticket for department review';
    }
    if (path === '/tickets') {
      return user?.role === 'admin' 
        ? 'Monitor and manage organization-wide support requests and incidents' 
        : 'View and track your filed support requests and tickets';
    }
    if (path === '/service-portal') {
      return 'Request citizens services, utilities, and catalog fulfillment';
    }
    if (path.startsWith('/complaints/')) {
      return 'Review status, SLA milestones, and discussion logs';
    }
    if (path === '/profile') {
      return 'Manage your personal details, credentials, and settings';
    }
    if (path === '/admin/service-requests') {
      return 'Manage, assign, and process citizen service requests';
    }
    if (path === '/manage-fields') {
      return 'Design custom fields and data capture schemas';
    }
    if (path === '/departments') {
      return 'Configure municipal departments and ticket routing categories';
    }
    if (path === '/staff') {
      return 'Manage support officers, roles, and console access permissions';
    }
    if (path.startsWith('/settings')) {
      return 'Configure portals, workflows, SLAs, calendars, and automation';
    }
    return settings.websiteDescription;
  };
  
  const isControlHub = location.pathname.startsWith('/settings') || 
                       ['/manage-fields', '/departments', '/staff', '/escalation-rules', '/escalation-analytics'].includes(location.pathname);

  return (
    <div className={`app-shell ${isControlHub ? 'control-hub-mode' : ''}`}>
      {!isControlHub && <Sidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
      <main className={`app-content ${isControlHub ? 'control-hub-content' : ''}`} onClick={() => setIsMobileSidebarOpen(false)}>
        {!isControlHub && (
          <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button 
                className="mobile-menu-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMobileSidebarOpen(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'none', // Styled responsive in index.css
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '8px'
                }}
              >
                <Menu size={20} />
              </button>
              <div className="header-title">
                <h1>{getHeaderTitle()}</h1>
                <p>{getHeaderSubtitle()}</p>
              </div>
            </div>
            {user?.role === 'admin' && location.pathname === '/settings' && (
              <button
                onClick={() => setIsSidebarEditMode(!isSidebarEditMode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: isSidebarEditMode ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.02)',
                  color: isSidebarEditMode ? 'white' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  boxShadow: isSidebarEditMode ? '0 4px 14px var(--accent-glow)' : 'var(--box-shadow-sm)',
                  backdropFilter: 'blur(8px)'
                }}
                onMouseEnter={(e) => {
                  if (!isSidebarEditMode) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSidebarEditMode) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {isSidebarEditMode ? <Check size={15} /> : <LayoutGrid size={15} />}
                <span>{isSidebarEditMode ? 'Finish Customizing' : 'Customize Sidebar'}</span>
              </button>
            )}
          </header>
        )}
        {children}
      </main>
    </div>
  );
};

const PageLoading = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '60vh',
    width: '100%',
    color: 'var(--text-secondary, #a1a1aa)',
    backgroundColor: 'transparent'
  }}>
    <div style={{
      border: '3px solid rgba(99, 102, 241, 0.05)',
      borderTop: '3px solid var(--accent-color, #6366f1)',
      borderRadius: '50%',
      width: '32px',
      height: '32px',
      animation: 'spin-loader 0.8s linear infinite',
      marginBottom: '12px'
    }} />
    <span style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '0.01em', opacity: 0.8 }}>Loading portal...</span>
    <style>{`
      @keyframes spin-loader {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

const TenantNotFoundPage = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 100%)',
      color: '#f8fafc',
      fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
      padding: '24px',
      boxSizing: 'border-box',
      textAlign: 'center'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '48px 32px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#ef4444',
          marginBottom: '24px',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: '28px',
          fontWeight: 800,
          margin: '0 0 12px 0',
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #fff 0%, #cbd5e1 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Portal Not Found
        </h1>

        <p style={{
          fontSize: '14.5px',
          color: '#94a3b8',
          lineHeight: '1.6',
          margin: '0 0 32px 0',
          fontWeight: 400
        }}>
          The organization portal you are trying to access does not exist or has been deactivated. Please check the URL or contact your system administrator.
        </p>

        <a 
          href="http://localhost:5173/register-tenant" 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '13.5px',
            fontWeight: 700,
            padding: '12px 24px',
            borderRadius: '12.5px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.4)';
          }}
        >
          Create Your Portal
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
      </div>
    </div>
  );
};

const AppContentWrapper = () => {
  const { tenantNotFound, loading } = useSettings();

  if (tenantNotFound) {
    return <TenantNotFoundPage />;
  }

  if (loading) {
    return <PageLoading />;
  }

  return (
    <Router>
      <React.Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-tenant" element={<RegisterTenant />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/tickets" 
            element={
              <ProtectedRoute>
                <AppLayout>
                  <TicketsPage />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/group-tickets" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <TicketsPage groupOnly={true} />
                </AppLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/file-complaint" 
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <AppLayout>
                  <FileComplaint />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/service-portal" 
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <AppLayout>
                  <CitizenServicePortal />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/complaints/:id" 
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ComplaintDetail />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Profile />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/admin/service-requests" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <AdminServiceRequests />
                </AppLayout>
              </ProtectedRoute>
            } 
          />


          <Route 
            path="/manage-fields" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="operations" defaultTab="fields" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/departments" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="teams" defaultTab="departments" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/staff" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="teams" defaultTab="staff" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/system" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="platform" defaultTab="branding" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/csat" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="analytics" defaultTab="csat" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/workload" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="teams" defaultTab="workload" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/workflows" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="automation" defaultTab="workflows" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/ai" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="ai" defaultTab="general" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/duplicate-analytics" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="analytics" defaultTab="duplicate" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/groups" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="teams" defaultTab="groups" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/calendar" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="operations" defaultTab="calendar" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/calendar-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="operations" defaultTab="calendar-dashboard" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/holidays" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="operations" defaultTab="holidays" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/blackout" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="operations" defaultTab="blackout" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/sla-config" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="operations" defaultTab="sla" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/settings/executive-dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="analytics" defaultTab="executive" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/escalation-rules" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="operations" defaultTab="escalation" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/escalation-analytics" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout>
                  <SettingsHub defaultSection="analytics" defaultTab="escalation" />
                </AppLayout>
              </ProtectedRoute>
            } 
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </Router>
  );
};

function App() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppContentWrapper />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

export default App;
