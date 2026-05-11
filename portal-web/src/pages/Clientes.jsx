import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { 
  User, MapPin, Phone, Mail, Home, Building2, Shield, 
  AlertTriangle, WifiOff, Calendar, ChevronUp, ChevronDown, 
  ClipboardList, X, Image, Map as MapIcon 
} from 'lucide-react';

// Mapa de estado → color (Premium Light Theme)
const ESTADO_COLORS = {
  LIBRE:         { bg: '#E8F5E9', text: '#2E7D32', label: 'LIBRE' },
  EN_VISITA:     { bg: '#FFF3E0', text: '#EF6C00', label: 'EN CAMINO' },
  VISITADO_PAGO: { bg: '#E3F2FD', text: '#1565C0', label: 'GESTIONADO' },
  REPROGRAMADO:  { bg: '#F3E5F5', text: '#7B1FA2', label: 'REPROGRAMADO' },
  NO_ENCONTRADO: { bg: '#FFEBEE', text: '#C62828', label: 'NO ENCONTRADO' },
  NO_ECONTRADO:  { bg: '#FFEBEE', text: '#C62828', label: 'NO ENCONTRADO (TYPO)' },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_COLORS[estado] || { bg: 'var(--c-surface-2)', text: 'var(--c-muted)', label: estado };
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.text,
      fontWeight: '700',
      fontSize: '11px',
      padding: '4px 12px',
      borderRadius: '6px',
      whiteSpace: 'nowrap',
      letterSpacing: '0.2px'
    }}>
      {cfg.label}
    </span>
  );
}

function FichaDetallePanel({ g }) {
  const { api } = useContext(AuthContext);
  const fmt = v => (v !== null && v !== undefined && v !== '') ? v : '—';
  const fmtNum = v => (v !== null && v !== undefined) ? parseFloat(v).toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '—';
  const fmtDate = v => v ? new Date(v).toLocaleDateString('es-PE') : '—';

  return (
    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>TIPO CRÉDITO</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-text)' }}>{fmt(g.tipo_credito)}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>FECHA DESEMBOLSO</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-text)' }}>{fmtDate(g.fecha_desembolso)}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>MONTO DESEMBOLSO</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-text)' }}>{g.moneda || 'PEN'} {fmtNum(g.monto_desembolso)}</div>
        </div>

        <div>
          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>N° CUOTAS</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-text)' }}>{fmt(g.nro_cuotas)}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>CUOTAS PAGADAS</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-text)' }}>{fmt(g.nro_cuotas_pagadas)}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>MONTO CUOTA</div>
          <div style={{ fontSize: '13px', fontWeight: '900', color: 'var(--c-text)' }}>S/ {fmtNum(g.monto_cuota)}</div>
        </div>

        <div>
          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>SALDO CAPITAL</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-text)' }}>S/ {fmtNum(g.saldo_capital)}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>COND. CONTABLE</div>
          <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--c-text)' }}>{fmt(g.condicion_contable)}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>DURACIÓN LLENADO</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--c-text)' }}>{g.duracion_llenado_seg ? `${g.duracion_llenado_seg}s` : '—'}</div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>OBSERVACIÓN</div>
        <div style={{ fontSize: '13px', color: 'var(--c-text)', fontStyle: 'italic', lineHeight: '1.5' }}>
          "{g.observacion || 'Sin observaciones registradas'}"
        </div>
      </div>

      {g.evidencias && g.evidencias.length > 0 && (
        <div style={{ display: 'flex', gap: '10px' }}>
          {g.evidencias.map((url, i) => (
            <img key={i} 
              src={url.startsWith('http') ? url : `${api.defaults.baseURL}${url}`} 
              style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--c-border)', cursor: 'pointer' }}
              onClick={() => window.open(url.startsWith('http') ? url : `${api.defaults.baseURL}${url}`, '_blank')}
              onError={e => e.target.style.display = 'none'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const getTipColor = (tip) => {
  if (tip === 'PAGO') return 'var(--c-success)';
  if (tip === 'REPROGRAMARA') return 'var(--c-warn)';
  if (tip === 'NO_ENCONTRADO' || tip === 'NO ENCONTRADO' || tip === 'NO_ECONTRADO') return 'var(--c-danger)';
  return 'var(--c-muted)';
};

export default function Clientes() {
  const { api, sedeActual } = useContext(AuthContext);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, totalPages: 0 });
  const [filters, setFilters] = useState({ 
    search: '', 
    distrito: '', 
    estado: '', 
    fecha_pago: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  });
  const [selectedClient, setSelectedClient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedGestion, setExpandedGestion] = useState(null);

  useEffect(() => { 
    fetchClientes(); 
  }, [api, pagination.page, filters]);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: pagination.page, limit: pagination.limit, ...filters }).toString();
      const res = await api.get(`/api/clientes?${query}`);
      setClients(res.data.data || []);
      setPagination(prev => ({ ...prev, totalPages: res.data.pagination?.totalPages || 1 }));
    } catch (e) { console.error('Error loading clientes', e); }
    finally { setLoading(false); }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleShowDetail = async (client) => {
    setLoadingDetail(true);
    setSelectedClient(client);
    setShowModal(true);
    setExpandedGestion(null);
    try {
      const res = await api.get(`/api/clientes/${client.id}`);
      setSelectedClient(res.data.data);
    } catch (e) { console.error('Error loading client details', e); }
    finally { setLoadingDetail(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="text-2xl font-bold">Gestión de Clientes - {sedeActual?.nombre || 'General'}</h1>
        <p className="text-muted">Administra tu cartera de clientes y visualiza sus deudas en esta sede.</p>
      </div>
      {/* FILTROS */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <div className="search-bar" style={{ flex: '1', minWidth: '300px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" name="search" placeholder="Buscar por nombre, apellidos o DNI..." value={filters.search} onChange={handleFilterChange} />
        </div>
        
        <input 
          type="date" 
          name="fecha_pago" 
          className="form-input" 
          style={{ width: '150px' }} 
          value={filters.fecha_pago} 
          onChange={handleFilterChange} 
        />

        <select name="estado" className="form-input" style={{ width: '160px' }} value={filters.estado} onChange={handleFilterChange}>
          <option value="">[ESTADOS] Todos</option>
          <option value="LIBRE">LIBRE</option>
          <option value="EN_VISITA">EN VISITA</option>
          <option value="VISITADO_PAGO">GESTIONADO</option>
          <option value="REPROGRAMADO">REPROGRAMADO</option>
          <option value="NO_ENCONTRADO">NO ENCONTRADO</option>
        </select>

        <select name="distrito" className="form-input" style={{ width: '180px' }} value={filters.distrito} onChange={handleFilterChange}>
          <option value="">[DISTRITOS] Todos</option>
          {sedeActual?.nombre?.toLowerCase().includes('arequipa') ? (
            ['AREQUIPA','CERRO COLORADO','CAYMA','YANAHUARA','JOSE LUIS BUSTAMANTE','PAUCARPATA','MIRAFLORES'].map(d => (
              <option key={d} value={d}>{d}</option>
            ))
          ) : (
            ['LIMA','ATE','CALLAO','COMAS','CHORRILLOS','LOS OLIVOS','SAN JUAN DE LURIGANCHO','SAN MARTIN DE PORRES','VILLA EL SALVADOR'].map(d => (
              <option key={d} value={d}>{d}</option>
            ))
          )}
        </select>
      </div>

      {/* TABLA */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th><th>DNI / Teléfono</th><th>Dirección / Distrito</th>
              <th>Deuda</th><th>Estado</th><th>Última Gestión</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center"><div className="spinner"></div></td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-4">No se encontraron clientes</td></tr>
            ) : clients.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="font-bold">{c.nombres} {c.apellidos}</div>
                  <div className="text-sm text-muted">{c.id.substring(0, 8)}</div>
                </td>
                <td><div>{c.dni}</div><div className="text-sm text-muted">{c.telefono}</div></td>
                <td>
                  <div className="text-sm">{c.direccion}</div>
                  <span className="badge badge-activo" style={{ fontSize: '10px' }}>{c.distrito}</span>
                </td>
                <td>
                  <div className="font-bold">S/ {parseFloat(c.deuda_total || 0).toFixed(2)}</div>
                  <div className="text-xs text-danger">{c.dias_retraso} días retraso</div>
                </td>
                <td><EstadoBadge estado={c.estado} /></td>
                <td>{c.fecha_gestion ? new Date(c.fecha_gestion).toLocaleDateString('es-PE') : 'Sin gestión'}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => handleShowDetail(c)}>Ver Detalle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINACIÓN */}
      <div className="pagination">
        <button className="btn btn-ghost" disabled={pagination.page === 1} onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}>Anterior</button>
        <span className="text-sm">Página {pagination.page} de {pagination.totalPages}</span>
        <button className="btn btn-ghost" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}>Siguiente</button>
      </div>

      {/* MODAL DETALLE PREMIUM */}
      {showModal && selectedClient && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(5px)' }}>
          <div className="modal" style={{ maxWidth: '1100px', width: '95vw', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: '24px', overflow: 'hidden' }}>
            
            {/* HEADER MODAL */}
            <div className="p-10 flex justify-between items-center">
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--c-text)', margin: 0 }}>{selectedClient.nombres} {selectedClient.apellidos}</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ color: 'var(--c-primary)', fontSize: '11px', fontWeight: '900', letterSpacing: '0.5px' }}>ID: {selectedClient.id.substring(0, 8).toUpperCase()}</span>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--c-border)' }}></span>
                  <span style={{ fontSize: '12px', color: 'var(--c-muted)' }}>Registrado {new Date(selectedClient.created_at || Date.now()).toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '14px', fontSize: '13px', fontWeight: '800' }}>
                  <ClipboardList size={18}/> EXPORTAR FICHA
                </button>
                <button 
                  onClick={() => setShowModal(false)}
                  style={{ 
                    width: '44px', height: '44px', borderRadius: '50%', border: '1px solid var(--c-border)', 
                    background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s', color: 'var(--c-muted)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-2)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-muted)'; }}
                >
                  <X size={24}/>
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ padding: '0 40px 40px', maxHeight: '75vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '48px' }}>
              
              {/* SIDEBAR IZQUIERDO */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* ASIGNACIÓN ACTUAL (DINÁMICO) - AHORA ARRIBA */}
                <section style={{ 
                  padding: '16px 20px', 
                  background: selectedClient.worker_nombre ? 'rgba(59, 130, 246, 0.05)' : 'rgba(239, 68, 68, 0.04)', 
                  border: `1px solid ${selectedClient.worker_nombre ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.12)'}`, 
                  borderRadius: '16px',
                  display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                  {selectedClient.worker_nombre 
                    ? <User size={18} color="#3b82f6"/>
                    : <AlertTriangle size={18} color="#ef4444"/>
                  }
                  <span style={{ fontSize: '13px', fontWeight: '800', color: selectedClient.worker_nombre ? '#3b82f6' : '#ef4444' }}>
                    {selectedClient.worker_nombre 
                      ? `${selectedClient.worker_nombre} (${selectedClient.ruta_nombre})`
                      : 'Sin worker y/o ruta activa'
                    }
                  </span>
                </section>

                {/* UBICACIÓN Y DATOS */}
                <section>
                  <h4 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px' }}>UBICACIÓN Y DATOS</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {[
                      { icon: <Phone size={18}/>, label: 'TELÉFONO', value: selectedClient.telefono },
                      { icon: <Mail size={18}/>, label: 'EMAIL', value: selectedClient.email || 'No registrado' },
                      { icon: <MapPin size={18}/>, label: 'DIRECCIÓN', value: selectedClient.direccion },
                      { icon: <Building2 size={18}/>, label: 'DISTRITO', value: selectedClient.distrito }
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ color: 'var(--c-primary)', marginTop: '2px' }}>{item.icon}</div>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--c-muted)', fontWeight: '800', marginBottom: '4px' }}>{item.label}</div>
                          <div style={{ fontSize: '14px', fontWeight: '700', lineHeight: '1.4' }}>{item.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

              </div>

              {/* CONTENIDO PRINCIPAL: TIMELINE */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>HISTORIAL DE GESTIONES</h4>
                </div>

                {loadingDetail ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>
                ) : !selectedClient.gestiones || selectedClient.gestiones.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', background: 'var(--c-surface)', borderRadius: '20px', border: '1px dashed var(--c-border)' }}>
                    <p style={{ color: 'var(--c-muted)', fontSize: '14px' }}>No hay registros de gestión para este cliente.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
                    {/* Línea vertical del timeline */}
                    <div style={{ position: 'absolute', left: '16px', top: '0', bottom: '0', width: '2px', background: 'var(--c-border)', zIndex: 0 }}></div>
                    
                    {selectedClient.gestiones.map((g, idx) => (
                      <div key={g.id || idx} style={{ position: 'relative', paddingLeft: '56px', marginBottom: '32px', zIndex: 1 }}>
                        {/* Círculo del timeline */}
                        <div style={{ 
                          position: 'absolute', left: '0', top: '0', width: '34px', height: '34px', 
                          borderRadius: '50%', background: 'var(--c-bg)', border: `2px solid ${getTipColor(g.tipificacion)}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2
                        }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: getTipColor(g.tipificacion) }}></div>
                        </div>

                        <div className="card" style={{ 
                          background: 'var(--c-surface)', borderRadius: '20px', padding: '24px', 
                          border: '1px solid var(--c-border)', transition: 'all 0.3s'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <span style={{ 
                                background: 'rgba(0,0,0,0.2)', color: getTipColor(g.tipificacion), 
                                fontSize: '10px', fontWeight: '900', padding: '4px 10px', 
                                borderRadius: '6px', border: `1px solid ${getTipColor(g.tipificacion)}` 
                              }}>
                                {g.tipificacion}
                              </span>
                              <div style={{ fontWeight: '800', fontSize: '14px' }}>{g.tipificacion === 'PAGO' ? 'Cobro Recaudado' : (g.tipificacion === 'REPROGRAMARA' ? 'Visita Reprogramada' : 'Entrega Fallida')}</div>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={14}/> {new Date(g.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })} • {new Date(g.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>

                          <FichaDetallePanel g={g} />
                          
                          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--c-border)', fontSize: '11px', color: 'var(--c-muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Gestionado por <b>{g.worker_nombre}</b></span>
                            {g.es_offline && <span style={{ color: 'var(--c-accent)', fontWeight: '900' }}>MODO OFFLINE</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
