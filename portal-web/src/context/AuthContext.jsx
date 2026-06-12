import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const isAuthenticated = !!token;

  const [sedeActual, setSedeActual] = useState(() => {
    const saved = localStorage.getItem('sedeActual');
    return saved ? JSON.parse(saved) : { id: '11111111-1111-1111-1111-000000000001', nombre: 'Lima' };
  });

  // useMemo for the api instance so it recreates only when token or sedeActual changes
  const apiData = React.useMemo(() => {
    // Lógica de URLs para Producción vs Local
    const isProd = window.location.hostname !== 'localhost' && !window.location.hostname.includes('192.168');
    const API_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const PROD_URL = import.meta.env.VITE_API_URL || 'https://rutazero-backend-co5q.onrender.com';
    
    // Exportamos la URL base para sockets y otros componentes
    const BASE_URL = isProd ? PROD_URL : `http://${API_HOST}:4000`;

    const instance = axios.create({
      baseURL: BASE_URL,
      headers: { 
        Authorization: token ? `Bearer ${token}` : undefined,
        'x-sede-id': sedeActual?.id
      },
    });
    return { instance, BASE_URL };
  }, [token, sedeActual]);

  const api = apiData.instance;
  const API_BASE_URL = apiData.BASE_URL;

  const login = async (username, password) => {
    const response = await api.post('/api/auth/login', { username, password });
    const { token: accessToken, user: loggedUser } = response.data;
    setToken(accessToken);
    setUser(loggedUser);
    localStorage.setItem('token', accessToken);
    return response.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  // optional: verify token on mount
  useEffect(() => {
    const verify = async () => {
      if (token) {
        try {
          const res = await api.get('/api/auth/me');
          setUser(res.data.user);
        } catch (e) {
          logout();
        }
      }
    };
    verify();
  }, [token]); // depend on token

  const cambiarSede = (sede) => {
    setSedeActual(sede);
    localStorage.setItem('sedeActual', JSON.stringify(sede));
  };

  // Fetch and apply theme on mount/auth
  const fetchAndApplyTheme = async () => {
    try {
      const res = await api.get('/api/config');
      const s = res.data;
      if (s.sidebar_bg) {
        applyStyles(s);
      }
    } catch (err) {
      console.error('Error applying theme:', err);
    }
  };

  const applyStyles = (s) => {
    if (!s) return;
    const root = document.documentElement;
    root.style.setProperty('--c-surface', s.sidebar_bg);
    root.style.setProperty('--c-bg', s.main_bg);
    root.style.setProperty('--c-text', s.main_text);
    root.style.setProperty('--c-sidebar-text', s.sidebar_text);
    root.style.setProperty('--c-primary', s.primary_color);
    root.style.setProperty('--logo-filter', s.logo_filter || 'none');
    root.style.setProperty('--font-main', s.font_family || 'Inter');
    
    // Also update data-theme attribute for CSS selectors
    const isDark = s.main_bg.toLowerCase() === '#0b0e11' || s.main_bg.toLowerCase() === '#000000';
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Forced re-render of components listening to theme if needed
    // (though CSS variables usually handle this)
  };

  useEffect(() => {
    if (isAuthenticated) fetchAndApplyTheme();
  }, [isAuthenticated, sedeActual.id]); // Re-fetch or re-apply on sede change to be safe

  return (
    <AuthContext.Provider value={{ 
      token, user, isAuthenticated, login, logout, api, sedeActual, cambiarSede, 
      applyStyles, fetchAndApplyTheme 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
