import React, { useEffect, useState, useContext } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { AuthContext } from '../context/AuthContext.jsx';

// Fix Leaflet default icon in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapPage() {
  const { api } = useContext(AuthContext);
  const [data, setData] = useState({ clientes: [], workers: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const res = await api.get('/api/clientes/mapa');
        setData(res.data.data || { clientes: [], workers: [] });
      } catch (e) {
        console.error('Error loading map data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchMapData();
    const interval = setInterval(fetchMapData, 30000); // Auto-refresh cada 30s
    return () => clearInterval(interval);
  }, [api]);

  // Iconos Personalizados - PINES GRANDES
  const getClientIcon = (estado) => {
    let color = '#3b82f6'; // Azul por defecto (GRANDE)
    if (estado === 'EN_VISITA') color = '#a855f7';
    if (estado === 'VISITADO_PAGO') color = '#10b981';
    if (estado === 'REPROGRAMADO') color = '#f59e0b';
    if (estado === 'NO_ENCONTRADO') color = '#ef4444';

    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="position: relative; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center;">
          <svg viewBox="0 0 24 24" width="30" height="30" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));">
            <path fill="${color}" stroke="white" stroke-width="1.5" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8z"/>
            <circle cx="12" cy="8" r="3" fill="white" />
          </svg>
        </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });
  };

  const workerIcon = L.divIcon({
    className: 'worker-div-icon',
    html: `
      <div style="position: relative; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center;">
        <svg viewBox="0 0 24 24" width="32" height="32" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
          <path fill="#1e293b" stroke="white" stroke-width="1.5" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8z"/>
          <path fill="white" d="M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-4 8a4 4 0 0 1 8 0v1H8v-1z" />
        </svg>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  const center = [-12.0464, -77.0428];

  return (
    <div className="map-page" style={{ height: 'calc(100vh - 110px)', margin: '-24px' }}>
      <div className="map-topbar">
        <div className="map-stat">
          <span className="badge badge-activo" style={{backgroundColor:'#3b82f6'}}></span>
          <span>{data.clientes.length} Clientes</span>
        </div>
        <div className="map-stat" style={{marginLeft: '15px'}}>
          <span className="badge" style={{backgroundColor:'#1e293b'}}></span>
          <span>{data.workers.length} Workers Activos</span>
        </div>
        <div className="text-muted text-sm" style={{marginLeft: 'auto'}}>
          Mapa en tiempo real (Auto-refresh 30s)
        </div>
      </div>
      
      <div className="map-container" style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {/* MARCADORES DE CLIENTES */}
          {data.clientes.map((c) => (
            <Marker key={c.id} position={[parseFloat(c.latitud), parseFloat(c.longitud)]} icon={getClientIcon(c.estado)}>
              <Popup>
                <div style={{minWidth: '150px'}}>
                  <strong style={{fontSize:'14px'}}>{c.nombres} {c.apellidos}</strong>
                  <div style={{color: '#64748b', fontSize:'11px', marginBottom:'5px'}}>{c.direccion}</div>
                  <div className={`badge badge-${c.estado.toLowerCase().replace(/_/g, '-')}`}>
                    {c.estado.replace('_', ' ')}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* MARCADORES DE WORKERS */}
          {data.workers.map((w) => (
            <Marker key={w.id} position={[parseFloat(w.latitud), parseFloat(w.longitud)]} icon={workerIcon}>
              <Popup>
                <div style={{minWidth: '120px'}}>
                  <strong style={{color:'#1e293b'}}>{w.nombres} {w.apellidos}</strong>
                  <div style={{marginTop:'5px'}}>
                     <span style={{fontSize:'10px', fontWeight:'bold', color: w.estado_jornada === 'EN_REFRIGERIO' ? '#f59e0b' : '#10b981'}}>
                        {w.estado_jornada.replace('_', ' ')}
                     </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
