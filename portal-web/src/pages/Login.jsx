import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { MessageSquarePlus } from 'lucide-react';
import './Login.css';
import logoImg from '../assets/LOGO2.png';

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
      setError('Acceso denegado. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* MALLA / GRID INTEGRADA EN CSS DIRECTAMENTE */}
      
      {/* INTERACTIVE CORNER GRID + FEEDBACK */}
      <div className="top-right-actions">
        <button className="btn-feedback">
          <MessageSquarePlus size={18} />
          <span>FEEDBACK</span>
        </button>
        <div className="interactive-corner-grid">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="grid-cell"></div>
          ))}
        </div>
      </div>

      {/* NAVBAR (Left Aligned) */}
      <nav className="navbar">
        <div className="brand-container">
          <img src={logoImg} alt="ROUTING" className="routing-logo-img" />
          <div className="brand-text">
            <h1 className="brand-name">ROUTING</h1>
            <p className="brand-sub">BY INFORMAPERU</p>
          </div>
        </div>
      </nav>

      {/* HERO CONTENT */}
      <div className="hero-container">
        <div className="hero-text">
          <div className="slogan">
            <div>Logística <span className="highlight">inteligente</span></div>
            <div>para <span className="highlight">rutas críticas</span></div>
          </div>
        </div>

        <div className="login-section">
          <div className="login-card">
            <form onSubmit={handleSubmit}>
              {error && <div className="error-msg">{error}</div>}
              
              <div className="form-group">
                <label>Usuario</label>
                <input 
                  type="text" 
                  placeholder="admin"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Contraseña</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? 'Validando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
