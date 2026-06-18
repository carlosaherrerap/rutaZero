import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Eye, Trash2, Plus, X, Map as MapIcon, Users, Calendar, Info, Sparkles } from 'lucide-react';
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
  const { api, sedeActual } = useContext(AuthContext);
  const [rutas, setRutas] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState(null);
  
  const [newRuta, setNewRuta] = useState({ 
    nombre: '', 
    worker_id: '', 
    cliente_ids: [],
    fecha_asignacion: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  });

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRutaDetails, setSelectedRutaDetails] = useState(null);
  const [heatZoneActive, setHeatZoneActive] = useState(false);
  const [showAllWorkers, setShowAllWorkers] = useState(false);

  const [creating, setCreating] = useState(false);
  const [filterPago, setFilterPago] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
  const [searchAvail, setSearchAvail] = useState('');
  const [selectedRouteIdToView, setSelectedRouteIdToView] = useState('');

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

  const handleEditRuta = async (id) => {
    try {
      const res = await api.get(`/api/rutas/${id}`);
      const r = res.data.data;
      setEditingRouteId(id);
      setNewRuta({
        nombre: r.nombre,
        worker_id: r.worker_id,
        cliente_ids: r.clientes.map(c => c.id),
        fecha_asignacion: new Date(r.fecha_asignacion).toISOString().split('T')[0]
      });
      setEditMode(true);
      setShowModal(true);
    } catch (err) {
      alert('Error al obtener detalles de la ruta');
    }
  };

  const handleSaveRuta = async () => {
    if (!newRuta.nombre || !newRuta.worker_id || newRuta.cliente_ids.length === 0) {
      return alert('Completa todos los campos y selecciona al menos un cliente.');
    }
    setCreating(true);
    try {
      if (editMode) {
        await api.patch(`/api/rutas/${editingRouteId}`, newRuta);
      } else {
        await api.post('/api/rutas', newRuta);
      }
      setShowModal(false);
      resetPlanner();
      fetchData();
    } catch (err) {
      alert(editMode ? 'Error al actualizar ruta' : 'Error al crear ruta');
    } finally {
      setCreating(false);
    }
  };

  const resetPlanner = () => {
    setNewRuta({ 
      nombre: '', 
      worker_id: '', 
      cliente_ids: [], 
      fecha_asignacion: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }) 
    });
    setEditMode(false);
    setEditingRouteId(null);
  };

  const toggleCliente = (id) => {
    setNewRuta(prev => {
      const ids = prev.cliente_ids.includes(id) 
        ? prev.cliente_ids.filter(cid => cid !== id)
        : [...prev.cliente_ids, id];
      return { ...prev, cliente_ids: ids };
    });
  };

  // Clientes ya asignados para la fecha de la ruta activa (creación o vista)
  const assignedClientIds = React.useMemo(() => {
    const ids = new Set();
    const refDate = showViewModal && selectedRutaDetails
      ? new Date(selectedRutaDetails.fecha_asignacion).toISOString().slice(0, 10)
      : new Date(newRuta.fecha_asignacion).toISOString().slice(0, 10);
    
    rutas.forEach(r => {
      // Excluir la propia ruta si estamos editándola o viéndola
      if (editMode && r.id === editingRouteId) return;
      if (showViewModal && selectedRutaDetails && r.id === selectedRutaDetails.id) return;

      const rDate = new Date(r.fecha_asignacion).toISOString().slice(0, 10);
      if (rDate === refDate) {
        // En el backend las rutas traen 'clientes' como array de objetos
        if (r.clientes) {
          r.clientes.forEach(c => ids.add(c.id));
        }
      }
    });
    return ids;
  }, [rutas, newRuta.fecha_asignacion, showViewModal, selectedRutaDetails, editMode, editingRouteId]);

  // Filtramos por fecha de pago normalizando ambos valores a YYYY-MM-DD
  const clientesVisibles = clientes.filter(c => {
    // SIEMPRE mostrar los clientes que ya están seleccionados para esta ruta
    if (newRuta.cliente_ids.includes(c.id)) return true;

    if (!filterPago) return true;
    if (!c.fecha_pago) return false;
    
    // Si ya está asignado a OTRA ruta hoy, ocultar del planificador
    if (showModal && assignedClientIds.has(c.id)) return false;

    // Convertir a string y tomar solo YYYY-MM-DD
    const fechaCliente = new Date(c.fecha_pago).toISOString().slice(0, 10);
    const fechaFiltro = new Date(filterPago).toISOString().slice(0, 10);
    return fechaCliente === fechaFiltro;
  });

  // Centro dinámico basado en la sede actual
  const mapCenter = sedeActual?.nombre?.toLowerCase().includes('arequipa') 
    ? [-16.4090, -71.5374] 
    : [-12.0464, -77.0428];

  if (loading) return <div className="p-8">Cargando datos del planificador...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Rutas - {sedeActual?.nombre || 'General'}</h1>
          <p className="text-muted">Planifica y asigna rutas a tus workers en esta sede.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditMode(false); setShowModal(true); }}>+ CREAR RUTA</button>
      </div>

      {/* NUEVA VISTA PRINCIPAL DE RUTAS */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: '900', margin: '0 0 16px 0', textTransform: 'uppercase', color: 'var(--c-muted)' }}>RUTAS ACTIVAS ({rutas.length})</h3>
            <select 
              className="form-input" 
              style={{ width: '350px', fontSize: '14px', fontWeight: '600' }}
              value={selectedRouteIdToView} 
              onChange={e => setSelectedRouteIdToView(e.target.value)}
            >
              <option value="">-- Selecciona una ruta para ver detalles --</option>
              {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre} (Worker: {r.worker_nombre})</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '24px', background: 'var(--c-surface-2)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--c-border)' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-success)' }}></div> GESTIONADOS</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-warn)' }}></div> REPROGRAMADOS</span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-accent)' }}></div> EN VISITA</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-info)' }}></div> LIBRES</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-danger)' }}></div> NO ENCONTRADO</span>
            </div>
          </div>
        </div>

        {selectedRouteIdToView && (() => {
          const rSelected = rutas.find(r => r.id === selectedRouteIdToView);
          if (!rSelected) return null;
          return (
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px dashed var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>RESUMEN DE RUTA</div>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--c-text)' }}>TOTAL: {rSelected.total_clientes} CLIENTES</div>
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '800', color: 'var(--c-success)' }} title="Gestionados">
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--c-success)' }}></div>
                    {rSelected.cant_gest || 0}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '800', color: 'var(--c-warn)' }} title="Reprogramados">
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--c-warn)' }}></div>
                    {rSelected.cant_repro || 0}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '800', color: 'var(--c-accent)' }} title="En Visita">
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--c-accent)' }}></div>
                    {rSelected.cant_visita || 0}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '800', color: 'var(--c-info)' }} title="Libres">
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--c-info)' }}></div>
                    {rSelected.cant_libres || 0}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '800', color: 'var(--c-danger)' }} title="No Encontrado">
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--c-danger)' }}></div>
                    {rSelected.cant_no_enc || 0}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className={`badge badge-${rSelected.completada ? 'success' : 'info'}`} style={{ padding: '6px 12px', fontSize: '11px', fontWeight: '800' }}>
                  {rSelected.completada ? 'COMPLETADA' : 'EN PROCESO'}
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => handleEditRuta(rSelected.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 16px' }}>
                  <Eye size={16}/> EDITAR
                </button>
                <button className="btn btn-sm" onClick={() => {
                  if (window.confirm('¿Estás seguro de eliminar esta ruta?')) {
                    handleDeleteRuta(rSelected.id);
                    setSelectedRouteIdToView('');
                  }
                }} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '8px 16px', background: 'var(--c-danger)', color: '#fff', border: 'none' }}>
                  <Trash2 size={16}/> ELIMINAR
                </button>
              </div>
            </div>
          );
        })()}
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
            <div className="modal-header" style={{ borderBottom: '1px solid var(--c-border)', padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="modal-title" style={{ color: 'var(--c-text)', fontSize: '1.4rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {editMode ? 'Editando Ruta' : 'Planificación de Rutas'}
                </span>
                <span style={{ color: 'var(--c-primary)', fontSize: '0.8rem', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>
                  {sedeActual?.nombre || 'Sede No Definida'}
                </span>
              </div>
              <button className="btn-ghost" style={{ color: 'var(--c-muted)', padding: '8px', borderRadius: '50%' }} onClick={() => { setShowModal(false); resetPlanner(); }}><X size={24}/></button>
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
                    style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)', height: '45px' }} 
                    placeholder="Ej: Ruta Sur - Lunes" 
                    value={newRuta.nombre} 
                    onChange={e => setNewRuta({...newRuta, nombre: e.target.value})} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--c-muted)', fontSize: '0.75rem', letterSpacing: '1px' }}>WORKER ASIGNADO</label>
                  <select 
                    className="form-input" 
                    style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)', height: '45px' }} 
                    value={newRuta.worker_id} 
                    onChange={e => setNewRuta({...newRuta, worker_id: e.target.value})}
                  >
                    <option value="">-- Seleccionar Worker --</option>
                    {workers.map(w => <option key={w.id} value={w.id} style={{ color: 'var(--c-text)', backgroundColor: 'var(--c-surface)' }}>{w.nombres} {w.apellidos}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--c-muted)', fontSize: '0.75rem', letterSpacing: '1px' }}>FECHA DE VISITA</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)', height: '45px' }} 
                    value={newRuta.fecha_asignacion} 
                    onChange={e => setNewRuta({...newRuta, fecha_asignacion: e.target.value})} 
                  />
                </div>

                 <div style={{ marginTop: '10px', padding: '15px', backgroundColor: 'var(--c-surface-2)', borderRadius: '12px', border: '1px solid var(--c-border)' }}>
                   <label className="form-label" style={{ color: 'var(--c-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>FILTRAR POR FECHA DE PAGO (CLIENTE)</label>
                   <input 
                     type="date" 
                     className="form-input" 
                     style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)', marginTop: '10px' }} 
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
                     <label htmlFor="heat-zone" style={{ color: 'var(--c-text)', fontSize: '0.8rem' }}>Activar zona de calor</label>
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
                     <label htmlFor="show-workers" style={{ color: 'var(--c-text)', fontSize: '0.8rem' }}>Ver todos los workers</label>
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
                     onClick={handleSaveRuta}
                     disabled={creating}
                   >
                     {creating ? 'PROCESANDO...' : (editMode ? 'ACTUALIZAR CAMBIOS' : 'CONFIRMAR Y CREAR RUTA')}
                   </button>
                   {editMode && (
                     <button 
                       className="btn btn-ghost" 
                       style={{ color: 'var(--c-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }} 
                       onClick={() => { handleDeleteRuta(editingRouteId); setShowModal(false); resetPlanner(); }}
                     >
                       ELIMINAR RUTA
                     </button>
                   )}
                   <button className="btn btn-ghost" style={{ color: '#94a3b8' }} onClick={() => { setShowModal(false); resetPlanner(); }}>CANCELAR</button>
                </div>
              </div>

              {/* LADO DERECHO: MAPA (OCUPANDO TODO EL ESPACIO RESTANTE) */}
              <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
                <MapContainer 
                  key={showModal ? `map-${sedeActual?.id}` : 'map-inactive'}
                  center={mapCenter} 
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
                          <div style={{ minWidth: '180px', padding: '10px 5px', color: 'var(--c-text)' }}>
                               <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)', paddingBottom: '5px' }}>{c.nombres} {c.apellidos}</h4>
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
                     <span style={{ color: 'var(--c-text)', fontSize: '0.7rem' }}>SELECCIONADO</span>
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
          <div className="modal" style={{ maxWidth: '900px', width: '95%', height: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
            <div className="modal-header" style={{ padding: '25px 30px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                  <div style={{ width: '40px', height: '40px', background: 'var(--c-primary-soft)', color: 'var(--c-primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '18px' }}>
                    {selectedRutaDetails.worker_nombre?.[0]}{selectedRutaDetails.worker_apellido?.[0]}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0, color: 'var(--c-text)', letterSpacing: '-0.5px' }}>
                      {selectedRutaDetails.worker_nombre} {selectedRutaDetails.worker_apellido}
                    </h2>
                    <div style={{ fontSize: '11px', color: 'var(--c-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Responsable de la ruta: {selectedRutaDetails.nombre}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                   <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14}/> {new Date(selectedRutaDetails.fecha_asignacion).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                   <span style={{ opacity: 0.3 }}>|</span>
                   <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={14}/> {selectedRutaDetails.clientes?.length || 0} clientes asignados</span>
                </div>
              </div>
              <button className="btn-ghost" onClick={() => setShowViewModal(false)} style={{ borderRadius: '12px', padding: '8px' }}><X size={24}/></button>
            </div>
            
            <div className="modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', padding: 0 }}>
              {/* LISTA IZQUIERDA: ACTUALES */}
              <div style={{ flex: 1.2, borderRight: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', background: 'var(--c-surface)' }}>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--c-border)', backgroundColor: 'var(--c-surface-2)' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--c-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={14}/> CLIENTES ASIGNADOS ({selectedRutaDetails.clientes?.length || 0})
                  </h4>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                  {selectedRutaDetails.clientes?.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--c-muted)' }}>
                      <Users size={40} style={{ opacity: 0.1, marginBottom: '10px' }}/>
                      <p style={{ fontSize: '13px' }}>No hay clientes asignados a esta ruta.</p>
                    </div>
                  ) : (
                    selectedRutaDetails.clientes.map(c => (
                      <div key={`assigned-${c.id}`} style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                        padding: '12px 16px', marginBottom: '10px', backgroundColor: 'var(--c-surface-2)', 
                        border: '1px solid var(--c-border)', borderRadius: '14px',
                        transition: 'all 0.2s'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--c-text)' }}>{c.nombres} {c.apellidos}</div>
                          <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: '2px' }}>{c.direccion}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ 
                            fontSize: '10px', fontWeight: '900', padding: '4px 8px', borderRadius: '6px',
                            backgroundColor: c.estado === 'LIBRE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            color: c.estado === 'LIBRE' ? 'var(--c-success)' : 'var(--c-info)'
                          }}>
                            {c.estado}
                          </span>
                          <button 
                            className="btn-icon color-danger btn-sm" 
                            style={{ padding: '8px' }}
                            onClick={async () => {
                              if (!window.confirm('¿Quitar a este cliente de la ruta?')) return;
                              const newIds = selectedRutaDetails.clientes.filter(x => x.id !== c.id).map(x => x.id);
                              try {
                                await api.patch(`/api/rutas/${selectedRutaDetails.id}`, { cliente_ids: newIds });
                                handleViewRuta(selectedRutaDetails.id);
                                fetchData();
                              } catch (e) { alert('Error al quitar cliente'); }
                            }}
                          >
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* LISTA DERECHA: DISPONIBLES */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--c-border)', backgroundColor: 'var(--c-surface)' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--c-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={14}/> AGREGAR CLIENTES
                  </h4>
                  <p style={{ fontSize: '10px', color: 'var(--c-muted)', marginTop: '4px' }}>Clientes libres no asignados a otra ruta.</p>
                  {/* Buscador */}
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={searchAvail}
                    onChange={e => setSearchAvail(e.target.value)}
                    style={{ marginTop: '10px', width: '100%', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', color: 'var(--c-text)', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                  {clientes
                    .filter(c => {
                      const rutaFecha = new Date(selectedRutaDetails.fecha_asignacion).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
                      const clientPagoStr = c.fecha_pago ? new Date(c.fecha_pago).toISOString().slice(0, 10) : '';
                      const isRutaDay = clientPagoStr === rutaFecha;
                      const isAlreadyInThisRuta = selectedRutaDetails.clientes.some(x => x.id === c.id);
                      const isAssignedElsewhere = assignedClientIds.has(c.id);
                      const isManaged = c.estado !== 'LIBRE';
                      const matchSearch = !searchAvail || 
                        `${c.nombres} ${c.apellidos} ${c.dni}`.toLowerCase().includes(searchAvail.toLowerCase());
                      return isRutaDay && !isAlreadyInThisRuta && !isAssignedElsewhere && !isManaged && matchSearch;
                    })
                    .map(c => (
                      <div key={`avail-${c.id}`} style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                        padding: '12px 16px', marginBottom: '10px', backgroundColor: 'var(--c-surface)', 
                        border: '1px solid var(--c-border)', borderRadius: '14px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--c-text)' }}>{c.nombres} {c.apellidos}</div>
                          <div style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: '2px' }}>{c.distrito} — S/ {c.deuda_total}</div>
                        </div>
                        <button 
                          className="btn btn-sm btn-primary"
                          style={{ borderRadius: '8px', fontSize: '11px', fontWeight: '800', padding: '6px 12px' }}
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
                      const rutaFecha = new Date(selectedRutaDetails.fecha_asignacion).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
                      const clientPagoStr = c.fecha_pago ? new Date(c.fecha_pago).toISOString().slice(0, 10) : '';
                      const isRutaDay = clientPagoStr === rutaFecha;
                      const isAlreadyInThisRuta = selectedRutaDetails.clientes.some(x => x.id === c.id);
                      const isAssignedElsewhere = assignedClientIds.has(c.id);
                      const isManaged = c.estado !== 'LIBRE';
                      const matchSearch = !searchAvail || 
                        `${c.nombres} ${c.apellidos} ${c.dni}`.toLowerCase().includes(searchAvail.toLowerCase());
                      return isRutaDay && !isAlreadyInThisRuta && !isAssignedElsewhere && !isManaged && matchSearch;
                  }).length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--c-muted)' }}>
                      <Sparkles size={40} style={{ opacity: 0.1, marginBottom: '10px' }}/>
                      <p style={{ fontSize: '12px', marginTop: '10px' }}>No hay más clientes disponibles con fecha de pago hoy.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '20px 25px', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: 'var(--c-surface)' }}>
               <button 
                 className="btn btn-primary"
                 style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--c-accent)', borderColor: 'var(--c-accent)' }}
                 onClick={() => {
                   // Cerramos este modal y abrimos el planificador enfocado si es necesario, 
                   // o simplemente centramos en el mapa principal.
                   setShowViewModal(false);
                   // Si tuviéramos una lógica de "foco", la activaríamos aquí.
                   alert('Centrando en el mapa principal...');
                 }}
               >
                 <MapIcon size={16}/> VER EN MAPA
               </button>
               <button className="btn btn-ghost" style={{ fontWeight: '800', color: 'var(--c-muted)' }} onClick={() => setShowViewModal(false)}>CERRAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
