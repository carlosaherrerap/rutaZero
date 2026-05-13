import React, { useEffect, useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Users, Navigation, Clock, MapPin, ChevronRight, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';

// Fix Leaflet icons in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const workerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3253/3253113.png', // Motito o worker
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35]
});

// Componente para centrar el mapa
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView(coords, 15);
  }, [coords]);
  return null;
}

export default function Localizar() {
  const { api, token, API_BASE_URL } = useContext(AuthContext);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchWorkers();
    
    // Configurar Socket.io usando la URL centralizada
    if (!API_BASE_URL) return;
    const newSocket = io(API_BASE_URL);
    setSocket(newSocket);

    newSocket.on('worker_gps_update', (data) => {
      setWorkers(prev => prev.map(w => {
        if (String(w.id) === String(data.worker_id)) {
          return { ...w, latitud: data.latitud, longitud: data.longitud, last_update: data.timestamp };
        }
        return w;
      }));
      
      // Si el worker seleccionado se movió, actualizar su rastro si es necesario
      // (Podríamos re-fetch el breadcrumb o simplemente añadir el punto localmente)
    });

    return () => newSocket.disconnect();
  }, [api]);

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/api/workers');
      setWorkers(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBreadcrumb = async (worker) => {
    setSelectedWorker(worker);
    setBreadcrumb([]);
    try {
      const res = await api.get(`/api/tracking/ruta-dia/${worker.id}`);
      const points = res.data.data || [];
      setBreadcrumb(points.map(p => [parseFloat(p.latitud), parseFloat(p.longitud)]));
    } catch (e) {
      console.error('Error fetching breadcrumb', e);
    }
  };

  if (loading) return <div className="spinner"></div>;

  return (
    <div className="dashboard-page" style={{ height: 'calc(100vh - 120px)', display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
      
      {/* SIDEBAR DE WORKERS */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} /> Field Workers
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={fetchWorkers}><RefreshCw size={14}/></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {workers.map(w => (
            <div 
              key={w.id} 
              className={`worker-list-item ${selectedWorker?.id === w.id ? 'active' : ''}`}
              onClick={() => fetchBreadcrumb(w)}
              style={{
                padding: '16px',
                borderRadius: '16px',
                marginBottom: '10px',
                cursor: 'pointer',
                border: '1px solid var(--c-border)',
                background: selectedWorker?.id === w.id ? 'var(--c-primary-soft)' : 'var(--c-surface)',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800 }}>{w.nombres} {w.apellidos}</div>
                <div style={{ 
                  width: '10px', height: '10px', borderRadius: '50%', 
                  background: w.estado_jornada === 'JORNADA_INICIADA' ? 'var(--c-success)' : 'var(--c-muted)' 
                }}></div>
              </div>
              <div className="text-xs text-muted" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Navigation size={10} /> {w.distrito || 'Ubicación desconocida'}
              </div>
              {selectedWorker?.id === w.id && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--c-border)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={12} color="var(--c-primary)"/> Inicio: {w.hora_inicio_sesion ? new Date(w.hora_inicio_sesion).toLocaleTimeString() : '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={12} color="var(--c-primary)"/> Rutas: {w.rutas_activas || 0} asignadas
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MAPA */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        <MapContainer 
          center={[-12.046374, -77.042793]} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />

          {/* Marcadores de todos los workers */}
          {workers.map(w => (
            w.latitud && w.longitud && (
              <Marker 
                key={w.id} 
                position={[parseFloat(w.latitud), parseFloat(w.longitud)]}
                icon={workerIcon}
              >
                <Popup>
                  <div style={{ textAlign: 'center', color: 'var(--c-text)' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--c-text)' }}>{w.nombres} {w.apellidos}</div>
                    <div style={{ fontSize: '12px', color: 'var(--c-text)' }}>{w.estado_jornada || 'Offline'}</div>
                    <button 
                      className="btn btn-primary btn-sm" 
                      style={{ marginTop: '8px', padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => fetchBreadcrumb(w)}
                    >
                      Ver Recorrido
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          ))}

          {/* Rastro del worker seleccionado */}
          {breadcrumb.length > 0 && (
            <Polyline 
              positions={breadcrumb} 
              pathOptions={{ color: 'var(--c-primary)', weight: 4, opacity: 0.7, dashArray: '10, 10' }} 
            />
          )}

          {/* Centrar en el seleccionado si existe */}
          {selectedWorker?.latitud && <RecenterMap coords={[parseFloat(selectedWorker.latitud), parseFloat(selectedWorker.longitud)]} />}
        </MapContainer>

        {/* Overlay informativo */}
        {selectedWorker && (
          <div style={{
            position: 'absolute', top: '20px', right: '20px', 
            background: 'var(--c-surface)', padding: '16px', borderRadius: '16px',
            boxShadow: 'var(--shadow)', border: '1px solid var(--c-border)', zIndex: 1000,
            width: '240px'
          }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '900' }}>Recorrido del Día</h4>
            <p className="text-xs text-muted">Dibujando trazo de breadcrumbs...</p>
            <div style={{ marginTop: '10px', fontSize: '12px' }}>
              <strong>Puntos registrados:</strong> {breadcrumb.length}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedWorker(null)} style={{ marginTop: '12px', width: '100%' }}>Limpiar mapa</button>
          </div>
        )}
      </div>

      <style>{`
        .worker-list-item:hover {
          background: var(--c-surface-2) !important;
          transform: translateX(5px);
        }
        .worker-list-item.active {
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
        }
      `}</style>
    </div>
  );
}
