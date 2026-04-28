import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Clock, FileText, Calendar, User } from 'lucide-react';
import L from 'leaflet';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function Stats() {
  const { api } = useContext(AuthContext);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);

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
    finally { setLoading(false); setSelectedSegment(null); }
  };

  const getPolylinePoints = () => {
    if (selectedSegment !== null && stats?.segmentos[selectedSegment]) {
      return stats.segmentos[selectedSegment].puntos.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
    }
    return stats?.puntos_ruta?.map(p => [parseFloat(p.latitud), parseFloat(p.longitud)]) || [];
  };

  const getMarkers = () => {
    if (selectedSegment !== null && stats?.segmentos[selectedSegment]) {
      return stats.segmentos[selectedSegment].puntos.map((p, j) => (
        <Marker key={j} position={[parseFloat(p.lat), parseFloat(p.lng)]}>
          <Popup><b>{p.label}</b><br/>{stats.segmentos[selectedSegment].razon}</Popup>
        </Marker>
      ));
    }
    return stats?.segmentos?.map((s, i) => (
      <React.Fragment key={i}>
        {s.puntos.map((p, j) => (
          <Marker key={`${i}-${j}`} position={[parseFloat(p.lat), parseFloat(p.lng)]}>
            <Popup><b>{p.label}</b><br/>{s.razon}</Popup>
          </Marker>
        ))}
      </React.Fragment>
    ));
  };

  const polylinePoints = getPolylinePoints();

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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>Calculando métricas...</div>
      ) : stats ? (
        <>
          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', background: 'var(--c-surface)', borderRadius: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ background: 'var(--c-surface-2)', color: 'var(--c-primary)', padding: '12px', borderRadius: '12px' }}><Navigation size={24}/></div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--c-muted)', fontWeight: 'bold' }}>DISTANCIA TOTAL</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--c-text)' }}>{stats.distancia_total} km</div>
              </div>
            </div>
            <div className="card" style={{ padding: '24px', background: 'var(--c-surface)', borderRadius: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ background: 'var(--c-surface-2)', color: 'var(--c-primary)', padding: '12px', borderRadius: '12px' }}><FileText size={24}/></div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--c-muted)', fontWeight: 'bold' }}>LLENADO PROMEDIO</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--c-text)' }}>{Math.floor(stats.tiempo_llenado_avg / 60)}m {stats.tiempo_llenado_avg % 60}s</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            {/* Map */}
            <div className="card" style={{ height: '500px', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
               <MapContainer center={polylinePoints[0] || [-12.046374, -77.042793]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {polylinePoints.length > 0 && <Polyline positions={polylinePoints} color="var(--c-info)" weight={4} opacity={0.6} dashArray="10, 10" />}
                {getMarkers()}
              </MapContainer>
            </div>

            {/* Segments List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--c-text)' }}>Razón de Trayectos</h3>
                {selectedSegment !== null && (
                  <button onClick={() => setSelectedSegment(null)} className="btn btn-ghost" style={{ fontSize: '12px', color: 'var(--c-primary)' }}>Ver Todo</button>
                )}
              </div>
              {stats.segmentos.length === 0 ? (
                <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--c-muted)', background: 'var(--c-surface)' }}>
                   No hay gestiones registradas este día para trazar segmentos.
                </div>
              ) : (
                stats.segmentos.map((s, i) => (
                  <div 
                    key={i} 
                    onClick={() => setSelectedSegment(i)}
                    className="card" 
                    style={{ 
                      padding: '16px', 
                      background: selectedSegment === i ? 'var(--c-surface-2)' : 'var(--c-surface)', 
                      borderRadius: '12px', 
                      borderLeft: selectedSegment === i ? '4px solid var(--c-primary)' : '4px solid var(--c-info)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: selectedSegment === i ? 'var(--c-primary)' : 'var(--c-info)', marginBottom: '4px' }}>TRAYECTO {i+1}</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--c-text)' }}>{s.razon}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--c-muted)' }}><Navigation size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }}/> {s.distancia.toFixed(2)} km</span>
                      <span style={{ color: 'var(--c-muted)' }}><Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }}/> {Math.round(s.distancia * 15)} min aprox.</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>Selecciona un worker para ver su actividad.</div>
      )}

      <style>{`
        .form-input:focus { outline: none; border-color: var(--c-primary) !important; box-shadow: 0 4px 12px rgba(16,24,32,0.06); }
        .card { box-shadow: var(--shadow); }
      `}</style>
    </div>
  );
}
