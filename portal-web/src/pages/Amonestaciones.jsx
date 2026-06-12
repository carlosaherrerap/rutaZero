import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { Plus, Search, FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';

const Amonestaciones = () => {
  const { api, user } = useContext(AuthContext);
  const [amonestaciones, setAmonestaciones] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewingAmonestacion, setViewingAmonestacion] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos los estados');

  const [formData, setFormData] = useState({
    worker_id: '',
    tipo: 'TARDANZA',
    fecha: new Date().toISOString().split('T')[0],
    monto: '0.00',
    descripcion: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resAmo, resWork] = await Promise.all([
        api.get('/api/amonestaciones'),
        api.get('/api/workers')
      ]);
      setAmonestaciones(Array.isArray(resAmo.data) ? resAmo.data : []);
      setWorkers(Array.isArray(resWork.data.data) ? resWork.data.data : []);
    } catch (err) {
      console.error('Error fetching amonestaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.worker_id) return alert('Seleccione un trabajador');
      await api.post('/api/amonestaciones', {
        ...formData,
        creado_por: user.id
      });
      setShowModal(false);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const filtered = amonestaciones.filter(a => {
    const matchesSearch = a.operador?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.tipo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEstado = filterEstado === 'Todos los estados' || a.estado === filterEstado;
    return matchesSearch && matchesEstado;
  });

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner"></div></div>;

  return (
    <div className="page-fade-in">
      <div className="dashboard-hero">
        <div className="hero-left">
          <h1>Control de Amonestaciones</h1>
          <p className="muted">Gestión administrativa de sanciones. Las amonestaciones deben ser firmadas por el trabajador en su App.</p>
        </div>
        <div className="hero-right">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Nueva Amonestación
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-bar" style={{ flex: 1, minWidth: '300px' }}>
            <Search size={16} style={{ opacity: 0.5 }} />
            <input 
              type="text" 
              placeholder="Buscar por operador o motivo..." 
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
            <option>Todos los estados</option>
            <option>PENDIENTE</option>
            <option>VALIDADO</option>
          </select>
          <button className="btn btn-ghost">
            <Download size={16} />
            Exportar
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Operador</th>
                <th>Amonestación</th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Monto</th>
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
                      background: 'var(--c-surface-2)', 
                      borderRadius: '4px', 
                      fontSize: '11px', 
                      fontWeight: '700' 
                    }}>
                      {item.tipo}
                    </span>
                  </td>
                  <td>{new Date(item.fecha).toLocaleDateString()}</td>
                  <td style={{ fontSize: '12px', color: 'var(--c-muted)', maxWidth: '250px', whiteSpace: 'normal' }}>
                    {item.descripcion}
                  </td>
                  <td style={{ fontWeight: '700' }}>S/ {item.monto}</td>
                  <td>
                    <span className={`badge ${item.estado === 'VALIDADO' ? 'badge-activo' : 'badge-inactivo'}`} style={{ fontSize: '10px' }}>
                      {item.estado === 'VALIDADO' ? <CheckCircle size={10} style={{marginRight: '4px'}} /> : <AlertCircle size={10} style={{marginRight: '4px'}} />}
                      {item.estado}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => setViewingAmonestacion(item)}>Ver Ficha</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--c-muted)' }}>
                    No se encontraron amonestaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar Nueva Amonestación</h2>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Seleccionar Operador</label>
                <select 
                  className="form-input"
                  value={formData.worker_id}
                  onChange={e => setFormData({...formData, worker_id: e.target.value})}
                >
                  <option value="">Seleccione un trabajador...</option>
                  {Array.isArray(workers) && workers.map(w => (
                    <option key={w.id} value={w.id}>{w.nombres} {w.apellidos}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Falta</label>
                <select 
                  className="form-input"
                  value={formData.tipo}
                  onChange={e => setFormData({...formData, tipo: e.target.value})}
                >
                  <option>TARDANZA</option>
                  <option>FALTA DE UNIFORME</option>
                  <option>INCUMPLIMIENTO DE RUTA</option>
                  <option>OTRO</option>
                </select>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={formData.fecha}
                    onChange={e => setFormData({...formData, fecha: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Monto de Sanción (S/)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="0.00" 
                    value={formData.monto}
                    onChange={e => setFormData({...formData, monto: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Observaciones / Detalles</label>
                <textarea 
                  className="form-input" 
                  rows="3" 
                  placeholder="Describa el motivo de la amonestación..."
                  value={formData.descripcion}
                  onChange={e => setFormData({...formData, descripcion: e.target.value})}
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate}>Emitir Amonestación</button>
            </div>
          </div>
        </div>
      )}
      {viewingAmonestacion && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Detalle de Amonestación</h2>
              <button className="btn btn-sm btn-ghost" onClick={() => setViewingAmonestacion(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ fontFamily: 'monospace' }}>
              <div style={{ padding: '15px', background: 'var(--c-surface-2)', borderRadius: '8px', marginBottom: '15px' }}>
                <p><strong>Operador:</strong> {viewingAmonestacion.operador}</p>
                <p><strong>Tipo de Falta:</strong> {viewingAmonestacion.tipo}</p>
                <p><strong>Fecha:</strong> {new Date(viewingAmonestacion.fecha).toLocaleDateString()}</p>
                <p><strong>Monto Sanción:</strong> S/ {viewingAmonestacion.monto}</p>
                <p><strong>Estado:</strong> {viewingAmonestacion.estado}</p>
              </div>
              <div>
                <strong>Observaciones:</strong>
                <p style={{ marginTop: '5px', color: 'var(--c-muted)', whiteSpace: 'pre-wrap' }}>{viewingAmonestacion.descripcion}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setViewingAmonestacion(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Amonestaciones;
