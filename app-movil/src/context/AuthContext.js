import React, { createContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const BASE_URL = 'http://192.168.1.69:4000';

  // Creamos la instancia de API
  useEffect(() => {
    let isMounted = true;
    const loadStoredData = async () => {
      try {
        const savedToken = await storage.getItem('token');
        const savedUser = await storage.getItem('user');
        
        if (isMounted && savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (e) {
        console.log('Error loading security data', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadStoredData();
    return () => { isMounted = false; };
  }, []);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: BASE_URL });
    
    // INTERCEPTOR: Inyecta el token en cada petición automáticamente
    instance.interceptors.request.use(
      async (config) => {
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
      },
      (error) => Promise.reject(error)
    );

    // INTERCEPTOR: Manejo de errores de conexión global
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (!error.response) {
          // Error de red (servidor caído o sin internet)
          console.log('[Network] Error de conexión detectado.');
          // Aquí podríamos disparar un evento global o alerta
        }
        if (error.response?.status === 401) {
          console.log('[Security] 401 Detected');
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, [token]);

  const storage = {
    getItem: async (key) => {
      try {
        if (Platform.OS === 'web') return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        return await SecureStore.getItemAsync(key);
      } catch (e) { return null; }
    },
    setItem: async (key, value) => {
      try {
        if (Platform.OS === 'web') {
          if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
        } else {
          await SecureStore.setItemAsync(key, value);
        }
      } catch (e) { }
    },
    deleteItem: async (key) => {
      try {
        if (Platform.OS === 'web') {
          if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
        } else {
          await SecureStore.deleteItemAsync(key);
        }
      } catch (e) { }
    }
  };

  const login = async (username, password) => {
    const res = await api.post('/api/auth/login', { username, password });
    const { token: accessToken, user: loggedUser } = res.data;
    setToken(accessToken);
    setUser(loggedUser);
    await storage.setItem('token', accessToken);
    await storage.setItem('user', JSON.stringify(loggedUser));
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await storage.deleteItem('token');
    await storage.deleteItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, api }}>
      {children}
    </AuthContext.Provider>
  );
};
