import React, { useEffect, useState, useContext } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { ChevronLeft, MapPin, FileText, Calendar, User as UserIcon, X, WifiOff } from 'lucide-react';

export default function WorkerDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { api } = useContext(AuthContext);

  const [selectedWorker, setSelectedWorker] = useState(location.state?.worker || null);
  const [workerRoutes, setWorkerRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [workerLogs, setWorkerLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeDetail, setRouteDetail] = useState(null);
  const [loadingRouteDetail, setLoadingRouteDetail] = useState(false);
  const [selectedFicha, setSelectedFicha] = useState(null);

  useEffect(() => {
    if (!selectedWorker) {
      // Fetch all workers and find
      api.get('/api/workers').then(res => {
        const w = (res.data.data || []).find(x => x.id === id);
        if (w) setSelectedWorker(w);
      }).catch(console.error);
    }
  }, [id, selectedWorker, api]);

  useEffect(() => {
    if (selectedWorker) {
      setLoadingRoutes(true);
      setLoadingLogs(true);
      api.get(`/api/rutas/worker/${selectedWorker.id}`).then(res => {
        setWorkerRoutes(res.data.data || []);
      }).catch(console.error).finally(() => setLoadingRoutes(false));
      
      api.get(`/api/monitoreo/logs/${selectedWorker.id}`).then(res => {
        setWorkerLogs(res.data.data || []);
      }).catch(console.error).finally(() => setLoadingLogs(false));
    }
  }, [selectedWorker, api]);

  const handleSelectRoute = async (r) => {
    setSelectedRoute(r);
    setLoadingRouteDetail(true);
    setRouteDetail(null);
    setSelectedFicha(null);
    try {
      const res = await api.get(`/api/rutas/${r.id}`);
      setRouteDetail(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingRouteDetail(false); }
  };

  const handleSelectClient = async (c) => {
    setSelectedFicha(null);
    try {
      const res = await api.get(`/api/workers/clientes/${c.id}/ficha`);
      setSelectedFicha({ client: c, data: res.data.data });
    } catch (e) {
      console.log('Error fetching ficha:', e);
      alert('Este cliente aún no tiene una ficha completada para esta gestión.');
    }
  };

  const getActionInfo = (accion) => {
    switch (accion) {
      case 'JORNADA_INICIADA': return { color: '#10b981', label: 'INICIÓ DÍA', icon: '' };
      case 'ALMUERZO_INICIADO': return { color: '#f59e0b', label: 'INICIÓ RECESO', icon: '' };
      case 'ALMUERZO_FINALIZADO': return { color: '#10b981', label: 'FIN RECESO', icon: '' };
      case 'FICHA_DETALLE_ABIERTA': return { color: '#3b82f6', label: 'VIO DETALLE', icon: '' };
      case 'VISITAR_PRESIONADO': return { color: '#a855f7', label: 'EN CAMINO', icon: '' };
      case 'FICHA_ABIERTA': return { color: '#6366f1', label: 'ABRIÓ FICHA', icon: '' };
      case 'FICHA_GUARDADA': return { color: '#059669', label: 'GESTIÓN LISTA', icon: '' };
      case 'JORNADA_FINALIZADA': return { color: '#ef4444', label: 'FINALIZÓ DÍA', icon: '' };
      default: return { color: '#94a3b8', label: accion, icon: '' };
    }
  };

  if (!selectedWorker) {
    return <div className="p-8 text-center"><div className="spinner"></div></div>;
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn btn-ghost" style={{ padding: '8px', borderRadius: '50%' }} onClick={() => navigate('/workers')}>
          <ChevronLeft size={24}/>
        </button>
        <div>
          <h1 className="text-2xl font-bold">Detalles del Worker</h1>
          <p className="text-muted">Análisis de rutas y actividad de {selectedWorker.nombres} {selectedWorker.apellidos}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* TOP SECTION: AUDITORÍA DE COMPORTAMIENTO (TIEMPO REAL) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '400px', padding: '24px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--c-border)', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite', boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)' }} />
            </div>
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--c-text)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Auditoría de Comportamiento</h4>
              <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '700', letterSpacing: '0.5px' }}>TIEMPO REAL</span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px', display: 'flex', flexDirection: 'column' }}>
            {loadingLogs ? (
              <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner"></div></div>
            ) : workerLogs.length === 0 ? (
              <div style={{ margin: 'auto', padding: '24px', textAlign: 'center', background: 'var(--c-surface-2)', borderRadius: '16px', border: '1px dashed var(--c-border)', width: '100%' }}>
                <p style={{ fontSize: '12px', color: 'var(--c-muted)', margin: 0 }}>Sin registros de actividad para hoy.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10px', borderLeft: '2px solid var(--c-border)', gap: '24px', marginLeft: '5px', marginTop: '10px' }}>
                {workerLogs.map((log, idx) => {
                  const info = getActionInfo(log.accion);
                  return (
                    <div key={idx} style={{ position: 'relative' }}>
                        <div style={{ 
                          position: 'absolute', left: '-17px', top: '0', 
                          width: '12px', height: '12px', borderRadius: '50%', 
                          background: info.color, border: '2px solid var(--c-surface)' 
                        }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px' }}>{info.icon}</span>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: info.color }}>{info.label}</span>
                            </div>
                            {log.cliente_nombre && (
                              <div style={{ fontSize: '13px', fontWeight: '600', marginTop: '4px', color: 'var(--c-text)' }}>
                                {log.cliente_nombre} {log.cliente_apellido}
                              </div>
                            )}
                            {log.metadata?.lat && (
                              <div style={{ fontSize: '10px', color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                  <MapPin size={10}/> {log.metadata.lat.toFixed(5)}, {log.metadata.lng.toFixed(5)}
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--c-muted)' }}>
                            {new Date(log.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM SECTION: RUTAS, CLIENTES Y FICHA */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '32px' }}>
          
          {/* NIVEL 1: RUTAS EN DROPDOWN */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <MapPin size={18} color="var(--c-primary)"/>
              <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--c-text)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Rutas Asignadas</h4>
            </div>
            
            {loadingRoutes ? (
              <div style={{ padding: '20px', textAlign: 'center' }}><div className="spinner"></div></div>
            ) : workerRoutes.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', background: 'var(--c-surface-2)', borderRadius: '16px', border: '1px dashed var(--c-border)' }}>
                <p style={{ fontSize: '13px', color: 'var(--c-muted)', margin: 0 }}>No hay rutas registradas para este worker.</p>
              </div>
            ) : (
              <div>
                <select 
                  className="form-input" 
                  value={selectedRoute?.id || ''}
                  onChange={(e) => {
                    const r = workerRoutes.find(x => x.id === e.target.value);
                    if (r) handleSelectRoute(r);
                    else {
                      setSelectedRoute(null);
                      setRouteDetail(null);
                      setSelectedFicha(null);
                    }
                  }}
                  style={{ width: '100%', maxWidth: '500px', fontSize: '15px', fontWeight: '600' }}
                >
                  <option value="">Selecciona una ruta para ver sus clientes...</option>
                  {workerRoutes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} • {r.total_clientes} Clientes • Asignado: {new Date(r.fecha_asignacion).toLocaleDateString('es-PE')}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* NIVEL 2: CLIENTES DE LA RUTA */}
          {selectedRoute && (
            <section style={{ animation: 'fadeInUp 0.4s ease', borderTop: '1px dashed var(--c-border)', paddingTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <UserIcon size={18} color="var(--c-primary)"/>
                <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--c-text)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Clientes de la ruta: {selectedRoute.nombre}</h4>
              </div>
              
              {loadingRouteDetail ? (
                <div style={{ padding: '20px', textAlign: 'center' }}><div className="spinner"></div></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {routeDetail?.clientes?.map(c => (
                    <div key={c.id} 
                      onClick={() => handleSelectClient(c)}
                      style={{ 
                        padding: '16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                        background: 'var(--c-surface)',
                        border: '1px solid var(--c-border)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--c-primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--c-border)'}
                    >
                      <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombres}</div>
                      <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: '4px' }}>DNI: {c.dni}</div>
                      <div style={{ 
                        marginTop: '12px', fontSize: '10px', fontWeight: '800', 
                        color: c.estado === 'LIBRE' ? 'var(--c-success)' : 'var(--c-info)',
                        textTransform: 'uppercase', display: 'inline-block',
                        padding: '4px 8px', borderRadius: '6px', background: c.estado === 'LIBRE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)'
                      }}>
                        {c.estado.replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      </div>

      {/* NIVEL 3: MODAL DE FICHA (Mismo diseño que Clientes.jsx) */}
      {selectedFicha && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(5px)' }}>
          <div className="modal" style={{ maxWidth: '900px', width: '95vw', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: '24px', overflow: 'hidden' }}>
            <div className="p-10 flex justify-between items-center" style={{ padding: '24px 32px', borderBottom: '1px solid var(--c-border)' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--c-text)', margin: 0, letterSpacing: '-0.5px' }}>{selectedFicha.client.nombres} {selectedFicha.client.apellidos}</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ color: 'var(--c-text)', fontSize: '13px', fontWeight: '500', background: 'var(--c-surface-2)', padding: '4px 8px', borderRadius: '4px' }}>DNI: {selectedFicha.client.dni}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedFicha(null)}
                style={{ 
                  width: '32px', height: '32px', border: 'none', 
                  background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s', color: 'var(--c-muted)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-muted)'; }}
              >
                <X size={20}/>
              </button>
            </div>

            <div className="modal-body" style={{ padding: '32px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: '600', color: 'var(--c-text)', textTransform: 'uppercase', margin: 0 }}>FICHA DE GESTIÓN (TICKET)</h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '16px', top: '0', bottom: '0', width: '2px', background: 'var(--c-border)', zIndex: 0 }}></div>
                
                <div style={{ position: 'relative', paddingLeft: '32px', marginBottom: '32px', zIndex: 1 }}>
                  <div style={{ 
                    position: 'absolute', left: '-5px', top: '24px', width: '12px', height: '12px', 
                    borderRadius: '50%', background: 'var(--c-bg)', border: `2px solid var(--c-muted)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2
                  }}>
                  </div>

                  <div className="card" style={{ 
                    background: 'var(--c-surface)', borderRadius: '8px', padding: 0, 
                    border: '1px solid var(--c-border)', transition: 'all 0.3s', overflow: 'hidden'
                  }}>
                    <div style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--c-border)', borderRadius: '6px 6px 0 0' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{
                          background: selectedFicha.data.tipificacion === 'PAGO' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: selectedFicha.data.tipificacion === 'PAGO' ? 'var(--c-success)' : 'var(--c-danger)',
                          fontWeight: '600', fontSize: '11px', padding: '4px 12px', borderRadius: '6px', whiteSpace: 'nowrap', letterSpacing: '0.2px'
                        }}>
                          {selectedFicha.data.tipificacion}
                        </span>
                        <div style={{ fontWeight: '500', fontSize: '15px' }}>
                          {selectedFicha.data.tipificacion === 'PAGO' ? 'Cobro Recaudado' : (selectedFicha.data.tipificacion === 'REPROGRAMARA' ? 'Visita Reprogramada' : 'Gestión Fallida')}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>CONDICIÓN</div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--c-text)' }}>{selectedFicha.data.condicion_contable || 'NO REGISTRADA'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>MONTO RECAUDADO</div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--c-text)' }}>S/ {selectedFicha.data.monto_cuota || '0.00'}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: '24px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>OBSERVACIÓN</div>
                        <div style={{ fontSize: '13px', color: 'var(--c-text)', fontStyle: 'italic', lineHeight: '1.5' }}>
                          "{selectedFicha.data.observacion || 'Sin observaciones registradas'}"
                        </div>
                      </div>

                      {selectedFicha.data.evidencias && selectedFicha.data.evidencias.length > 0 && (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                          {selectedFicha.data.evidencias.map((url, i) => (
                            <img key={i} 
                              src={url.startsWith('http') ? url : `${api.defaults.baseURL}${url}`} 
                              style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--c-border)', cursor: 'pointer' }}
                              onClick={() => window.open(url.startsWith('http') ? url : `${api.defaults.baseURL}${url}`, '_blank')}
                              onError={e => e.target.style.display = 'none'}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--c-border)', fontSize: '12px', color: 'var(--c-text)', display: 'flex', justifyContent: 'space-between', background: 'var(--c-surface)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--c-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                          {selectedWorker.nombres ? selectedWorker.nombres[0] : 'W'}
                        </div>
                        <span>Gestionado por <b>{selectedWorker.nombres}</b></span>
                      </div>
                      {selectedFicha.data.es_offline && <span style={{ color: 'var(--c-danger)', fontWeight: '600' }}>MODO OFFLINE</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ticketSlideIn {
          from { opacity: 0; transform: scale(0.9) translateY(40px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .evidence-container:hover img { transform: scale(1.1); }
      `}</style>
    </div>
  );
}
