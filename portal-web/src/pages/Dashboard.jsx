import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { Users, Wallet, Activity, Map as MapIcon, CheckCircle, AlertCircle, Calendar, CreditCard } from 'lucide-react';

export default function Dashboard() {
  const { api, token } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [actividad, setActividad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');

  useEffect(() => { fetchData(); }, [api]);

  const fetchData = async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        api.get('/api/dashboard/stats'),
        api.get('/api/dashboard/actividad?limit=10&offset=0')
      ]);
      setStats(sRes.data.data);
      setActividad(aRes.data.data || []);
      setPage(0);
    } catch (e) {
      console.error('Error loading dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await api.get(`/api/dashboard/actividad?limit=10&offset=${nextPage * 10}`);
      const newData = res.data.data || [];
      setActividad(prev => [...prev, ...newData]);
      setPage(nextPage);
    } catch (e) {
      console.error('Error loading more activity', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleExport = () => {
    const API_BASE = api.defaults.baseURL || 'http://192.168.1.69:4000';
    let url = `${API_BASE}/api/dashboard/export_actividad?token=${token}`;
    if (exportStart) url += `&fecha_inicio=${exportStart}`;
    if (exportEnd) url += `&fecha_fin=${exportEnd}`;
    window.open(url, '_blank');
    setShowExportModal(false);
  };

  if (loading) return <div className="spinner"></div>;
  if (!stats) return <div className="empty-state"><p>No se pudieron cargar las estadísticas.</p></div>;

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero card">
        <div className="hero-left">
          <h1 style={{ fontFamily: 'Serimi, sans-serif', fontSize: '42px', letterSpacing: '-1px' }}>Bienvenido de nuevo</h1>
          <p className="muted">Resumen rápido de operaciones y estado de rutas en Routing.</p>
          <div style={{display:'flex',gap:12,marginTop:12}}>
            <button className="btn btn-primary" onClick={() => window.location.href='/rutas'}>Crear ruta</button>
            <button className="btn btn-ghost" onClick={() => window.location.href='/ciclos'}>Ver Ciclos</button>
          </div>
        </div>
        <div className="hero-right">
          <img src="/src/assets/hero.png" alt="Hero" style={{maxWidth:'220px',opacity:0.95}}/>
        </div>
      </section>

      {/* STATS SCROLLABLE */}
      <div style={{ overflowX: 'auto', paddingBottom: '16px', marginBottom: '24px', cursor: 'grab' }}>
        <div style={{ display: 'flex', gap: '20px', minWidth: 'max-content', padding: '4px' }}>
          {[
            { label: 'TOTAL CLIENTES', value: stats.totalClientes, sub: 'TOTAL CARTERA', color: 'var(--c-primary)', icon: <Users size={48} />, bg: 'var(--c-primary-soft)' },
            { label: 'PAGOS DE HOY', value: stats.clientesPagoHoy, sub: 'VENCEN HOY', color: 'var(--c-accent)', icon: <Wallet size={48} />, bg: 'var(--c-accent-soft)' },
            { label: 'WORKERS ACTIVOS', value: stats.workersActivos, sub: 'EN JORNADA', color: 'var(--c-info)', icon: <Activity size={48} />, bg: 'var(--c-info-soft)' },
            { label: 'RUTAS HOY', value: stats.rutasHoy, sub: 'ASIGNADAS', color: 'var(--c-primary)', icon: <MapIcon size={48} />, bg: 'var(--c-primary-soft)' },
            { label: 'GESTIONES', value: stats.gestionesHoy, sub: 'REALIZADAS', color: 'var(--c-success)', icon: <CheckCircle size={48} />, bg: 'var(--c-success-soft)' },
            { 
              label: 'NO ENCONTRADOS', 
              value: stats.clientesPorEstado?.find(e => e.estado === 'NO_ENCONTRADO')?.total || 0, 
              sub: 'AUSENTES', color: 'var(--c-danger)', icon: <AlertCircle size={48} />, bg: 'var(--c-danger-soft)' 
            },
            { 
              label: 'REPROGRAMADOS', 
              value: stats.clientesPorEstado?.find(e => e.estado === 'REPROGRAMADO')?.total || 0, 
              sub: 'PENDIENTES', color: 'var(--c-warn)', icon: <Calendar size={48} />, bg: 'var(--c-warn-soft)' 
            },
            { 
              label: 'PAGARON', 
              value: stats.clientesPorEstado?.find(e => e.estado === 'VISITADO_PAGO')?.total || 0, 
              sub: 'GESTIONADOS', color: '#10b981', icon: <CreditCard size={48} />, bg: 'rgba(16,185,129,0.1)' 
            },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ 
              minWidth: '280px', 
              flex: '0 0 auto',
              background: 'var(--c-surface)',
              padding: '24px',
              borderRadius: '24px',
              border: '1px solid var(--c-border)',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              transition: 'transform 0.2s',
              cursor: 'default'
            }}>
              <div style={{ 
                color: s.color,
                opacity: 0.8
              }}>
                {s.icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right', flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--c-text)', letterSpacing: '0.5px' }}>{s.label}</div>
                <div style={{ fontSize: '38px', fontWeight: '900', color: 'var(--c-text)', margin: '4px 0', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--c-muted)', fontWeight: '800' }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="form-row form-row-2 mt-4">
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Actividad Reciente</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowExportModal(true)} style={{ fontSize: '12px', padding: '6px 12px' }}>Descargar Historial</button>
          </div>
          <div className="activity-feed">
            {actividad.length === 0 ? (
              <p className="text-muted text-center py-4">Sin actividad reciente</p>
            ) : actividad.map((a, idx) => (
              <div key={a.id || idx} className="activity-item">
                <div className="sidebar-avatar" style={{width:36, height:36, fontSize:13}}>
                  {a.worker_nombre?.[0] || 'A'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600}}>{a.worker_nombre} <span style={{fontWeight:400}}>gestionó a</span> <strong>{a.cliente_nombre}</strong></div>
                  <div className="text-xs" style={{color:'var(--c-muted)'}}>
                    {a.tipificacion} • {new Date(a.timestamp_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
            {actividad.length > 0 && (
              <button 
                onClick={handleLoadMore} 
                className="btn btn-ghost" 
                style={{ width: '100%', marginTop: '12px', textAlign: 'center', color: 'var(--c-primary)' }}
                disabled={loadingMore}
              >
                {loadingMore ? 'Cargando...' : 'Cargar más'}
              </button>
            )}
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
                      background: e.estado === 'LIBRE' ? 'var(--c-success)' : e.estado === 'VISITADO_PAGO' ? 'var(--c-info)' : 'var(--c-warn)' 
                    }}
                  ></div>
                </div>
                <div className="chart-bar-val">{e.total}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '24px', width: '400px', background: 'var(--c-surface)' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '800' }}>Exportar Historial</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Fecha Inicio</label>
              <input type="date" className="form-input" value={exportStart} onChange={e => setExportStart(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Fecha Fin</label>
              <input type="date" className="form-input" value={exportEnd} onChange={e => setExportEnd(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowExportModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleExport}>Descargar CSV</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
