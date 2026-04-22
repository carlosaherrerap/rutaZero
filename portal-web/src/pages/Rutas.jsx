import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Componente para ajustar el mapa a los marcadores seleccionados
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [coords, map]);
  return null;
}

export default function Rutas() {
  const { api } = useContext(AuthContext);
  const [rutas, setRutas] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [newRuta, setNewRuta] = useState({ nombre: '', worker_id: '', cliente_ids: [] });
  const [creating, setCreating] = useState(false);
  
  const [showRouteDetail, setShowRouteDetail] = useState(null);
  const [routeClients, setRouteClients] = useState([]);
  const [routeClientsLoading, setRouteClientsLoading] = useState(false);

  // Icono para el mapa de planificación
  const selectedIcon = L.divIcon({
    className: 'selected-client-icon',
    html: '<div style="background-color:#3b82f6; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
    iconSize: [12, 12]
  });

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [rRes, wRes, cRes] = await Promise.all([
        api.get('/api/rutas'),
        api.get('/api/workers'),
        api.get('/api/clientes?limit=200')
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

  useEffect(() => {
    fetchInitialData();
  }, [api]);

  const toggleCliente = (id) => {
    setNewRuta(prev => {
      const ids = prev.cliente_ids.includes(id) 
        ? prev.cliente_ids.filter(x => x !== id)
        : [...prev.cliente_ids, id];
      return { ...prev, cliente_ids: ids };
    });
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
      alert('Error: ' + (e.response?.data?.error || e.message));
    } finally {
      setCreating(false);
    }
  };

  // Obtener coordenadas de clientes seleccionados para el mapa
  const selectedCoords = clientes
    .filter(c => newRuta.cliente_ids.includes(c.id))
    .map(c => [parseFloat(c.latitud), parseFloat(c.longitud)]);

  return (
    <div className="rutas-page">
      <div className="filter-bar">
        <div className="search-bar" style={{ width: '250px' }}>
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
              <th>Ruta</th>
              <th>Worker</th>
              <th>Progreso</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center"><div className="spinner"></div></td></tr>
            ) : rutas.map(r => (
              <tr key={r.id}>
                <td><span className="font-bold">{r.nombre}</span><div className="text-sm text-muted">{r.total_clientes} clientes</div></td>
                <td>{r.worker_nombre} {r.worker_apellido}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="chart-bar-track" style={{width: 60, height:6}}>
                       <div className="chart-bar-fill" style={{width: `${((r.visitados || 0)/r.total_clientes)*100}%`, background:'#10b981'}}></div>
                    </div>
                    <span className="text-xs">{r.visitados || 0}/{r.total_clientes}</span>
                  </div>
                </td>
                <td>{new Date(r.fecha_asignacion).toLocaleDateString()}</td>
                <td>{r.completada ? <span className="badge badge-visitado">LISTO</span> : <span className="badge badge-en-gestion">GESTIÓN</span>}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setShowRouteDetail(r)}>Detalle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL CREADOR CON MAPA */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '1000px', width: '90%' }}>
            <div className="modal-header">
              <span className="modal-title">Planificador de Ruta</span>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRuta} style={{ display: 'flex', flexDirection: 'row', gap: '20px', height: '550px' }}>
              
              {/* Lado Izquierdo: Formulario y Tabla */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="form-group">
                  <label className="form-label">Nombre y Worker</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input className="form-input" placeholder="Nombre Ruta" required value={newRuta.nombre} onChange={e => setNewRuta({...newRuta, nombre: e.target.value})} />
                    <select className="form-input" required value={newRuta.worker_id} onChange={e => setNewRuta({...newRuta, worker_id: e.target.value})}>
                      <option value="">Asignar a...</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.nombres}</option>)}
                    </select>
                  </div>
                </div>

                <label className="form-label">Seleccionar Clientes ({newRuta.cliente_ids.length})</label>
                <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
                  <table style={{ fontSize: '12px' }}>
                    <thead>
                      <tr><th></th><th>Cliente</th><th>Distrito</th></tr>
                    </thead>
                    <tbody>
                      {clientes.filter(c => c.estado === 'LIBRE').map(c => (
                        <tr key={c.id} onClick={() => toggleCliente(c.id)} style={{ cursor: 'pointer', background: newRuta.cliente_ids.includes(c.id) ? '#eff6ff' : 'transparent' }}>
                          <td><input type="checkbox" checked={newRuta.cliente_ids.includes(c.id)} readOnly /></td>
                          <td>{c.nombres}</td>
                          <td>{c.distrito}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer" style={{ padding: '15px 0 0 0' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar Ruta</button>
                </div>
              </div>

              {/* Lado Derecho: Mapa Interactivo */}
              <div style={{ flex: 1.2, borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <MapContainer center={[-12.0464, -77.0428]} zoom={11} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {clientes.filter(c => newRuta.cliente_ids.includes(c.id)).map(c => (
                    <Marker key={c.id} position={[parseFloat(c.latitud), parseFloat(c.longitud)]} icon={selectedIcon}>
                      <Popup>{c.nombres} {c.apellidos}</Popup>
                    </Marker>
                  ))}
                  <RecenterMap coords={selectedCoords} />
                </MapContainer>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
