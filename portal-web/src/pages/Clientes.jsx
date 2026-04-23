import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function FichaDetallePanel({ g }) {
  const fmt = v => (v !== null && v !== undefined && v !== '') ? v : '—';
  const fmtNum = v => (v !== null && v !== undefined) ? parseFloat(v).toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '—';
  const fmtDate = v => v ? new Date(v).toLocaleDateString('es-PE') : '—';

  return (
    <div style={{ background: 'var(--c-bg-light)', borderRadius: '12px', padding: '14px', marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '12px' }}>
      <div><span style={{ color: 'var(--c-text-muted)' }}>Tipo Crédito</span><br /><b>{fmt(g.tipo_credito)}</b></div>
      <div><span style={{ color: 'var(--c-text-muted)' }}>Fecha Desembolso</span><br /><b>{fmtDate(g.fecha_desembolso)}</b></div>
      <div><span style={{ color: 'var(--c-text-muted)' }}>Monto Desembolso</span><br /><b>{g.moneda || 'PEN'} {fmtNum(g.monto_desembolso)}</b></div>
      <div><span style={{ color: 'var(--c-text-muted)' }}>N° Cuotas</span><br /><b>{fmt(g.nro_cuotas)}</b></div>
      <div><span style={{ color: 'var(--c-text-muted)' }}>Cuotas Pagadas</span><br /><b>{fmt(g.nro_cuotas_pagadas)}</b></div>
      <div><span style={{ color: 'var(--c-text-muted)' }}>Monto Cuota</span><br /><b>{fmtNum(g.monto_cuota)}</b></div>
      <div><span style={{ color: 'var(--c-text-muted)' }}>Saldo Capital</span><br /><b>{fmtNum(g.saldo_capital)}</b></div>
      <div><span style={{ color: 'var(--c-text-muted)' }}>Cond. Contable</span><br /><b>{fmt(g.condicion_contable)}</b></div>
      <div><span style={{ color: 'var(--c-text-muted)' }}>Duración Llenado</span><br /><b>{g.duracion_llenado_seg ? `${g.duracion_llenado_seg}s` : '—'}</b></div>
      {g.observacion && (
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={{ color: 'var(--c-text-muted)' }}>Observación</span><br />
          <i style={{ color: 'var(--c-text)' }}>{g.observacion}</i>
        </div>
      )}
      {g.evidencias && g.evidencias.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={{ color: 'var(--c-text-muted)', display: 'block', marginBottom: '8px' }}>
            📸 Evidencias ({g.evidencias.length})
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {g.evidencias.map((url, i) => (
              <a key={i} href={`${API_BASE}${url}`} target="_blank" rel="noopener noreferrer">
                <img
                  src={`${API_BASE}${url}`}
                  alt={`evidencia-${i + 1}`}
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '2px solid var(--c-border)', cursor: 'pointer', transition: 'transform 0.15s' }}
                  onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Clientes() {
  const { api } = useContext(AuthContext);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', distrito: '', estado: '' });
  const [selectedClient, setSelectedClient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedGestion, setExpandedGestion] = useState(null);

  useEffect(() => { fetchClientes(); }, [api, pagination.page, filters]);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: pagination.page, limit: pagination.limit, ...filters }).toString();
      const res = await api.get(`/api/clientes?${query}`);
      setClients(res.data.data || []);
      setPagination(prev => ({ ...prev, totalPages: res.data.pagination.totalPages }));
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

  const getTipColor = (tip) => {
    if (tip === 'PAGO') return '#10b981';
    if (tip === 'REPROGRAMARA') return '#f59e0b';
    if (tip === 'NO_ENCONTRADO') return '#ef4444';
    return '#6b7280';
  };

  return (
    <div>
      {/* FILTROS */}
      <div className="filter-bar">
        <div className="search-bar">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" name="search" placeholder="Buscar por nombre, apellidos o DNI..." value={filters.search} onChange={handleFilterChange} />
        </div>
        <select name="distrito" className="form-input" style={{ width: '180px' }} value={filters.distrito} onChange={handleFilterChange}>
          <option value="">Todos los distritos</option>
          {['LIMA','SANTIAGO DE SURCO','SAN BORJA','MIRAFLORES','LA MOLINA','SAN ISIDRO','PUENTE PIEDRA','CARABAYLLO','INDEPENDENCIA','LOS OLIVOS','SAN MARTIN DE PORRES'].map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select name="estado" className="form-input" style={{ width: '150px' }} value={filters.estado} onChange={handleFilterChange}>
          <option value="">Todos los estados</option>
          <option value="LIBRE">LIBRE</option>
          <option value="EN_VISITA">EN VISITA</option>
          <option value="VISITADO_PAGO">PAGÓ</option>
          <option value="REPROGRAMADO">REPROGRAMADO</option>
          <option value="NO_ENCONTRADO">NO ENCONTRADO</option>
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
                  <div className="badge badge-activo" style={{ fontSize: '10px' }}>{c.distrito}</div>
                </td>
                <td>
                  <div className="font-bold">S/ {parseFloat(c.deuda_total || 0).toFixed(2)}</div>
                  <div className="text-xs text-danger">{c.dias_retraso} días retraso</div>
                </td>
                <td>
                  <span className={`badge badge-${c.estado.toLowerCase().replace(/_/g, '-')}`}>{c.estado}</span>
                  {c.bloqueado_por && <div className="text-xs text-muted mt-1">Por: {c.bloqueado_por_nombre}</div>}
                </td>
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
        <button className="btn btn-ghost" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}>Siguiente</button>
      </div>

      {/* MODAL DETALLE */}
      {showModal && selectedClient && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '960px', width: '95vw' }}>
            <div className="modal-header">
              <span className="modal-title">
                📋 Ficha — {selectedClient.nombres} {selectedClient.apellidos}
              </span>
              <button className="btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>
              ) : (
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

                  {/* COLUMNA IZQUIERDA */}
                  <div style={{ flex: '1', minWidth: '220px' }}>
                    <h4 className="card-title mb-3">Información Personal</h4>
                    <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <div className="stat-card" style={{ padding: '10px' }}>
                        <span className="stat-label">Nombre</span>
                        <span className="stat-value" style={{ fontSize: '12px' }}>{selectedClient.nombres} {selectedClient.apellidos}</span>
                      </div>
                      <div className="stat-card" style={{ padding: '10px' }}>
                        <span className="stat-label">DNI</span>
                        <span className="stat-value" style={{ fontSize: '13px' }}>{selectedClient.dni}</span>
                      </div>
                    </div>
                    <div className="card" style={{ padding: '12px', background: 'var(--c-bg-light)', fontSize: '13px', marginBottom: '10px' }}>
                      <div className="text-sm text-muted mb-2">Contacto</div>
                      <div className="mb-1">📞 {selectedClient.telefono}</div>
                      <div>✉️ {selectedClient.email || 'No registrado'}</div>
                      <div className="text-sm text-muted mt-3 mb-1">Ubicación</div>
                      <div className="mb-1">📍 {selectedClient.direccion}</div>
                      <div>🏙️ {selectedClient.distrito} - Lima</div>
                    </div>
                    <div className="card" style={{ padding: '12px', background: 'var(--c-bg-light)', fontSize: '13px' }}>
                      <div className="text-sm text-muted mb-1">Deuda Total</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--c-danger)' }}>
                        S/ {parseFloat(selectedClient.deuda_total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-muted">{selectedClient.dias_retraso} días de retraso</div>
                    </div>
                  </div>

                  {/* COLUMNA DERECHA: Historial */}
                  <div style={{ flex: '2', minWidth: '300px' }}>
                    <h4 className="card-title mb-3">
                      Historial de Gestiones ({(selectedClient.gestiones || []).length})
                    </h4>
                    {!selectedClient.gestiones || selectedClient.gestiones.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: 'var(--c-text-muted)', fontSize: '14px' }}>
                        📋 No hay gestiones registradas para este cliente
                      </div>
                    ) : selectedClient.gestiones.map((g, idx) => (
                      <div key={g.id || idx} className="card mb-3"
                        style={{ padding: '14px', borderLeft: `4px solid ${getTipColor(g.tipificacion)}` }}>
                        <div
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                          onClick={() => setExpandedGestion(expandedGestion === idx ? null : idx)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              style={{ background: getTipColor(g.tipificacion), color: '#fff', borderRadius: '6px', padding: '3px 8px', fontSize: '10px', fontWeight: '800' }}>
                              {g.tipificacion}
                            </span>
                            <b style={{ fontSize: '13px' }}>{g.worker_nombre}</b>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--c-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📅 {new Date(g.timestamp_at).toLocaleString('es-PE')}
                            <span style={{ fontSize: '10px' }}>{expandedGestion === idx ? '▲ ocultar' : '▼ ver ficha'}</span>
                          </div>
                        </div>
                        {expandedGestion === idx && <FichaDetallePanel g={g} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
