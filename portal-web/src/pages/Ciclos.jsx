import React, { useEffect, useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { 
  RefreshCw, AlertTriangle, Download, Loader2, Upload, 
  X, CheckCircle, WifiOff, Clock, CloudOff, Lock, ChevronDown,
  FileSpreadsheet, FileDown, FileUp, MapPin, User, Calendar, Tag
} from 'lucide-react';

const ESTADO_COLORS = {
  VISITADO_PAGO: { bg: 'var(--c-surface-2)', text: 'var(--c-success)', label: 'GESTIONADO' },
  REPROGRAMADO:  { bg: 'var(--c-surface-2)', text: 'var(--c-warn)', label: 'REPROGRAMADO' },
  NO_ENCONTRADO: { bg: 'var(--c-surface-2)', text: 'var(--c-danger)', label: 'NO ENCONTRADO' },
  LIBRE:         { bg: 'var(--c-surface-2)', text: 'var(--c-info)', label: 'NO VISITADO' },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_COLORS[estado] || { bg: 'var(--c-surface-2)', text: 'var(--c-muted)', label: estado };
  return (
    <span className="estado-badge" style={{ background: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

export default function Ciclos() {
  const { api, token, sedeActual } = useContext(AuthContext);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liberando, setLiberando] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState('gestionados');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClientDetail, setSelectedClientDetail] = useState(null);
  const itemsPerPage = 20;
  const fileRef = useRef();

  useEffect(() => { 
    setCurrentPage(1);
    fetchCiclos(); 
  }, [api]);

  const fetchCiclos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/asistencia/ciclos');
      setClientes(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Separar en dos grupos filtrando por sedeActual
  const clientesFiltrados = clientes.filter(c => {
    if (!sedeActual || !c.sede_id) return true;
    return c.sede_id === sedeActual.id || c.sede === sedeActual.nombre;
  });

  const gestionados = clientesFiltrados.filter(c => ['VISITADO_PAGO', 'REPROGRAMADO', 'NO_ENCONTRADO'].includes(c.estado));
  const noGestionados = clientesFiltrados.filter(c => c.estado === 'LIBRE');

  const openLiberarModal = (c) => {
    setSelectedCliente(c);
    setNuevaFecha(c.fecha_pago ? c.fecha_pago.split('T')[0] : '');
    setShowModal(true);
  };

  const handleLiberar = async () => {
    if (!nuevaFecha) return alert('Debes ingresar una nueva fecha de pago');
    setLiberando(selectedCliente.id);
    try {
      await api.patch(`/api/asistencia/ciclos/${selectedCliente.id}/liberar`, { fecha_pago: nuevaFecha });
      setClientes(prev => prev.filter(c => c.id !== selectedCliente.id));
      setShowModal(false);
    } catch (e) {
      alert('Error al liberar el cliente');
    } finally { setLiberando(null); }
  };

  const handleDownloadGestionados = () => {
    const API_BASE = api.defaults.baseURL || 'http://localhost:4000';
    window.open(`${API_BASE}/api/asistencia/ciclos/export?token=${token}`, '_blank');
  };

  const handleDownloadNoGestionados = () => {
    const headers = 'NOMBRES,APELLIDOS,DNI,TELEFONO,FECHA_PAGO_VENCIDA,CASUISTICA,DISTRITO';
    const rows = noGestionados.map(c =>
      `"${c.nombres}","${c.apellidos}","${c.dni}","${c.telefono || ''}","${c.fecha_pago ? c.fecha_pago.split('T')[0] : ''}","No fue visitado - quedó LIBRE con fecha vencida","${c.distrito || ''}"`
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `no_gestionados_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDescargarPlantilla = () => {
    const content = 'DOCUMENTO,FECHA_PAGO\n12345678,2026-05-15\n87654321,2026-05-20';
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_ciclos.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportarExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await api.post('/api/asistencia/ciclos/importar-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(res.data);
      fetchCiclos();
    } catch (e) {
      setImportResult({ message: 'Error al importar', errores: [e.response?.data?.error || e.message] });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const activeListAll = activeTab === 'gestionados' ? gestionados : noGestionados;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const activeList = activeListAll.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(activeListAll.length / itemsPerPage);

  return (
    <div>
      {/* TABS */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--c-border)' }}>
        <button
          onClick={() => { setActiveTab('gestionados'); setCurrentPage(1); }}
          style={{
            padding: '10px 20px', fontWeight: 800, fontSize: 13, background: 'none', border: 'none',
            borderBottom: activeTab === 'gestionados' ? '2px solid var(--c-primary)' : '2px solid transparent',
            color: activeTab === 'gestionados' ? 'var(--c-primary)' : 'var(--c-muted)',
            cursor: 'pointer', marginBottom: '-2px'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={14} /> Para Liberar ({gestionados.length})</span>
        </button>
        <button
          onClick={() => { setActiveTab('no_gestionados'); setCurrentPage(1); }}
          style={{
            padding: '10px 20px', fontWeight: 800, fontSize: 13, background: 'none', border: 'none',
            borderBottom: activeTab === 'no_gestionados' ? '2px solid var(--c-danger)' : '2px solid transparent',
            color: activeTab === 'no_gestionados' ? 'var(--c-danger)' : 'var(--c-muted)',
            cursor: 'pointer', marginBottom: '-2px'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> No Gestionados — Fecha Vencida ({noGestionados.length})</span>
        </button>
      </div>

      {/* HEADER ACCIONES */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          {activeTab === 'gestionados' ? (
            <>
              <h3 style={{ margin: 0, color: 'var(--c-text)' }}>Clientes Gestionados — Ciclo de Liberación</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--c-muted)' }}>
                {gestionados.length} clientes pendientes de liberar para el siguiente ciclo
              </p>
            </>
          ) : (
            <>
              <h3 style={{ margin: 0, color: 'var(--c-danger)' }}>No Gestionados — Fecha Vencida</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--c-muted)' }}>
                {noGestionados.length} clientes con fecha de pago vencida que no fueron visitados (quedaron LIBRE)
              </p>
            </>
          )}
        </div>

        {activeTab === 'gestionados' ? (
          <>
            <button onClick={handleDownloadGestionados} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: '8px', background: '#28a745', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
               <FileDown size={14} /> Descargar Ciclos (CSV)
            </button>
            <button onClick={handleDescargarPlantilla} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: '8px', background: 'transparent', color: '#28a745', border: '1px solid #28a745', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
              <FileSpreadsheet size={14} /> Plantilla Excel
            </button>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: '8px', background: '#28a745', color: 'white', fontWeight: 'bold', border: 'none', fontSize: '13px' }}>
              {importing ? <><Loader2 size={14} className="animate-spin" /> Cargando...</> : <><FileUp size={14} /> Importar Excel</>}
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportarExcel} disabled={importing} />
            </label>
          </>
        ) : (
          <button
            onClick={handleDownloadNoGestionados}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: '8px', background: 'var(--c-danger)', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '13px' }}
          >
            <Download size={14} /> Descargar No Gestionados (CSV)
          </button>
        )}
      </div>

      {/* RESULTADO IMPORT */}
      {importResult && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16, borderLeft: `4px solid ${importResult.errores?.length > 0 ? 'var(--c-warn)' : 'var(--c-primary)'}` }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{importResult.message}</div>
          {importResult.errores?.length > 0 && (
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--c-danger)' }}>
              {importResult.errores.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button style={{ marginTop: 8, fontSize: 11, background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setImportResult(null)}><X size={14} /> Cerrar</button>
        </div>
      )}

      {/* TABLA */}
      {loading ? (
        <div className="text-center" style={{ padding: 40 }}><div className="spinner"></div></div>
      ) : activeList.length === 0 ? (
        <div className="card text-center" style={{ padding: 40, color: 'var(--c-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <CheckCircle size={40} style={{ opacity: 0.1 }} />
          {activeTab === 'gestionados'
            ? 'No hay clientes gestionados pendientes de liberar'
            : 'No hay clientes sin gestionar con fecha vencida'}
        </div>
      ) : (
        <div className="table-wrap" style={{ padding: 0, background: 'transparent', marginTop: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '48px', alignItems: 'start' }}>
            
            {/* Lista Izquierda */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)', paddingLeft: '8px', marginBottom: '4px', textTransform: 'uppercase' }}>
                CLIENTES ({activeListAll.length})
              </div>
              {activeList.map(c => {
                const isSelected = selectedClientDetail?.id === c.id;
                return (
                  <div 
                    key={c.id} 
                    onClick={() => setSelectedClientDetail(c)}
                    style={{
                      padding: '16px', background: isSelected ? 'var(--c-surface-2)' : 'var(--c-surface)', 
                      border: '1px solid', borderColor: isSelected ? 'var(--c-primary)' : 'var(--c-border)', 
                      borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                      borderLeft: isSelected ? '4px solid var(--c-primary)' : '1px solid var(--c-border)'
                    }}
                  >
                    <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--c-text)' }}>{c.nombres} {c.apellidos}</div>
                    <div style={{ fontSize: '12px', color: 'var(--c-muted)', marginTop: '4px' }}>DNI: {c.dni}</div>
                  </div>
                );
              })}
            </div>
            
            {/* Detalles Derecha */}
            <div>
              {selectedClientDetail ? (
                <div className="card" style={{ padding: '32px', borderTop: '4px solid var(--c-primary)', animation: 'fadeIn 0.3s ease' }}>
                  <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--c-text)' }}>{selectedClientDetail.nombres} {selectedClientDetail.apellidos}</h2>
                    <div style={{ fontSize: '14px', color: 'var(--c-muted)' }}>DNI: {selectedClientDetail.dni}</div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} /> Dirección
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--c-text)' }}>{selectedClientDetail.direccion} - {selectedClientDetail.distrito}</div>
                    </div>
                    
                    {activeTab === 'gestionados' && (
                      <>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={14} /> Último Worker
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--c-text)' }}>{selectedClientDetail.ultimo_worker || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} /> Fecha Gestión
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--c-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {selectedClientDetail.fecha_gestion ? new Date(selectedClientDetail.fecha_gestion).toLocaleDateString('es-PE') : '—'}
                            {selectedClientDetail.es_offline && <WifiOff size={14} color="var(--c-danger)" title="Modo Offline"/>}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Tag size={14} /> Tipificación
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: selectedClientDetail.tipificacion === 'PAGO' ? 'var(--c-primary)' : selectedClientDetail.tipificacion === 'REPROGRAMARA' ? 'var(--c-warn)' : 'var(--c-danger)' }}>{selectedClientDetail.tipificacion || '—'}</div>
                        </div>
                      </>
                    )}
                    
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} /> Fecha Pago {activeTab === 'no_gestionados' && <span style={{color: 'var(--c-danger)'}}>(VENCIDA)</span>}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: activeTab === 'no_gestionados' ? 'var(--c-danger)' : 'var(--c-text)' }}>{selectedClientDetail.fecha_pago ? new Date(selectedClientDetail.fecha_pago).toLocaleDateString('es-PE') : '—'}</div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--c-surface-2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--c-border)', marginBottom: '24px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} /> Observación de Gestión
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--c-text)', fontStyle: 'italic', lineHeight: '1.6' }}>"{selectedClientDetail.observacion || 'Sin observaciones registradas'}"</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--c-border)', paddingTop: '24px' }}>
                    <button 
                      onClick={() => openLiberarModal(selectedClientDetail)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '8px', background: 'var(--c-accent)', color: '#fff', fontWeight: '800', fontSize: '14px', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#7a1fd6'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--c-accent)'}
                    >
                      <Lock size={16} /> LIBERAR
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card text-center" style={{ padding: '80px 40px', color: 'var(--c-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <User size={64} style={{ opacity: 0.1, marginBottom: '24px' }} />
                  <p style={{ fontSize: '16px', fontWeight: '500' }}>Selecciona un cliente de la lista de la izquierda<br/>para ver su información detallada</p>
                </div>
              )}
            </div>

          </div>

          {/* PAGINACIÓN */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px', padding: '10px' }}>
              <button 
                className="btn btn-ghost btn-sm" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                Anterior
              </button>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Página {currentPage} de {totalPages}</span>
              <button 
                className="btn btn-ghost btn-sm" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL REPROGRAMAR */}
      {showModal && selectedCliente && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={18} /> Reprogramar Cliente</span>
              <button className="btn-ghost" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="card" style={{ padding: '12px 16px', background: 'var(--c-surface-2)', marginBottom: 16, fontSize: 13 }}>
                <div className="font-bold" style={{ fontSize: 15, marginBottom: 4 }}>
                  {selectedCliente.nombres} {selectedCliente.apellidos}
                </div>
                <div className="text-muted">DNI: {selectedCliente.dni}</div>
                <div className="text-muted">Estado actual: <EstadoBadge estado={selectedCliente.estado} /></div>
              </div>
              <label className="form-label">Nueva Fecha de Pago</label>
              <input
                type="date"
                className="form-input"
                value={nuevaFecha}
                onChange={e => setNuevaFecha(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <p style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 8 }}>
                Al confirmar, el estado del cliente cambiará a <strong>LIBRE</strong> y su fecha de pago será actualizada.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleLiberar}
                disabled={liberando === selectedCliente.id || !nuevaFecha}
              >
                {liberando === selectedCliente.id ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
