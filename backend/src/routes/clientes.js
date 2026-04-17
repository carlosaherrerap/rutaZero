const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

// Todas las rutas de clientes requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/clientes
 * Query params: ?distrito=&estado=&fecha_pago=&page=1&limit=50
 */
router.get('/', async (req, res) => {
  try {
    const { distrito, estado, fecha_pago, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];
    let paramIndex = 1;

    if (distrito) {
      conditions.push(`ub.distrito = $${paramIndex++}`);
      params.push(distrito);
    }
    if (estado) {
      conditions.push(`c.estado = $${paramIndex++}`);
      params.push(estado);
    }
    if (fecha_pago) {
      conditions.push(`c.fecha_pago = $${paramIndex++}`);
      params.push(fecha_pago);
    }
    if (search) {
      conditions.push(`(c.nombres ILIKE $${paramIndex} OR c.apellidos ILIKE $${paramIndex} OR c.dni ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) FROM clientes c LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch paginated
    const { rows } = await db.query(
      `SELECT c.id, c.nombres, c.apellidos, c.dni, c.telefono, c.email,
              c.estado, c.fecha_pago, c.deuda_total, c.dias_retraso, c.fecha_gestion,
              c.bloqueado_por,
              ub.latitud, ub.longitud, ub.direccion, ub.departamento, ub.provincia, ub.distrito, ub.referencia,
              bw.nombres AS bloqueado_por_nombre, bw.apellidos AS bloqueado_por_apellido
       FROM clientes c
       LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       LEFT JOIN usuarios bw ON bw.id = c.bloqueado_por
       ${whereClause}
       ORDER BY c.apellidos, c.nombres
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Error al obtener clientes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/clientes/mapa
 * Retorna todos los clientes con coordenadas para el mapa (sin paginación)
 */
router.get('/mapa', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.nombres, c.apellidos, c.estado, c.fecha_pago, c.deuda_total, c.dias_retraso,
              ub.latitud, ub.longitud, ub.distrito,
              bw.nombres AS worker_nombre, bw.apellidos AS worker_apellido
       FROM clientes c
       LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       LEFT JOIN usuarios bw ON bw.id = c.bloqueado_por
       WHERE ub.latitud IS NOT NULL AND ub.longitud IS NOT NULL
       ORDER BY ub.distrito, c.apellidos`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener clientes para mapa:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/clientes/distritos
 * Retorna lista de distritos disponibles
 */
router.get('/distritos', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT ub.distrito, COUNT(c.id) AS total
       FROM clientes c
       JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       GROUP BY ub.distrito
       ORDER BY ub.distrito`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener distritos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/clientes/:id
 * Retorna un cliente con toda su información
 */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*,
              ub.latitud, ub.longitud, ub.direccion, ub.departamento, ub.provincia, ub.distrito, ub.referencia,
              bw.nombres AS worker_nombre, bw.apellidos AS worker_apellido
       FROM clientes c
       LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       LEFT JOIN usuarios bw ON bw.id = c.bloqueado_por
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Obtener historial de gestiones
    const gestiones = await db.query(
      `SELECT gh.*, u.nombres AS worker_nombre, u.apellidos AS worker_apellido
       FROM gestiones_historial gh
       JOIN usuarios u ON u.id = gh.worker_id
       WHERE gh.cliente_id = $1
       ORDER BY gh.timestamp_at DESC
       LIMIT 20`,
      [req.params.id]
    );

    res.json({
      data: { ...rows[0], gestiones: gestiones.rows },
    });
  } catch (err) {
    console.error('Error al obtener cliente:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/clientes/:id/ficha
 * Retorna la ficha más reciente del cliente
 */
router.get('/:id/ficha', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT f.*, u.nombres AS worker_nombre, u.apellidos AS worker_apellido
       FROM fichas f
       JOIN usuarios u ON u.id = f.worker_id
       WHERE f.cliente_id = $1
       ORDER BY f.created_at DESC
       LIMIT 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.json({ data: null });
    }

    // Obtener evidencias
    const evidencias = await db.query(
      'SELECT * FROM evidencias WHERE ficha_id = $1 ORDER BY orden',
      [rows[0].id]
    );

    res.json({
      data: { ...rows[0], evidencias: evidencias.rows },
    });
  } catch (err) {
    console.error('Error al obtener ficha:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
