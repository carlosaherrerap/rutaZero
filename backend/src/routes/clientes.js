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
      SELECT c.*, ub.latitud, ub.longitud, ub.direccion, ub.distrito,
             u.nombres || ' ' || u.apellidos AS bloqueado_por_nombre
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
      LEFT JOIN usuarios u ON u.id = c.bloqueado_por
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
    // 1. Obtener Clientes con su estado, ubicación y DEUDA
    const clientesRes = await db.query(`
      SELECT c.id, c.nombres, c.apellidos, c.estado, c.deuda_total,
             ub.latitud, ub.longitud, ub.direccion, ub.distrito, 
             c.bloqueado_por as worker_id
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
    `);

    // 2. Obtener Workers con jornada activa hoy
    const workersRes = await db.query(`
      SELECT u.id, u.nombres, u.apellidos, j.estado as estado_jornada, 
             COALESCE(ub.latitud, '0') as latitud, COALESCE(ub.longitud, '0') as longitud
      FROM usuarios u
      LEFT JOIN jornadas j ON j.worker_id = u.id AND j.fecha = CURRENT_DATE
      LEFT JOIN ubicaciones ub ON ub.id = u.ubicacion_id
      WHERE u.rol = 'WORKER' AND (j.estado IS NULL OR j.estado != 'JORNADA_FINALIZADA')
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

/**
 * GET /api/clientes/:id
 * Obtiene detalle de un cliente específico
 */
router.get('/:id', async (req, res) => {
  try {
    // 1. Datos base del cliente
    const { rows: clienteRows } = await db.query(`
      SELECT c.*, ub.latitud, ub.longitud, ub.direccion, ub.distrito,
             u.nombres || ' ' || u.apellidos AS bloqueado_por_nombre
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
      LEFT JOIN usuarios u ON u.id = c.bloqueado_por
      WHERE c.id = $1
    `, [req.params.id]);

    if (clienteRows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    const cliente = clienteRows[0];

    // 2. Historial de gestiones con nombre del worker y timestamp
    const { rows: gestionesRows } = await db.query(`
      SELECT 
        gh.id, gh.tipificacion, gh.estado_nuevo, gh.observacion,
        gh.created_at AS timestamp_at,
        u.nombres || ' ' || u.apellidos AS worker_nombre,
        f.tipo_credito, f.monto_desembolso, f.moneda, f.nro_cuotas,
        f.nro_cuotas_pagadas, f.monto_cuota, f.condicion_contable,
        f.saldo_capital, f.fecha_desembolso, f.hora_inicio_visita,
        f.hora_apertura_ficha, f.hora_cierre_ficha, f.duracion_llenado_seg,
        COALESCE(
          json_agg(ev.url ORDER BY ev.id) FILTER (WHERE ev.id IS NOT NULL),
          '[]'
        ) AS evidencias
      FROM gestiones_historial gh
      JOIN usuarios u ON u.id = gh.worker_id
      LEFT JOIN fichas f ON f.id = gh.ficha_id
      LEFT JOIN evidencias ev ON ev.ficha_id = f.id
      WHERE gh.cliente_id = $1
      GROUP BY gh.id, u.nombres, u.apellidos,
               f.tipo_credito, f.monto_desembolso, f.moneda, f.nro_cuotas,
               f.nro_cuotas_pagadas, f.monto_cuota, f.condicion_contable,
               f.saldo_capital, f.fecha_desembolso, f.hora_inicio_visita,
               f.hora_apertura_ficha, f.hora_cierre_ficha, f.duracion_llenado_seg
      ORDER BY gh.created_at DESC
    `, [req.params.id]);

    res.json({ data: { ...cliente, gestiones: gestionesRows } });
  } catch (err) {
    console.error('Error al obtener cliente:', err);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
});

module.exports = router;
