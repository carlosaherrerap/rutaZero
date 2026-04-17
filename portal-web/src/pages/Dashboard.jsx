import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { api } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [actividad, setActividad] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [api]);

  const fetchData = async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        api.get('/api/dashboard/stats'),
        api.get('/api/dashboard/actividad')
      ]);
      setStats(sRes.data.data);
      setActividad(aRes.data.data);
    } catch (e) {
      console.error('Error loading dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  // Recargar al recibir sockets (simulado o via props si NotificationCenter emitiera, 
  // pero NotificationCenter es hermano. Podríamos usar un event bus o simplemente 
  // que el Dashboard escuche también). 
  // Para WOW: El Dashboard escuchará sus propios eventos.

  if (loading) return <div className="spinner"></div>;
  if (!stats) return <div className="empty-state"><p>No se pudieron cargar las estadísticas.</p></div>;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Clientes</span>
          <span className="stat-value">{stats.totalClientes}</span>
          <span className="stat-sub">Registrados en Lima</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Workers Activos</span>
          <span className="stat-value">{stats.workersActivos}</span>
          <span className="stat-sub">En jornada hoy</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Rutas Hoy</span>
          <span className="stat-value">{stats.rutasHoy}</span>
          <span className="stat-sub">Asignadas</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Gestiones</span>
          <span className="stat-value">{stats.gestionesHoy}</span>
          <span className="stat-sub">Realizadas hoy</span>
        </div>
      </div>

      <div className="form-row form-row-2 mt-4">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Actividad Reciente (Real-time)</h3>
          </div>
          <div className="activity-feed">
            {actividad.length === 0 ? (
              <p className="text-muted text-center py-4">Sin actividad reciente</p>
            ) : actividad.map((a, idx) => (
              <div key={a.id} className="activity-item" style={{
                padding: '12px',
                borderBottom: idx === actividad.length - 1 ? 'none' : '1px solid var(--c-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '15px'
              }}>
                <div className="sidebar-avatar" style={{width:32, height:32, fontSize:12, background:'var(--c-accent-soft)', color:'var(--c-accent)'}}>
                  {a.worker_nombre[0]}
                </div>
                <div style={{flex: 1}}>
                  <div className="text-sm">
                    <strong className="text-accent">{a.worker_nombre}</strong> gestionó a <strong>{a.cliente_nombre} {a.cliente_apellido}</strong>
                  </div>
                  <div className="text-xs text-muted">
                    Resultado: <span className={`badge badge-${a.estado_nuevo.toLowerCase().replace(/_/g, '-')}`} style={{fontSize: 9}}>{a.tipificacion}</span>
                  </div>
                </div>
                <div className="text-xs text-muted">
                  {new Date(a.timestamp_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Estado de Cartera</h3>
          </div>
          <div className="chart-container">
             {stats.clientesPorEstado?.map(e => (
              <div key={e.estado} className="chart-bar-row">
                <div className="chart-bar-label">{e.estado}</div>
                <div className="chart-bar-track">
                  <div 
                    className="chart-bar-fill" 
                    style={{ 
                      width: `${(e.total / stats.totalClientes) * 100}%`,
                      background: e.estado === 'LIBRE' ? '#10b981' : e.estado === 'VISITADO_PAGO' ? '#3b82f6' : '#f59e0b' 
                    }}
                  ></div>
                </div>
                <div className="chart-bar-val">{e.total}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
