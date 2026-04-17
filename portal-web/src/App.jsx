import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MapPage from './pages/Map.jsx';
import Clientes from './pages/Clientes.jsx';
import Workers from './pages/Workers.jsx';
import Rutas from './pages/Rutas.jsx';
import NotificationCenter from './components/NotificationCenter.jsx';
import './index.css';
import './App.css';

// ─── Icons (inline SVG for zero deps) ────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    dashboard: <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z"/>,
    map:       <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11z"/>,
    clients:   <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>,
    workers:   <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>,
    routes:    <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>,
    logout:    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4z"/>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}>
      {icons[name]}
    </svg>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────
function Sidebar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        🛵 <span>Ruta</span>Zero
      </div>
      <ul className="sidebar-nav">
        <li><NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="dashboard"/>Dashboard</NavLink></li>
        <li><NavLink to="/map" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="map"/>Mapa</NavLink></li>
        <li><NavLink to="/clientes" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="clients"/>Clientes</NavLink></li>
        <li><NavLink to="/workers" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="workers"/>Workers</NavLink></li>
        <li><NavLink to="/rutas" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="routes"/>Rutas</NavLink></li>
      </ul>
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.nombres?.[0]?.toUpperCase() || 'A'}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.nombres} {user?.apellidos}</div>
            <div className="sidebar-user-role">{user?.rol}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'none',border:'none',color:'var(--c-muted)',cursor:'pointer',width:'100%',borderRadius:6,marginTop:4,fontSize:13}}>
          <Icon name="logout"/>Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

// ─── Protected layout ─────────────────────────────────────────
function AppLayout({ children, title }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, title }) {
  const { isAuthenticated } = useContext(AuthContext);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout title={title}>{children}</AppLayout>;
}

// ─── App ──────────────────────────────────────────────────────
export default function App() {
  return (
    <Router>
      <NotificationCenter />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute title="Dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute title="Mapa de Clientes"><MapPage /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute title="Clientes"><Clientes /></ProtectedRoute>} />
        <Route path="/workers" element={<ProtectedRoute title="Workers"><Workers /></ProtectedRoute>} />
        <Route path="/rutas" element={<ProtectedRoute title="Rutas"><Rutas /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
