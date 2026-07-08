import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    websiteName: 'ApexResolve',
    websiteDescription: 'Managing and tracking issues efficiently',
    websiteLogo: '',
    primaryColor: '#6366f1',
    contactEmail: 'support@apexresolve.com',
    allowCitizenRegistration: true
  });
  const [loading, setLoading] = useState(true);
  const [tenantNotFound, setTenantNotFound] = useState(false);

  const fetchSettings = async () => {
    try {
      // Extract tenant parameters from URL query if present
      const params = new URLSearchParams(window.location.search);
      const queryTenant = params.get('tenant') || params.get('tenantId');
      if (queryTenant) {
        localStorage.setItem('tenantId', queryTenant.toLowerCase());
      }

      const headers = {};
      const savedTenantId = localStorage.getItem('tenantId');
      if (savedTenantId) {
        headers['X-Tenant-Id'] = savedTenantId;
      }

      const response = await fetch('/api/settings', { headers });
      if (response.status === 404) {
        setTenantNotFound(true);
        setLoading(false);
        return;
      }
      const result = await response.json();
      if (result.success && result.data) {
        setSettings(result.data);
        setTenantNotFound(false);
      }
    } catch (err) {
      console.error('Failed to load system settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Helper to convert hex color to RGB values for glow/shadow rendering
  const hexToRgb = (hex) => {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Inject primary color values into CSS custom properties dynamically
  useEffect(() => {
    if (settings?.primaryColor) {
      document.documentElement.style.setProperty('--accent-color', settings.primaryColor);
      
      const rgb = hexToRgb(settings.primaryColor);
      if (rgb) {
        document.documentElement.style.setProperty('--accent-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
        document.documentElement.style.setProperty('--border-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
      }
      
      // Update accent gradient dynamically
      document.documentElement.style.setProperty(
        '--accent-gradient', 
        `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.primaryColor}cc 100%)`
      );
    }
  }, [settings?.primaryColor]);

  const [pinnedSidebarItems, setPinnedSidebarItems] = useState(() => {
    const saved = localStorage.getItem('pinnedSidebarItems');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse pinned sidebar items:', e);
      }
    }
    return ['Escalation Analytics'];
  });

  useEffect(() => {
    localStorage.setItem('pinnedSidebarItems', JSON.stringify(pinnedSidebarItems));
  }, [pinnedSidebarItems]);

  const pinItem = (name) => {
    if (!pinnedSidebarItems.includes(name)) {
      setPinnedSidebarItems(prev => [...prev, name]);
    }
  };

  const unpinItem = (name) => {
    setPinnedSidebarItems(prev => prev.filter(item => item !== name));
  };

  const resetPinnedItems = () => {
    setPinnedSidebarItems(['Escalation Analytics']);
  };

  const [isSidebarEditMode, setIsSidebarEditMode] = useState(false);

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      fetchSettings, 
      loading, 
      tenantNotFound,
      pinnedSidebarItems, 
      pinItem, 
      unpinItem, 
      resetPinnedItems,
      isSidebarEditMode,
      setIsSidebarEditMode 
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
