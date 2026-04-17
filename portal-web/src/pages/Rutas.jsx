import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

export default function Rutas() {
  const { api } = useContext(AuthContext);
  const [rutas, setRutas] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Form state
  const [newRuta, setNewRuta] = useState({ nombre: '', worker_id: '', cliente_ids: [] });
  const [creating, setCreating] = useState(false);
  
  // Route Detail state
  const [showRouteDetail, setShowRouteDetail] = useState(null);
  const [routeClients, setRouteClients] = useState([]);
  const [routeClientsLoading, setRouteClientsLoading] = useState(false);
  
  const handleViewRouteDetail = async (ruta) => {
    setShowRouteDetail(ruta);
    setRouteClientsLoading(true);
    try {
      const res = await api.get(`/api/rutas/${ruta.id}`);
      setRouteClients(res.data.data.clientes || []);
    } catch (e) {
      console.error('Error loading route detail', e);
    } finally {
      setRouteClientsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [api]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [rRes, wRes, cRes] = await Promise.all([
        api.get('/api/rutas'),
        api.get('/api/workers'),
        api.get('/api/clientes?limit=100') // get more clients for selection
      ]);
      setRutas(rRes.data.data || []);
      setWorkers(wRes.data.data || []);
      setClientes(cRes.data.data || []);
    } catch (e) {
      console.error('Error loading data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRuta = async (e) => {
    e.preventDefault();
    if (newRuta.cliente_ids.length === 0) return alert('Selecciona al menos un cliente');
    
    setCreating(true);
    try {
      await api.post('/api/rutas', newRuta);
      setShowModal(false);
      setNewRuta({ nombre: '', worker_id: '', cliente_ids: [] });
      fetchInitialData();
    } catch (e) {
      alert('Error al crear ruta: ' + (e.response?.data?.error || e.message));
    } finally {
      setCreating(false);
    }
  };

  const toggleCliente = (id) => {
    setNewRuta(prev => {
      const ids = prev.cliente_ids.includes(id) 
        ? prev.cliente_ids.filter(x => x !== id)
        : [...prev.cliente_ids, id];
      return { ...prev, cliente_ids: ids };
    });
  };

  return (
    <div>
      <div className="filter-bar">
        <div className="search-bar" style={{ width: '250px' }}>
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
           <input type="text" placeholder="Filtrar rutas..." />
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowModal(true)}>
          + Crear Nueva Ruta
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre de Ruta</th>
              <th>Worker Asignado</th>
              <th>Progreso</th>
              <th>Fecha Asignación</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center"><div className="spinner"></div></td></tr>
            ) : rutas.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-4">No hay rutas creadas</td></tr>
            ) : rutas.map(r => (
              <tr key={r.id}>
                <td>
                  <div className="font-bold">{r.nombre}</div>
                  <div className="text-sm text-muted">{r.total_clientes} clientes</div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="sidebar-avatar" style={{width:24, height:24, fontSize:10}}>{r.worker_nombre?.[0]}</div>
                    <span>{r.worker_nombre} {r.worker_apellido}</span>
                  </div>
                </td>
                <td>
                  <div style={{width: '100px'}}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{Math.round(((r.visitados || 0) / r.total_clientes) * 100)}%</span>
                      <span className="text-muted">{r.visitados || 0}/{r.total_clientes}</span>
                    </div>
                    <div className="chart-bar-track" style={{height: 6}}>
                      <div 
                        className="chart-bar-fill" 
                        style={{ width: `${((r.visitados || 0) / r.total_clientes) * 100}%`, background: 'var(--c-accent)' }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td>{new Date(r.fecha_asignacion).toLocaleDateString()}</td>
                <td>
                  {r.completada ? (
                    <span className="badge badge-visitado">COMPLETADA</span>
                  ) : (
                    <span className="badge badge-en-gestion">EN PROGRESO</span>
                  )}
                </td>
                <td>
                  <button className="btn btn-primary btn-sm" onClick={() => handleViewRouteDetail(r)}>Ver Ruta</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal - Route Detail */}
      {showRouteDetail && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <span className="modal-title">Detalle de Ruta: {showRouteDetail.nombre}</span>
              <button className="btn-ghost btn-sm" onClick={() => setShowRouteDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '25px' }}>
                <div className="stat-card">
                  <span className="stat-label">Worker</span>
                  <span className="stat-value" style={{fontSize: '15px'}}>{showRouteDetail.worker_nombre} {showRouteDetail.worker_apellido}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Progreso</span>
                  <span className="stat-value" style={{fontSize: '15px'}}>{showRouteDetail.visitados || 0} / {showRouteDetail.total_clientes}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Fecha</span>
                  <span className="stat-value" style={{fontSize: '15px'}}>{new Date(showRouteDetail.fecha_asignacion).toLocaleDateString()}</span>
                </div>
              </div>

              <h4 className="card-title mb-3">Orden de Visita</h4>
              <div className="table-wrap" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '50px' }}>Ord</th>
                      <th>Cliente</th>
                      <th>Distrito / Dirección</th>
                      <th>Deuda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeClientsLoading ? (
                      <tr><td colSpan="4" className="text-center"><div className="spinner"></div></td></tr>
                    ) : (
                      routeClients.map(c => (
                        <tr key={c.id}>
                          <td className="font-bold text-center">{c.orden}</td>
                          <td>
                            <div className="font-bold">{c.nombres} {c.apellidos}</div>
                            <div className={`badge badge-${c.estado.toLowerCase().replace(/_/g, '-')}`} style={{fontSize: 9}}>
                              {c.estado}
                            </div>
                          </td>
                          <td>
                            <div className="text-sm">{c.distrito}</div>
                            <div className="text-xs text-muted">{c.direccion}</div>
                          </td>
                          <td>S/ {parseFloat(c.deuda_total).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowRouteDetail(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Creador de Rutas */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <span className="modal-title">Crear Nueva Ruta</span>
              <button className="btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRuta}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre de la Ruta</label>
                  <input 
                    className="form-input" 
                    placeholder="Ej: Lima Norte Lunes" 
                    required 
                    value={newRuta.nombre}
                    onChange={e => setNewRuta({...newRuta, nombre: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Asignar a Worker</label>
                  <select 
                    className="form-input" 
                    required
                    value={newRuta.worker_id}
                    onChange={e => setNewRuta({...newRuta, worker_id: e.target.value})}
                  >
                    <option value="">Selecciona un worker...</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>{w.nombres} {w.apellidos} ({w.distrito || 'Sin distrito'})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Seleccionar Clientes ({newRuta.cliente_ids.length} seleccionados)</label>
                  <div className="table-wrap" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <table>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th></th>
                          <th>Cliente</th>
                          <th>Distrito</th>
                          <th>Deuda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientes.filter(c => c.estado === 'LIBRE').map(c => (
                          <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => toggleCliente(c.id)}>
                            <td>
                              <input 
                                type="checkbox" 
                                readOnly 
                                checked={newRuta.cliente_ids.includes(c.id)} 
                              />
                            </td>
                            <td>{c.nombres} {c.apellidos}</td>
                            <td>{c.distrito}</td>
                            <td>S/ {parseFloat(c.deuda_total).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Guardando...' : 'Guardar y Asignar Ruta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
