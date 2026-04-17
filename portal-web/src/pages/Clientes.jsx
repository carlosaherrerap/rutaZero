import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

export default function Clientes() {
  const { api } = useContext(AuthContext);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', distrito: '', estado: '' });
  
  // Detail state
  const [selectedClient, setSelectedClient] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchClientes();
  }, [api, pagination.page, filters]);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      }).toString();
      const res = await api.get(`/api/clientes?${query}`);
      setClients(res.data.data || []);
      setPagination(prev => ({ ...prev, totalPages: res.data.pagination.totalPages }));
    } catch (e) {
      console.error('Error loading clientes', e);
    } finally {
      setLoading(false);
    }
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
    try {
      const res = await api.get(`/api/clientes/${client.id}`);
      setSelectedClient(res.data.data);
    } catch (e) {
      console.error('Error loading client details', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div>
      <div className="filter-bar">
        <div className="search-bar">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input 
            type="text" 
            name="search"
            placeholder="Buscar por nombre, apellidos o DNI..." 
            value={filters.search}
            onChange={handleFilterChange}
          />
        </div>
        <select 
          name="distrito"
          className="form-input" 
          style={{ width: '180px' }}
          value={filters.distrito}
          onChange={handleFilterChange}
        >
          <option value="">Todos los distritos</option>
          {['LIMA', 'SANTIAGO DE SURCO', 'SAN BORJA', 'MIRAFLORES', 'LA MOLINA', 'SAN ISIDRO', 'PUENTE PIEDRA', 'CARABAYLLO'].map(d => (
             <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select 
          name="estado"
          className="form-input" 
          style={{ width: '150px' }}
          value={filters.estado}
          onChange={handleFilterChange}
        >
          <option value="">Todos los estados</option>
          <option value="LIBRE">LIBRE</option>
          <option value="EN_VISITA">EN VISITA</option>
          <option value="VISITADO_PAGO">PAGO</option>
          <option value="REPROGRAMADO">REPROGRAMADO</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>DNI / Teléfono</th>
              <th>Dirección / Distrito</th>
              <th>Deuda</th>
              <th>Estado</th>
              <th>Última Gestión</th>
              <th>Acciones</th>
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
                  <div className="text-sm text-muted">{c.id.substring(0,8)}</div>
                </td>
                <td>
                  <div>{c.dni}</div>
                  <div className="text-sm text-muted">{c.telefono}</div>
                </td>
                <td>
                  <div className="text-sm">{c.direccion}</div>
                  <div className="badge badge-activo" style={{fontSize: '10px'}}>{c.distrito}</div>
                </td>
                <td>
                  <div className="font-bold">S/ {parseFloat(c.deuda_total).toFixed(2)}</div>
                  <div className="text-xs text-danger">{c.dias_retraso} días retraso</div>
                </td>
                <td>
                  <span className={`badge badge-${c.estado.toLowerCase().replace(/_/g, '-')}`}>
                    {c.estado}
                  </span>
                  {c.bloqueado_por && (
                    <div className="text-xs text-muted mt-1">Por: {c.bloqueado_por_nombre}</div>
                  )}
                </td>
                <td>{c.fecha_gestion ? new Date(c.fecha_gestion).toLocaleDateString() : 'Sin gestión'}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleShowDetail(c)}>Ver Detalle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button 
          className="btn btn-ghost" 
          disabled={pagination.page === 1}
          onClick={() => setPagination(prev => ({...prev, page: prev.page - 1}))}
        >
          Anterior
        </button>
        <span className="text-sm">Página {pagination.page} de {pagination.totalPages}</span>
        <button 
          className="btn btn-ghost" 
          disabled={pagination.page === pagination.totalPages}
          onClick={() => setPagination(prev => ({...prev, page: prev.page + 1}))}
        >
          Siguiente
        </button>
      </div>

      {showModal && selectedClient && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <span className="modal-title">Ficha del Cliente</span>
              <button className="btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {loadingDetail ? (
                <div className="spinner"></div>
              ) : (
                <div className="form-row form-row-2" style={{ gap: '30px' }}>
                  <div style={{ flex: 1 }}>
                    <h4 className="card-title mb-4">Información General</h4>
                    <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="stat-card" style={{ padding: '15px' }}>
                        <span className="stat-label">Nombre</span>
                        <span className="stat-value" style={{ fontSize: '14px' }}>{selectedClient.nombres} {selectedClient.apellidos}</span>
                      </div>
                      <div className="stat-card" style={{ padding: '15px' }}>
                        <span className="stat-label">DNI</span>
                        <span className="stat-value" style={{ fontSize: '14px' }}>{selectedClient.dni}</span>
                      </div>
                    </div>
                    
                    <div className="card mt-4" style={{ padding: '15px', background: 'var(--c-bg-light)' }}>
                      <div className="text-sm text-muted mb-2">Contacto</div>
                      <div className="mb-2">📞 {selectedClient.telefono}</div>
                      <div className="mb-2">✉️ {selectedClient.email || 'No registrado'}</div>
                      <div className="text-sm text-muted mt-4 mb-2">Ubicación</div>
                      <div className="mb-2">📍 {selectedClient.direccion}</div>
                      <div className="mb-2">🏙️ {selectedClient.distrito} - Lima</div>
                    </div>
                  </div>

                  <div style={{ flex: 1.5 }}>
                    <h4 className="card-title mb-4">Historial de Gestiones</h4>
                    <div className="table-wrap" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table className="text-sm">
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <th>Fecha</th>
                            <th>Worker</th>
                            <th>Tipificación</th>
                            <th>Observación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!selectedClient.gestiones || selectedClient.gestiones.length === 0 ? (
                            <tr><td colSpan="4" className="text-center py-4 text-muted">No hay historial disponible</td></tr>
                          ) : selectedClient.gestiones.map(g => (
                            <tr key={g.id}>
                              <td>{new Date(g.timestamp_at).toLocaleDateString()}</td>
                              <td>{g.worker_nombre}</td>
                              <td>
                                <span className={`badge badge-${g.estado_nuevo.toLowerCase().replace(/_/g, '-')}`} style={{ fontSize: '9px' }}>
                                  {g.tipificacion}
                                </span>
                              </td>
                              <td style={{ maxWidth: '150px', whiteSpace: 'normal' }}>{g.observacion}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
