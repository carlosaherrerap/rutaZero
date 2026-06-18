import React, { useEffect, useState, useContext, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { 
  Clock, Download, ChevronRight, ChevronLeft, Users, 
  CheckCircle2, PlayCircle, StopCircle, Coffee, 
  ClipboardList, Map as MapIcon, Timer 
} from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar.js';

export default function Asistencia() {
  const { api, token } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
  const [monthData, setMonthData] = useState([]);
  const [dayWorkers, setDayWorkers] = useState([]);
  const [selectedWorkerDetails, setSelectedWorkerDetails] = useState(null);

  const fetchMonthData = async (month, year) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/asistencia?mes=${month}&anio=${year}`);
      setMonthData(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchMonthData(currentDate.getMonth() + 1, currentDate.getFullYear());
  }, [currentDate]);

  useEffect(() => {
    const workers = monthData.filter(j => {
      const jDate = new Date(j.fecha).toISOString().split('T')[0];
      return jDate === selectedDay;
    });
    setDayWorkers(workers);
    setSelectedWorkerDetails(null);
  }, [selectedDay, monthData]);

  const handleMonthNav = (dir) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + dir);
    setCurrentDate(next);
  };

  const handleValidar = async (jornadaId) => {
    if (!window.confirm('¿Validar este día?')) return;
    try {
      await api.patch(`/api/asistencia/${jornadaId}/validar`);
      fetchMonthData(currentDate.getMonth() + 1, currentDate.getFullYear());
    } catch (e) { console.error(e); }
  };

  const handleDownload = () => {
    const API_BASE = api.defaults.baseURL || 'http://192.168.1.69:4000';
    window.open(`${API_BASE}/api/asistencia/export?token=${token}`, '_blank');
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    const padding = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < padding; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasActivity = monthData.some(j => new Date(j.fecha).toISOString().split('T')[0] === dateStr);
      const allValidated = hasActivity && monthData.filter(j => new Date(j.fecha).toISOString().split('T')[0] === dateStr).every(j => j.validado);
      days.push({ day: d, date: dateStr, hasActivity, allValidated });
    }
    return days;
  }, [currentDate, monthData]);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--c-text)', marginBottom: '4px', fontFamily: 'Serimi' }}>Panel de Asistencia</h1>
          <p style={{ color: 'var(--c-muted)', fontSize: '14px' }}>Control interactivo de jornadas y validación administrativa.</p>
        </div>
        <button onClick={handleDownload} className="btn btn-primary">
          <Download size={18}/> Exportar Reporte
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 380px 1fr', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* CALENDAR PANEL */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '900', color: 'var(--c-muted)', textTransform: 'uppercase' }}>Calendario</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-icon btn-sm" style={{ background: 'var(--c-surface-2)', color: 'var(--c-text)' }} onClick={() => handleMonthNav(-1)}><ChevronLeft size={16}/></button>
              <button className="btn-icon btn-sm" style={{ background: 'var(--c-surface-2)', color: 'var(--c-text)' }} onClick={() => handleMonthNav(1)}><ChevronRight size={16}/></button>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '16px', fontWeight: '800', color: 'var(--c-primary)', textTransform: 'capitalize' }}>
            {currentDate.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center' }}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <div key={i} style={{ fontSize: '10px', fontWeight: '900', color: 'var(--c-muted-2)', paddingBottom: '8px' }}>{d}</div>
            ))}
            {calendarDays.map((d, i) => (
              <div key={i} 
                onClick={() => d && setSelectedDay(d.date)}
                style={{ 
                  aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '12px',
                  cursor: d ? 'pointer' : 'default',
                  background: d?.date === selectedDay ? 'var(--c-primary)' : (d?.hasActivity ? 'var(--c-surface-2)' : 'transparent'),
                  color: d?.date === selectedDay ? 'var(--c-on-primary)' : 'var(--c-text)',
                  border: d?.date === selectedDay ? 'none' : '1px solid var(--c-border)',
                  position: 'relative', transition: 'all 0.2s'
                }}
              >
                {d && (
                  <>
                    <span style={{ fontSize: '13px', fontWeight: '700' }}>{d.day}</span>
                    {d.hasActivity && (
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: d.allValidated ? 'var(--c-success)' : 'var(--c-warn)', position: 'absolute', bottom: '6px' }} />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          {/* Leyenda */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--c-muted)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-success)' }}/>Validado
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--c-muted)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--c-warn)' }}/>Pendiente
            </div>
          </div>
        </div>

        {/* WORKERS LIST */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface-2)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '900', color: 'var(--c-text)' }}>
              Trabajadores el {new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--c-muted)', marginTop: '4px' }}>{dayWorkers.length} registros</p>
          </div>
          <div style={{ height: '550px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center' }}><div className="spinner"/></div>
            ) : dayWorkers.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--c-muted)' }}>
                <Users size={32} style={{ opacity: 0.3, marginBottom: '12px' }}/>
                <p>Sin actividad registrada.</p>
              </div>
            ) : dayWorkers.map(j => (
              <div key={j.id} onClick={() => setSelectedWorkerDetails(selectedWorkerDetails?.id === j.id ? null : j)}
                style={{ 
                  padding: '16px 20px', borderBottom: '1px solid var(--c-border)', cursor: 'pointer',
                  background: selectedWorkerDetails?.id === j.id ? 'rgba(0,169,188,0.06)' : 'transparent',
                  borderLeft: selectedWorkerDetails?.id === j.id ? '3px solid var(--c-primary)' : '3px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="avatar-small" style={{ width: '40px', height: '40px' }}>
                    <img src={getAvatarUrl(j.nombres, j.worker_id)} alt="avatar" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700' }}>{j.nombres} {j.apellidos}</div>
                    <div style={{ fontSize: '11px', color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={10}/> {j.hora_inicio_sesion ? new Date(j.hora_inicio_sesion).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      {j.validado && <span style={{ color: 'var(--c-success)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12}/> Validado</span>}
                    </div>
                  </div>
                </div>
                <ChevronRight size={16} color="var(--c-muted)" style={{ transform: selectedWorkerDetails?.id === j.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}/>
              </div>
            ))}
          </div>
        </div>

        {/* WORKER DETAIL */}
        <div>
          {selectedWorkerDetails ? (
            <div className="card" style={{ padding: '24px' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--c-border)' }}>
                <div className="avatar-small" style={{ width: '56px', height: '56px', borderRadius: '16px' }}>
                  <img src={getAvatarUrl(selectedWorkerDetails.nombres, selectedWorkerDetails.worker_id)} alt="avatar" />
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '900', margin: 0 }}>{selectedWorkerDetails.nombres} {selectedWorkerDetails.apellidos}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--c-muted)', margin: '4px 0 0' }}>
                    Jornada del {new Date(selectedWorkerDetails.fecha).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  {selectedWorkerDetails.validado ? (
                    <span style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--c-success)', fontWeight: '900', fontSize: '12px', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--c-success)', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14}/> VALIDADA</span>
                  ) : (
                    <span style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--c-warn)', fontWeight: '900', fontSize: '12px', padding: '6px 14px', borderRadius: '20px', border: '1px solid var(--c-warn)' }}>PENDIENTE</span>
                  )}
                </div>
              </div>

              {/* Métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                {[
                  { label: 'Inicio Jornada', value: selectedWorkerDetails.hora_inicio_sesion ? new Date(selectedWorkerDetails.hora_inicio_sesion).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—', color: 'var(--c-primary)', icon: <PlayCircle size={18}/> },
                  { label: 'Fin Jornada', value: selectedWorkerDetails.hora_fin_jornada ? new Date(selectedWorkerDetails.hora_fin_jornada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—', color: 'var(--c-text)', icon: <StopCircle size={18}/> },
                  { label: 'Refrigerio', value: `${selectedWorkerDetails.duracion_refrigerio_min || 0} min`, color: 'var(--c-warn)', icon: <Coffee size={18}/> },
                  { label: 'Fichas Guardadas', value: selectedWorkerDetails.clientes_gestionados || 0, color: 'var(--c-success)', icon: <ClipboardList size={18}/> },
                  { label: 'Rutas Asignadas', value: selectedWorkerDetails.rutas_asignadas || 0, color: 'var(--c-info)', icon: <MapIcon size={18}/> },
                  { label: 'Horas Trabajadas', value: selectedWorkerDetails.horas_trabajadas ? `${selectedWorkerDetails.horas_trabajadas}h` : '—', color: 'var(--c-accent)', icon: <Timer size={18}/> },
                ].map((m, i) => (
                  <div key={i} style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                    <div style={{ color: m.color, marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{m.icon}</div>
                    <div style={{ fontSize: '10px', color: 'var(--c-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{m.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Horarios Detallados */}
              <div style={{ background: 'var(--c-surface-2)', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
                <h5 style={{ fontSize: '11px', fontWeight: '900', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Horario Detallado</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Inicio de sesión', time: selectedWorkerDetails.hora_inicio_sesion },
                    { label: 'Inicio refrigerio', time: selectedWorkerDetails.hora_inicio_almuerzo },
                    { label: 'Fin refrigerio', time: selectedWorkerDetails.hora_fin_almuerzo },
                    { label: 'Cierre de jornada', time: selectedWorkerDetails.hora_fin_jornada },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                      <span style={{ color: 'var(--c-muted)' }}>{item.label}</span>
                      <b style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                        {item.time ? new Date(item.time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                      </b>
                    </div>
                  ))}
                </div>
              </div>

              {/* Acción validar */}
              {!selectedWorkerDetails.validado && (
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '12px', fontWeight: '900', fontSize: '14px' }}
                  onClick={() => handleValidar(selectedWorkerDetails.id)}
                >
                  <CheckCircle2 size={16}/> VALIDAR JORNADA
                </button>
              )}
            </div>
          ) : (
            <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--c-muted)', borderStyle: 'dashed', background: 'transparent' }}>
              <Users size={48} style={{ opacity: 0.1, marginBottom: '16px' }}/>
              <p style={{ fontSize: '14px' }}>Selecciona un trabajador para ver el detalle de su jornada.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
