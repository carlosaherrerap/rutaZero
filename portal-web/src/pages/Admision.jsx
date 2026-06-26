import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';


export default function Admision() {
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [dniSearch, setDniSearch] = useState('');
  const [loadingEval, setLoadingEval] = useState(false);
  const [evalResult, setEvalResult] = useState(null);
  const [selectedClientInfo, setSelectedClientInfo] = useState(null);
  const [approvalData, setApprovalData] = useState({ condicion: 'APTO', lineaCredito: 'Préstamo MYPE', apePat: '', apeMat: '', nombre: '', dni: '' });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedClientInfo(null);
        setShowEvalModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Datos mock de evaluaciones recientes en campo
  const [evaluaciones] = useState([
    { id: 1, dni: '74839201', ape_pat: 'Quispe', ape_mat: 'Huaman', nombres: 'Luis Alberto', producto: 'Préstamo Personal', linea: 'S/ 5,000', estado: 'APTO', fecha: '19/06/2026 10:00' },
    { id: 2, dni: '45321098', ape_pat: 'Garcia', ape_mat: 'Perez', nombres: 'Maria Elena', producto: 'Tarjeta de Crédito', linea: 'S/ 2,500', estado: 'NO APTO', fecha: '19/06/2026 09:30' },
    { id: 3, dni: '09341234', ape_pat: 'Mamani', ape_mat: 'Condori', nombres: 'Jose Carlos', producto: 'Préstamo Vehicular', linea: 'S/ 25,000', estado: 'APTO', fecha: '18/06/2026 16:15' },
    { id: 4, dni: '72345678', ape_pat: 'Flores', ape_mat: 'Romero', nombres: 'Ana Sofia', producto: 'Préstamo Personal', linea: 'S/ 10,000', estado: 'APTO', fecha: '18/06/2026 15:20' },
    { id: 5, dni: '40123456', ape_pat: 'Salazar', ape_mat: 'Vargas', nombres: 'Carlos', producto: 'Tarjeta de Crédito', linea: 'S/ 1,000', estado: 'NO APTO', fecha: '17/06/2026 11:10' }
  ]);

  const handleBuscarSBS = () => {
    if (!dniSearch || dniSearch.length < 8) return;
    setLoadingEval(true);
    setEvalResult(null);

    // Simular tiempo de consulta a la SBS
    setTimeout(() => {
      setEvalResult({
        nombre: 'JUAN PEREZ GONZALES',
        dni: dniSearch,
        fechaConsulta: new Date().toLocaleString('es-PE'),
        periodo: 'Diciembre-2025',
        rating: {
          normal: 0,
          problemas: 0,
          deficiente: 0,
          dudoso: 0,
          perdida: 100
        },
        deudas: [
          { entidad: 'BANCO FALABELLA', calificacion: '4: Perdida', capital: 100, intereses: 31, total: 130 },
          { entidad: 'BBVA', calificacion: '4: Perdida', capital: 64, intereses: 30, total: 94 }
        ],
        lineas: [
          { entidad: 'BANCO FALABELLA', tipo: 'Líneas de crédito en tarjetas de crédito de consumo', total: 100 }
        ]
      });
      setLoadingEval(false);
    }, 2000);
  };

  return (
    <div className="page fade-in" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--c-text)' }}>Evaluaciones y Admisión</h1>
          <p style={{ color: 'var(--c-muted)', fontSize: '14px', marginTop: '4px' }}>Visualiza las evaluaciones de campo y realiza consultas manuales en la SBS.</p>
        </div>
        <button 
          onClick={() => { setShowEvalModal(true); setEvalResult(null); setDniSearch(''); }}
          style={{
            backgroundColor: 'var(--c-primary)', color: 'white', border: 'none', padding: '10px 20px', 
            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 4px 10px rgba(66, 99, 235, 0.3)'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14"/></svg>
          Evaluar Manualmente
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '12px', padding: '15px', border: '1px solid var(--c-border)', height: '180px' }}>
          <h3 style={{ fontSize: '13px', margin: '0 0 10px 0', color: 'var(--c-muted)', textTransform: 'uppercase', fontWeight: '800' }}>Tasa de Aprobación</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={[
                { name: 'APTO', value: evaluaciones.filter(e => e.estado === 'APTO').length },
                { name: 'NO APTO', value: evaluaciones.filter(e => e.estado === 'NO APTO').length }
              ]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={2}>
                <Cell fill="var(--c-success)" />
                <Cell fill="var(--c-danger)" />
              </Pie>
              <RechartsTooltip contentStyle={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)', fontSize: '12px', borderRadius: '8px' }} itemStyle={{ color: 'var(--c-text)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '12px', padding: '15px', border: '1px solid var(--c-border)', height: '180px' }}>
          <h3 style={{ fontSize: '13px', margin: '0 0 10px 0', color: 'var(--c-muted)', textTransform: 'uppercase', fontWeight: '800' }}>Evaluaciones por Producto</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              { name: 'Personal', val: evaluaciones.filter(e => e.producto.includes('Personal')).length },
              { name: 'Vehicular', val: evaluaciones.filter(e => e.producto.includes('Vehicular')).length },
              { name: 'Tarjeta', val: evaluaciones.filter(e => e.producto.includes('Tarjeta')).length }
            ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--c-muted)' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--c-muted)' }} />
              <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)', fontSize: '12px', borderRadius: '8px' }} />
              <Bar dataKey="val" fill="var(--c-primary)" radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '12px', padding: '15px', border: '1px solid var(--c-border)', height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h3 style={{ fontSize: '13px', margin: '0 0 5px 0', color: 'var(--c-muted)', textTransform: 'uppercase', fontWeight: '800', width: '100%' }}>Total Evaluados Hoy</h3>
          <div style={{ fontSize: '48px', fontWeight: '900', color: 'var(--c-text)', lineHeight: '1' }}>{evaluaciones.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--c-muted)', marginTop: '5px' }}>Clientes procesados</div>
          <div style={{ fontSize: '11px', color: 'var(--c-success)', marginTop: '5px', fontWeight: 'bold' }}>+12% respecto a ayer</div>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--c-surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--c-border)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--c-border)', color: 'var(--c-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px', fontWeight: 'bold' }}>DNI</th>
              <th style={{ padding: '12px', fontWeight: 'bold' }}>Ape. Paterno</th>
              <th style={{ padding: '12px', fontWeight: 'bold' }}>Ape. Materno</th>
              <th style={{ padding: '12px', fontWeight: 'bold' }}>Nombres</th>
              <th style={{ padding: '12px', fontWeight: 'bold' }}>Producto</th>
              <th style={{ padding: '12px', fontWeight: 'bold' }}>Línea Crédito</th>
              <th style={{ padding: '12px', fontWeight: 'bold' }}>Estado</th>
              <th style={{ padding: '12px', fontWeight: 'bold' }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {evaluaciones.map((ev) => (
              <tr 
                key={ev.id} 
                onClick={() => setSelectedClientInfo(ev)}
                style={{ cursor: 'pointer', borderBottom: '1px solid var(--c-border)', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--c-text)' }}>{ev.dni}</td>
                <td style={{ padding: '12px', color: 'var(--c-text)' }}>{ev.ape_pat}</td>
                <td style={{ padding: '12px', color: 'var(--c-text)' }}>{ev.ape_mat}</td>
                <td style={{ padding: '12px', color: 'var(--c-text)' }}>{ev.nombres}</td>
                <td style={{ padding: '12px', color: 'var(--c-text)' }}>{ev.producto}</td>
                <td style={{ padding: '12px', color: 'var(--c-text)', fontWeight: 'bold' }}>{ev.linea}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    backgroundColor: ev.estado === 'APTO' ? 'rgba(12, 166, 120, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: ev.estado === 'APTO' ? '#0CA678' : '#EF4444',
                    padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'
                  }}>
                    {ev.estado}
                  </span>
                </td>
                <td style={{ padding: '12px', color: 'var(--c-muted)', fontSize: '13px' }}>{ev.fecha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Evaluación Manual */}
      {showEvalModal && (
        <div 
          onClick={() => setShowEvalModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--c-surface)', borderRadius: '12px', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: '1px solid var(--c-border)'
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--c-surface-2)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--c-text)', margin: 0 }}>Consulta de Calificación Crediticia (SBS)</h2>
              <button 
                onClick={() => setShowEvalModal(false)} 
                style={{ 
                  background: 'var(--c-surface)', 
                  border: '1px solid var(--c-border)', 
                  cursor: 'pointer', 
                  color: 'var(--c-text)', 
                  padding: '8px 16px', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontWeight: 'bold', 
                  fontSize: '13px',
                  transition: 'all 0.2s' 
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-surface)'}
              >
                Cerrar
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              {/* Buscador */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
                <input 
                  type="text" 
                  placeholder="Ingrese DNI del cliente..." 
                  value={dniSearch}
                  onChange={e => setDniSearch(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={8}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--c-border)', backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', fontSize: '16px', outline: 'none' }}
                />
                <button 
                  onClick={handleBuscarSBS}
                  disabled={loadingEval || dniSearch.length < 8}
                  style={{
                    backgroundColor: '#0CA678', color: 'white', border: 'none', padding: '0 24px', borderRadius: '8px', 
                    fontWeight: 'bold', cursor: (loadingEval || dniSearch.length < 8) ? 'not-allowed' : 'pointer', fontSize: '16px',
                    opacity: (loadingEval || dniSearch.length < 8) ? 0.6 : 1
                  }}
                >
                  {loadingEval ? 'Consultando...' : 'Buscar en SBS'}
                </button>
              </div>

              {/* Loading State */}
              {loadingEval && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTopColor: '#0CA678', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#64748B', marginTop: '16px', fontWeight: '500' }}>Conectando con la Superintendencia de Banca, Seguros y AFP...</p>
                  <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Resultados */}
              {evalResult && !loadingEval && (
                <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Bloque 1: Calificación Crediticia */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
                          <div style={{ border: '1px solid var(--c-border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', padding: '10px 16px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid var(--c-border)' }}>
                        Calificación crediticia
                      </div>
                      <div style={{ display: 'flex', width: '100%' }}>
                        <div style={{ flex: 1, backgroundColor: '#10B981', color: 'white', padding: '8px', fontSize: '12px', fontWeight: '600' }}>Normal</div>
                        <div style={{ flex: 1, backgroundColor: '#84CC16', color: 'white', padding: '8px', fontSize: '12px', fontWeight: '600' }}>Problemas Potenciales</div>
                        <div style={{ flex: 1, backgroundColor: '#EAB308', color: 'white', padding: '8px', fontSize: '12px', fontWeight: '600' }}>Deficiente</div>
                        <div style={{ flex: 1, backgroundColor: '#F97316', color: 'white', padding: '8px', fontSize: '12px', fontWeight: '600' }}>Dudoso</div>
                        <div style={{ flex: 1, backgroundColor: '#DC2626', color: 'white', padding: '8px', fontSize: '12px', fontWeight: '600' }}>Pérdida</div>
                      </div>
                      <div style={{ display: 'flex', width: '100%', padding: '12px 0', borderBottom: '1px solid var(--c-border)' }}>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#10B981' }}>● {evalResult.rating.normal}%</div>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#84CC16' }}>● {evalResult.rating.problemas}%</div>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#EAB308' }}>● {evalResult.rating.deficiente}%</div>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#F97316' }}>● {evalResult.rating.dudoso}%</div>
                        <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 'bold', color: '#DC2626' }}>● {evalResult.rating.perdida}%</div>
                      </div>
                      <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--c-muted)' }}>
                        Cifras redondeadas. No se muestra información menor a 0.5%
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', border: '1px solid var(--c-border)', borderRadius: '4px' }}>
                        <div style={{ padding: '10px 12px', backgroundColor: 'var(--c-surface-2)', width: '130px', borderRight: '1px solid var(--c-border)', fontSize: '13px', fontWeight: '600', color: 'var(--c-muted)' }}>Fecha de Consulta</div>
                        <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-text)', fontWeight: '500', flex: 1 }}>{evalResult.fechaConsulta}</div>
                      </div>
                      <div style={{ display: 'flex', border: '1px solid var(--c-border)', borderRadius: '4px' }}>
                        <div style={{ padding: '10px 12px', backgroundColor: 'var(--c-surface-2)', width: '130px', borderRight: '1px solid var(--c-border)', fontSize: '13px', fontWeight: '600', color: 'var(--c-muted)' }}>Período Reportado</div>
                        <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--c-text)', fontWeight: '500', flex: 1 }}>{evalResult.periodo}</div>
                      </div>
                    </div>
                  </div>

                  {/* Bloque 2: Tablas de Deuda y Líneas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    
                    {/* Detalle de deuda */}
                    <div>
                      <div style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', padding: '10px 16px', fontWeight: 'bold', fontSize: '14px', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', border: '1px solid var(--c-border)', borderBottom: 'none' }}>
                        Detalle de deuda
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--c-border)' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)' }}>
                            <th style={{ padding: '10px', fontSize: '12px', textAlign: 'left', color: 'var(--c-muted)', fontWeight: '600' }}>No.</th>
                            <th style={{ padding: '10px', fontSize: '12px', textAlign: 'left', color: 'var(--c-muted)', fontWeight: '600' }}>Entidad Informante</th>
                            <th style={{ padding: '10px', fontSize: '12px', textAlign: 'left', color: 'var(--c-muted)', fontWeight: '600' }}>Calificación</th>
                            <th style={{ padding: '10px', fontSize: '12px', textAlign: 'right', color: 'var(--c-muted)', fontWeight: '600' }}>Capital</th>
                            <th style={{ padding: '10px', fontSize: '12px', textAlign: 'right', color: 'var(--c-muted)', fontWeight: '600' }}>Intereses</th>
                            <th style={{ padding: '10px', fontSize: '12px', textAlign: 'right', color: 'var(--c-muted)', fontWeight: '600' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evalResult.deudas.map((d, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--c-border)' }}>
                              <td style={{ padding: '10px', fontSize: '12px', color: 'var(--c-text)' }}>{i + 1}</td>
                              <td style={{ padding: '10px', fontSize: '12px', color: 'var(--c-text)', fontWeight: '600' }}>{d.entidad}</td>
                              <td style={{ padding: '10px', fontSize: '12px', color: '#DC2626', fontWeight: '500' }}>● {d.calificacion}</td>
                              <td style={{ padding: '10px', fontSize: '12px', color: 'var(--c-text)', textAlign: 'right' }}>S/. {d.capital}</td>
                              <td style={{ padding: '10px', fontSize: '12px', color: 'var(--c-text)', textAlign: 'right' }}>S/. {d.intereses}</td>
                              <td style={{ padding: '10px', fontSize: '12px', color: 'var(--c-text)', textAlign: 'right', fontWeight: 'bold' }}>S/. {d.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Líneas de crédito */}
                    <div>
                      <div style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', padding: '10px 16px', fontWeight: 'bold', fontSize: '14px', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', border: '1px solid var(--c-border)', borderBottom: 'none' }}>
                        Líneas de crédito
                      </div>
                      <div style={{ border: '1px solid var(--c-border)', padding: '16px', backgroundColor: 'var(--c-surface)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--c-muted)', marginBottom: '12px' }}>Líneas de crédito otorgadas y que no han sido usadas.</p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--c-border)' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)' }}>
                              <th style={{ padding: '10px', fontSize: '12px', textAlign: 'left', color: 'var(--c-muted)', fontWeight: '600' }}>No.</th>
                              <th style={{ padding: '10px', fontSize: '12px', textAlign: 'left', color: 'var(--c-muted)', fontWeight: '600' }}>Entidad Reportante</th>
                              <th style={{ padding: '10px', fontSize: '12px', textAlign: 'left', color: 'var(--c-muted)', fontWeight: '600' }}>Tipo de Línea</th>
                              <th style={{ padding: '10px', fontSize: '12px', textAlign: 'right', color: 'var(--c-muted)', fontWeight: '600' }}>Total Línea</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evalResult.lineas.map((l, i) => (
                              <tr key={i}>
                                <td style={{ padding: '10px', fontSize: '12px', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>{i + 1}</td>
                                <td style={{ padding: '10px', fontSize: '12px', color: 'var(--c-text)', fontWeight: '600', borderBottom: '1px solid var(--c-border)' }}>{l.entidad}</td>
                                <td style={{ padding: '10px', fontSize: '12px', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>{l.tipo}</td>
                                <td style={{ padding: '10px', fontSize: '12px', color: 'var(--c-text)', textAlign: 'right', fontWeight: 'bold', borderBottom: '1px solid var(--c-border)' }}>S/. {l.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Aprobación de Crédito */}
                  <div style={{ border: '1px solid var(--c-border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', padding: '10px 16px', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px solid var(--c-border)' }}>
                      ✅ Datos Personales y Resolución de Crédito
                    </div>
                    <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'var(--c-surface)' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>DNI</label>
                        <input type="text" value={approvalData.dni || dniSearch} onChange={e => setApprovalData({...approvalData, dni: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid var(--c-border)', backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Nombres</label>
                        <input type="text" value={approvalData.nombre} onChange={e => setApprovalData({...approvalData, nombre: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid var(--c-border)', backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Ape. Paterno</label>
                        <input type="text" value={approvalData.apePat} onChange={e => setApprovalData({...approvalData, apePat: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid var(--c-border)', backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Ape. Materno</label>
                        <input type="text" value={approvalData.apeMat} onChange={e => setApprovalData({...approvalData, apeMat: e.target.value})} style={{ width: '100%', padding: '10px', border: '1px solid var(--c-border)', backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Condición</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          {['APTO', 'NO APTO'].map(op => (
                            <button key={op} onClick={() => setApprovalData({...approvalData, condicion: op})} style={{
                              flex: 1, padding: '10px', border: `2px solid ${approvalData.condicion === op ? (op === 'APTO' ? 'var(--c-success)' : 'var(--c-danger)') : 'var(--c-border)'}`,
                              borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer',
                              backgroundColor: approvalData.condicion === op ? (op === 'APTO' ? 'var(--c-success)' : 'var(--c-danger)') : 'var(--c-surface-2)',
                              color: approvalData.condicion === op ? 'white' : 'var(--c-muted)',
                              transition: 'all 0.2s'
                            }}>{op}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Línea de Crédito Aprobada</label>
                        <select value={approvalData.lineaCredito} onChange={e => setApprovalData({...approvalData, lineaCredito: e.target.value})} style={{
                          width: '100%', padding: '10px 14px', border: '1px solid var(--c-border)', borderRadius: '4px',
                          fontSize: '14px', backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', cursor: 'pointer', outline: 'none'
                        }}>
                          <option value="Préstamo MYPE">Préstamo MYPE</option>
                          <option value="Crédito Consumo">Crédito Consumo</option>
                          <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                          <option value="Préstamo Vehicular">Préstamo Vehicular</option>
                          <option value="Préstamo Hipotecario">Préstamo Hipotecario</option>
                        </select>
                      </div>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', marginTop: '10px' }}>
                        <button 
                          type="button"
                          onClick={() => setShowEvalModal(false)} 
                          style={{
                            flex: 1, padding: '14px', backgroundColor: 'var(--c-surface-2)', color: 'var(--c-text)', border: '1px solid var(--c-border)',
                            borderRadius: '4px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-border)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-surface-2)'}
                        >
                          CANCELAR
                        </button>
                        <button 
                          type="button"
                          onClick={() => setShowEvalModal(false)} 
                          style={{
                            flex: 2, padding: '14px', backgroundColor: 'var(--c-primary)', color: 'white', border: 'none',
                            borderRadius: '4px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer',
                            boxShadow: 'none', transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-primary-h)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-primary)'}
                        >
                          CONFIRMAR Y GUARDAR
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle del Cliente */}
      {selectedClientInfo && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px'
          }}
          onClick={() => setSelectedClientInfo(null)}
        >
          <div 
            style={{
              backgroundColor: 'var(--c-surface)', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '90vh',
              display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', border: '1px solid var(--c-border)', overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--c-surface-2)' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--c-text)', margin: 0 }}>{selectedClientInfo.nombres} {selectedClientInfo.ape_pat} {selectedClientInfo.ape_mat}</h2>
                <p style={{ color: 'var(--c-muted)', fontSize: '13px', marginTop: '4px', margin: 0 }}>DNI: {selectedClientInfo.dni} • Estado: <strong style={{ color: selectedClientInfo.estado === 'APTO' ? '#0CA678' : '#EF4444' }}>{selectedClientInfo.estado}</strong></p>
              </div>
              <button 
                onClick={() => setSelectedClientInfo(null)} 
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', cursor: 'pointer', color: 'var(--c-text)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-surface)'}
              >
                Cerrar
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
              
              {/* Sección 1 */}
              <div style={{ border: '1px solid var(--c-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'var(--c-surface-2)', padding: '12px 16px', fontWeight: 'bold', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>
                  👤 Datos de Identidad y Demográficos
                </div>
                <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <InfoItem label="Edad actual" value="34 años" />
                  <InfoItem label="Estado civil" value="Casado(a)" />
                  <InfoItem label="Número de dependientes" value="2" />
                  <InfoItem label="Tipo de residencia" value="Familiar" />
                  <InfoItem label="Tiempo de residencia" value="5 años" />
                </div>
              </div>

              {/* Sección 2 */}
              <div style={{ border: '1px solid var(--c-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'var(--c-surface-2)', padding: '12px 16px', fontWeight: 'bold', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>
                  💰 Ingresos Detallados
                </div>
                <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <InfoItem label="Ingreso neto mensual fijo" value="S/ 3,500.00" />
                  <InfoItem label="Ingresos variables promedio" value="S/ 500.00" />
                  <InfoItem label="Ingresos de la sociedad conyugal" value="S/ 2,000.00" />
                  <InfoItem label="Otros ingresos comprobables" value="S/ 0.00" />
                </div>
              </div>

              {/* Sección 3 */}
              <div style={{ border: '1px solid var(--c-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'var(--c-surface-2)', padding: '12px 16px', fontWeight: 'bold', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>
                  📉 Gastos y Obligaciones Mensuales
                </div>
                <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <InfoItem label="Costo de vivienda mensual" value="S/ 800.00" />
                  <InfoItem label="Gastos de vida estimados" value="S/ 1,200.00" />
                  <InfoItem label="Cuotas de deudas financieras" value="S/ 450.00" />
                  <InfoItem label="Obligaciones legales" value="Ninguna" />
                </div>
              </div>

              {/* Sección 4 */}
              <div style={{ border: '1px solid var(--c-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'var(--c-surface-2)', padding: '12px 16px', fontWeight: 'bold', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>
                  💼 Situación Laboral y Profesional
                </div>
                <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <InfoItem label="Tipo de contrato" value="Indefinido" />
                  <InfoItem label="Antigüedad laboral actual" value="3 años y 2 meses" />
                  <InfoItem label="Antigüedad en el giro" value="5 años" />
                  <InfoItem label="Sector económico" value="Tecnología / Servicios" />
                </div>
              </div>

              {/* Sección 5 */}
              <div style={{ border: '1px solid var(--c-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'var(--c-surface-2)', padding: '12px 16px', fontWeight: 'bold', color: 'var(--c-text)', borderBottom: '1px solid var(--c-border)' }}>
                  🏛️ Situación Financiera y Patrimonial
                </div>
                <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <InfoItem label="Patrimonio neto" value="S/ 45,000.00" />
                  <InfoItem label="Saldo promedio en cuentas" value="S/ 2,300.00" />
                  <InfoItem label="Score de crédito numérico" value="750" />
                  <InfoItem label="Número de entidades acreedoras" value="2" />
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente helper para mostrar la información en 2 columnas
function InfoItem({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '11px', color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>{label}</span>
      <span style={{ fontSize: '14px', color: 'var(--c-text)', fontWeight: '500', marginTop: '4px' }}>{value}</span>
    </div>
  );
}
