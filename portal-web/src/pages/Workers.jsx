import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

export default function Workers() {
  const { api } = useContext(AuthContext);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newWorker, setNewWorker] = useState({
    username: '', password: '', nombres: '', apellidos: '', dni: '', telefono: '', email: '', distrito: ''
  });

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/workers');
      setWorkers(res.data.data || []);
    } catch (e) {
      console.error('Error loading workers', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, [api]);

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/api/workers', newWorker);
      setShowModal(false);
      setNewWorker({ username: '', password: '', nombres: '', apellidos: '', dni: '', telefono: '', email: '', distrito: '' });
      fetchWorkers();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.error || e.message));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="filter-bar">
        <div className="search-bar" style={{ width: '300px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Buscar worker..." />
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowModal(true)}>
          + Agregar Worker
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>DNI / Teléfono</th>
              <th>Distrito Base</th>
              <th>Jornada Hoy</th>
              <th>Rutas Activas</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center"><div className="spinner"></div></td></tr>
            ) : workers.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-4">No se encontraron workers</td></tr>
            ) : workers.map(w => (
              <tr key={w.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="sidebar-avatar">{w.nombres[0]}</div>
                    <div>
                      <div className="font-bold">{w.nombres} {w.apellidos}</div>
                      <div className="text-sm text-muted">{w.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div>{w.dni}</div>
                  <div className="text-sm text-muted">{w.telefono}</div>
                </td>
                <td>{w.distrito || '--'}</td>
                <td>
                  {w.estado_jornada ? (
                    <span className={`badge badge-${w.estado_jornada.toLowerCase().replace(/_/g, '-')}`}>
                      {w.estado_jornada.replace(/_/g, ' ')}
                    </span>
                  ) : (
                    <span className="text-muted">Sin iniciar</span>
                  )}
                </td>
                <td>
                   <div className="font-bold">{w.rutas_activas || 0}</div>
                </td>
                <td>
                  <span className={`badge badge-${w.estado.toLowerCase()}`}>
                    {w.estado}
                  </span>
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span className="modal-title">Registrar Nuevo Worker</span>
              <button className="btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateWorker}>
              <div className="modal-body">
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input className="form-input" required value={newWorker.username} onChange={e => setNewWorker({...newWorker, username: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input className="form-input" type="password" required value={newWorker.password} onChange={e => setNewWorker({...newWorker, password: e.target.value})} />
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Nombres</label>
                    <input className="form-input" required value={newWorker.nombres} onChange={e => setNewWorker({...newWorker, nombres: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Apellidos</label>
                    <input className="form-input" required value={newWorker.apellidos} onChange={e => setNewWorker({...newWorker, apellidos: e.target.value})} />
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">DNI</label>
                    <input className="form-input" required value={newWorker.dni} onChange={e => setNewWorker({...newWorker, dni: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input className="form-input" value={newWorker.telefono} onChange={e => setNewWorker({...newWorker, telefono: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={newWorker.email} onChange={e => setNewWorker({...newWorker, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Distrito Base</label>
                  <input className="form-input" placeholder="Ej: San Juan de Lurigancho" value={newWorker.distrito} onChange={e => setNewWorker({...newWorker, distrito: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Guardando...' : 'Crear Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
