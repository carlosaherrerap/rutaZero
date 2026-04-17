import React, { useEffect, useState, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';

export default function NotificationCenter() {
  const { user } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000');

    socket.on('journey_started', (data) => {
      addNotification(`🚀 Worker ha iniciado jornada`, 'info');
    });

    socket.on('journey_finished', (data) => {
      addNotification(`🏁 Worker ha finalizado jornada`, 'success');
    });

    socket.on('visit_started', (data) => {
      addNotification(`📍 Visita iniciada en cliente #${data.cliente_id.substring(0,5)}`, 'warning');
    });

    socket.on('ficha_completed', (data) => {
      addNotification(`📝 Gestión completada: ${data.tipificacion}`, 'success');
    });

    return () => socket.disconnect();
  }, [user]);

  const addNotification = (text, type) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  if (notifications.length === 0) return null;

  return (
    <div className="notification-container" style={{
      position: 'fixed',
      bottom: '20px',
      right: '24px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {notifications.map(n => (
        <div key={n.id} className={`toast toast-${n.type}`} style={{
          padding: '12px 20px',
          borderRadius: '12px',
          background: n.type === 'success' ? '#10b981' : n.type === 'warning' ? '#f59e0b' : '#3b82f6',
          color: 'white',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          animation: 'slideIn 0.3s ease-out',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {n.text}
          <button 
            onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', opacity: 0.7 }}
          >✕</button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
