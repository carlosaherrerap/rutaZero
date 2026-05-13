import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { ChevronRight, MapPin, FileText, Calendar, User as UserIcon, X, Search as SearchIcon, WifiOff } from 'lucide-react';

export default function Workers() {
  const { api, sedeActual } = useContext(AuthContext);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drill-down state
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerRoutes, setWorkerRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeDetail, setRouteDetail] = useState(null);
  const [loadingRouteDetail, setLoadingRouteDetail] = useState(false);

  const [selectedFicha, setSelectedFicha] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newWorker, setNewWorker] = useState({
    username: '', password: '', nombres: '', apellidos: '', dni: '', telefono: '', email: '', distrito: ''
  });

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/workers');
      setWorkers(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchWorkers(); }, [api]);

  const [workerLogs, setWorkerLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const handleSelectWorker = async (w) => {
    setSelectedWorker(w);
    setLoadingRoutes(true);
    setLoadingLogs(true);
    setWorkerRoutes([]);
    setWorkerLogs([]);
    setSelectedRoute(null);
    setRouteDetail(null);
    setSelectedFicha(null);
    try {
      const resR = await api.get(`/api/rutas/worker/${w.id}`);
      setWorkerRoutes(resR.data.data || []);
      
      const resL = await api.get(`/api/monitoreo/logs/${w.id}`);
      setWorkerLogs(resL.data.data || []);
    } catch (e) { console.error(e); }
    finally { 
      setLoadingRoutes(false);
      setLoadingLogs(false); 
    }
  };

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

  const [editingWorker, setEditingWorker] = useState(null);

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/api/workers', newWorker);
      setShowModal(false);
      setNewWorker({ username: '', password: '', nombres: '', apellidos: '', dni: '', telefono: '', email: '', distrito: '' });
      fetchWorkers();
    } catch (e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    finally { setCreating(false); }
  };

  const handleEditWorker = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.patch(`/api/workers/${editingWorker.id}`, editingWorker);
      setEditingWorker(null);
      fetchWorkers();
    } catch (e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    finally { setCreating(false); }
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedWorker ? '1fr 450px' : '1fr', gap: '24px', transition: 'all 0.3s' }}>
      
      {/* MAIN TABLE */}
      <div>
        <div style={{ marginBottom: '24px' }}>
          <h1 className="text-2xl font-bold">Gestión de Workers - {sedeActual?.nombre || 'General'}</h1>
          <p className="text-muted">Visualiza el estado de tus trabajadores en campo y su productividad en esta sede.</p>
        </div>

        <div className="filter-bar">
          <div className="search-bar" style={{ width: '300px' }}>
            <SearchIcon size={16} color="var(--c-muted)"/>
            <input type="text" placeholder="Buscar worker..." />
          </div>
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowModal(true)}>
            + Agregar Worker
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>DNI / Teléfono</th>
                <th>Distrito Base</th>
                <th>Estado Jornada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center"><div className="spinner"></div></td></tr>
              ) : workers.map(w => (
                <tr key={w.id} 
                  onClick={() => handleSelectWorker(w)} 
                  style={{ cursor: 'pointer', background: selectedWorker?.id === w.id ? 'var(--c-surface-2)' : 'transparent' }}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--c-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                        {w.nombres[0]}
                      </div>
                      <div>
                        <div className="font-bold">{w.nombres} {w.apellidos}</div>
                        <div className="text-sm text-muted">{w.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{w.dni} <br/> <small className="text-muted">{w.telefono}</small></td>
                  <td>{w.distrito || '--'}</td>
                  <td>
                    <span className={`badge badge-${(w.estado_jornada || 'off').toLowerCase().replace(/_/g, '-')}`}>
                      {w.estado_jornada || 'SIN INICIAR'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditingWorker(w); }}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRILL-DOWN PANEL: ACTIVIDAD DETALLADA */}
      {selectedWorker && (
        <div className="card activity-panel" style={{ 
          display: 'flex', flexDirection: 'column', 
          height: 'calc(100vh - 110px)', padding: 0, 
          overflow: 'hidden', backgroundColor: 'var(--c-surface)',
          border: '1px solid var(--c-border)', borderRadius: '24px',
          boxShadow: 'var(--shadow-lg)', animation: 'panelSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* HEADER DEL PANEL */}
          <div style={{ 
            padding: '20px 24px', borderBottom: '1px solid var(--c-border)', 
            background: 'var(--c-surface-2)', display: 'flex', 
            justifyContent: 'space-between', alignItems: 'center' 
          }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: '900', color: 'var(--c-primary)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>MONITOREO DE ACTIVIDAD</div>
              <h3 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: 'var(--c-text)', letterSpacing: '-0.5px' }}>{selectedWorker.nombres} {selectedWorker.apellidos}</h3>
            </div>
            <button className="btn-icon" style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px' }} onClick={() => setSelectedWorker(null)}><X size={18}/></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* NUEVA SECCIÓN: LÍNEA DE TIEMPO DE AUDITORÍA */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <FileText size={16} color="var(--c-primary)"/>
                <h4 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--c-text)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Auditoría de Comportamiento</h4>
              </div>

              {loadingLogs ? (
                <div style={{ padding: '20px', textAlign: 'center' }}><div className="spinner"></div></div>
              ) : workerLogs.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', background: 'var(--c-surface-2)', borderRadius: '16px', border: '1px dashed var(--c-border)' }}>
                  <p style={{ fontSize: '12px', color: 'var(--c-muted)', margin: 0 }}>Sin registros de actividad para hoy.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10px', borderLeft: '2px solid var(--c-border)', gap: '20px', marginLeft: '5px' }}>
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
                                  <span style={{ fontSize: '11px', fontWeight: '900', color: info.color }}>{info.label}</span>
                               </div>
                               {log.cliente_nombre && (
                                 <div style={{ fontSize: '12px', fontWeight: '700', marginTop: '2px' }}>
                                   {log.cliente_nombre} {log.cliente_apellido}
                                 </div>
                               )}
                               {log.metadata?.lat && (
                                 <div style={{ fontSize: '10px', color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    <MapPin size={8}/> {log.metadata.lat.toFixed(5)}, {log.metadata.lng.toFixed(5)}
                                 </div>
                               )}
                             </div>
                             <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)' }}>
                               {new Date(log.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                             </div>
                          </div>
                       </div>
                     );
                   })}
                </div>
              )}
            </section>
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <MapPin size={16} color="var(--c-primary)"/>
                <h4 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--c-text)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Rutas Asignadas</h4>
              </div>
              
              {loadingRoutes ? (
                <div style={{ padding: '20px', textAlign: 'center' }}><div className="spinner"></div></div>
              ) : workerRoutes.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', background: 'var(--c-surface-2)', borderRadius: '16px', border: '1px dashed var(--c-border)' }}>
                  <p style={{ fontSize: '13px', color: 'var(--c-muted)', margin: 0 }}>No hay rutas registradas para este worker.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {workerRoutes.map(r => (
                    <div key={r.id} 
                      onClick={() => handleSelectRoute(r)}
                      style={{ 
                        padding: '16px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.3s',
                        background: selectedRoute?.id === r.id ? 'var(--c-primary)' : 'var(--c-surface-2)',
                        border: '1px solid',
                        borderColor: selectedRoute?.id === r.id ? 'var(--c-primary)' : 'var(--c-border)',
                        color: selectedRoute?.id === r.id ? 'var(--c-on-primary)' : 'var(--c-text)',
                        boxShadow: selectedRoute?.id === r.id ? '0 10px 20px rgba(0, 169, 188, 0.2)' : 'none',
                        position: 'relative', overflow: 'hidden'
                      }}
                    >
                      <div style={{ fontWeight: '800', fontSize: '14px' }}>{r.nombre}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '11px', opacity: 0.8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12}/> {new Date(r.fecha_asignacion).toLocaleDateString('es-PE')}</span>
                        <span style={{ fontWeight: '900', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)' }}>{r.total_clientes} CLIENTES</span>
                      </div>
                      {selectedRoute?.id === r.id && <div style={{ position: 'absolute', right: '-10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.1 }}><MapPin size={60}/></div>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* NIVEL 2: CLIENTES DE LA RUTA */}
            {selectedRoute && (
              <section style={{ animation: 'fadeInUp 0.4s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <UserIcon size={16} color="var(--c-primary)"/>
                  <h4 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--c-text)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Clientes en Ruta</h4>
                </div>
                
                {loadingRouteDetail ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}><div className="spinner"></div></div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {routeDetail?.clientes?.map(c => (
                      <div key={c.id} 
                        onClick={() => handleSelectClient(c)}
                        style={{ 
                          padding: '12px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                          background: selectedFicha?.client?.id === c.id ? 'var(--c-surface-2)' : 'var(--c-surface)',
                          border: '1px solid',
                          borderColor: selectedFicha?.client?.id === c.id ? 'var(--c-primary)' : 'var(--c-border)',
                          boxShadow: selectedFicha?.client?.id === c.id ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombres}</div>
                        <div style={{ fontSize: '10px', color: 'var(--c-muted)', marginTop: '2px' }}>DNI: {c.dni}</div>
                        <div style={{ 
                          marginTop: '8px', fontSize: '9px', fontWeight: '900', 
                          color: c.estado === 'LIBRE' ? 'var(--c-success)' : 'var(--c-info)',
                          textTransform: 'uppercase'
                        }}>
                          {c.estado.replace(/_/g, ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* NIVEL 3: FICHA DE GESTIÓN (EL TICKET) */}
            {selectedFicha && (
              <section style={{ animation: 'ticketSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <FileText size={16} color="var(--c-primary)"/>
                  <h4 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--c-text)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Ficha de Gestión</h4>
                </div>

                <div className="ficha-ticket" style={{ 
                  background: 'var(--c-surface)', 
                  border: '1px solid var(--c-border)', 
                  borderRadius: '20px', 
                  overflow: 'hidden',
                  boxShadow: '0 15px 35px rgba(0,0,0,0.15)'
                }}>
                  {/* Header de la ficha */}
                  <div style={{ padding: '20px', background: 'var(--c-surface-2)', borderBottom: '2px dashed var(--c-border)', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '900', color: 'var(--c-muted)', marginBottom: '4px' }}>TIPIFICACIÓN</div>
                        <div style={{ 
                          fontSize: '20px', fontWeight: '900', 
                          color: selectedFicha.data.tipificacion === 'PAGO' ? 'var(--c-success)' : 'var(--c-danger)' 
                        }}>
                          {selectedFicha.data.tipificacion}
                        </div>
                      </div>
                      {selectedFicha.data.es_offline && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--c-danger)', padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <WifiOff size={14}/> MODO OFFLINE
                        </div>
                      )}
                    </div>
                    {/* Los circulitos decorativos de ticket lateral */}
                    <div style={{ position: 'absolute', bottom: '-10px', left: '-10px', width: '20px', height: '20px', background: 'var(--c-surface)', borderRadius: '50%' }}></div>
                    <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', width: '20px', height: '20px', background: 'var(--c-surface)', borderRadius: '50%' }}></div>
                  </div>

                  {/* Cuerpo de la ficha */}
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* DATOS DEL CLIENTE EN LA FICHA */}
                    <div style={{ padding: '12px 16px', background: 'var(--c-surface-2)', borderRadius: '12px', border: '1px solid var(--c-border)' }}>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>CLIENTE GESTIONADO</div>
                      <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--c-text)' }}>{selectedFicha.client.nombres} {selectedFicha.client.apellidos}</div>
                      <div style={{ fontSize: '12px', color: 'var(--c-muted)', marginTop: '2px' }}>DNI: {selectedFicha.client.dni}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', marginBottom: '4px' }}>CONDICIÓN</div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-text)' }}>{selectedFicha.data.condicion_contable || 'NO REGISTRADA'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', marginBottom: '4px' }}>MONTO RECAUDADO</div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-text)' }}>S/ {selectedFicha.data.monto_cuota || '0.00'}</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', marginBottom: '4px' }}>OBSERVACIONES GENERALES</div>
                      <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--c-text)', margin: 0, padding: '12px', background: 'var(--c-surface-2)', borderRadius: '12px', border: '1px solid var(--c-border)' }}>
                        {selectedFicha.data.observacion || 'Sin observaciones registradas por el worker.'}
                      </p>
                    </div>

                    {/* EVIDENCIAS FOTOGRÁFICAS */}
                    {selectedFicha.data.evidencias && selectedFicha.data.evidencias.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', marginBottom: '12px' }}>EVIDENCIAS FOTOGRÁFICAS ({selectedFicha.data.evidencias.length})</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {selectedFicha.data.evidencias.map((url, i) => (
                            <div key={i} className="evidence-container" style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--c-border)', cursor: 'pointer' }}>
                                <img 
                                  src={url.startsWith('http') ? url : `${api.defaults.baseURL}${url}`} 
                                  style={{ width: '100%', height: '140px', objectFit: 'cover', transition: 'transform 0.3s' }}
                                  alt={`Evidencia ${i+1}`}
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                  onClick={() => window.open(url.startsWith('http') ? url : `${api.defaults.baseURL}${url}`, '_blank')}
                                />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

          </div>
          
          <style>{`
            @keyframes panelSlideIn {
              from { opacity: 0; transform: translateX(50px); }
              to { opacity: 1; transform: translateX(0); }
            }
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes ticketSlideIn {
              from { opacity: 0; transform: scale(0.9) translateY(40px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .evidence-container:hover img { transform: scale(1.1); }
          `}</style>
        </div>
      )}

      {/* MODAL EDITAR / CREAR (Same as before but cleaned up) */}
      {editingWorker && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span className="modal-title">Editar Worker: {editingWorker.username}</span>
              <button className="btn-ghost btn-sm" onClick={() => setEditingWorker(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditWorker}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Estado de Cuenta</label>
                  <select className="form-input" value={editingWorker.estado} onChange={e => setEditingWorker({...editingWorker, estado: e.target.value})}>
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Nombres</label><input className="form-input" value={editingWorker.nombres} onChange={e => setEditingWorker({...editingWorker, nombres: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Apellidos</label><input className="form-input" value={editingWorker.apellidos} onChange={e => setEditingWorker({...editingWorker, apellidos: e.target.value})} /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditingWorker(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Guardando...' : 'Actualizar Worker'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span className="modal-title">Registrar Nuevo Worker</span>
              <button className="btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateWorker}>
              <div className="modal-body">
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Username</label><input className="form-input" required value={newWorker.username} onChange={e => setNewWorker({...newWorker, username: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" required value={newWorker.password} onChange={e => setNewWorker({...newWorker, password: e.target.value})} /></div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Nombres</label><input className="form-input" required value={newWorker.nombres} onChange={e => setNewWorker({...newWorker, nombres: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Apellidos</label><input className="form-input" required value={newWorker.apellidos} onChange={e => setNewWorker({...newWorker, apellidos: e.target.value})} /></div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">DNI</label><input className="form-input" required value={newWorker.dni} onChange={e => setNewWorker({...newWorker, dni: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={newWorker.telefono} onChange={e => setNewWorker({...newWorker, telefono: e.target.value})} /></div>
                </div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={newWorker.email} onChange={e => setNewWorker({...newWorker, email: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Distrito Base</label><input className="form-input" value={newWorker.distrito} onChange={e => setNewWorker({...newWorker, distrito: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Guardando...' : 'Crear Worker'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
