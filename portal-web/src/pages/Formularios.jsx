import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { ClipboardList, Filter, CheckCircle2, AlertCircle, Plus, Users } from 'lucide-react';

export default function Formularios() {
  const { api } = useContext(AuthContext);
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlantilla, setSelectedPlantilla] = useState(null);
  const [filtros, setFiltros] = useState({
    dias_atraso_min: 0,
    dias_atraso_max: 999,
    distritos: []
  });
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetchPlantillas();
  }, [api]);

  const fetchPlantillas = async () => {
    try {
      const res = await api.get('/api/formularios/plantillas');
      setPlantillas(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAsignar = async () => {
    if (!selectedPlantilla) return alert('Seleccione una plantilla');
    try {
      const res = await api.post('/api/formularios/asignar', {
        plantilla_id: selectedPlantilla.id,
        filtros
      });
      setMsg({ type: 'success', text: res.data.message });
      setTimeout(() => setMsg(null), 5000);
    } catch (e) {
      setMsg({ type: 'error', text: 'Error al asignar: ' + e.message });
    }
  };

  if (loading) return <div className="spinner"></div>;

  return (
    <div className="dashboard-page">
      <section className="card mb-6" style={{ padding: '24px' }}>
        <h1 style={{ fontFamily: 'Serimi, sans-serif', fontSize: '32px', margin: 0 }}>Gestión de Formularios Dinámicos</h1>
        <p className="muted">Crea plantillas y asígnalas a segmentos de clientes específicos.</p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* LISTA DE PLANTILLAS */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">Plantillas Disponibles</h3>
            <button className="btn btn-primary btn-sm"><Plus size={14}/> Nueva Plantilla</button>
          </div>
          <div style={{ padding: '16px' }}>
            {plantillas.map(p => (
              <div 
                key={p.id} 
                onClick={() => setSelectedPlantilla(p)}
                style={{
                  padding: '16px', borderRadius: '16px', border: '1px solid var(--c-border)',
                  marginBottom: '12px', cursor: 'pointer',
                  background: selectedPlantilla?.id === p.id ? 'var(--c-primary-soft)' : 'var(--c-surface)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ClipboardList size={16} color="var(--c-primary)"/> {p.nombre}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                  {p.requiere_firma ? '✓ Requiere Firma' : '× Sin Firma'} • {(p.campos ? (typeof p.campos === 'string' ? JSON.parse(p.campos) : p.campos).length : 0)} campos definidos
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ASIGNACIÓN MASIVA */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Asignación Masiva por Filtros</h3>
          </div>
          <div style={{ padding: '24px' }}>
            {msg && (
              <div style={{ 
                padding: '12px', borderRadius: '12px', marginBottom: '20px',
                background: msg.type === 'success' ? 'var(--c-success-soft)' : 'var(--c-danger-soft)',
                color: msg.type === 'success' ? 'var(--c-success)' : 'var(--c-danger)',
                display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '13px'
              }}>
                {msg.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
                {msg.text}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '900', marginBottom: '8px' }}>RANGO DE ATRASO (DÍAS)</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="number" className="form-input" placeholder="Min" 
                  value={filtros.dias_atraso_min} 
                  onChange={e => setFiltros({...filtros, dias_atraso_min: parseInt(e.target.value)})}
                />
                <span>a</span>
                <input 
                  type="number" className="form-input" placeholder="Max" 
                  value={filtros.dias_atraso_max}
                  onChange={e => setFiltros({...filtros, dias_atraso_max: parseInt(e.target.value)})}
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '900', marginBottom: '8px' }}>DISTRITOS (Opcional)</label>
              <select 
                multiple className="form-input" style={{ height: '100px' }}
                onChange={e => setFiltros({...filtros, distritos: Array.from(e.target.selectedOptions, option => option.value)})}
              >
                {['LIMA','SANTIAGO DE SURCO','SAN BORJA','MIRAFLORES','LA MOLINA','SAN ISIDRO','PUENTE PIEDRA','CARABAYLLO'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <p className="text-xs text-muted" style={{ marginTop: '4px' }}>Ctrl + Click para seleccionar múltiples</p>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '14px', borderRadius: '16px', fontWeight: '900' }}
              disabled={!selectedPlantilla}
              onClick={handleAsignar}
            >
              <Users size={18}/> ASIGNAR A CLIENTES FILTRADOS
            </button>
            {!selectedPlantilla && <p className="text-center text-xs text-danger mt-2">Debe seleccionar una plantilla a la izquierda</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
