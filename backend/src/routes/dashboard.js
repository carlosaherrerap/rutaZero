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
      'SELECT COUNT(*) FROM rutas WHERE fecha_asignacion = CURRENT_DATE AND completada = true'
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
    const { rows } = await db.query(
      `SELECT gh.*, u.nombres as worker_nombre, c.nombres as cliente_nombre, c.apellidos as cliente_apellido
       FROM gestiones_historial gh
       JOIN usuarios u ON u.id = gh.worker_id
       JOIN clientes c ON c.id = gh.cliente_id
       ORDER BY gh.timestamp_at DESC
       LIMIT 10`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener actividad:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
