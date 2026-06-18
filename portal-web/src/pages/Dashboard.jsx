import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { Users, Wallet, Activity, Map as MapIcon, CheckCircle, AlertCircle, Calendar, CreditCard, ChevronRight } from 'lucide-react';
import arequipaImg from '../assets/arequipa.png';
import limaImg from '../assets/lima.png';
import { getAvatarUrl } from '../utils/avatar.js';

// Componente para animar los números (Counter)
function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(value) || 0;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }

    const duration = 1500; // ms
    const increment = end / (duration / 30);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        // Efecto de "flicker" aleatorio ligero
        setDisplayValue(Math.floor(start + (Math.random() * 2 - 1)));
      }
    }, 30);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayValue.toLocaleString()}</span>;
}

export default function Dashboard() {
  const { api, token, sedeActual } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [actividad, setActividad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');

  // Sede Image Logic - Imágenes de alta calidad (Tech/SaaS)
  const heroImage = sedeActual?.nombre?.toLowerCase().includes('arequipa') 
    ? 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2564&auto=format&fit=crop' // Modern circuit board / tech
    : 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2564&auto=format&fit=crop'; // Matrix / Code aesthetic

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
      <section className="dashboard-hero card" style={{ position: 'relative', overflow: 'hidden', border: 'none', background: 'var(--c-surface)' }}>
        <div className="hero-left" style={{ position: 'relative', zIndex: 3, padding: '10px 0' }}>
          <h1 
            key={`title-${sedeActual?.id}`}
            style={{ 
              fontFamily: 'var(--font-main), Serimi, sans-serif', fontSize: '42px', letterSpacing: '1px', color: 'var(--c-text)',
              animation: 'slideLeftRight 0.8s ease-out forwards'
            }}
          >
            Routing {sedeActual?.nombre}
          </h1>
          <p className="muted">Resumen rápido de operaciones y estado de rutas en <b>{sedeActual?.nombre}</b>.</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => window.location.href = '/rutas'}>Crear ruta</button>
            <button className="btn btn-ghost" onClick={() => window.location.href = '/ciclos'}>Ver Ciclos</button>
            <button className="btn btn-ghost" style={{ border: '1px solid var(--c-accent)', color: 'var(--c-accent)' }} onClick={() => window.location.href = '/localizar'}>Localizar Workers</button>
            <button className="btn btn-ghost" style={{ border: '1px solid var(--c-info)', color: 'var(--c-info)' }} onClick={() => window.location.href = '/monitoreo'}>Tiempos Muertos</button>
          </div>
        </div>
        
        {/* Capa de degradado para desvanecer la imagen */}
        <div style={{ 
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '60%',
          background: 'linear-gradient(to right, var(--c-surface), transparent)',
          zIndex: 2
        }} />
        <div className="grid-bg" style={{ opacity: 0.2 }}></div>

        <div 
          className="hero-right" 
          key={`hero-container-${sedeActual?.id}`}
          style={{ 
            position: 'absolute', 
            inset: 0, 
            zIndex: 1,
            animation: 'heroSlideIn 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'var(--c-surface)', zIndex: 1, opacity: 0.3 }} />
          <img 
            src={heroImage} 
            alt="Hero Sede" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              opacity: 0.4,
              mixBlendMode: 'screen',
              maskImage: 'linear-gradient(to right, var(--c-surface) 0%, transparent 80%)',
              WebkitMaskImage: 'linear-gradient(to right, black 20%, transparent 100%)'
            }} 
          />
        </div>

        <style>{`
          @keyframes slideLeftRight {
            from { opacity: 0; transform: translateX(-50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes dropDown {
            from { opacity: 0; transform: translateY(-30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes heroSlideIn {
            from { opacity: 0; transform: translateY(-50%) translateX(150px); }
            to { opacity: 0.8; transform: translateY(-50%) translateX(0); }
          }
        `}</style>
      </section>

      {/* STATS SCROLLABLE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', padding: '4px' }}>
          {[
            { label: 'TOTAL CLIENTES', value: stats.totalClientes, sub: 'TOTAL CARTERA', color: '#22B8CF', icon: <Users size={140} strokeWidth={1} /> },
            { label: 'PAGOS DE HOY', value: stats.clientesPagoHoy, sub: 'VENCEN HOY', color: '#FFFFFF', icon: <Wallet size={140} strokeWidth={1} /> },
            { label: 'WORKERS ACTIVOS', value: stats.workersActivos, sub: 'EN JORNADA', color: '#4263EB', icon: <Activity size={140} strokeWidth={1} /> },
            { label: 'RUTAS HOY', value: stats.rutasHoy, sub: 'ASIGNADAS', color: '#22B8CF', icon: <MapIcon size={140} strokeWidth={1} /> },
          ].map((s, i) => (
            <div 
              key={i} 
              className="card" 
              style={{ 
                padding: '28px 24px', display: 'flex', flexDirection: 'column',
                position: 'relative', overflow: 'hidden', minHeight: '160px',
                border: '1px solid var(--c-border)'
              }}
            >
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div 
                  key={`label-${sedeActual?.id}-${i}`}
                  style={{ 
                    fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)', letterSpacing: '1px', textTransform: 'uppercase',
                    marginBottom: '8px'
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: '42px', fontWeight: '900', color: '#FFF', margin: '0 0 4px 0', lineHeight: '1' }}>
                   <AnimatedNumber value={s.value} />
                </div>
                <div 
                  key={`sub-${sedeActual?.id}-${i}`}
                  style={{ 
                    fontSize: '10px', fontWeight: '800', color: s.color, textTransform: 'uppercase', letterSpacing: '0.5px'
                  }}
                >
                  {s.sub}
                </div>
              </div>
              <div 
                key={`bgicon-${sedeActual?.id}-${i}`}
                style={{ 
                  position: 'absolute', right: '-20px', bottom: '-30px', color: '#FFFFFF', opacity: 0.05,
                  zIndex: 1
                }}
              >
                {s.icon}
              </div>
            </div>
          ))}
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
              <div key={a.id || idx} className="activity-item" style={{ background: 'transparent', padding: '12px 0', borderBottom: '1px solid var(--c-border)', borderRadius: 0 }}>
                <div className="avatar-small" style={{ width: '48px', height: '48px', borderRadius: '50%' }}><img src={getAvatarUrl(a.worker_nombre, a.worker_id)} alt={a.worker_nombre} style={{ borderRadius: '50%' }} /></div>
                <div style={{ flex: 1, marginLeft: '4px' }}>
                  <div style={{ fontSize: '15px', color: 'var(--c-text)' }}><strong>{a.worker_nombre}</strong> gestionó a <strong>{a.cliente_nombre}</strong></div>
                  <div style={{ fontSize: '12px', color: 'var(--c-muted)', marginTop: '2px', fontWeight: '500' }}>
                    {a.tipificacion} • {new Date(a.created_at).toLocaleString('es-PE')}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 20px' }}>
            {stats.clientesPorEstado?.map(e => {
              const estColor = e.estado === 'LIBRE' ? 'var(--c-success)' : 
                               e.estado === 'VISITADO_PAGO' ? 'var(--c-info)' : 
                               (e.estado === 'NO_ENCONTRADO' || e.estado === 'NO_ECONTRADO') ? 'var(--c-danger)' : 
                               'var(--c-warn)';
              const EstIcon = e.estado === 'LIBRE' ? CheckCircle : 
                              e.estado === 'VISITADO_PAGO' ? Wallet : 
                              (e.estado === 'NO_ENCONTRADO' || e.estado === 'NO_ECONTRADO') ? AlertCircle : 
                              Calendar;
              return (
                <div key={e.estado} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--c-surface-2)', borderRadius: '12px', border: '1px solid var(--c-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: estColor }}>
                      <EstIcon size={20} strokeWidth={2.5} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--c-text)' }}>
                      {e.estado.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: estColor }}>
                    {e.total}
                  </div>
                </div>
              );
            })}
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
