import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Componente para ajustar el mapa a los marcadores seleccionados o a todos
function RecenterMap({ coords }) {
  const map = useMap();
  const [hasCentered, setHasCentered] = React.useState(false);

  useEffect(() => {
    // Solo centramos si tenemos coordenadas y no hemos centrado ya en esta sesión
    if (coords.length > 0 && !hasCentered) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
      setHasCentered(true);
    }
  }, [coords, map, hasCentered]);

  // Resetear el estado cuando no hay coordenadas (para que vuelva a centrar al abrir de nuevo)
  useEffect(() => {
    if (coords.length === 0) setHasCentered(false);
  }, [coords]);

  return null;
}

export default function Rutas() {
  const { api } = useContext(AuthContext);
  const [rutas, setRutas] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Estado para nueva ruta
  const [newRuta, setNewRuta] = useState({ 
    nombre: '', 
    worker_id: '', 
    cliente_ids: [],
    fecha_asignacion: new Date().toISOString().split('T')[0]
  });

  const [creating, setCreating] = useState(false);
  const [filterPago, setFilterPago] = useState('');

  useEffect(() => {
    fetchData();
  }, [api]);

  const fetchData = async () => {
    try {
      const [resRutas, resWorkers, resClientes] = await Promise.all([
        api.get('/api/rutas'),
        api.get('/api/workers'), // CORRECCIÓN: Endpoint correcto
        api.get('/api/clientes?limit=9999')  // Sin límite: traer TODOS para el planificador
      ]);
      setRutas(resRutas.data.data);
      setWorkers(resWorkers.data.data);
      setClientes(resClientes.data.data);
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRuta = async () => {
    if (!newRuta.nombre || !newRuta.worker_id || newRuta.cliente_ids.length === 0) {
      alert('Por favor completa todos los campos y selecciona al menos un cliente.');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/rutas', newRuta);
      setShowModal(false);
      setNewRuta({ nombre: '', worker_id: '', cliente_ids: [], fecha_asignacion: new Date().toISOString().split('T')[0] });
      fetchData();
      alert('Ruta creada con éxito');
    } catch (err) {
      alert('Error al crear ruta');
    } finally {
      setCreating(false);
    }
  };

  const toggleCliente = (id) => {
    setNewRuta(prev => {
      const ids = prev.cliente_ids.includes(id) 
        ? prev.cliente_ids.filter(cid => cid !== id)
        : [...prev.cliente_ids, id];
      return { ...prev, cliente_ids: ids };
    });
  };

  // Filtramos por fecha de pago normalizando ambos valores a YYYY-MM-DD
  const clientesVisibles = clientes.filter(c => {
    if (!filterPago) return true;  // Sin filtro → mostrar TODOS
    if (!c.fecha_pago) return false;
    // Convertir a string y tomar solo YYYY-MM-DD (funciona con '2026-04-27' y '2026-04-27T00:00:00.000Z')
    const fechaCliente = new Date(c.fecha_pago).toISOString().slice(0, 10);
    const fechaFiltro = new Date(filterPago).toISOString().slice(0, 10);
    return fechaCliente === fechaFiltro;
  });

  if (loading) return <div className="p-8">Cargando datos del planificador...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Rutas</h1>
          <p className="text-muted">Planifica y asigna rutas a tus workers.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ CREAR RUTA</button>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Worker</th>
              <th>Fecha</th>
              <th>Clientes</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rutas.map(r => (
              <tr key={r.id}>
                <td>{r.nombre}</td>
                <td>{r.worker_nombre}</td>
                <td>{new Date(r.fecha_asignacion).toLocaleDateString()}</td>
                <td>{r.total_clientes}</td>
                <td>
                  <span className={`badge ${r.estado === 'COMPLETADA' ? 'badge-success' : 'badge-primary'}`}>
                    {r.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PLANIFICADOR DE RUTA (REDISEÑO DE ESTRUCTURA) */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ 
            maxWidth: '1440px', 
            width: '98%', 
            height: '94vh', 
            display: 'grid', 
            gridTemplateRows: 'auto 1fr',
            backgroundColor: '#0f172a', 
            border: '1px solid #334155',
            overflow: 'hidden'
          }}>
            {/* HEADER FIJO */}
            <div className="modal-header" style={{ borderBottom: '1px solid #1e293b', padding: '15px 25px' }}>
              <span className="modal-title" style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: '800' }}>CENTRO DE PLANIFICACIÓN DE RUTAS</span>
              <button className="btn-ghost" style={{ color: '#94a3b8' }} onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            {/* BODY USANDO GRID PARA EVITAR DESBORDAMIENTOS */}
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: '100%', padding: 0, overflow: 'hidden' }}>
              
              {/* LADO IZQUIERDO: CONTROLES */}
              <div style={{ 
                backgroundColor: '#1e293b', 
                borderRight: '1px solid #334155', 
                padding: '25px', 
                display: 'flex', 
                flexDirection: 'column',
                gap: '20px',
                height: '100%',
                overflowY: 'auto'
              }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem', letterSpacing: '1px' }}>NOMBRE DE LA RUTA</label>
                  <input 
                    className="form-input" 
                    style={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', height: '45px' }} 
                    placeholder="Ej: Ruta Sur - Lunes" 
                    value={newRuta.nombre} 
                    onChange={e => setNewRuta({...newRuta, nombre: e.target.value})} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem', letterSpacing: '1px' }}>WORKER ASIGNADO</label>
                  <select 
                    className="form-input" 
                    style={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', height: '45px' }} 
                    value={newRuta.worker_id} 
                    onChange={e => setNewRuta({...newRuta, worker_id: e.target.value})}
                  >
                    <option value="">-- Seleccionar Worker --</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.nombres} {w.apellidos}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem', letterSpacing: '1px' }}>FECHA DE VISITA</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    style={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', height: '45px' }} 
                    value={newRuta.fecha_asignacion} 
                    onChange={e => setNewRuta({...newRuta, fecha_asignacion: e.target.value})} 
                  />
                </div>

                <div style={{ marginTop: '10px', padding: '15px', backgroundColor: '#334155', borderRadius: '12px', border: '1px solid #475569' }}>
                   <label className="form-label" style={{ color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 'bold' }}>FILTRAR POR FECHA DE PAGO (CLIENTE)</label>
                   <input 
                     type="date" 
                     className="form-input" 
                     style={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff', marginTop: '10px' }} 
                     value={filterPago} 
                     onChange={e => setFilterPago(e.target.value)} 
                   />
                </div>

                <div style={{ flex: 1 }} />

                <div style={{ padding: '15px', backgroundColor: '#0f172a', borderRadius: '12px', border: '1px dashed #334155' }}>
                   <div className="flex justify-between items-center">
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Seleccionados:</span>
                      <span style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '1.2rem' }}>{newRuta.cliente_ids.length}</span>
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                   <button 
                     className="btn btn-primary" 
                     style={{ height: '50px', fontSize: '0.9rem', fontWeight: 'bold' }}
                     onClick={handleCreateRuta}
                     disabled={creating}
                   >
                     {creating ? 'PROCESANDO...' : 'CONFIRMAR Y CREAR RUTA'}
                   </button>
                   <button className="btn btn-ghost" style={{ color: '#94a3b8' }} onClick={() => setShowModal(false)}>CANCELAR</button>
                </div>
              </div>

              {/* LADO DERECHO: MAPA (OCUPANDO TODO EL ESPACIO RESTANTE) */}
              <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
                <MapContainer 
                  key={showModal ? 'map-active' : 'map-inactive'}
                  center={[-12.0464, -77.0428]} 
                  zoom={12} 
                  style={{ height: '100%', width: '100%' }}
                >
                   <TileLayer 
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                    attribution='&copy; OpenStreetMap'
                  />

                  {/* RECENTRAR MAPA INCLUYENDO AL WORKER SI EXISTE */}
                  <RecenterMap 
                    coords={[
                      ...clientesVisibles.map(c => [parseFloat(c.latitud), parseFloat(c.longitud)]),
                      ...(workers.find(w => w.id === newRuta.worker_id)?.latitud 
                        ? [[parseFloat(workers.find(w => w.id === newRuta.worker_id).latitud), parseFloat(workers.find(w => w.id === newRuta.worker_id).longitud)]] 
                        : [])
                    ]} 
                  />

                  {/* PIN DEL WORKER SELECCIONADO */}
                  {(() => {
                    const selectedWorker = workers.find(w => w.id === newRuta.worker_id);
                    if (!selectedWorker || !selectedWorker.latitud || !selectedWorker.longitud) return null;
                    
                    const workerIcon = L.divIcon({
                      className: 'worker-pin',
                      html: `
                        <div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); position: relative;">
                           <svg viewBox="0 0 24 24" width="48" height="48" fill="#10b981" stroke="white" stroke-width="1.5">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                           </svg>
                           <div style="background: #10b981; color: white; padding: 2px 6px; border-radius: 8px; font-size: 9px; font-weight: 800; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); border: 1.5px solid white; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                             ${selectedWorker.nombres.split(' ')[0].toUpperCase()}
                           </div>
                        </div>
                      `,
                      iconSize: [48, 48],
                      iconAnchor: [24, 48],
                      popupAnchor: [0, -45]
                    });

                    return (
                      <Marker 
                        key={`worker-${selectedWorker.id}`}
                        position={[parseFloat(selectedWorker.latitud), parseFloat(selectedWorker.longitud)]} 
                        icon={workerIcon}
                      >
                        <Popup>
                          <div style={{ textAlign: 'center', padding: '5px' }}>
                            <strong style={{ display: 'block', fontSize: '14px', color: '#1e293b' }}>{selectedWorker.nombres} {selectedWorker.apellidos}</strong>
                            <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '11px' }}>Worker Seleccionado</span>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })()}
                  {clientesVisibles.map(c => {
                    const isSelected = newRuta.cliente_ids.includes(c.id);
                    const isOccupied = c.estado !== 'LIBRE';
                    
                    const pinIcon = L.divIcon({
                      className: 'custom-pin',
                      html: `
                        <div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); opacity: ${isOccupied && !isSelected ? '0.6' : '1'}">
                           <svg viewBox="0 0 24 24" width="42" height="42" fill="${isSelected ? '#3b82f6' : (isOccupied ? '#94a3b8' : '#64748b')}" stroke="white" stroke-width="1.2">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                           </svg>
                        </div>
                      `,
                      iconSize: [42, 42],
                      iconAnchor: [21, 42],
                      popupAnchor: [0, -40]
                    });

                    return (
                      <Marker 
                        key={c.id} 
                        position={[parseFloat(c.latitud), parseFloat(c.longitud)]} 
                        icon={pinIcon}
                        eventHandlers={{
                          click: () => !isOccupied && toggleCliente(c.id)
                        }}
                      >
                        <Popup>
                           <div style={{ minWidth: '180px', padding: '10px' }}>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{c.nombres}</h4>
                              <p style={{ margin: '4px 0', fontSize: '12px' }}>Deuda: <b>S/ {c.deuda_total}</b></p>
                              <p style={{ margin: '4px 0', fontSize: '12px' }}>Estado: <b style={{ color: isOccupied ? '#ef4444' : '#10b981' }}>{c.estado}</b></p>
                              {!isOccupied ? (
                                <button 
                                  className={`btn btn-sm ${isSelected ? 'btn-danger' : 'btn-primary'}`} 
                                  style={{ width: '100%', padding: '8px' }}
                                  onClick={(e) => { e.stopPropagation(); toggleCliente(c.id); }}
                                >
                                  {isSelected ? 'QUITAR' : 'ASIGNAR'}
                                </button>
                              ) : (
                                <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', marginTop: '10px' }}>Cliente ya tiene gestión o ruta activa.</div>
                              )}
                           </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>

                {/* LEYENDA FLOTANTE */}
                <div style={{ 
                  position: 'absolute', top: '20px', right: '20px', zIndex: 1000, 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '12px', borderRadius: '10px', border: '1px solid #334155'
                }}>
                   <div className="flex items-center gap-3 mb-2">
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }}></div>
                      <span style={{ color: '#f8fafc', fontSize: '0.7rem' }}>SELECCIONADO</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b' }}></div>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>DISPONIBLE</span>
                   </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
