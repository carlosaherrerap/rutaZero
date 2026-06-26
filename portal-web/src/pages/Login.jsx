import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import logoPixi from '../assets/logo-pixi.png';
import './Login.css';

const IconAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas. Verifica tu usuario y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* PANE IZQUIERDO: Animación de Rutas y Branding con forma irregular */}
      <div className="login-left-pane">
        <div className="routing-animation">
          <svg viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" className="map-svg">
            {/* Rutas (Líneas) */}
            <path className="route-line route-1" d="M -100 200 C 150 250, 300 100, 500 300 S 700 600, 1100 500" />
            <path className="route-line route-2" d="M 200 -100 C 250 150, 100 400, 400 500 S 800 400, 900 900" />
            <path className="route-line route-3" d="M -50 700 C 200 650, 400 800, 600 500 S 800 100, 1200 200" />
            
            {/* Nodos (Puntos de entrega) */}
            <circle cx="215" cy="205" r="6" className="node" />
            <circle cx="500" cy="300" r="8" className="node" />
            <circle cx="795" cy="485" r="6" className="node" />
            
            <circle cx="215" cy="115" r="6" className="node" />
            <circle cx="400" cy="500" r="8" className="node" />
            <circle cx="690" cy="460" r="6" className="node" />

            <circle cx="170" cy="670" r="6" className="node" />
            <circle cx="600" cy="500" r="8" className="node" />
            <circle cx="910" cy="205" r="6" className="node" />
          </svg>
        </div>

        <div className="auth-branding-overlay">
          <h1 className="brand-name-routing">Informatech</h1>
          <p className="brand-tagline">La plataforma operativa de campo más avanzada.</p>
          <div className="auth-badges-container">
            <span className="glass-badge">Optimización IA</span>
            <span className="glass-badge">Tiempo Real</span>
            <span className="glass-badge">Control Total</span>
          </div>
        </div>
      </div>

      {/* Logo esquina superior derecha */}
      <img src={logoPixi} alt="Logo Informatech" className="login-logo-tr" />

      {/* PANE DERECHO: Formulario de Login */}
      <div className="login-right-pane">
        <div className="auth-form-container">
          <div className="form-header">
            <p className="form-eyebrow">BIENVENIDO</p>
            <h2 className="form-title">Iniciar Sesión</h2>
            <p className="form-subtitle">Ingresa tus credenciales para acceder al panel de control.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="login-form">
            {error && (
              <div className="error-msg">
                <IconAlert />
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                type="text"
                id="username"
                autoComplete="off"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="btn-continue" disabled={loading}>
              {loading ? 'Validando...' : 'INGRESAR'}
            </button>
          </form>

          <div className="auth-footer">
            <p>POWERED BY INFORMATECH</p>
          </div>
        </div>
      </div>
    </div>
  );
}
