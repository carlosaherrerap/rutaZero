import React, { useEffect, useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function fmtHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuracion(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function WorkerBadge({ nombre }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--c-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
        {nombre?.[0]?.toUpperCase()}
      </div>
      <span className="font-bold">{nombre}</span>
    </div>
  );
}

export default function Asistencia() {
  const { api } = useContext(AuthContext);
  const today = new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [anio, setAnio] = useState(today.getFullYear());
  const [jornadas, setJornadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(null); // jornadaId en validación

  useEffect(() => { fetchAsistencia(); }, [mes, anio]);

  const fetchAsistencia = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/asistencia?mes=${mes}&anio=${anio}`);
      setJornadas(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleValidar = async (jornadaId) => {
    if (!window.confirm('¿Validar este día como trabajado? El worker verá el día en verde en su calendario.')) return;
    setValidating(jornadaId);
    try {
      await api.patch(`/api/asistencia/${jornadaId}/validar`);
      setJornadas(prev => prev.map(j => j.id === jornadaId ? { ...j, validado: true } : j));
    } catch (e) {
      alert('Error al validar la jornada');
    } finally { setValidating(null); }
  };

  const prevMonth = () => {
    if (mes === 1) { setMes(12); setAnio(a => a - 1); }
    else setMes(m => m - 1);
  };
  const nextMonth = () => {
    if (mes === 12) { setMes(1); setAnio(a => a + 1); }
    else setMes(m => m + 1);
  };

  // Agrupar por worker
  const byWorker = jornadas.reduce((acc, j) => {
    const key = j.worker_id;
    if (!acc[key]) acc[key] = { nombre: `${j.nombres} ${j.apellidos}`, dias: [] };
    acc[key].dias.push(j);
    return acc;
  }, {});

  const totalValidados = jornadas.filter(j => j.validado).length;
  const totalFinalizados = jornadas.filter(j => j.estado === 'JORNADA_FINALIZADA').length;

  return (
    <div>
      {/* STATS */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-label">Registros del mes</span>
          <span className="stat-value">{jornadas.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Días Finalizados</span>
          <span className="stat-value" style={{ color: 'var(--c-primary)' }}>{totalFinalizados}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Días Validados</span>
          <span className="stat-value" style={{ color: '#10b981' }}>{totalValidados}</span>
        </div>
      </div>

      {/* NAVEGACIÓN MES */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="btn btn-ghost" onClick={prevMonth}>← Anterior</button>
        <h3 style={{ flex: 1, textAlign: 'center', margin: 0 }}>{MESES[mes - 1]} {anio}</h3>
        <button className="btn btn-ghost" onClick={nextMonth}>Siguiente →</button>
      </div>

      {/* TABLA */}
      {loading ? (
        <div className="text-center" style={{ padding: 40 }}><div className="spinner"></div></div>
      ) : jornadas.length === 0 ? (
        <div className="card text-center" style={{ padding: 40, color: 'var(--c-text-muted)' }}>
          📅 No hay registros de asistencia para {MESES[mes - 1]} {anio}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Fecha</th>
                <th>Entrada</th>
                <th>Ini. Receso</th>
                <th>Fin Receso</th>
                <th>Salida</th>
                <th>Receso</th>
                <th>Horas Trab.</th>
                <th>Gestionados</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {jornadas.map(j => (
                <tr key={j.id} style={{ background: j.validado ? 'rgba(16,185,129,0.06)' : 'transparent' }}>
                  <td><WorkerBadge nombre={`${j.nombres} ${j.apellidos}`} /></td>
                  <td>{new Date(j.fecha).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td>{fmtHora(j.hora_inicio_sesion)}</td>
                  <td>{fmtHora(j.hora_inicio_almuerzo)}</td>
                  <td>{fmtHora(j.hora_fin_almuerzo)}</td>
                  <td>{fmtHora(j.hora_fin_jornada)}</td>
                  <td>{fmtDuracion(j.duracion_refrigerio_min)}</td>
                  <td>
                    <span style={{ fontWeight: 800, color: j.horas_trabajadas >= 8 ? '#10b981' : '#f59e0b' }}>
                      {j.horas_trabajadas ? `${j.horas_trabajadas}h` : '—'}
                    </span>
                  </td>
                  <td>{j.clientes_gestionados}</td>
                  <td>
                    {j.validado ? (
                      <span className="badge" style={{ background: '#d1fae5', color: '#065f46', fontWeight: 800, fontSize: 10 }}>
                        ✅ VALIDADO
                      </span>
                    ) : j.estado === 'JORNADA_FINALIZADA' ? (
                      <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8', fontWeight: 800, fontSize: 10 }}>
                        FINALIZADO
                      </span>
                    ) : (
                      <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', fontSize: 10 }}>
                        {j.estado?.replace('_', ' ') || 'EN CURSO'}
                      </span>
                    )}
                  </td>
                  <td>
                    {!j.validado && j.estado === 'JORNADA_FINALIZADA' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleValidar(j.id)}
                        disabled={validating === j.id}
                        style={{ fontSize: 11, padding: '5px 12px' }}
                      >
                        {validating === j.id ? '...' : '✓ DATE'}
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
  );
}
