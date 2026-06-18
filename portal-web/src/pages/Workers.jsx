import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { ChevronRight, MapPin, FileText, Calendar, User as UserIcon, X, Search as SearchIcon, WifiOff } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar.js';

export default function Workers() {
  const { api, sedeActual } = useContext(AuthContext);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drill-down state
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerRoutes, setWorkerRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeDetail, setRouteDetail] = useState(null);
  const [loadingRouteDetail, setLoadingRouteDetail] = useState(false);

  const [selectedFicha, setSelectedFicha] = useState(null);

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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchWorkers(); }, [api]);

  const navigate = useNavigate();
  const handleSelectWorker = async (w) => {
    navigate(`/workers/${w.id}`, { state: { worker: w } });
  };

  const handleSelectRoute = async (r) => {
    setSelectedRoute(r);
    setLoadingRouteDetail(true);
    setRouteDetail(null);
    setSelectedFicha(null);
    try {
      const res = await api.get(`/api/rutas/${r.id}`);
      setRouteDetail(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingRouteDetail(false); }
  };

  const handleSelectClient = async (c) => {
    setSelectedFicha(null);
    try {
      const res = await api.get(`/api/workers/clientes/${c.id}/ficha`);
      setSelectedFicha({ client: c, data: res.data.data });
    } catch (e) {
      console.log('Error fetching ficha:', e);
      alert('Este cliente aún no tiene una ficha completada para esta gestión.');
    }
  };

  const [editingWorker, setEditingWorker] = useState(null);

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/api/workers', newWorker);
      setShowModal(false);
      setNewWorker({ username: '', password: '', nombres: '', apellidos: '', dni: '', telefono: '', email: '', distrito: '' });
      fetchWorkers();
    } catch (e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    finally { setCreating(false); }
  };

  const handleEditWorker = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.patch(`/api/workers/${editingWorker.id}`, editingWorker);
      setEditingWorker(null);
      fetchWorkers();
    } catch (e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    finally { setCreating(false); }
  };

  const getActionInfo = (accion) => {
    switch (accion) {
      case 'JORNADA_INICIADA': return { color: '#10b981', label: 'INICIÓ DÍA', icon: '' };
      case 'ALMUERZO_INICIADO': return { color: '#f59e0b', label: 'INICIÓ RECESO', icon: '' };
      case 'ALMUERZO_FINALIZADO': return { color: '#10b981', label: 'FIN RECESO', icon: '' };
      case 'FICHA_DETALLE_ABIERTA': return { color: '#3b82f6', label: 'VIO DETALLE', icon: '' };
      case 'VISITAR_PRESIONADO': return { color: '#a855f7', label: 'EN CAMINO', icon: '' };
      case 'FICHA_ABIERTA': return { color: '#6366f1', label: 'ABRIÓ FICHA', icon: '' };
      case 'FICHA_GUARDADA': return { color: '#059669', label: 'GESTIÓN LISTA', icon: '' };
      case 'JORNADA_FINALIZADA': return { color: '#ef4444', label: 'FINALIZÓ DÍA', icon: '' };
      default: return { color: '#94a3b8', label: accion, icon: '' };
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', transition: 'all 0.3s' }}>
      
      {/* MAIN TABLE */}
      <div>
        <div style={{ marginBottom: '24px' }}>
          <h1 className="text-2xl font-bold">Gestión de Workers - {sedeActual?.nombre || 'General'}</h1>
          <p className="text-muted">Visualiza el estado de tus trabajadores en campo y su productividad en esta sede.</p>
        </div>

        <div className="filter-bar" style={{ gap: '32px' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '300px' }}>
            <SearchIcon size={16} color="var(--c-muted)"/>
            <input type="text" placeholder="Buscar worker..." />
          </div>
          <button className="btn btn-primary" style={{ padding: '12px 24px' }} onClick={() => setShowModal(true)}>
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
                <th>Estado Jornada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center"><div className="spinner"></div></td></tr>
              ) : workers.map(w => (
                <tr key={w.id} 
                  onClick={() => handleSelectWorker(w)} 
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="avatar-small" style={{ width: '48px', height: '48px' }}>
                        <img src={getAvatarUrl(w.nombres, w.id)} alt="avatar" />
                      </div>
                      <div>
                        <div className="font-bold" style={{ fontSize: '15px' }}>{w.nombres} {w.apellidos}</div>
                        <div className="text-sm text-muted">{w.email || 'Sin correo registrado'}</div>
                      </div>
                    </div>
                  </td>
                  <td>{w.dni} <br/> <small className="text-muted">{w.telefono}</small></td>
                  <td>{w.distrito || '--'}</td>
                  <td>
                    <span className={`badge badge-${(w.estado_jornada || 'off').toLowerCase().replace(/_/g, '-')}`}>
                      {w.estado_jornada || 'SIN INICIAR'}
                    </span>
                  </td>
                  <td className="table-col-final">
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditingWorker(w); }}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDITAR / CREAR (Same as before but cleaned up) */}
      {editingWorker && (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(5px)' }}>
          <div className="modal" style={{ maxWidth: '600px', width: '95vw', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: '24px', overflow: 'hidden' }}>
            <div className="p-10 flex justify-between items-center" style={{ padding: '32px 40px 20px', borderBottom: '1px solid var(--c-border)' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--c-text)', margin: 0 }}>Editar Worker</h2>
                <div style={{ color: 'var(--c-primary)', fontSize: '12px', fontWeight: '800', marginTop: '4px' }}>@{editingWorker.username}</div>
              </div>
              <button 
                className="btn-icon" 
                style={{ background: 'var(--c-surface-2)', borderRadius: '50%', padding: '8px' }}
                onClick={() => setEditingWorker(null)}
              ><X size={20} /></button>
            </div>
            <form onSubmit={handleEditWorker}>
              <div className="modal-body" style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Estado de Cuenta</label>
                  <select className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.estado} onChange={e => setEditingWorker({...editingWorker, estado: e.target.value})}>
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Nombres</label>
                    <input className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.nombres} onChange={e => setEditingWorker({...editingWorker, nombres: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '900' }}>Apellidos</label>
                    <input className="form-input" style={{ background: 'var(--c-surface)' }} value={editingWorker.apellidos} onChange={e => setEditingWorker({...editingWorker, apellidos: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '24px 40px', background: 'var(--c-surface-2)', borderTop: '1px solid var(--c-border)', display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditingWorker(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: '12px' }} disabled={creating}>{creating ? 'Guardando...' : 'Actualizar Worker'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span className="modal-title">Registrar Nuevo Worker</span>
              <button className="btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateWorker}>
              <div className="modal-body">
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Username</label><input className="form-input" required value={newWorker.username} onChange={e => setNewWorker({...newWorker, username: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" required value={newWorker.password} onChange={e => setNewWorker({...newWorker, password: e.target.value})} /></div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Nombres</label><input className="form-input" required value={newWorker.nombres} onChange={e => setNewWorker({...newWorker, nombres: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Apellidos</label><input className="form-input" required value={newWorker.apellidos} onChange={e => setNewWorker({...newWorker, apellidos: e.target.value})} /></div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">DNI</label><input className="form-input" required value={newWorker.dni} onChange={e => setNewWorker({...newWorker, dni: e.target.value})} /></div>
                  <div className="form-group"><label className="form-label">Teléfono</label><input className="form-input" value={newWorker.telefono} onChange={e => setNewWorker({...newWorker, telefono: e.target.value})} /></div>
                </div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={newWorker.email} onChange={e => setNewWorker({...newWorker, email: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Distrito Base</label><input className="form-input" value={newWorker.distrito} onChange={e => setNewWorker({...newWorker, distrito: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Guardando...' : 'Crear Worker'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
