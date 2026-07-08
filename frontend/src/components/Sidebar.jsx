import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import '../styles/Sidebar.css';
import { 
  LayoutDashboard, 
  FilePlus, 
  LogOut, 
  ShieldAlert, 
  FolderLock,
  Settings,
  Building2,
  Users,
  SlidersHorizontal,
  Layers,
  TrendingUp,
  Bell,
  X,
  GripVertical,
  Star,
  Scale,
  Activity,
  Calendar,
  Folder,
  Inbox
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { 
    settings, 
    pinnedSidebarItems, 
    pinItem, 
    unpinItem,
    isSidebarEditMode
  } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const defaultPermissions = {
    allowAll: true,
    systemSettings: false,
    escalationRules: false,
    escalationAnalytics: true,
    csatAnalytics: true,
    manageFields: true,
    manageStaff: false,
    manageDepartments: true
  };
  const isSuperAdmin = user?.role === 'admin' && (!user.department || user.department === 'General Administration');
  const perms = { ...defaultPermissions, ...(user?.settingsPermissions || {}) };

  const allSettingsOptions = [
    { name: 'Service Operations', path: '/settings?section=operations', icon: <SlidersHorizontal size={18} />, show: user?.role === 'admin' },
    { name: 'Teams & Departments', path: '/settings?section=teams', icon: <Users size={18} />, show: user?.role === 'admin' },
    { name: 'Automation', path: '/settings?section=automation', icon: <Activity size={18} />, show: user?.role === 'admin' },
    { name: 'AI Configuration', path: '/settings?section=ai', icon: <SlidersHorizontal size={18} />, show: isSuperAdmin },
    { name: 'Asset Management', path: '/settings?section=assets', icon: <Layers size={18} />, show: user?.role === 'admin' },
    { name: 'Analytics', path: '/settings?section=analytics', icon: <TrendingUp size={18} />, show: user?.role === 'admin' },
    { name: 'Platform', path: '/settings?section=platform', icon: <FolderLock size={18} />, show: isSuperAdmin || perms.systemSettings }
  ];

  const legacyToNewMap = {
    'System Settings': { name: 'System Settings', path: '/settings/system', icon: <SlidersHorizontal size={18} />, show: isSuperAdmin || perms.systemSettings },
    'CSAT Analytics': { name: 'CSAT Analytics', path: '/settings/csat', icon: <Star size={18} />, show: isSuperAdmin || perms.csatAnalytics },
    'Escalation Rules': { name: 'Escalation Rules', path: '/escalation-rules', icon: <Layers size={18} />, show: isSuperAdmin || perms.escalationRules },
    'Escalation Analytics': { name: 'Escalation Analytics', path: '/escalation-analytics', icon: <TrendingUp size={18} />, show: isSuperAdmin || perms.escalationAnalytics },
    'Manage Fields': { name: 'Manage Fields', path: '/manage-fields', icon: <SlidersHorizontal size={18} />, show: isSuperAdmin || perms.manageFields },
    'Manage Staff': { name: 'Manage Staff', path: '/staff', icon: <Users size={18} />, show: isSuperAdmin || perms.manageStaff },
    'Manage Departments': { name: 'Manage Departments', path: '/departments', icon: <Building2 size={18} />, show: isSuperAdmin || perms.manageDepartments },
    'Workload Balancing': { name: 'Workload Balancing', path: '/settings/workload', icon: <Scale size={18} />, show: user?.role === 'admin' },
    'Group Management': { name: 'Group Management', path: '/settings/groups', icon: <Users size={18} />, show: user?.role === 'admin' },
    'Business Calendar': { name: 'Business Calendar', path: '/settings/calendar', icon: <SlidersHorizontal size={18} />, show: user?.role === 'admin' },
    'Calendar Dashboard': { name: 'Calendar Dashboard', path: '/settings/calendar-dashboard', icon: <Activity size={18} />, show: user?.role === 'admin' },
    'Holiday Dashboard': { name: 'Holiday Dashboard', path: '/settings/holidays', icon: <Calendar size={18} />, show: user?.role === 'admin' },
    'Blackout Management': { name: 'Blackout Management', path: '/settings/blackout', icon: <ShieldAlert size={18} />, show: user?.role === 'admin' },
    'SLA Config Matrix': { name: 'SLA Config Matrix', path: '/settings/sla-config', icon: <Layers size={18} />, show: user?.role === 'admin' },
    'Executive Dashboard': { name: 'Executive Dashboard', path: '/settings/executive-dashboard', icon: <TrendingUp size={18} />, show: user?.role === 'admin' },
    'Asset Inventory': { name: 'Asset Inventory', path: '/settings?section=assets&tab=inventory', icon: <Layers size={18} />, show: user?.role === 'admin' }
  };

  const isSettingsActive = 
    (location.pathname.startsWith('/settings') || 
     ['/escalation-rules', '/manage-fields', '/staff', '/departments', '/escalation-analytics'].includes(location.pathname)) && 
    !pinnedSidebarItems.some(name => {
      const matched = allSettingsOptions.find(opt => opt.name === name);
      return matched && matched.path === location.pathname;
    });

  const [isDragOverSidebar, setIsDragOverSidebar] = useState(false);
  const [isDragOverSettingsLink, setIsDragOverSettingsLink] = useState(false);

  const dragCounterSidebar = useRef(0);
  const dragCounterSettingsLink = useRef(0);

  const handleDragStartSidebar = (e, itemName) => {
    if (!isSidebarEditMode) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', itemName);
    e.dataTransfer.setData('source', 'sidebar');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnterSidebar = (e) => {
    if (user?.role !== 'admin' || !isSidebarEditMode) return;
    e.preventDefault();
    dragCounterSidebar.current += 1;
    if (dragCounterSidebar.current === 1) {
      setIsDragOverSidebar(true);
    }
  };

  const handleDragOverSidebar = (e) => {
    if (user?.role !== 'admin' || !isSidebarEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeaveSidebar = (e) => {
    if (user?.role !== 'admin' || !isSidebarEditMode) return;
    e.preventDefault();
    dragCounterSidebar.current -= 1;
    if (dragCounterSidebar.current === 0) {
      setIsDragOverSidebar(false);
    }
  };

  const handleDropSidebar = (e) => {
    e.preventDefault();
    dragCounterSidebar.current = 0;
    setIsDragOverSidebar(false);
    if (!isSidebarEditMode) return;
    const itemName = e.dataTransfer.getData('text/plain');
    const source = e.dataTransfer.getData('source');
    if (source === 'hub') {
      pinItem(itemName);
    }
  };

  const handleDragEnterSettingsLink = (e) => {
    if (!isSidebarEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterSettingsLink.current += 1;
    if (dragCounterSettingsLink.current === 1) {
      setIsDragOverSettingsLink(true);
    }
  };

  const handleDragOverSettingsLink = (e) => {
    if (!isSidebarEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeaveSettingsLink = (e) => {
    if (!isSidebarEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterSettingsLink.current -= 1;
    if (dragCounterSettingsLink.current === 0) {
      setIsDragOverSettingsLink(false);
    }
  };

  const handleDropSettingsLink = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterSettingsLink.current = 0;
    setIsDragOverSettingsLink(false);
    if (!isSidebarEditMode) return;
    const itemName = e.dataTransfer.getData('text/plain');
    const source = e.dataTransfer.getData('source');
    if (source === 'sidebar') {
      unpinItem(itemName);
    }
  };

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const drawerRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showNotifications &&
        drawerRef.current &&
        !drawerRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const result = await response.json();
      if (result.success) {
        setNotifications(result.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchNotifications();
      // Poll for new notifications every 30 seconds
      const timer = setInterval(fetchNotifications, 30000);
      return () => clearInterval(timer);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.isRead) {
        await fetch(`/api/notifications/${notif._id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${user.token}` }
        });
      }
      
      setShowNotifications(false);
      fetchNotifications();

      if (notif.complaint) {
        navigate(`/complaints/${notif.complaint._id || notif.complaint}`);
      }
    } catch (err) {
      console.error('Failed to process notification click:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon sb-brand-icon">
          {settings.websiteLogo ? (
            <img src={settings.websiteLogo} alt="Logo" className="sb-brand-logo" />
          ) : (
            <FolderLock size={20} />
          )}
        </div>
        <span className="brand-name">{settings.websiteName}</span>
      </div>

      <nav 
        className={`sidebar-nav sb-nav-container ${isDragOverSidebar && isSidebarEditMode ? 'sb-nav-drag-over' : ''}`}
        onDragEnter={handleDragEnterSidebar}
        onDragOver={handleDragOverSidebar}
        onDragLeave={handleDragLeaveSidebar}
        onDrop={handleDropSidebar}
      >
        {isDragOverSidebar && isSidebarEditMode && (
          <div className="sb-drop-hint">
            Drop to Pin Item
          </div>
        )}
        {user?.role === 'citizen' ? (
          <>
            <NavLink 
              to="/" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onClose?.()}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
            
            <NavLink 
              to="/tickets" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onClose?.()}
            >
              <Inbox size={18} />
              <span>My Tickets</span>
            </NavLink>
            
            <NavLink 
              to="/file-complaint" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onClose?.()}
            >
              <FilePlus size={18} />
              <span>File Complaint</span>
            </NavLink>

            <NavLink 
              to="/service-portal" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onClose?.()}
            >
              <Folder size={18} />
              <span>Service Catalog Portal</span>
            </NavLink>

            <div 
              ref={triggerRef}
              className={`nav-item ${showNotifications ? 'active' : ''}`}
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="sb-unread-badge">
                  {unreadCount}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <NavLink 
              to="/" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${isSidebarEditMode ? 'sb-nav-item-edit-disabled' : ''}`}
              onClick={(e) => {
                if (isSidebarEditMode) {
                  e.preventDefault();
                } else {
                  onClose?.();
                }
              }}
            >
              <ShieldAlert size={18} />
              <span>Admin Board</span>
            </NavLink>

            <NavLink 
              to="/tickets" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${isSidebarEditMode ? 'sb-nav-item-edit-disabled' : ''}`}
              onClick={(e) => {
                if (isSidebarEditMode) {
                  e.preventDefault();
                } else {
                  onClose?.();
                }
              }}
            >
              <Inbox size={18} />
              <span>Tickets Queue</span>
            </NavLink>

            <NavLink 
              to="/admin/service-requests" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${isSidebarEditMode ? 'sb-nav-item-edit-disabled' : ''}`}
              onClick={(e) => {
                if (isSidebarEditMode) {
                  e.preventDefault();
                } else {
                  onClose?.();
                }
              }}
            >
              <Folder size={18} />
              <span>Service Requests</span>
            </NavLink>

            {pinnedSidebarItems
              .map(name => allSettingsOptions.find(opt => opt.name === name) || legacyToNewMap[name])
              .filter(opt => opt && opt.show)
              .map(opt => (
                <NavLink 
                  key={opt.path}
                  to={opt.path} 
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${isSidebarEditMode ? 'nav-item-edit-mode' : ''}`}
                  draggable={isSidebarEditMode ? "true" : "false"}
                  onDragStart={(e) => handleDragStartSidebar(e, opt.name)}
                  title={isSidebarEditMode ? "Drag to unpin" : `Go to ${opt.name}`}
                  onClick={(e) => {
                    if (isSidebarEditMode) {
                      e.preventDefault();
                    } else {
                      onClose?.();
                    }
                  }}
                >
                  {opt.icon}
                  <span>{opt.name}</span>
                  {isSidebarEditMode && (
                    <GripVertical size={14} className="sb-grip-icon" />
                  )}
                </NavLink>
              ))
            }

            <div 
              ref={triggerRef}
              className={`nav-item ${showNotifications ? 'active' : ''} ${isSidebarEditMode ? 'sb-nav-item-edit-disabled' : ''}`}
              onClick={() => {
                if (!isSidebarEditMode) {
                  setShowNotifications(!showNotifications);
                }
              }}
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="sb-unread-badge">
                  {unreadCount}
                </span>
              )}
            </div>

            {(isSuperAdmin || perms.allowAll !== false) && (
              <NavLink 
                to="/settings" 
                className={`nav-item ${isSettingsActive ? 'active' : ''} sb-settings-link ${isDragOverSettingsLink ? 'sb-settings-link-drag-over' : ''} ${isSidebarEditMode ? 'sb-nav-item-edit-disabled' : ''}`}
                onClick={(e) => {
                  if (isSidebarEditMode) {
                    e.preventDefault();
                  } else {
                    onClose?.();
                  }
                }}
                onDragEnter={handleDragEnterSettingsLink}
                onDragOver={handleDragOverSettingsLink}
                onDragLeave={handleDragLeaveSettingsLink}
                onDrop={handleDropSettingsLink}
                title={isDragOverSettingsLink ? "Drop to remove from Sidebar" : "Settings Portal"}
              >
                <Settings size={18} />
                <span>{isDragOverSettingsLink ? "Drop to Unpin" : "Settings"}</span>
              </NavLink>
            )}
          </>
        )}
      </nav>

      {/* Floating Notification Dropdown adjacent to sidebar */}
      {showNotifications && (
        <div ref={drawerRef} className="sb-notifications-drawer">
          <div className="sb-notifications-header">
            <span style={{ fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={14} className="text-accent" /> Notifications
            </span>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="sb-mark-all-read-btn"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="sb-notifications-list">
            {notifications.length === 0 ? (
              <div className="sb-notifications-empty">
                No notifications yet.
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif._id} 
                  onClick={() => handleNotificationClick(notif)}
                  className={`sb-notification-item ${notif.isRead ? '' : 'sb-notification-unread'}`}
                >
                  {!notif.isRead && (
                    <span className="sb-unread-dot" />
                  )}
                  <div className="sb-notification-content">
                    <div className="sb-notification-title">{notif.title}</div>
                    <div className="sb-notification-body">{notif.message}</div>
                    <div className="sb-notification-time">
                      {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sb-notifications-footer">
            <button 
              onClick={() => setShowNotifications(false)}
              className="btn btn-secondary sb-close-panel-btn"
            >
              Close Panel
            </button>
          </div>
        </div>
      )}

      {/* Clean Profile Pane */}
      <div 
        className={`sidebar-profile ${location.pathname === '/profile' ? 'active' : ''} ${isSidebarEditMode ? 'sb-nav-item-edit-disabled' : ''}`}
        onClick={() => {
          if (!isSidebarEditMode) {
            navigate('/profile');
          }
        }}
        style={{ cursor: isSidebarEditMode ? 'not-allowed' : 'pointer' }}
        title={isSidebarEditMode ? "Profile (Locked)" : "Manage Profile"}
      >
        <div className="profile-avatar">
          {getInitials(user?.name)}
        </div>
        <div className="profile-info">
          <div className="profile-name" title={user?.name}>{user?.name}</div>
          <div className="profile-role">{user?.role}</div>
        </div>
        <button 
          className="btn-logout" 
          onClick={(e) => {
            e.stopPropagation();
            handleLogout();
          }}
          title="Sign Out"
          style={{ background: 'none', border: 'none' }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
