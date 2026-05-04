import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Clock, FileText, Calendar, User } from 'lucide-react';
import L from 'leaflet';
import pinmanIcon from '../assets/PINMAN.png';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Subcomponente para ajustar los límites del mapa automáticamente
function MapBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);
  return null;
}

const workerIcon = L.icon({
  iconUrl: pinmanIcon,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

// Icono por defecto para evitar errores de 'createIcon'
const defaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function Stats() {
  const { api } = useContext(AuthContext);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [routeMode, setRouteMode] = useState('foot'); // 'foot' or 'bike'

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (selectedWorker) fetchStats();
  }, [selectedWorker, fecha]);

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/api/workers');
      setWorkers(res.data.data || []);
      if (res.data.data?.length > 0) setSelectedWorker(res.data.data[0].id);
    } catch (e) { console.error(e); }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/stats/worker/${selectedWorker}?fecha=${fecha}`);
      setStats(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setSelectedSegment(null); setRoutePolyline([]); }
  };

  // Fetch real walking/cycling route from OSRM public API
  const fetchOsrmRoute = async (segment) => {
    const validPoints = segment.puntos.filter(p => p.lat && p.lng && !isNaN(parseFloat(p.lat)));
    if (validPoints.length < 2) { setRoutePolyline([]); return; }
    // Use only first and last point (origin → destination)
    const [origin, dest] = [validPoints[0], validPoints[validPoints.length - 1]];
    const profile = routeMode === 'bike' ? 'bike' : 'foot';
    try {
      const url = `https://router.project-osrm.org/route/v1/${profile}/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        setRoutePolyline(coords);
      } else {
        setRoutePolyline([]);
      }
    } catch (e) {
      console.warn('OSRM routing failed, using straight line', e);
      setRoutePolyline([]);
    }
  };

  const getPolylinePoints = () => {
    if (selectedSegment !== null && stats?.segmentos[selectedSegment]) {
      return stats.segmentos[selectedSegment].puntos
        .filter(p => p.lat && p.lng && !isNaN(parseFloat(p.lat)) && !isNaN(parseFloat(p.lng)))
        .map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
    }
    return stats?.puntos_ruta?.filter(p => p.latitud && p.longitud).map(p => [parseFloat(p.latitud), parseFloat(p.longitud)]) || [];
  };

  const getMarkers = () => {
    if (selectedSegment !== null && stats?.segmentos[selectedSegment]) {
      return stats.segmentos[selectedSegment].puntos
        .filter(p => p.lat && p.lng && p.label !== 'Tracking')
        .map((p, j) => (
          <Marker key={`seg-${selectedSegment}-${j}-${p.lat}-${p.lng}`} position={[parseFloat(p.lat), parseFloat(p.lng)]} icon={p.label === 'Casa' ? workerIcon : defaultIcon}>
            <Popup><b>{p.label}</b><br/>{stats.segmentos[selectedSegment].razon}</Popup>
          </Marker>
        ));
    }
    // Si no hay segmento seleccionado, mostrar solo los puntos de inicio/fin de cada segmento
    return stats?.segmentos?.map((s, i) => (
      <React.Fragment key={`frag-${i}`}>
        {s.puntos.filter(p => p.lat && p.lng && p.label !== 'Tracking').map((p, j) => (
          <Marker key={`all-${i}-${j}-${p.lat}-${p.lng}`} position={[parseFloat(p.lat), parseFloat(p.lng)]} icon={p.label === 'Casa' ? workerIcon : defaultIcon}>
            <Popup><b>{p.label}</b><br/>{s.razon}</Popup>
          </Marker>
        ))}
      </React.Fragment>
    ));
  };

  // When segment is selected, fetch OSRM route
  useEffect(() => {
    if (selectedSegment !== null && stats?.segmentos[selectedSegment]) {
      fetchOsrmRoute(stats.segmentos[selectedSegment]);
    } else {
      setRoutePolyline([]);
    }
  }, [selectedSegment, routeMode]);

  const polylinePoints = getPolylinePoints();
  // Use real OSRM route if available, else fall back to straight line
  const displayPolyline = routePolyline.length > 0 ? routePolyline : polylinePoints;

  return (
    <div className="stats-page" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Filters */}
      <div className="card" style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'flex-end', background: 'var(--c-surface)' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--c-muted)' }}>Seleccionar Worker</label>
          <select 
            className="form-input" 
            value={selectedWorker} 
            onChange={e => setSelectedWorker(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--c-border)' }}
          >
            {workers.map(w => <option key={w.id} value={w.id}>{w.nombres} {w.apellidos}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--c-muted)' }}>Fecha de Análisis</label>
          <input 
            type="date" 
            className="form-input" 
            value={fecha} 
            onChange={e => setFecha(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--c-border)' }}
          />
        </div>
      </div>

      {/* Map and Content Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', flex: 1 }}>
        {/* Map Column */}
        <div className="card" style={{ height: '600px', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--c-border)', background: 'var(--c-surface)', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--c-primary)' }}>
              Cargando trayectos...
            </div>
          )}
          
          <MapContainer 
            center={[-12.046374, -77.042793]} 
            zoom={13} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {stats && (
              <React.Fragment key={`${selectedWorker}-${fecha}-${selectedSegment}`}>
                <MapBounds points={displayPolyline.length > 0 ? displayPolyline : polylinePoints} />
                {displayPolyline.length > 0 && (
                  <Polyline
                    positions={displayPolyline}
                    color={routePolyline.length > 0 ? '#10b981' : 'var(--c-primary)'}
                    weight={5}
                    opacity={0.85}
                    dashArray={routePolyline.length > 0 ? undefined : '8 6'}
                  />
                )}
                {getMarkers()}
              </React.Fragment>
            )}
          </MapContainer>
        </div>

        {/* Info Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {stats ? (
            <>
              {/* Mini Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="card" style={{ padding: '16px', background: 'var(--c-surface)', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <Navigation size={20} color="var(--c-primary)"/>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--c-muted)', fontWeight: 'bold' }}>DISTANCIA</div>
                    <div style={{ fontSize: '16px', fontWeight: '800' }}>{stats.distancia_total} km</div>
                  </div>
                </div>
                <div className="card" style={{ padding: '16px', background: 'var(--c-surface)', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <Clock size={20} color="var(--c-primary)"/>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--c-muted)', fontWeight: 'bold' }}>LLENADO AVG</div>
                    <div style={{ fontSize: '16px', fontWeight: '800' }}>{Math.floor(stats.tiempo_llenado_avg / 60)}m {stats.tiempo_llenado_avg % 60}s</div>
                  </div>
                </div>
              </div>

              {/* Segments List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800' }}>Trayectos</h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {selectedSegment !== null && (
                      <>
                        <select
                          value={routeMode}
                          onChange={e => setRouteMode(e.target.value)}
                          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer' }}
                        >
                          <option value="foot">A pie</option>
                          <option value="bike">Bicicleta</option>
                        </select>
                        <button onClick={() => setSelectedSegment(null)} style={{ fontSize: '12px', color: 'var(--c-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Ver Todo</button>
                      </>
                    )}
                  </div>
                </div>
                
                {stats.segmentos.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--c-muted)', background: 'var(--c-surface)', borderRadius: '12px', border: '1px dashed var(--c-border)' }}>
                     Sin gestiones registradas.
                  </div>
                ) : (
                  stats.segmentos.map((s, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedSegment(i)}
                      className="card" 
                      style={{ 
                        padding: '12px', 
                        background: selectedSegment === i ? 'var(--c-surface-2)' : 'var(--c-surface)', 
                        borderRadius: '12px', 
                        borderLeft: selectedSegment === i ? '4px solid var(--c-primary)' : '4px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: 'var(--shadow)'
                      }}
                    >
                      <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--c-primary)', marginBottom: '4px' }}>TRAYECTO {i+1}</div>
                      <div style={{ fontSize: '13px', fontWeight: '700' }}>{s.razon}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--c-muted)' }}>
                        <span><Navigation size={12}/> {s.distancia.toFixed(2)} km</span>
                        <span><Clock size={12}/> ~{Math.round(s.distancia * 15)} min</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--c-muted)', background: 'var(--c-surface-2)', borderRadius: '24px', border: '2px dashed var(--c-border)' }}>
              <User size={40} style={{ opacity: 0.2, marginBottom: '12px' }}/>
              <p style={{ fontSize: '13px', textAlign: 'center', padding: '0 20px' }}>Selecciona un trabajador para ver el análisis de sus rutas.</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .form-input:focus { outline: none; border-color: var(--c-primary) !important; box-shadow: 0 4px 12px rgba(16,24,32,0.06); }
        .card { box-shadow: var(--shadow); }
      `}</style>
    </div>
  );
}
