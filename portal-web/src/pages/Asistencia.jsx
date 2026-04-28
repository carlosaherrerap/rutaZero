import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { Calendar, User, CheckCircle, Clock, Download, ChevronRight, Search } from 'lucide-react';

export default function Asistencia() {
  const { api, token } = useContext(AuthContext);
  const [summary, setSummary] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSummary();
  }, [api]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/asistencia/workers-summary');
      setSummary(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSelectWorker = async (worker) => {
    setSelectedWorker(worker);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/api/asistencia?worker_id=${worker.id}`);
      setHistory(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingHistory(false); }
  };

  const handleValidar = async (jornadaId) => {
    if (!window.confirm('¿Validar este día?')) return;
    try {
      await api.patch(`/api/asistencia/${jornadaId}/validar`);
      // Refresh history
      const res = await api.get(`/api/asistencia?worker_id=${selectedWorker.id}`);
      setHistory(res.data.data || []);
      fetchSummary(); // Refresh counts in list
    } catch (e) { console.error(e); }
  };

  const handleDownload = () => {
    const API_BASE = api.defaults.baseURL || 'http://192.168.1.69:4000';
    window.open(`${API_BASE}/api/asistencia/export?token=${token}`, '_blank');
  };

  const filteredSummary = summary.filter(w => 
    `${w.nombres} ${w.apellidos}`.toLowerCase().includes(search.toLowerCase()) ||
    w.dni.includes(search)
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header with Global Download */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--c-text)', marginBottom: '4px' }}>Control de Asistencia</h1>
          <p style={{ color: 'var(--c-muted)', fontSize: '14px' }}>Monitorea y valida las jornadas laborales de tus trabajadores.</p>
        </div>
        <button 
          onClick={handleDownload}
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', borderRadius: '12px', background: 'var(--c-primary)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: '700' }}
        >
          <Download size={18}/>
          Exportar Asistencia (CSV)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedWorker ? '380px 1fr' : '1fr', gap: '32px', alignItems: 'flex-start' }}>
        
        {/* WORKER LIST PANEL */}
            <div className="card" style={{ background: 'var(--c-surface)', borderRadius: '20px', border: '1px solid var(--c-border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--c-border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-muted)' }}/>
              <input 
                type="text" 
                placeholder="Buscar trabajador..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '10px', border: '1px solid var(--c-border)', fontSize: '14px', background:'var(--c-surface-2)', color:'var(--c-text)' }}
              />
            </div>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--c-muted)' }}>Cargando trabajadores...</div>
            ) : filteredSummary.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--c-muted)' }}>No se encontraron trabajadores.</div>
            ) : filteredSummary.map(w => (
              <div 
                key={w.id} 
                onClick={() => handleSelectWorker(w)}
                style={{ 
                  padding: '20px', 
                  borderBottom: '1px solid var(--c-surface-2)', 
                  cursor: 'pointer',
                  background: selectedWorker?.id === w.id ? 'var(--c-surface-2)' : 'transparent',
                  borderLeft: selectedWorker?.id === w.id ? `4px solid var(--c-primary)` : '4px solid transparent',
                  transition: 'all var(--transition)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--c-text)' }}>{w.nombres} {w.apellidos}</div>
                  <div style={{ fontSize: '12px', color: 'var(--c-muted)', marginTop: '2px' }}>DNI: {w.dni}</div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <div title="Total asistencias" style={{ fontSize: '11px', fontWeight: '700', color: 'var(--c-muted)', background: 'var(--c-surface-2)', padding: '2px 8px', borderRadius: '6px' }}>
                      {w.total_asistencias} días
                    </div>
                    <div title="Días validados" style={{ fontSize: '11px', fontWeight: '700', color: 'var(--c-primary)', background: 'rgba(16,185,129,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                      {w.dias_validados} val.
                    </div>
                  </div>
                </div>
                {selectedWorker?.id === w.id && <ChevronRight size={18} color="var(--c-primary)" />}
              </div>
            ))}
          </div>
        </div>

        {/* WORKER DETAIL PANEL */}
        {selectedWorker ? (
          <div className="card" style={{ background: 'var(--c-surface)', borderRadius: '20px', border: '1px solid var(--c-border)', padding: '32px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--c-text)' }}>Historial de Asistencia</h2>
                <div style={{ color: 'var(--c-muted)', fontSize: '14px', marginTop: '4px' }}>Worker: <b>{selectedWorker.nombres} {selectedWorker.apellidos}</b></div>
              </div>
              <button className="btn btn-ghost" onClick={() => setSelectedWorker(null)} style={{ color: 'var(--c-danger)' }}>Cerrar Detalle</button>
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>Obteniendo registros...</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--c-muted)', background: 'var(--c-surface-2)', borderRadius: '16px', border: '2px dashed var(--c-border)' }}>
                Este trabajador aún no tiene registros de asistencia.
              </div>
            ) : (
              <div className="table-wrap" style={{ border: '1px solid var(--c-border)', borderRadius: '12px' }}>
                <table style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-surface-2)' }}>
                      <th style={{ padding: '16px' }}>Fecha</th>
                      <th>Estado</th>
                      <th>Entrada</th>
                      <th>Salida</th>
                      <th>Horas</th>
                      <th>Refrigerio</th>
                      <th>Gestiones</th>
                      <th>Validación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(j => (
                      <tr key={j.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '16px', fontWeight: '700' }}>
                          {new Date(j.fecha).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </td>
                        <td>
                          <span style={{ 
                            fontSize: '10px', fontWeight: '800', padding: '4px 10px', borderRadius: '20px',
                            background: j.estado === 'JORNADA_FINALIZADA' ? 'var(--c-success)' : 'var(--c-warn)',
                            color: 'var(--c-on-primary)',
                            display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {j.estado.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--c-muted)' }}>{j.hora_inicio_sesion?.substring(11, 16) || '—'}</td>
                        <td style={{ color: 'var(--c-muted)' }}>{j.hora_fin_jornada?.substring(11, 16) || '—'}</td>
                        <td><b style={{ color: 'var(--c-text)' }}>{j.horas_trabajadas || '0'}h</b></td>
                        <td style={{ color: 'var(--c-muted)', fontSize: '13px' }}>{j.duracion_refrigerio_min ? `${j.duracion_refrigerio_min} min` : '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: 'var(--c-surface-2)', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', color:'var(--c-muted)' }}>
                            {j.clientes_gestionados}
                          </span>
                        </td>
                        <td>
                          {j.validado ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--c-primary)', fontWeight: '800', fontSize: '13px' }}>
                              <CheckCircle size={16}/> Validado
                            </div>
                          ) : (
                            <button 
                              className="btn btn-primary btn-sm" 
                              onClick={() => handleValidar(j.id)}
                              style={{ padding: '6px 12px', background: 'var(--c-primary)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Validar Día
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '500px', background: 'var(--c-surface-2)', borderRadius: '24px', border: '2px dashed var(--c-border)', color: 'var(--c-muted)' }}>
            <User size={48} style={{ marginBottom: '16px', opacity: 0.3 }}/>
            <p style={{ fontWeight: '600' }}>Selecciona un trabajador del panel izquierdo</p>
            <p style={{ fontSize: '13px' }}>Para ver su historial detallado y validar sus asistencias.</p>
          </div>
        )}

      </div>
    </div>
  );
}
