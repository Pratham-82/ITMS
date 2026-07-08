import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on load
  useEffect(() => {
    const checkLoggedIn = async () => {
      const token = localStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId') || 'default-tenant';
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-Id': tenantId
          }
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Keep token on object
          setUser({ ...result.data, token });
        } else {
          // Token expired or invalid
          localStorage.removeItem('token');
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  // Login User
  const login = useCallback(async (email, password) => {
    const tenantId = localStorage.getItem('tenantId') || 'default-tenant';
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId
      },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (result.success) {
      localStorage.setItem('token', result.data.token);
      localStorage.setItem('tenantId', result.data.tenantId || 'default-tenant');
      setUser(result.data);
      return { success: true };
    } else {
      return { success: false, message: result.message };
    }
  }, []);

  // Register User
  const register = useCallback(async (name, email, password, department) => {
    const tenantId = localStorage.getItem('tenantId') || 'default-tenant';
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId
      },
      body: JSON.stringify({ name, email, password, department })
    });

    const result = await response.json();

    if (result.success) {
      localStorage.setItem('token', result.data.token);
      localStorage.setItem('tenantId', result.data.tenantId || 'default-tenant');
      setUser(result.data);
      return { success: true };
    } else {
      return { success: false, message: result.message };
    }
  }, []);

  // Logout User
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
    setUser(null);
  }, []);

  // Quick switch role for testing / demo
  const switchRoleDemo = useCallback(async () => {
    setLoading(true);
    try {
      const currentRole = user ? user.role : 'none';
      let email = 'admin@apex.com';
      if (currentRole === 'admin') {
        email = 'citizen@apex.com';
      }
      
      const res = await login(email, 'password');
      return res;
    } catch (err) {
      console.error('Role switcher failed', err);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, [user, login]);

  const contextValue = useMemo(() => ({
    user,
    setUser,
    loading,
    login,
    register,
    logout,
    switchRoleDemo
  }), [user, loading, login, register, logout, switchRoleDemo]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
