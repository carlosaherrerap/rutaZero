import React, { useEffect, useState, useContext } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { AuthContext } from '../context/AuthContext.jsx';

import pinmanIcon from '../assets/PINMAN.png';

// Fix Leaflet default icon in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapPage() {
  const { api, sedeActual } = useContext(AuthContext);
  const [data, setData] = useState({ clientes: [], workers: [] });
  const [loading, setLoading] = useState(true);

  // Coordenadas por defecto según sede
  const getSedeCenter = () => {
    if (sedeActual?.nombre?.toLowerCase().includes('arequipa')) {
      return [-16.4090, -71.5375];
    }
    return [-12.0464, -77.0428]; // Lima
  };

  // Filtros
  const todayStr = new Date().toISOString().split('T')[0];
  const [fechaPago, setFechaPago] = useState(todayStr);
  const [tipoGestion, setTipoGestion] = useState('TODOS');

  const fetchMapData = async () => {
    try {
      const res = await api.get('/api/clientes/mapa', {
        params: {
          fecha_pago: fechaPago,
          tipo_gestion: tipoGestion
          // SE QUITA en_ruta: true para mostrar todos los clientes gestionados hoy
        }
      });
      setData(res.data.data || { clientes: [], workers: [] });
    } catch (e) {
      console.error('Error loading map data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 30000); // Auto-refresh cada 30s
    return () => clearInterval(interval);
  }, [api, fechaPago, tipoGestion]);

  // Iconos Personalizados - PINES GRANDES
  const getClientIcon = (estado) => {
    let color = 'var(--c-info)'; // Azul por defecto (LIBRE)
    if (estado === 'EN_VISITA') color = 'var(--c-accent)';
    if (estado === 'VISITADO_PAGO') color = 'var(--c-success)';
    if (estado === 'REPROGRAMADO') color = 'var(--c-warn)';
    if (estado === 'NO_ENCONTRADO') color = 'var(--c-danger)';

    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="position: relative; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center;">
          <svg viewBox="0 0 24 24" width="30" height="30" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));">
            <path fill="${color}" stroke="var(--c-on-primary)" stroke-width="1.5" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8z"/>
            <circle cx="12" cy="8" r="3" fill="var(--c-on-primary)" />
          </svg>
        </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });
  };

  const workerIcon = L.icon({
    iconUrl: pinmanIcon,
    iconSize: [45, 45],
    iconAnchor: [22, 45],
    popupAnchor: [0, -45]
  });

  const center = getSedeCenter();

  return (
    <div className="map-page" style={{ height: 'calc(100vh - 110px)', margin: '-24px', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .map-filters-input {
          background-color: var(--c-surface-2) !important;
          color: var(--c-text) !important;
          border: 1px solid var(--c-border) !important;
          padding: 8px 12px !important;
          border-radius: var(--radius) !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          outline: none !important;
          appearance: none;
          -webkit-appearance: none;
        }
        .map-filters-input option {
          background-color: var(--c-surface) !important;
          color: var(--c-text) !important;
        }
        /* Fix for date icon color in some browsers */
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }
      `}</style>
      <div className="map-topbar" style={{ display: 'flex', alignItems: 'center', padding: '10px 15px', backgroundColor: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', gap: '15px', flexWrap: 'wrap' }}>
        <div className="map-stat">
          <span className="badge badge-activo" style={{backgroundColor:'var(--c-info)'}}></span>
          <span>{data.clientes.length} Clientes</span>
        </div>
        <div className="map-stat">
          <span className="badge" style={{backgroundColor:'var(--c-text)'}}></span>
          <span>{data.workers.length} Workers</span>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Filtros:</label>
          <input 
            type="date" 
            className="map-filters-input" 
            value={fechaPago} 
            onChange={(e) => setFechaPago(e.target.value)} 
          />
          <select 
            className="map-filters-input" 
            value={tipoGestion} 
            onChange={(e) => setTipoGestion(e.target.value)}
          >
            <option value="TODOS">Todas las Gestiones</option>
            <option value="LIBRE">LIBRE</option>
            <option value="EN_VISITA">EN VISITA</option>
            <option value="VISITADO_PAGO">GESTIONADO (PAGO)</option>
            <option value="REPROGRAMADO">REPROGRAMADO</option>
            <option value="NO_ENCONTRADO">NO ENCONTRADO</option>
          </select>
        </div>
      </div>
      
      <div className="map-container" style={{ flex: 1, position: 'relative' }}>
        <MapContainer key={sedeActual?.id || 'map'} center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {/* MARCADORES DE CLIENTES */}
          {data.clientes.map((c) => (
            <Marker key={c.id} position={[parseFloat(c.latitud), parseFloat(c.longitud)]} icon={getClientIcon(c.estado)}>
              <Popup>
                <div style={{minWidth: '150px', color: 'var(--c-text)'}}>
                  <strong style={{fontSize:'14px', color: 'var(--c-text)'}}>{c.nombres} {c.apellidos}</strong>
                  <div style={{color: 'var(--c-danger)', fontWeight: 'bold', fontSize: '13px', margin: '3px 0'}}>
                    DEUDA: S/ {parseFloat(c.deuda_total || 0).toFixed(2)}
                  </div>
                  <div style={{color: 'var(--c-muted)', fontSize:'11px', marginBottom:'5px'}}>{c.direccion}</div>
                  <div className={`badge badge-${c.estado.toLowerCase().replace(/_/g, '-')}`}>
                    {c.estado.replace('_', ' ')}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* MARCADORES DE WORKERS */}
          {data.workers.map((w) => (
            <Marker key={w.id} position={[parseFloat(w.latitud || 0), parseFloat(w.longitud || 0)]} icon={workerIcon}>
              <Popup>
                <div style={{minWidth: '120px', color: 'var(--c-text)'}}>
                  <strong style={{color:'var(--c-text)'}}>{w.nombres} {w.apellidos}</strong>
                  <div style={{marginTop:'5px'}}>
                    <span style={{fontSize:'10px', fontWeight:'bold', color: w.estado_jornada === 'EN_REFRIGERIO' ? 'var(--c-warn)' : 'var(--c-muted)'}}>
                        {w.estado_jornada ? w.estado_jornada.replace('_', ' ') : 'SIN INICIAR DÍA'}
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
