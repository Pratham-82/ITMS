import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const pathPermissionMap = {
  '/settings': 'allowAll',
  '/settings/system': 'systemSettings',
  '/settings/sla-config': 'slaSettings',
  '/settings/csat': 'escalationAnalytics',
  '/settings/workload': 'manageStaff',
  '/settings/workflows': 'systemSettings',
  '/settings/ai': 'systemSettings',
  '/settings/duplicate-analytics': 'escalationAnalytics',
  '/settings/groups': 'manageStaff',
  '/settings/calendar': 'slaSettings',
  '/settings/calendar-dashboard': 'slaSettings',
  '/settings/holidays': 'slaSettings',
  '/settings/blackout': 'slaSettings',
  '/settings/executive-dashboard': 'escalationAnalytics',
  '/escalation-rules': 'escalationRules',
  '/escalation-analytics': 'escalationAnalytics',
  '/manage-fields': 'manageFields',
  '/staff': 'manageStaff',
  '/departments': 'manageDepartments'
};

const defaultPermissions = {
  allowAll: true,
  systemSettings: false,
  slaSettings: false,
  escalationRules: false,
  escalationAnalytics: true,
  manageFields: true,
  manageStaff: false,
  manageDepartments: true
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div 
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)'
        }}
      >
        <div 
          className="spinner"
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
        <div style={{ fontWeight: 600, fontSize: '15px' }}>Loading session...</div>
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  if (!user) {
    // Not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Logged in but unauthorized, redirect to default dashboard
    return <Navigate to="/" replace />;
  }

  // Settings permission checks for administrators
  if (user.role === 'admin') {
    const isSuperAdmin = !user.department || user.department === 'General Administration';
    const currentPath = location.pathname;
    
    const configRoutes = [
      '/escalation-rules',
      '/escalation-analytics',
      '/manage-fields',
      '/staff',
      '/departments'
    ];
    const isConfigRoute = currentPath.startsWith('/settings') || configRoutes.includes(currentPath);

    if (isConfigRoute && !isSuperAdmin) {
      const perms = { ...defaultPermissions, ...(user.settingsPermissions || {}) };
      
      // If the administrator is blocked from settings entirely
      if (perms.allowAll === false) {
        return <Navigate to="/" replace />;
      }
      
      const requiredPermission = pathPermissionMap[currentPath];
      const redirectPath = currentPath.startsWith('/settings') ? '/settings' : '/';

      if (!requiredPermission || (requiredPermission !== 'allowAll' && perms[requiredPermission] === false)) {
        return <Navigate to={redirectPath} replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
