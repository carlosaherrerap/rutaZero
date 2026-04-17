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
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await api.get('/api/clientes/mapa');
        // Handle the wrapper { data: [...] }
        setClients(Array.isArray(res.data.data) ? res.data.data : []);
      } catch (e) {
        console.error('Error loading clients for map', e);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [api]);

  // Center of Lima
  const center = [-12.0464, -77.0428];

  return (
    <div className="map-page" style={{ height: 'calc(100vh - 110px)', margin: '-24px' }}>
      <div className="map-topbar">
        <div className="map-stat">
          <span className="badge badge-activo"></span>
          <span>{loading ? 'Cargando...' : `${clients.length} Clientes`}</span>
        </div>
        <div className="text-muted text-sm" style={{marginLeft: 'auto'}}>
          Visualizando todos los puntos de Lima
        </div>
      </div>
      
      <div className="map-container" style={{ flex: 1, position: 'relative' }}>
        {loading && <div className="spinner" style={{position:'absolute', top:'50%', left:'50%', zIndex:1000}}></div>}
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {clients.map((c) => (
            <Marker key={c.id} position={[parseFloat(c.latitud), parseFloat(c.longitud)]}>
              <Popup className="custom-popup">
                <div style={{minWidth: '150px'}}>
                  <strong style={{fontSize:'14px'}}>{c.nombres} {c.apellidos}</strong>
                  <div className={`badge badge-${c.estado.toLowerCase().replace(/_/g, '-')}`} style={{marginTop:'5px'}}>
                    {c.estado}
                  </div>
                  <div style={{marginTop:'10px', fontSize:'12px', color:'var(--c-muted)'}}>
                    Distrito: <strong>{c.distrito}</strong><br/>
                    Deuda: <strong>S/ {parseFloat(c.deuda_total).toFixed(2)}</strong>
                  </div>
                  {c.worker_nombre && (
                    <div style={{marginTop:'8px', paddingTop:'8px', borderTop:'1px solid var(--c-border)', fontSize:'11px'}}>
                      Capturado por: {c.worker_nombre} {c.worker_apellido}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
