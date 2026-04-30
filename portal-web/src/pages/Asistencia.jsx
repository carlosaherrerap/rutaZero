import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { Calendar, User, CheckCircle, Clock, Download, ChevronRight, ChevronLeft, Search } from 'lucide-react';

export default function Asistencia() {
  const { api, token } = useContext(AuthContext);
  const [summary, setSummary] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

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

  const handleSelectWorker = async (worker, month = currentMonth, year = currentYear) => {
    setSelectedWorker(worker);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/api/asistencia?worker_id=${worker.id}&mes=${month}&anio=${year}`);
      setHistory(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingHistory(false); }
  };

  const handleMonthChange = (e) => {
    const val = parseInt(e.target.value);
    setCurrentMonth(val);
    if (selectedWorker) handleSelectWorker(selectedWorker, val, currentYear);
  };

  const handleValidar = async (jornadaId) => {
    if (!window.confirm('¿Validar este día?')) return;
    try {
      await api.patch(`/api/asistencia/${jornadaId}/validar`);
      // Refresh history
      const res = await api.get(`/api/asistencia?worker_id=${selectedWorker.id}&mes=${currentMonth}&anio=${currentYear}`);
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <button className="btn btn-ghost" onClick={() => setSelectedWorker(null)} style={{ color: 'var(--c-danger)', alignSelf: 'flex-end' }}>Cerrar Detalle</button>
                
                {/* MONTH NAVIGATION */}
                <div style={{ backgroundColor: 'var(--c-surface-2)', padding: '16px', borderRadius: '15px', border: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button 
                    className="btn-icon" 
                    onClick={() => {
                      const newMonth = currentMonth === 1 ? 12 : currentMonth - 1;
                      const newYear = currentMonth === 1 ? currentYear - 1 : currentYear;
                      setCurrentMonth(newMonth);
                      setCurrentYear(newYear);
                      if (selectedWorker) handleSelectWorker(selectedWorker, newMonth, newYear);
                    }}
                  >
                    <ChevronLeft size={20}/>
                  </button>
                  
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--c-text)', textTransform: 'uppercase' }}>
                      {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][currentMonth - 1]} {currentYear}
                    </span>
                  </div>

                  <button 
                    className="btn-icon" 
                    onClick={() => {
                      const newMonth = currentMonth === 12 ? 1 : currentMonth + 1;
                      const newYear = currentMonth === 12 ? currentYear + 1 : currentYear;
                      setCurrentMonth(newMonth);
                      setCurrentYear(newYear);
                      if (selectedWorker) handleSelectWorker(selectedWorker, newMonth, newYear);
                    }}
                  >
                    <ChevronRight size={20}/>
                  </button>
                </div>
              </div>
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>Obteniendo registros...</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--c-muted)', background: 'var(--c-surface-2)', borderRadius: '16px', border: '2px dashed var(--c-border)' }}>
                Este trabajador aún no tiene registros en este mes.
              </div>
            ) : (
              <div className="table-container" style={{ 
                border: '1px solid var(--c-border)', 
                borderRadius: '16px', 
                overflowX: 'auto', 
                background: 'var(--c-surface)',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)'
              }}>
                <table style={{ borderCollapse: 'collapse', minWidth: '1000px', width: '100%' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-surface-2)' }}>
                      <th style={{ padding: '20px 16px', textAlign: 'left', color: 'var(--c-muted)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Día / Fecha</th>
                      <th style={{ textAlign: 'left', color: 'var(--c-muted)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Estado</th>
                      <th style={{ textAlign: 'left', color: 'var(--c-muted)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Entrada</th>
                      <th style={{ textAlign: 'left', color: 'var(--c-muted)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Salida</th>
                      <th style={{ textAlign: 'left', color: 'var(--c-muted)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Horas Efec.</th>
                      <th style={{ textAlign: 'left', color: 'var(--c-muted)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Refrigerio</th>
                      <th style={{ textAlign: 'center', color: 'var(--c-muted)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Gestiones</th>
                      <th style={{ textAlign: 'right', paddingRight: '24px', color: 'var(--c-muted)', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(j => (
                      <tr key={j.id} style={{ borderBottom: '1px solid var(--c-border)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '24px 16px' }}>
                          <div style={{ fontWeight: '900', color: 'var(--c-primary)', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {new Date(j.fecha).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric' }).replace(',', '').toUpperCase()}
                          </div>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span className={`badge badge-${j.estado.toLowerCase().replace(/_/g, '-')}`} style={{ fontSize: '10px' }}>
                            {j.estado.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--c-text)', fontWeight: '600', padding: '8px' }}>
                          {j.hora_inicio_sesion ? new Date(j.hora_inicio_sesion).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                        </td>
                        <td style={{ color: 'var(--c-text)', fontWeight: '600', padding: '8px' }}>
                          {j.hora_fin_jornada ? new Date(j.hora_fin_jornada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                        </td>
                        <td style={{ padding: '8px' }}><b style={{ color: 'var(--c-info)', fontSize: '15px' }}>{j.horas_trabajadas || '0'}h</b></td>
                        <td style={{ color: 'var(--c-muted)', fontSize: '13px', padding: '8px' }}>{j.duracion_refrigerio_min ? `${j.duracion_refrigerio_min} min` : '—'}</td>
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <div style={{ background: 'var(--c-surface-2)', display: 'inline-flex', padding: '6px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', color:'var(--c-text)', border: '1px solid var(--c-border)' }}>
                            {j.clientes_gestionados || 0}
                          </div>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', paddingRight: '24px' }}>
                          {j.validado ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', color: 'var(--c-success)', fontWeight: '900', fontSize: '12px' }}>
                              <CheckCircle size={16}/> VALIDADO
                            </div>
                          ) : (
                            <button 
                              className="btn btn-primary btn-sm" 
                              onClick={() => handleValidar(j.id)}
                            >
                              VALIDAR
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
