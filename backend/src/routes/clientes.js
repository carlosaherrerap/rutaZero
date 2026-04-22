const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/clientes
 * Lista clientes con filtros de búsqueda y zona
 */
router.get('/', async (req, res) => {
  try {
    const { search, distrito, estado, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (c.nombres ILIKE $${params.length} OR c.apellidos ILIKE $${params.length} OR c.dni ILIKE $${params.length})`;
    }

    if (distrito) {
      params.push(`%${distrito}%`);
      whereClause += ` AND ub.distrito ILIKE $${params.length}`;
    }

    if (estado) {
      params.push(estado);
      whereClause += ` AND c.estado = $${params.length}`;
    }


    const countQuery = `
      SELECT COUNT(*) 
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
      ${whereClause}
    `;
    const countRes = await db.query(countQuery, params);
    const totalItems = parseInt(countRes.rows[0].count);

    // Obtener datos
    const dataQuery = `
      SELECT c.*, ub.latitud, ub.longitud, ub.direccion, ub.distrito
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
      ${whereClause}
      ORDER BY c.apellidos, c.nombres
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const { rows } = await db.query(dataQuery, [...params, limit, offset]);

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems,
        totalPages: Math.ceil(totalItems / limit)
      }
    });
  } catch (err) {
    console.error('Error al filtrar clientes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/mapa', async (req, res) => {
  try {
    // 1. Obtener Clientes con su estado y ubicación
    const clientesRes = await db.query(`
      SELECT c.id, c.nombres, c.apellidos, c.estado, ub.latitud, ub.longitud, ub.direccion, ub.distrito, 
             c.bloqueado_por as worker_id
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
    `);

    // 2. Obtener Workers con jornada activa hoy
    const workersRes = await db.query(`
      SELECT u.id, u.nombres, u.apellidos, j.estado as estado_jornada, 
             COALESCE(ub.latitud, '0') as latitud, COALESCE(ub.longitud, '0') as longitud
      FROM usuarios u
      JOIN jornadas j ON j.worker_id = u.id AND j.fecha = CURRENT_DATE
      LEFT JOIN ubicaciones ub ON ub.id = u.ubicacion_id
      WHERE u.rol = 'WORKER' AND j.estado != 'JORNADA_FINALIZADA'
    `);

    res.json({
      data: {
        clientes: clientesRes.rows,
        workers: workersRes.rows
      }
    });
  } catch (err) {
    console.error('Error al cargar mapa:', err);
    res.status(500).json({ error: 'Error al cargar mapa' });
  }
});

module.exports = router;
