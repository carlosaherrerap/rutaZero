import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const isAuthenticated = !!token;

  // configure axios instance
  const api = axios.create({
    baseURL: 'http://localhost:4000',
    headers: { Authorization: token ? `Bearer ${token}` : undefined },
  });

  const login = async (username, password) => {
    const response = await api.post('/api/auth/login', { username, password });
    const { token: accessToken, user: loggedUser } = response.data;
    setToken(accessToken);
    setUser(loggedUser);
    localStorage.setItem('token', accessToken);
    // update axios default header
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    return response.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
  };

  // optional: verify token on mount
  useEffect(() => {
    const verify = async () => {
      if (token) {
        try {
          const res = await api.get('/api/auth/me');
          setUser(res.data);
        } catch (e) {
          logout();
        }
      }
    };
    verify();
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, login, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
};
