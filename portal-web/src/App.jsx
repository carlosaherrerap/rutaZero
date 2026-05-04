import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MapPage from './pages/Map.jsx';
import Clientes from './pages/Clientes.jsx';
import Workers from './pages/Workers.jsx';
import Rutas from './pages/Rutas.jsx';
import Asistencia from './pages/Asistencia.jsx';
import Ciclos from './pages/Ciclos.jsx';
import Stats from './pages/Stats.jsx';
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
    attendance: <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>,
    cycles:    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>,
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
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span style={{ fontFamily: 'Serimi', fontSize: '32px' }}>Routing</span>
      </div>
      <div className="sidebar-subtitle">GESTIÓN PRINCIPAL</div>
      <ul className="sidebar-nav">
        <li><NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="dashboard"/>Home</NavLink></li>
        <li><NavLink to="/map" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="map"/>Mapa</NavLink></li>
        <li><NavLink to="/clientes" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="clients"/>Clientes</NavLink></li>
        <li><NavLink to="/workers" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="workers"/>Workers</NavLink></li>
      </ul>

      <div className="sidebar-subtitle">OPERACIONES</div>
      <ul className="sidebar-nav">
        <li><NavLink to="/rutas" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="routes"/>Rutas</NavLink></li>
        <li><NavLink to="/asistencia" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="attendance"/>Asistencia</NavLink></li>
        <li><NavLink to="/stats" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="map"/>Stats</NavLink></li>
        <li><NavLink to="/ciclos" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="cycles"/>Ciclos</NavLink></li>
      </ul>
    </aside>
  );
}

// ─── Topbar & Profile ─────────────────────────────────────────
function Topbar({ title }) {
  const { user, logout } = useContext(AuthContext);
  const [showMenu, setShowMenu] = React.useState(false);
  const [theme, setTheme] = React.useState(() => localStorage.getItem('theme') || 'light');
  const navigate = useNavigate();
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    try { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); } catch (e) {}
  }, [theme]);

  // Cerrar dropdown al hacer click fuera
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title" style={{ fontFamily: title === 'Home' ? 'Serimi' : 'inherit', fontSize: title === 'Home' ? '28px' : 'inherit' }}>{title}</span>
      </div>
      
      <div className="topbar-right">
        
        <div className="profile-container" ref={dropdownRef}>
          <button className="profile-trigger" onClick={() => setShowMenu(!showMenu)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '14px', border: '1px solid var(--c-border)', transition: 'all 0.2s' }}>
            <div className="avatar-small">
              {user?.nombres?.[0]?.toUpperCase()}
            </div>
            <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--c-text)' }}>{user?.nombres?.split(' ')[0]}</div>
              <div style={{ fontSize: '10px', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{user?.rol}</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.5 }}><path d="M6 9l6 6 6-6"/></svg>
          </button>

          {showMenu && (
            <div className="profile-dropdown" style={{ 
              position: 'absolute', top: 'calc(100% + 10px)', right: 0, 
              width: '240px', backgroundColor: 'var(--c-surface)', 
              borderRadius: '16px', border: '1px solid var(--c-border)', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 9999,
              padding: '8px', overflow: 'hidden', animation: 'dropdownIn 0.2s ease-out'
            }}>
              <div style={{ padding: '12px', borderBottom: '1px solid var(--c-border)', marginBottom: '4px' }}>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: '900', color: 'var(--c-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{user?.rol}</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '700', color: 'var(--c-text)' }}>{user?.nombres} {user?.apellidos}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button 
                  className="dropdown-item" 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: '8px', color: 'var(--c-text)', fontSize: '13px' }}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--c-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {theme === 'dark' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
                    )}
                  </div>
                  <span style={{ flex: 1, fontWeight: '500' }}>Modo {theme === 'dark' ? 'claro' : 'oscuro'}</span>
                </button>

                <div style={{ height: '1px', background: 'var(--c-border)', margin: '4px 0' }} />

                <button 
                  className="dropdown-item" 
                  onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: '8px', color: 'var(--c-danger)', fontSize: '13px' }}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4z"/></svg>
                  </div>
                  <span style={{ flex: 1, fontWeight: '700' }}>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Theme Toggle (Ahora integrado en Topbar) ─────────────────
// Eliminado para evitar duplicidad o dejarlo como placeholder si se usa en otro lado
function ThemeToggle() { return null; }

// ─── Protected layout ─────────────────────────────────────────
function AppLayout({ children, title }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <div className="grid-bg" aria-hidden="true" />
        <Topbar title={title} />
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
        <Route path="/dashboard" element={<ProtectedRoute title="Home"><Dashboard /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute title="Mapa de Clientes"><MapPage /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute title="Clientes"><Clientes /></ProtectedRoute>} />
        <Route path="/workers" element={<ProtectedRoute title="Workers"><Workers /></ProtectedRoute>} />
        <Route path="/rutas" element={<ProtectedRoute title="Rutas"><Rutas /></ProtectedRoute>} />
        <Route path="/asistencia" element={<ProtectedRoute title="Asistencia"><Asistencia /></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute title="Estadísticas de Trabajadores"><Stats /></ProtectedRoute>} />
        <Route path="/ciclos" element={<ProtectedRoute title="Ciclos — Liberación"><Ciclos /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
