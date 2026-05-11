import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { Search, Download, CheckCircle, Clock, FileText, User } from 'lucide-react';

const Permisos = () => {
  const { api, user } = useContext(AuthContext);
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Pendientes de Firma');

  useEffect(() => {
    fetchPermisos();
  }, []);

  const fetchPermisos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/permisos');
      setPermisos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching permisos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleValidar = async (id) => {
    try {
      if (!window.confirm('¿Está seguro de validar y firmar este permiso?')) return;
      await api.patch(`/api/permisos/${id}/validar`, {
        validado_por: user.id
      });
      fetchPermisos();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const filtered = permisos.filter(p => {
    const matchesSearch = p.operador?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.tipo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEstado = filterEstado === 'Todos los estados' || 
                          (filterEstado === 'Pendientes de Firma' && p.estado === 'PENDIENTE') ||
                          (filterEstado === 'VALIDADO' && p.estado === 'VALIDADO');
    return matchesSearch && matchesEstado;
  });

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner"></div></div>;

  return (
    <div className="page-fade-in">
      <div className="dashboard-hero">
        <div className="hero-left">
          <h1>Gestión de Permisos</h1>
          <p className="muted">Validación y seguimiento de solicitudes enviadas por los trabajadores desde su App.</p>
        </div>
        <div className="hero-right">
          <button className="btn btn-ghost">
            <Download size={18} />
            Reporte Mensual
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-bar" style={{ flex: 1, minWidth: '300px' }}>
            <Search size={16} style={{ opacity: 0.5 }} />
            <input 
              type="text" 
              placeholder="Buscar trabajador o motivo..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="form-input" 
            style={{ width: 'auto' }}
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
          >
            <option>Pendientes de Firma</option>
            <option>Todos los estados</option>
            <option>VALIDADO</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Operador</th>
                <th>Tipo de Permiso</th>
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody style={{ fontFamily: 'monospace' }}>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: '700', color: 'var(--c-text)' }}>{item.operador}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      background: 'rgba(59, 130, 246, 0.1)', 
                      color: 'var(--c-info)',
                      borderRadius: '4px', 
                      fontSize: '11px', 
                      fontWeight: '700' 
                    }}>
                      {item.tipo}
                    </span>
                  </td>
                  <td>{new Date(item.fecha_inicio).toLocaleDateString()}</td>
                  <td>{new Date(item.fecha_fin).toLocaleDateString()}</td>
                  <td style={{ fontSize: '12px', color: 'var(--c-muted)', maxWidth: '200px', whiteSpace: 'normal' }}>
                    {item.descripcion}
                  </td>
                  <td>
                    <span className={`badge ${item.estado === 'VALIDADO' ? 'badge-activo' : 'badge-inactivo'}`} style={{ fontSize: '10px' }}>
                      {item.estado === 'VALIDADO' ? <CheckCircle size={10} style={{marginRight: '4px'}} /> : <Clock size={10} style={{marginRight: '4px'}} />}
                      {item.estado}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {item.estado === 'PENDIENTE' ? (
                      <button 
                        className="btn btn-sm btn-primary" 
                        onClick={() => handleValidar(item.id)}
                      >
                        Validar / Firmar
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-ghost">
                        <FileText size={14} style={{marginRight: '4px'}} />
                        Ver Documento
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--c-muted)' }}>
                    No se encontraron solicitudes de permisos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Permisos;
