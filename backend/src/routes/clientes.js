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
    const { search, distrito, estado, worker_id, ruta_id, fecha_pago } = req.query;
    const pageNum = parseInt(req.query.page) || 1;
    const limitNum = parseInt(req.query.limit) || 12;
    const offsetNum = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params = [];

    const sedeId = req.headers['x-sede-id'];
    if (sedeId) {
      params.push(sedeId);
      whereClause += ` AND c.sede_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (c.nombres ILIKE $${params.length} OR c.apellidos ILIKE $${params.length} OR c.dni ILIKE $${params.length})`;
    }

    if (distrito) {
      params.push(`%${distrito}%`);
      whereClause += ` AND ub.distrito ILIKE $${params.length}`;
    }

    if (estado) {
      if (estado === 'NO_ENCONTRADO') {
        whereClause += ` AND c.estado = 'NO_ENCONTRADO'`;
      } else {
        params.push(estado);
        whereClause += ` AND c.estado = $${params.length}`;
      }
    }

    if (fecha_pago) {
      params.push(fecha_pago);
      whereClause += ` AND c.fecha_pago = $${params.length}`;
    }

    if (worker_id) {
      params.push(worker_id);
      // Filtramos clientes que pertenezcan a alguna ruta del worker
      whereClause += ` AND EXISTS (
        SELECT 1 FROM ruta_clientes rc 
        JOIN rutas r ON r.id = rc.ruta_id 
        WHERE rc.cliente_id = c.id AND r.worker_id = $${params.length}
      )`;
    }

    if (ruta_id) {
      params.push(ruta_id);
      whereClause += ` AND EXISTS (
        SELECT 1 FROM ruta_clientes rc 
        WHERE rc.cliente_id = c.id AND rc.ruta_id = $${params.length}
      )`;
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
      SELECT c.*, c.dias_retraso as dias_atraso, ub.latitud, ub.longitud, ub.direccion, ub.distrito,
             u.nombres || ' ' || u.apellidos AS bloqueado_por_nombre,
             r.nombre AS ruta_nombre,
             uw.nombres || ' ' || uw.apellidos AS worker_nombre
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
      LEFT JOIN usuarios u ON u.id = c.bloqueado_por
      LEFT JOIN ruta_clientes rc ON rc.cliente_id = c.id
      LEFT JOIN rutas r ON r.id = rc.ruta_id
      LEFT JOIN usuarios uw ON uw.id = r.worker_id
      ${whereClause}
      ORDER BY c.apellidos, c.nombres
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const { rows } = await db.query(dataQuery, [...params, limitNum, offsetNum]);

    res.json({
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum)
      }
    });
  } catch (err) {
    console.error('Error al filtrar clientes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/mapa', async (req, res) => {
  try {
    const { fecha_pago, tipo_gestion, en_ruta } = req.query;

    let queryClientes = `
      SELECT DISTINCT c.id, c.nombres, c.apellidos, c.estado, c.deuda_total, c.fecha_pago, c.dias_retraso as dias_atraso,
             ub.latitud, ub.longitud, ub.direccion, ub.distrito, 
             c.bloqueado_por as worker_id
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
      LEFT JOIN ruta_clientes rc ON rc.cliente_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    const sedeId = req.headers['x-sede-id'];
    if (sedeId) {
      queryClientes += ` AND c.sede_id = $${paramIdx++}`;
      params.push(sedeId);
    }

    if (fecha_pago) {
      queryClientes += ` AND c.fecha_pago = $${paramIdx++}`;
      params.push(fecha_pago);
    }
    
    if (tipo_gestion && tipo_gestion !== 'TODOS') {
      queryClientes += ` AND c.estado = $${paramIdx++}`;
      params.push(tipo_gestion);
    }

    if (en_ruta === 'true') {
      queryClientes += ` AND rc.id IS NOT NULL`;
    }

    const clientesRes = await db.query(queryClientes, params);

    // 2. Obtener Workers con jornada activa hoy de la sede seleccionada
    const workersRes = await db.query(`
      SELECT u.id, u.nombres, u.apellidos, j.estado as estado_jornada, 
             COALESCE(ub.latitud, '0') as latitud, COALESCE(ub.longitud, '0') as longitud
      FROM usuarios u
      LEFT JOIN jornadas j ON j.worker_id = u.id AND j.fecha = CURRENT_DATE
      LEFT JOIN ubicaciones ub ON ub.id = u.ubicacion_id
      WHERE u.rol = 'WORKER' 
        AND (u.sede_id = $1 OR $1 IS NULL)
        AND (j.estado IS NULL OR j.estado != 'JORNADA_FINALIZADA')
    `, [sedeId]);

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
             u.nombres || ' ' || u.apellidos AS bloqueado_por_nombre,
             r.nombre AS ruta_nombre,
             uw.nombres || ' ' || uw.apellidos AS worker_nombre,
             pf.nombre as plantilla_nombre,
             pf.campos as plantilla_campos,
             pf.requiere_firma as plantilla_requiere_firma
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
      LEFT JOIN usuarios u ON u.id = c.bloqueado_por
      LEFT JOIN ruta_clientes rc ON rc.cliente_id = c.id
      LEFT JOIN rutas r ON r.id = rc.ruta_id
      LEFT JOIN usuarios uw ON uw.id = r.worker_id
      LEFT JOIN plantillas_formularios pf ON pf.id = c.plantilla_id
      WHERE c.id = $1
    `, [req.params.id]);

    if (clienteRows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    const cliente = clienteRows[0];

    // 2. Historial de gestiones con nombre del worker y timestamp
    const { rows: gestionesRows } = await db.query(`
      SELECT 
        gh.id, gh.tipificacion, gh.estado_nuevo, gh.observacion, gh.es_offline,
        gh.created_at,
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
      GROUP BY gh.id, u.nombres, u.apellidos, gh.created_at,
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

/**
 * GET /api/clientes/chatbot/info
 * Búsqueda optimizada para el ChatBot (Clientes y Workers)
 */
router.get('/chatbot/info', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: 'Query requerida' });

    // 1. Buscar en Clientes
    const { rows: clienteRows } = await db.query(`
      SELECT c.id, c.nombres, c.apellidos, c.dni, c.estado, c.fecha_pago, c.deuda_total,
             ub.direccion, ub.distrito,
             (SELECT tipificacion FROM gestiones_historial WHERE cliente_id = c.id ORDER BY created_at DESC LIMIT 1) as ultima_gestion
      FROM clientes c
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
      WHERE (c.nombres ILIKE $1 OR c.apellidos ILIKE $1 OR c.dni ILIKE $1)
      LIMIT 1
    `, [`%${query}%`]);

    if (clienteRows.length > 0) {
      const client = clienteRows[0];
      return res.json({ 
        found: true, 
        type: 'CLIENTE',
        data: {
          nombre: `${client.nombres} ${client.apellidos}`,
          dni: client.dni,
          estado: client.estado,
          fecha_pago: client.fecha_pago,
          deuda: client.deuda_total,
          direccion: `${client.direccion}, ${client.distrito}`,
          ultima_ficha: client.ultima_gestion || "Aún no tiene ficha"
        }
      });
    }

    // 2. Si no es cliente, buscar en Workers (Usuarios con rol WORKER)
    const { rows: workerRows } = await db.query(`
      SELECT u.id, u.username, u.nombres, u.apellidos, u.rol, u.estado,
             s.nombre as sede_nombre,
             (SELECT COUNT(*) FROM rutas WHERE worker_id = u.id AND estado = 'COMPLETADO') as rutas_completadas
      FROM usuarios u
      LEFT JOIN sedes s ON s.id = u.sede_id
      WHERE u.rol = 'WORKER' 
        AND (u.nombres ILIKE $1 OR u.apellidos ILIKE $1 OR u.username ILIKE $1)
      LIMIT 1
    `, [`%${query}%`]);

    if (workerRows.length > 0) {
      const worker = workerRows[0];
      return res.json({
        found: true,
        type: 'OPERADOR',
        data: {
          nombre: `${worker.nombres} ${worker.apellidos}`,
          usuario: worker.username,
          sede: worker.sede_nombre,
          estado: worker.estado,
          total_rutas: worker.rutas_completadas
        }
      });
    }

    res.json({ found: false });
  } catch (err) {
    res.status(500).json({ error: 'Error en búsqueda chatbot' });
  }
});

module.exports = router;
