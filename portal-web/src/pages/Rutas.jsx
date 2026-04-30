import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Eye, Trash2, Plus, X, Map as MapIcon, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import pinmanIcon from '../assets/PINMAN.png';

const workerIcon = L.icon({
  iconUrl: pinmanIcon,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

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
  
  const [newRuta, setNewRuta] = useState({ 
    nombre: '', 
    worker_id: '', 
    cliente_ids: [],
    fecha_asignacion: new Date().toISOString().split('T')[0]
  });

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRutaDetails, setSelectedRutaDetails] = useState(null);
  const [heatZoneActive, setHeatZoneActive] = useState(false);
  const [showAllWorkers, setShowAllWorkers] = useState(false);

  const [creating, setCreating] = useState(false);
  const [filterPago, setFilterPago] = useState(new Date().toISOString().split('T')[0]);

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

  const handleDeleteRuta = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta ruta?')) return;
    try {
      await api.delete(`/api/rutas/${id}`);
      fetchData();
    } catch (err) {
      alert('Error al eliminar ruta');
    }
  };

  const handleViewRuta = async (id) => {
    try {
      const res = await api.get(`/api/rutas/${id}`);
      setSelectedRutaDetails(res.data.data);
      setShowViewModal(true);
    } catch (err) {
      alert('Error al obtener detalles de la ruta');
    }
  };
  const handleCreateRuta = async () => {
    if (!newRuta.nombre || !newRuta.worker_id || newRuta.cliente_ids.length === 0) {
      return alert('Completa todos los campos y selecciona al menos un cliente.');
    }
    setCreating(true);
    try {
      await api.post('/api/rutas', newRuta);
      setShowModal(false);
      setNewRuta({ nombre: '', worker_id: '', cliente_ids: [], fecha_asignacion: new Date().toISOString().split('T')[0] });
      fetchData();
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

  // Clientes ya asignados para la fecha seleccionada
  const assignedClientIds = React.useMemo(() => {
    const ids = new Set();
    rutas.forEach(r => {
      const rDate = new Date(r.fecha_asignacion).toISOString().slice(0, 10);
      const fDate = new Date(newRuta.fecha_asignacion).toISOString().slice(0, 10);
      if (rDate === fDate && r.client_ids) {
        r.client_ids.forEach(id => ids.add(id));
      }
    });
    return ids;
  }, [rutas, newRuta.fecha_asignacion]);

  // Filtramos por fecha de pago normalizando ambos valores a YYYY-MM-DD
  const clientesVisibles = clientes.filter(c => {
    if (!filterPago) return true;  // Sin filtro → mostrar TODOS
    if (!c.fecha_pago) return false;
    
    // Si ya está asignado a otra ruta HOY, no mostrar en el planificador (si estamos creando ruta)
    if (showModal && assignedClientIds.has(c.id)) return false;

    // Convertir a string y tomar solo YYYY-MM-DD
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
                <td className="flex gap-4">
                  <button className="btn-icon color-info" onClick={() => handleViewRuta(r.id)} title="Ver detalles"><Eye size={18}/></button>
                  <button className="btn-icon color-danger" onClick={() => handleDeleteRuta(r.id)} title="Borrar ruta"><Trash2 size={18}/></button>
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
            backgroundColor: 'var(--c-surface)', 
            border: '1px solid var(--c-border)',
            overflow: 'hidden'
          }}>
            {/* HEADER FIJO */}
            <div className="modal-header" style={{ borderBottom: '1px solid #1e293b', padding: '15px 25px' }}>
              <span className="modal-title" style={{ color: 'var(--c-text)', fontSize: '1.2rem', fontWeight: '800' }}>CENTRO DE PLANIFICACIÓN DE RUTAS</span>
              <button className="btn-ghost" style={{ color: 'var(--c-muted)' }} onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            {/* BODY USANDO GRID PARA EVITAR DESBORDAMIENTOS */}
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: '100%', padding: 0, overflow: 'hidden' }}>
              
              {/* LADO IZQUIERDO: CONTROLES */}
              <div style={{ 
                backgroundColor: 'var(--c-surface)', 
                borderRight: '1px solid var(--c-border)', 
                padding: '25px', 
                display: 'flex', 
                flexDirection: 'column',
                gap: '20px',
                height: '100%',
                overflowY: 'auto'
              }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--c-muted)', fontSize: '0.75rem', letterSpacing: '1px' }}>NOMBRE DE LA RUTA</label>
                  <input 
                    className="form-input" 
                    style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-on-primary)', height: '45px' }} 
                    placeholder="Ej: Ruta Sur - Lunes" 
                    value={newRuta.nombre} 
                    onChange={e => setNewRuta({...newRuta, nombre: e.target.value})} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--c-muted)', fontSize: '0.75rem', letterSpacing: '1px' }}>WORKER ASIGNADO</label>
                  <select 
                    className="form-input" 
                    style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-on-primary)', height: '45px' }} 
                    value={newRuta.worker_id} 
                    onChange={e => setNewRuta({...newRuta, worker_id: e.target.value})}
                  >
                    <option value="">-- Seleccionar Worker --</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.nombres} {w.apellidos}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--c-muted)', fontSize: '0.75rem', letterSpacing: '1px' }}>FECHA DE VISITA</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-on-primary)', height: '45px' }} 
                    value={newRuta.fecha_asignacion} 
                    onChange={e => setNewRuta({...newRuta, fecha_asignacion: e.target.value})} 
                  />
                </div>

                 <div style={{ marginTop: '10px', padding: '15px', backgroundColor: 'var(--c-surface-2)', borderRadius: '12px', border: '1px solid var(--c-border)' }}>
                   <label className="form-label" style={{ color: 'var(--c-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>FILTRAR POR FECHA DE PAGO (CLIENTE)</label>
                   <input 
                     type="date" 
                     className="form-input" 
                     style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-on-primary)', marginTop: '10px' }} 
                     value={filterPago} 
                     onChange={e => setFilterPago(e.target.value)} 
                   />

                   <div className="flex items-center gap-2 mt-4">
                     <input 
                       type="checkbox" 
                       id="heat-zone"
                       checked={heatZoneActive} 
                       onChange={e => setHeatZoneActive(e.target.checked)} 
                     />
                     <label htmlFor="heat-zone" style={{ color: 'var(--c-on-primary)', fontSize: '0.8rem' }}>Activar zona de calor</label>
                     <button 
                       className="btn-ghost" 
                       style={{ padding: 0, color: 'var(--c-info)' }}
                       onClick={() => alert("ZONA DE CALOR:\n- Amarillo: 1-7 días de atraso\n- Anaranjado: 8-12 días de atraso\n- Rojo: 13+ días de atraso\n- Verde: Sin atraso")}
                     >
                       <span style={{ fontSize: '1.2rem' }}>ⓘ</span>
                     </button>
                   </div>

                   <div className="flex items-center gap-2 mt-2">
                     <input 
                       type="checkbox" 
                       id="show-workers"
                       checked={showAllWorkers} 
                       onChange={e => setShowAllWorkers(e.target.checked)} 
                     />
                     <label htmlFor="show-workers" style={{ color: 'var(--c-on-primary)', fontSize: '0.8rem' }}>Ver todos los workers</label>
                   </div>
                </div>

                <div style={{ flex: 1 }} />

                 <div style={{ padding: '15px', backgroundColor: 'var(--c-surface-2)', borderRadius: '12px', border: '1px dashed var(--c-border)' }}>
                   <div className="flex justify-between items-center">
                     <span style={{ color: 'var(--c-muted)', fontSize: '0.8rem' }}>Seleccionados:</span>
                     <span style={{ color: 'var(--c-info)', fontWeight: 'bold', fontSize: '1.2rem' }}>{newRuta.cliente_ids.length}</span>
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

                  {/* TODOS LOS WORKERS O SOLO EL SELECCIONADO */}
                  {workers.map(w => {
                    const isSelected = w.id === newRuta.worker_id;
                    if (!showAllWorkers && !isSelected) return null;
                    if (!w.latitud || !w.longitud) return null;

                    const workerIcon = L.divIcon({
                      className: 'worker-pin',
                      html: `
                        <div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); position: relative;">
                           <img src="${pinmanIcon}" style="width: 48px; height: 48px;" />
                           <div style="background: ${isSelected ? 'var(--c-success)' : 'var(--c-muted)'}; color: var(--c-on-primary); padding: 2px 6px; border-radius: 8px; font-size: 9px; font-weight: 800; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); border: 1.5px solid var(--c-on-primary); white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                             ${w.nombres.split(' ')[0].toUpperCase()}
                           </div>
                        </div>
                      `,
                      iconSize: [48, 48],
                      iconAnchor: [24, 48],
                      popupAnchor: [0, -45]
                    });

                    return (
                      <Marker 
                        key={`worker-${w.id}`}
                        position={[parseFloat(w.latitud), parseFloat(w.longitud)]} 
                        icon={workerIcon}
                        eventHandlers={{
                          click: () => setNewRuta(prev => ({ ...prev, worker_id: w.id }))
                        }}
                      >
                        <Popup>
                          <div style={{ textAlign: 'center', padding: '5px' }}>
                            <strong style={{ display: 'block', fontSize: '14px', color: 'var(--c-text)' }}>{w.nombres} {w.apellidos}</strong>
                            <span style={{ color: isSelected ? 'var(--c-success)' : 'var(--c-muted)', fontWeight: 'bold', fontSize: '11px' }}>
                              {isSelected ? 'Worker Seleccionado' : 'Hacer clic para asignar'}
                            </span>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                  {clientesVisibles.map(c => {
                    const isSelected = newRuta.cliente_ids.includes(c.id);
                    const isOccupied = c.estado !== 'LIBRE';
                    
                    let fillColor = isSelected ? 'var(--c-info)' : (isOccupied ? 'var(--c-muted-2)' : 'var(--c-muted)');
                    
                    if (heatZoneActive && !isSelected) {
                      const dias = c.dias_atraso || 0;
                      if (dias >= 13) fillColor = '#ef4444'; // Rojo
                      else if (dias >= 8) fillColor = '#f59e0b'; // Naranja
                      else if (dias >= 1) fillColor = '#eab308'; // Amarillo
                      else fillColor = '#10b981'; // Verde
                    }

                    const opacity = (isOccupied && !isSelected) ? '0.6' : '1';

                    const pinIcon = L.divIcon({
                      className: 'custom-pin',
                      html: `
                        <div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); opacity: ${opacity}">
                          <svg viewBox="0 0 24 24" width="42" height="42" fill="${fillColor}" stroke="var(--c-on-primary)" stroke-width="1.2">
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
                               <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{c.nombres} {c.apellidos}</h4>
                               <p style={{ margin: '4px 0', fontSize: '12px' }}>Deuda: <b>S/ {c.deuda_total}</b></p>
                               <p style={{ margin: '4px 0', fontSize: '12px' }}>Atraso: <b>{c.dias_atraso || 0} días</b></p>
                               <p style={{ margin: '4px 0', fontSize: '12px' }}>Estado: <b style={{ color: isOccupied ? 'var(--c-danger)' : 'var(--c-success)' }}>{c.estado}</b></p>
                              {!isOccupied ? (
                                <button 
                                  className={`btn btn-sm ${isSelected ? 'btn-danger' : 'btn-primary'}`} 
                                  style={{ width: '100%', padding: '8px' }}
                                  onClick={(e) => { e.stopPropagation(); toggleCliente(c.id); }}
                                >
                                  {isSelected ? 'QUITAR' : 'ASIGNAR'}
                                </button>
                              ) : (
                                <div style={{ fontSize: '10px', color: 'var(--c-muted)', textAlign: 'center', marginTop: '10px' }}>Cliente ya tiene gestión o ruta activa.</div>
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
                  backgroundColor: 'var(--c-surface-2)', padding: '12px', borderRadius: '10px', border: '1px solid var(--c-border)'
                 }}>
                   <div className="flex items-center gap-3 mb-2">
                     <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--c-info)' }}></div>
                     <span style={{ color: 'var(--c-on-primary)', fontSize: '0.7rem' }}>SELECCIONADO</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--c-muted)' }}></div>
                     <span style={{ color: 'var(--c-muted-2)', fontSize: '0.7rem' }}>DISPONIBLE</span>
                   </div>
                 </div>
              </div>

            </div>
          </div>
        </div>
       )}
      {/* MODAL VER RUTA */}
      {showViewModal && selectedRutaDetails && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '800px', width: '95%', height: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <span className="modal-title">GESTIÓN DE RUTA: {selectedRutaDetails.nombre}</span>
              <button className="btn-ghost" onClick={() => setShowViewModal(false)}><X size={20}/></button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', p: 0 }}>
              <div className="flex" style={{ flex: 1 }}>
                {/* LISTA DE CLIENTES ACTUALES */}
                <div style={{ flex: 1, borderRight: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column' }}>
                   <div className="p-4 bg-muted-surface flex justify-between items-center">
                      <div>
                        <h4 className="font-bold flex items-center gap-2"><Users size={16}/> Clientes en Ruta</h4>
                        <p className="text-xs text-muted">{selectedRutaDetails.worker_nombre} {selectedRutaDetails.worker_apellido}</p>
                      </div>
                   </div>
                   <div style={{ flex: 1, overflowY: 'auto' }} className="p-2">
                      {selectedRutaDetails.clientes.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-3 mb-2 bg-surface border rounded-xl hover:shadow-sm transition-all">
                          <div>
                            <div className="font-bold text-sm">{c.nombres} {c.apellidos}</div>
                            <div className="text-xs text-muted">{c.direccion}</div>
                          </div>
                          <div className="flex items-center gap-3">
                             <span className={`badge badge-sm ${c.estado === 'LIBRE' ? 'badge-success' : 'badge-info'}`}>{c.estado}</span>
                             <button 
                                className="btn-icon color-danger btn-sm" 
                                onClick={async () => {
                                  const newIds = selectedRutaDetails.clientes.filter(x => x.id !== c.id).map(x => x.id);
                                  try {
                                    await api.patch(`/api/rutas/${selectedRutaDetails.id}`, { cliente_ids: newIds });
                                    handleViewRuta(selectedRutaDetails.id);
                                    fetchData();
                                  } catch (e) { alert('Error al quitar cliente'); }
                                }}
                             >
                               <Trash2 size={14}/>
                             </button>
                          </div>
                        </div>
                      ))}
                   </div>
                </div>

                {/* AGREGAR CLIENTES (HOY + NO ASIGNADOS) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                   <div className="p-4 border-b bg-white">
                      <h4 className="font-bold flex items-center gap-2"><Plus size={16}/> Agregar a Ruta</h4>
                      <p className="text-xs text-muted">Clientes con pago hoy no asignados</p>
                   </div>
                   <div style={{ flex: 1, overflowY: 'auto' }} className="p-2">
                      {clientes
                        .filter(c => {
                          const isToday = new Date(c.fecha_pago).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
                          const isAlreadyInThisRuta = selectedRutaDetails.clientes.some(x => x.id === c.id);
                          const isAssignedElsewhere = assignedClientIds.has(c.id);
                          const isManaged = c.estado !== 'LIBRE' && c.estado !== 'EN_RUTA';
                          return isToday && !isAlreadyInThisRuta && !isAssignedElsewhere && !isManaged;
                        })
                        .map(c => (
                          <div key={c.id} className="flex justify-between items-center p-3 mb-2 bg-white border rounded-xl shadow-sm">
                            <div style={{ flex: 1 }}>
                              <div className="font-bold text-sm">{c.nombres} {c.apellidos}</div>
                              <div className="text-xs text-muted">{c.distrito}</div>
                            </div>
                            <button 
                              className="btn btn-sm btn-primary"
                              onClick={async () => {
                                const newIds = [...selectedRutaDetails.clientes.map(x => x.id), c.id];
                                try {
                                  await api.patch(`/api/rutas/${selectedRutaDetails.id}`, { cliente_ids: newIds });
                                  handleViewRuta(selectedRutaDetails.id);
                                  fetchData();
                                } catch (e) { alert('Error al agregar cliente'); }
                              }}
                            >
                              AGREGAR
                            </button>
                          </div>
                        ))
                      }
                      {clientes.filter(c => {
                          const isToday = new Date(c.fecha_pago).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
                          const isAlreadyInThisRuta = selectedRutaDetails.clientes.some(x => x.id === c.id);
                          const isAssignedElsewhere = assignedClientIds.has(c.id);
                          return isToday && !isAlreadyInThisRuta && !isAssignedElsewhere;
                      }).length === 0 && (
                        <div className="p-8 text-center text-muted text-sm">No hay más clientes disponibles para hoy.</div>
                      )}
                   </div>
                </div>
              </div>
            </div>
            <div className="modal-footer bg-white border-t p-4 flex justify-end gap-3">
               <button 
                 className="btn btn-info flex items-center gap-2"
                 onClick={() => {
                   // Lógica para abrir mapa con ruta (Podría ser otro modal o expandir este)
                   alert('Visualización de mapa en construcción para esta sección.');
                 }}
               >
                 <MapIcon size={16}/> VER EN MAPA
               </button>
               <button className="btn btn-ghost" onClick={() => setShowViewModal(false)}>CERRAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
