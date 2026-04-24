import React, { useEffect, useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

const ESTADO_COLORS = {
  VISITADO_PAGO: { bg: '#d1fae5', text: '#065f46', label: 'GESTIONADO' },
  REPROGRAMADO:  { bg: '#fef3c7', text: '#92400e', label: 'REPROGRAMADO' },
  NO_ENCONTRADO: { bg: '#fee2e2', text: '#991b1b', label: 'NO ENCONTRADO' },
};

function EstadoBadge({ estado }) {
  const cfg = ESTADO_COLORS[estado] || { bg: '#f1f5f9', text: '#64748b', label: estado };
  return (
    <span style={{ background: cfg.bg, color: cfg.text, fontWeight: 800, fontSize: 10, padding: '3px 10px', borderRadius: 20 }}>
      {cfg.label}
    </span>
  );
}

export default function Ciclos() {
  const { api } = useContext(AuthContext);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liberando, setLiberando] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  useEffect(() => { fetchCiclos(); }, []);

  const fetchCiclos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/asistencia/ciclos');
      setClientes(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

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

  // ── EXCEL ────────────────────────────────────────────────────
  const handleDescargarPlantilla = () => {
    // Genera un CSV de plantilla simple
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
      fetchCiclos(); // Refrescar lista
    } catch (e) {
      setImportResult({ message: 'Error al importar', errores: [e.response?.data?.error || e.message] });
    } finally {
      setImporting(false);
      e.target.value = ''; // reset input
    }
  };

  return (
    <div>
      {/* HEADER ACCIONES */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, color: 'var(--c-text)' }}>
            Clientes Gestionados — Ciclo de Liberación
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--c-text-muted)' }}>
            {clientes.length} clientes pendientes de liberar para el siguiente ciclo
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleDescargarPlantilla}>
          ⬇️ Descargar Plantilla Excel
        </button>
        <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          {importing ? '⏳ Cargando...' : '📤 Importar Excel'}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportarExcel} disabled={importing} />
        </label>
      </div>

      {/* RESULTADO IMPORT */}
      {importResult && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 16, borderLeft: `4px solid ${importResult.errores?.length > 0 ? '#f59e0b' : '#10b981'}` }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{importResult.message}</div>
          {importResult.errores?.length > 0 && (
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: '#ef4444' }}>
              {importResult.errores.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button style={{ marginTop: 8, fontSize: 11, background: 'none', border: 'none', color: 'var(--c-text-muted)', cursor: 'pointer' }} onClick={() => setImportResult(null)}>✕ Cerrar</button>
        </div>
      )}

      {/* TABLA */}
      {loading ? (
        <div className="text-center" style={{ padding: 40 }}><div className="spinner"></div></div>
      ) : clientes.length === 0 ? (
        <div className="card text-center" style={{ padding: 40, color: 'var(--c-text-muted)' }}>
          🎉 No hay clientes gestionados pendientes de liberar
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th><th>DNI</th><th>Estado</th>
                <th>Último Worker</th><th>Fecha Gestión</th>
                <th>Tipificación</th><th>Fecha Pago Actual</th><th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="font-bold">{c.nombres} {c.apellidos}</div>
                    <div className="text-sm text-muted">{c.direccion} — {c.distrito}</div>
                  </td>
                  <td>{c.dni}</td>
                  <td><EstadoBadge estado={c.estado} /></td>
                  <td>{c.ultimo_worker || '—'}</td>
                  <td>{c.fecha_gestion ? new Date(c.fecha_gestion).toLocaleDateString('es-PE') : '—'}</td>
                  <td>
                    <span style={{
                      fontWeight: 800, fontSize: 11,
                      color: c.tipificacion === 'PAGO' ? '#10b981' : c.tipificacion === 'REPROGRAMARA' ? '#f59e0b' : '#ef4444'
                    }}>
                      {c.tipificacion || '—'}
                    </span>
                  </td>
                  <td>{c.fecha_pago ? new Date(c.fecha_pago).toLocaleDateString('es-PE') : '—'}</td>
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => openLiberarModal(c)}>
                      🔓 Liberar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL LIBERAR */}
      {showModal && selectedCliente && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <span className="modal-title">🔓 Liberar Cliente</span>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="card" style={{ padding: '12px 16px', background: 'var(--c-bg-light)', marginBottom: 16, fontSize: 13 }}>
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
              <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 8 }}>
                Al confirmar, el estado del cliente cambiará a <strong>LIBRE</strong> y su fecha de pago será actualizada. El cliente volverá a estar disponible para ser asignado en rutas.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleLiberar}
                disabled={liberando === selectedCliente.id || !nuevaFecha}
              >
                {liberando === selectedCliente.id ? 'Liberando...' : 'Confirmar Liberación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
