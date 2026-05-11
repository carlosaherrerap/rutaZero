import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import './Login.css';

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
      <div className="grid-bg"></div>
      <div className="auth-container">
        {/* Lado Izquierdo: Branding */}
        <div className="auth-info-pane">
          <div className="auth-branding">
            <h1 className="brand-name-routing">Routing</h1>
          </div>

          <div className="auth-features">
            <div className="feature-item">
              <div className="feature-dot"></div>
              <div className="feature-text">
                <h3>Acceso seguro</h3>
                <p>Protegemos tus datos operativos con cifrado de grado industrial.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-dot"></div>
              <div className="feature-text">
                <h3>Gestión Centralizada</h3>
                <p>Controla todas tus rutas y trabajadores desde un solo lugar.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-dot"></div>
              <div className="feature-text">
                <h3>Operaciones en tiempo real</h3>
                <p>Monitoreo constante de entregas y jornadas de campo.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Formulario */}
        <div className="auth-form-pane">
          <div className="form-content">
            <h2 className="form-title">Iniciar Sesión</h2>

            <form onSubmit={handleSubmit}>
              {error && <div className="error-msg">{error}</div>}

              <div className="form-group-floating">
                <input
                  type="text"
                  id="username"
                  autoComplete="off"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder=" "
                  required
                />
                <label htmlFor="username">Username</label>
              </div>

              <div className="form-group-floating">
                <input
                  type="password"
                  id="password"
                  autoComplete="off"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder=" "
                  required
                />
                <label htmlFor="password">Password</label>
              </div>

              <button type="submit" className="btn-continue" disabled={loading}>
                {loading ? 'Validando...' : 'Entrar'}
              </button>
            </form>

            <div className="auth-footer">
              <p>BY INFORMATECH</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
