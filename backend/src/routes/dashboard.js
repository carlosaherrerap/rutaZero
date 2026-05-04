const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/dashboard/stats
 * KPIs generales para el portal web
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = {};

    // Total clientes
    const totalClientes = await db.query('SELECT COUNT(*) FROM clientes');
    stats.totalClientes = parseInt(totalClientes.rows[0].count);

    // Clientes por estado
    const porEstado = await db.query(
      `SELECT estado, COUNT(*) AS total FROM clientes GROUP BY estado ORDER BY estado`
    );
    stats.clientesPorEstado = porEstado.rows;

    // Workers activos (con jornada hoy)
    const workersActivos = await db.query(
      `SELECT COUNT(*) FROM jornadas WHERE fecha = CURRENT_DATE AND estado != 'INACTIVO' AND estado != 'JORNADA_FINALIZADA'`
    );
    stats.workersActivos = parseInt(workersActivos.rows[0].count);

    // Total workers
    const totalWorkers = await db.query(
      "SELECT COUNT(*) FROM usuarios WHERE rol = 'WORKER' AND estado = 'ACTIVO'"
    );
    stats.totalWorkers = parseInt(totalWorkers.rows[0].count);

    // Rutas hoy
    const rutasHoy = await db.query(
      'SELECT COUNT(*) FROM rutas WHERE fecha_asignacion = CURRENT_DATE'
    );
    stats.rutasHoy = parseInt(rutasHoy.rows[0].count);

    // Rutas completadas hoy
    const rutasCompletadas = await db.query(
      `SELECT COUNT(*) 
       FROM rutas r 
       WHERE r.fecha_asignacion = CURRENT_DATE 
       AND (
         SELECT COUNT(*) 
         FROM ruta_clientes rc 
         JOIN clientes c ON c.id = rc.cliente_id 
         WHERE rc.ruta_id = r.id AND c.estado IN ('LIBRE', 'EN_VISITA')
       ) = 0`
    );
    stats.rutasCompletadas = parseInt(rutasCompletadas.rows[0].count);

    // Gestiones hoy
    const gestionesHoy = await db.query(
      'SELECT COUNT(*) FROM gestiones_historial WHERE fecha = CURRENT_DATE'
    );
    stats.gestionesHoy = parseInt(gestionesHoy.rows[0].count);

    // Reprogramados hoy (clientes que pasaron a REPROGRAMADO hoy)
    const reprogramados = await db.query(
      "SELECT COUNT(*) FROM clientes WHERE estado = 'REPROGRAMADO' AND fecha_gestion = CURRENT_DATE"
    );
    stats.totalReprogramados = parseInt(reprogramados.rows[0].count);

    // Clientes con fecha de pago hoy
    const pagoHoy = await db.query(
      'SELECT COUNT(*) FROM clientes WHERE fecha_pago = CURRENT_DATE'
    );
    stats.clientesPagoHoy = parseInt(pagoHoy.rows[0].count);

    // Clientes por distrito (top 10)
    const porDistrito = await db.query(
      `SELECT ub.distrito, COUNT(c.id) AS total
       FROM clientes c
       JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       GROUP BY ub.distrito
       ORDER BY total DESC
       LIMIT 10`
    );
    stats.clientesPorDistrito = porDistrito.rows;

    // Resumen de workers
    const resumenWorkers = await db.query('SELECT * FROM v_resumen_worker');
    stats.resumenWorkers = resumenWorkers.rows;

    res.json({ data: stats });
  } catch (err) {
    console.error('Error al obtener stats:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener actividad reciente
router.get('/actividad', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const { rows } = await db.query(
      `SELECT gh.*, u.nombres as worker_nombre, c.nombres as cliente_nombre, c.apellidos as cliente_apellido
       FROM gestiones_historial gh
       JOIN usuarios u ON u.id = gh.worker_id
       JOIN clientes c ON c.id = gh.cliente_id
       ORDER BY gh.timestamp_at DESC
       LIMIT $1 OFFSET $2`,
       [limit, offset]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener actividad:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Exportar actividad (CSV)
router.get('/export_actividad', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    let query = `
       SELECT gh.id, u.nombres as worker, c.nombres as cliente, c.apellidos as apellido_cliente, gh.tipificacion, gh.estado_nuevo, gh.observacion, gh.timestamp_at
       FROM gestiones_historial gh
       JOIN usuarios u ON u.id = gh.worker_id
       JOIN clientes c ON c.id = gh.cliente_id
       WHERE 1=1
    `;
    const params = [];
    
    if (fecha_inicio) {
      params.push(fecha_inicio);
      query += ` AND gh.fecha >= $${params.length}`;
    }
    if (fecha_fin) {
      params.push(fecha_fin);
      query += ` AND gh.fecha <= $${params.length}`;
    }
    
    query += ` ORDER BY gh.timestamp_at DESC`;
    
    const { rows } = await db.query(query, params);
    
    let csv = "ID,Worker,Cliente,Tipificacion,Estado Nuevo,Observacion,Fecha Hora\n";
    rows.forEach(r => {
      const fecha = new Date(r.timestamp_at).toLocaleString('es-PE', {timeZone: 'America/Lima'});
      const cleanObs = r.observacion ? r.observacion.replace(/"/g, '""').replace(/\n/g, ' ') : '';
      csv += `${r.id},"${r.worker}","${r.cliente} ${r.apellido_cliente}",${r.tipificacion},${r.estado_nuevo},"${cleanObs}","${fecha}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=actividad_historica.csv');
    res.send(Buffer.from('\uFEFF' + csv, 'utf-8'));
  } catch (err) {
    console.error('Error al exportar actividad:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
