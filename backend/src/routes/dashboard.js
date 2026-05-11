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
    const sedeId = req.headers['x-sede-id'];

    // Total clientes
    const totalClientes = await db.query('SELECT COUNT(*) FROM clientes WHERE (sede_id = $1 OR $1 IS NULL)', [sedeId]);
    stats.totalClientes = parseInt(totalClientes.rows[0].count);

    // Clientes por estado
    const porEstado = await db.query(
      `SELECT estado, COUNT(*) AS total FROM clientes WHERE (sede_id = $1 OR $1 IS NULL) GROUP BY estado ORDER BY estado`,
      [sedeId]
    );
    stats.clientesPorEstado = porEstado.rows;

    // Workers activos (con jornada hoy)
    const workersActivos = await db.query(
      `SELECT COUNT(*) FROM jornadas j JOIN usuarios u ON u.id = j.worker_id WHERE j.fecha = CURRENT_DATE AND j.estado != 'INACTIVO' AND j.estado != 'JORNADA_FINALIZADA' AND (u.sede_id = $1 OR $1 IS NULL)`,
      [sedeId]
    );
    stats.workersActivos = parseInt(workersActivos.rows[0].count);

    // Total workers
    const totalWorkers = await db.query(
      "SELECT COUNT(*) FROM usuarios WHERE rol = 'WORKER' AND estado = 'ACTIVO' AND (sede_id = $1 OR $1 IS NULL)",
      [sedeId]
    );
    stats.totalWorkers = parseInt(totalWorkers.rows[0].count);

    // Rutas hoy
    const rutasHoy = await db.query(
      'SELECT COUNT(*) FROM rutas WHERE fecha_asignacion = CURRENT_DATE AND (sede_id = $1 OR $1 IS NULL)',
      [sedeId]
    );
    stats.rutasHoy = parseInt(rutasHoy.rows[0].count);

    // Rutas completadas hoy
    const rutasCompletadas = await db.query(
      `SELECT COUNT(*) 
       FROM rutas r 
       WHERE r.fecha_asignacion = CURRENT_DATE 
       AND (r.sede_id = $1 OR $1 IS NULL)
       AND (
         SELECT COUNT(*) 
         FROM ruta_clientes rc 
         JOIN clientes c ON c.id = rc.cliente_id 
         WHERE rc.ruta_id = r.id AND c.estado IN ('LIBRE', 'EN_VISITA')
       ) = 0`,
       [sedeId]
    );
    stats.rutasCompletadas = parseInt(rutasCompletadas.rows[0].count);

    // Gestiones hoy
    const gestionesHoy = await db.query(
      'SELECT COUNT(*) FROM gestiones_historial gh JOIN clientes c ON c.id = gh.cliente_id WHERE gh.fecha = CURRENT_DATE AND (c.sede_id = $1 OR $1 IS NULL)',
      [sedeId]
    );
    stats.gestionesHoy = parseInt(gestionesHoy.rows[0].count);

    // Reprogramados hoy
    const reprogramados = await db.query(
      "SELECT COUNT(*) FROM clientes WHERE estado = 'REPROGRAMADO' AND fecha_gestion = CURRENT_DATE AND (sede_id = $1 OR $1 IS NULL)",
      [sedeId]
    );
    stats.totalReprogramados = parseInt(reprogramados.rows[0].count);

    // Clientes con fecha de pago hoy
    const pagoHoy = await db.query(
      'SELECT COUNT(*) FROM clientes WHERE fecha_pago = CURRENT_DATE AND (sede_id = $1 OR $1 IS NULL)',
      [sedeId]
    );
    stats.clientesPagoHoy = parseInt(pagoHoy.rows[0].count);

    // Clientes por distrito (top 10)
    const porDistrito = await db.query(
      `SELECT ub.distrito, COUNT(c.id) AS total
       FROM clientes c
       JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       WHERE (c.sede_id = $1 OR $1 IS NULL)
       GROUP BY ub.distrito
       ORDER BY total DESC
       LIMIT 10`,
       [sedeId]
    );
    stats.clientesPorDistrito = porDistrito.rows;

    // Resumen de workers
    const resumenWorkers = await db.query('SELECT * FROM v_resumen_worker WHERE (sede_id = $1 OR $1 IS NULL)', [sedeId]);
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
    
    const sedeId = req.headers['x-sede-id'];
    
    const { rows } = await db.query(
      `SELECT gh.*, u.nombres as worker_nombre, c.nombres as cliente_nombre, c.apellidos as cliente_apellido
       FROM gestiones_historial gh
       JOIN usuarios u ON u.id = gh.worker_id
       JOIN clientes c ON c.id = gh.cliente_id
       WHERE (c.sede_id = $3 OR $3 IS NULL)
       ORDER BY gh.created_at DESC
       LIMIT $1 OFFSET $2`,
       [limit, offset, sedeId]
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
    
    const sedeId = req.headers['x-sede-id'];
    const params = [];
    
    let query = `
       SELECT gh.id, u.nombres as worker, c.nombres as cliente, c.apellidos as apellido_cliente, gh.tipificacion, gh.estado_nuevo, gh.observacion, gh.created_at
       FROM gestiones_historial gh
       JOIN usuarios u ON u.id = gh.worker_id
       JOIN clientes c ON c.id = gh.cliente_id
       WHERE (c.sede_id = $1 OR $1 IS NULL)
    `;
    params.push(sedeId);
    
    if (fecha_inicio) {
      params.push(fecha_inicio);
      query += ` AND gh.fecha >= $${params.length}`;
    }
    if (fecha_fin) {
      params.push(fecha_fin);
      query += ` AND gh.fecha <= $${params.length}`;
    }
    
    query += ` ORDER BY gh.created_at DESC`;
    
    const { rows } = await db.query(query, params);
    
    let csv = "ID,Worker,Cliente,Tipificacion,Estado Nuevo,Observacion,Fecha Hora\n";
    rows.forEach(r => {
      const fecha = new Date(r.created_at).toLocaleString('es-PE', {timeZone: 'America/Lima'});
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
