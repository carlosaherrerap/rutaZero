import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { Clock, Timer, Navigation, Save, Coffee, PlayCircle, ChevronRight, Info } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar.js';

export default function Monitoreo() {
  const { api, sedeActual } = useContext(AuthContext);
  const [data, setData] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');

  useEffect(() => {
    fetchWorkers();
  }, [api]);

  useEffect(() => {
    fetchTiempos();
  }, [api, fecha, selectedWorkerId]);

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/api/workers');
      setWorkers(res.data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTiempos = async () => {
    setLoading(true);
    try {
      let url = `/api/monitoreo/tiempos-muertos?fecha=${fecha}`;
      if (selectedWorkerId) url += `&worker_id=${selectedWorkerId}`;
      const res = await api.get(url);
      setData(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getMetricColor = (mins) => {
    if (mins > 60) return 'var(--c-danger)';
    if (mins > 30) return 'var(--c-warn)';
    return 'var(--c-success)';
  };

  return (
    <div className="dashboard-page">
      <section className="card mb-6" style={{ position: 'relative', overflow: 'hidden', padding: '32px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', background: 'var(--c-surface)' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', background: 'linear-gradient(to right, var(--c-surface), transparent)', zIndex: 2 }} />
        <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80" style={{ position: 'absolute', right: '-50px', top: '50%', transform: 'translateY(-50%)', height: '150%', opacity: 0.15, mixBlendMode: 'screen', zIndex: 1, maskImage: 'linear-gradient(to right, transparent, black 60%)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 60%)' }} alt="Background" />
        <div style={{ position: 'relative', zIndex: 3 }}>
          <h1 style={{ fontFamily: 'var(--font-main), Serimi, sans-serif', fontSize: '32px', margin: 0, color: 'var(--c-text)', letterSpacing: '-0.5px' }}>Análisis de Productividad - {sedeActual?.nombre}</h1>
          <p className="muted" style={{ marginTop: '4px' }}>Monitoreo de tiempos de transición y ejecución en campo para esta sede.</p>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', position: 'relative', zIndex: 3 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: '900', color: 'var(--c-muted)', letterSpacing: '0.5px' }}>FILTRAR POR WORKER:</span>
            <select 
              className="form-input" 
              style={{ width: '220px', height: '38px', fontSize: '12px' }}
              value={selectedWorkerId}
              onChange={e => setSelectedWorkerId(e.target.value)}
            >
              <option value="">Todos los Workers</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.nombres} {w.apellidos}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: '900', color: 'var(--c-muted)', letterSpacing: '0.5px' }}>FECHA DE ANÁLISIS:</span>
            <input 
              type="date" 
              className="form-input" 
              value={fecha} 
              onChange={e => setFecha(e.target.value)}
              style={{ width: '180px', height: '38px', fontSize: '12px' }}
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="spinner"></div>
      ) : data.length === 0 ? (
        <div className="card text-center py-10">
          <Info size={48} className="text-muted mx-auto mb-4" />
          <h3>No hay datos de monitoreo para esta fecha</h3>
          <p className="text-muted">Los workers deben registrar acciones hoy para generar métricas.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          {data.map(w => (
            <div key={w.worker_id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ 
                padding: '20px 24px', background: 'var(--c-surface-2)', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid var(--c-border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="avatar-small">
                    <img src={getAvatarUrl(w.nombres, w.worker_id)} alt="avatar" />
                  </div>
                  <h3 style={{ margin: 0, fontWeight: 900 }}>{w.worker_nombre}</h3>
                </div>
                <div style={{ display: 'flex', gap: '32px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="text-xs text-muted font-bold">INICIO A 1° VISITA (DATO 3)</div>
                    <div style={{ fontSize: '18px', fontWeight: '900', color: getMetricColor(w.metricas.dato_3) }}>
                      {w.metricas.dato_3 !== null ? `${w.metricas.dato_3} min` : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                
                {/* DATO 1: TRANSICIÓN ENTRE CLIENTES */}
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Navigation size={14}/> Transición entre Clientes (Dato 1)
                  </h4>
                  {w.metricas.dato_1.length === 0 ? (
                    <p className="text-sm text-muted italic">Sin transiciones registradas</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {w.metricas.dato_1.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--c-bg)', borderRadius: '12px', border: '1px solid var(--c-border)' }}>
                          <div style={{ flex: 1, fontSize: '11px' }}>
                            <div className="text-muted">De cliente previo a nuevo Visitar</div>
                            <div style={{ fontWeight: 'bold', color: 'var(--c-text)' }}>Transición #{i+1}</div>
                          </div>
                          <div style={{ padding: '6px 12px', borderRadius: '8px', background: getMetricColor(d.minutos) + '22', color: getMetricColor(d.minutos), fontWeight: '900', fontSize: '14px' }}>
                            {d.minutos} min
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* DATO 2: TIEMPO DE GESTIÓN (GUARDADO -> APERTURA) */}
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: '900', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Timer size={14}/> Demora en Apertura de Ficha (Dato 2)
                  </h4>
                  {w.metricas.dato_2.length === 0 ? (
                    <p className="text-sm text-muted italic">Sin datos de apertura</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {w.metricas.dato_2.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--c-bg)', borderRadius: '12px', border: '1px solid var(--c-border)' }}>
                          <div style={{ flex: 1, fontSize: '11px' }}>
                            <div className="text-muted">Tiempo desde cierre previo hasta abrir nueva ficha</div>
                            <div style={{ fontWeight: 'bold', color: 'var(--c-text)' }}>Gestión #{i+1}</div>
                          </div>
                          <div style={{ padding: '6px 12px', borderRadius: '8px', background: getMetricColor(d.minutos) + '22', color: getMetricColor(d.minutos), fontWeight: '900', fontSize: '14px' }}>
                            {d.minutos} min
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      <section className="card mt-8" style={{ padding: '24px', background: 'var(--c-surface-2)', border: '1px solid var(--c-accent)' }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--c-accent)' }}>¿Cómo leer estas métricas?</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '16px' }}>
          <div className="text-xs">
            <strong>DATO 1:</strong> Mide el tiempo que tarda el trabajador desde que guarda la ficha de un cliente hasta que marca "VISITAR" al siguiente. Ideal para medir traslados.
          </div>
          <div className="text-xs">
            <strong>DATO 2:</strong> Mide el tiempo desde que termina una gestión hasta que abre la ficha del siguiente cliente. Ideal para detectar pausas prolongadas.
          </div>
          <div className="text-xs">
            <strong>DATO 3:</strong> Tiempo transcurrido desde el "Inicio de Jornada" hasta la primera acción de "Visitar". Mide la puntualidad en el inicio de ruta.
          </div>
        </div>
      </section>
    </div>
  );
}
