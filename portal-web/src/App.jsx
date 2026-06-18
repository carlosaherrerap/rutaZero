import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MapPage from './pages/Map.jsx';
import Clientes from './pages/Clientes.jsx';
import Workers from './pages/Workers.jsx';
import WorkerDetail from './pages/WorkerDetail.jsx';
import Rutas from './pages/Rutas.jsx';
import Asistencia from './pages/Asistencia.jsx';
import Ciclos from './pages/Ciclos.jsx';
import Stats from './pages/Stats.jsx';
import NotificationCenter from './components/NotificationCenter.jsx';
import Localizar from './pages/Localizar.jsx';
import Monitoreo from './pages/Monitoreo.jsx';
import Formularios from './pages/Formularios.jsx';
import Amonestaciones from './pages/Amonestaciones.jsx';
import Permisos from './pages/Permisos.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import UserGuide from './components/UserGuide.jsx';
import ChatBot from './components/ChatBot.jsx';
import Temas from './pages/Temas.jsx';
import './index.css';
import './App.css';
import logoSidebar from './assets/logo-2.png';

// ─── Icons (inline SVG for zero deps) ────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    dashboard: <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z" />,
    map: <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11z" />,
    clients: <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />,
    workers: <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />,
    routes: <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />,
    attendance: <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />,
    cycles: <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />,
    forms: <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />,
    config: <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />,
    logout: <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4z" />,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      {icons[name] || icons.dashboard}
    </svg>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────
function Sidebar() {
  const { sedeActual, cambiarSede } = useContext(AuthContext);
  const [isHighlighting, setIsHighlighting] = React.useState(false);
  const [showSedeMenu, setShowSedeMenu] = React.useState(false);
  const sedeDropdownRef = React.useRef(null);

  const sedesList = [
    { id: '11111111-1111-1111-1111-000000000001', nombre: 'Lima' },
    { id: '11111111-1111-1111-1111-000000000002', nombre: 'Arequipa' }
  ];

  React.useEffect(() => {
    const handleHighlight = () => {
      setIsHighlighting(true);
      setTimeout(() => setIsHighlighting(false), 5000);
    };
    window.addEventListener('highlight-sede-selector', handleHighlight);
    return () => window.removeEventListener('highlight-sede-selector', handleHighlight);
  }, []);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (sedeDropdownRef.current && !sedeDropdownRef.current.contains(event.target)) {
        setShowSedeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [sedeDropdownRef]);

  const handleSedeChange = (e) => {
    const selected = sedesList.find(s => s.nombre === e.target.value);
    if (selected) cambiarSede(selected);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header" style={{ padding: '24px 20px', borderBottom: '1px solid var(--c-border)', marginBottom: '10px' }}>
        <img src={logoSidebar} alt="InformaTech" style={{ height: '36px', width: 'auto', marginBottom: '16px', filter: 'var(--logo-filter)' }} />

        <div className={`sede-selector-box ${isHighlighting ? 'highlight-pulse' : ''}`} style={{ transition: 'all 0.5s ease', position: 'relative' }} ref={sedeDropdownRef}>
          <div style={{ fontSize: '9px', color: isHighlighting ? 'var(--c-primary)' : 'var(--c-muted)', fontWeight: '900', marginBottom: '6px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>SEDE ACTUAL</div>
          <button
            onClick={() => setShowSedeMenu(!showSedeMenu)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', background: 'var(--c-surface-2)', fontSize: '11px', fontWeight: '800', height: '36px', padding: '0 12px',
              border: isHighlighting ? '2px solid var(--c-primary)' : '1px solid var(--c-border)',
              borderRadius: '10px', color: 'var(--c-text)', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <span>{sedeActual.nombre}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showSedeMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.5 }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          
          {showSedeMenu && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
              backgroundColor: 'var(--c-surface)', borderRadius: '12px', border: '1px solid var(--c-border)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 9999, overflow: 'hidden', animation: 'dropdownIn 0.2s ease-out'
            }}>
              {sedesList.map(s => (
                <button
                  key={s.id}
                  onClick={() => { cambiarSede(s); setShowSedeMenu(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: '11px', fontWeight: '800', color: s.nombre === sedeActual.nombre ? 'var(--c-primary)' : 'var(--c-text)',
                    backgroundColor: s.nombre === sedeActual.nombre ? 'var(--c-surface-2)' : 'transparent', transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = s.nombre === sedeActual.nombre ? 'var(--c-surface-2)' : 'transparent'}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-content" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="sidebar-subtitle">VISUALIZACION</div>
        <ul className="sidebar-nav">
          <li id="nav-principal"><NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="dashboard" />Principal</NavLink></li>
          <li id="nav-mapa"><NavLink to="/map" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="map" />Mapa</NavLink></li>
          <li id="nav-clientes"><NavLink to="/clientes" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="clients" />Clientes</NavLink></li>
          <li id="nav-operadores"><NavLink to="/workers" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="workers" />Operadores</NavLink></li>
        </ul>

        <div className="sidebar-subtitle">GESTION</div>
        <ul className="sidebar-nav">
          <li><NavLink to="/rutas" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="routes" />Rutas</NavLink></li>
          <li><NavLink to="/formularios" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="forms" />Formularios</NavLink></li>
          <li><NavLink to="/ciclos" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="cycles" />Ciclos</NavLink></li>
        </ul>

        <div className="sidebar-subtitle">RADAR</div>
        <ul className="sidebar-nav">
          <li><NavLink to="/localizar" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="map" />Radar</NavLink></li>
          <li><NavLink to="/monitoreo" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="attendance" />Productividad</NavLink></li>
          <li><NavLink to="/stats" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="map" />Trayectos</NavLink></li>
        </ul>

        <div className="sidebar-subtitle">REPORTES Y ASISTENCIA</div>
        <ul className="sidebar-nav">
          <li><NavLink to="/asistencia" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="attendance" />Asistencia</NavLink></li>
          <li><NavLink to="/amonestaciones" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="config" />Amonestaciones</NavLink></li>
          <li><NavLink to="/permisos" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="config" />Permisos</NavLink></li>
        </ul>

        <div className="sidebar-subtitle">CONFIGURACIONES</div>
        <ul className="sidebar-nav">
          <li><NavLink to="/temas" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="config" />Paleta / Temas</NavLink></li>
          <li><NavLink to="/tipografia" className={({ isActive }) => isActive ? 'active' : ''}><Icon name="config" />Tipografía</NavLink></li>
        </ul>
      </div>
    </aside>
  );
}

// ─── Topbar & Profile ─────────────────────────────────────────
function Topbar({ title }) {
  const { user, logout, applyStyles, api } = useContext(AuthContext);
  const [showMenu, setShowMenu] = React.useState(false);
  const navigate = useNavigate();
  const dropdownRef = React.useRef(null);

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

  const toggleQuickTheme = async () => {
    const isCurrentlyDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isCurrentlyDark ? 'light' : 'dark';
    
    const presets = {
      dark: {
        sidebar_bg: '#15191C',
        sidebar_text: '#FFFFFF',
        main_bg: '#0B0E11',
        main_text: '#FFFFFF',
        primary_color: '#00A9BC',
        font_family: 'Inter',
        logo_filter: 'none'
      },
      light: {
        sidebar_bg: '#F9F9F7',
        sidebar_text: '#222222',
        main_bg: '#FFFFFF',
        main_text: '#111111',
        primary_color: '#2D3436',
        font_family: 'Inter',
        logo_filter: 'invert(1) brightness(0.2)'
      }
    };

    const selected = presets[newTheme];
    applyStyles(selected);
    // Persist to DB
    try { 
      await api.post('/api/config', selected);
    } catch (e) { 
      console.error(e); 
    }

  };

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title" style={{ fontFamily: title === 'Principal' ? 'Serimi' : 'inherit', fontSize: title === 'Principal' ? '28px' : 'inherit' }}>{title}</span>
      </div>

      <div className="topbar-right">

        <div className="profile-container" ref={dropdownRef}>
          <button className="profile-trigger" onClick={() => setShowMenu(!showMenu)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '14px', border: '1px solid var(--c-border)', transition: 'all 0.2s' }}>
            <div className="avatar-small">
              {user?.nombres ? user.nombres[0].toUpperCase() : 'A'}
            </div>
            <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--c-text)' }}>
                {user?.nombres ? user.nombres.split(' ')[0] : (user?.username || 'Admin')}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {user?.rol || 'ADMINISTRADOR'}
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.5 }}><path d="M6 9l6 6 6-6" /></svg>
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
                  onClick={toggleQuickTheme}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: '8px', color: 'var(--c-text)', fontSize: '13px' }}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--c-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isDark ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
                    )}
                  </div>
                  <span style={{ flex: 1, fontWeight: '500' }}>Modo {isDark ? 'claro' : 'oscuro'}</span>
                </button>

                <div style={{ height: '1px', background: 'var(--c-border)', margin: '4px 0' }} />

                <button
                  className="dropdown-item"
                  onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: '8px', color: 'var(--c-danger)', fontSize: '13px' }}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4z" /></svg>
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
  // Theme is now managed in AuthContext to avoid resets on Sede change

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area fade-in">
        <Topbar title={title} />
        <main className="page-content">{children}</main>
        <UserGuide />
        <ChatBot />
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
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
        <Route path="/workers" element={<ProtectedRoute><Workers /></ProtectedRoute>} />
        <Route path="/workers/:id" element={<ProtectedRoute title="Detalle Worker"><WorkerDetail /></ProtectedRoute>} />
        <Route path="/rutas" element={<ProtectedRoute><Rutas /></ProtectedRoute>} />
        <Route path="/asistencia" element={<ProtectedRoute><Asistencia /></ProtectedRoute>} />
        <Route path="/localizar" element={<ProtectedRoute><Localizar /></ProtectedRoute>} />
        <Route path="/monitoreo" element={<ProtectedRoute><Monitoreo /></ProtectedRoute>} />
        <Route path="/formularios" element={<ProtectedRoute><Formularios /></ProtectedRoute>} />
        <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
        <Route path="/ciclos" element={<ProtectedRoute><Ciclos /></ProtectedRoute>} />

        {/* Nuevas Rutas de RRHH */}
        <Route path="/amonestaciones" element={<ProtectedRoute title="Amonestaciones"><Amonestaciones /></ProtectedRoute>} />
        <Route path="/permisos" element={<ProtectedRoute title="Permisos"><Permisos /></ProtectedRoute>} />
        <Route path="/temas" element={<ProtectedRoute title="Personalización"><Temas /></ProtectedRoute>} />
        <Route path="/tipografia" element={<ProtectedRoute title="Tipografía"><Temas /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
