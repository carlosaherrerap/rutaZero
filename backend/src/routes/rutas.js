const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/rutas
 * Lista todas las rutas (admin) o las del worker autenticado
 */
router.get('/', async (req, res) => {
  try {
    let query, params;

    if (req.user.rol === 'ADMIN') {
      const sedeId = req.headers['x-sede-id'];
      params = [];
      let whereClause = 'WHERE 1=1';
      if (sedeId) {
        params.push(sedeId);
        whereClause = `WHERE r.sede_id = $${params.length}`;
      }

      query = `SELECT r.id, r.nombre, r.worker_id, r.creado_por, r.total_clientes, r.fecha_asignacion, r.created_at,
                      u.nombres AS worker_nombre, u.apellidos AS worker_apellido,
                      adm.nombres AS creador_nombre, adm.apellidos AS creador_apellido,
                      (SELECT json_agg(cliente_id) FROM ruta_clientes WHERE ruta_id = r.id) as client_ids,
                      (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado = 'LIBRE') as cant_libres,
                      (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado = 'REPROGRAMADO') as cant_repro,
                      (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado = 'EN_VISITA') as cant_visita,
                      (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado = 'NO_ENCONTRADO') as cant_no_enc,
                      (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado = 'VISITADO_PAGO') as cant_gest,
                      CASE 
                        WHEN (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado IN ('LIBRE', 'EN_VISITA')) = 0 THEN TRUE
                        ELSE FALSE
                      END AS completada
               FROM rutas r
               LEFT JOIN usuarios u ON u.id = r.worker_id
               LEFT JOIN usuarios adm ON adm.id = r.creado_por
               ${whereClause}
               ORDER BY r.fecha_asignacion DESC, r.nombre`;
    } else {
      query = `SELECT r.id, r.nombre, r.worker_id, r.creado_por, r.total_clientes, r.fecha_asignacion, r.created_at,
                      u.nombres AS worker_nombre, u.apellidos AS worker_apellido,
                      adm.nombres AS creador_nombre, adm.apellidos AS creador_apellido,
                      (SELECT json_agg(cliente_id) FROM ruta_clientes WHERE ruta_id = r.id) as client_ids,
                      (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado = 'LIBRE') as cant_libres,
                      (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado = 'REPROGRAMADO') as cant_repro,
                      (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado = 'EN_VISITA') as cant_visita,
                      (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado = 'NO_ENCONTRADO') as cant_no_enc,
                      (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado = 'VISITADO_PAGO') as cant_gest,
                      CASE 
                        WHEN (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado IN ('LIBRE', 'EN_VISITA')) = 0 THEN TRUE
                        ELSE FALSE
                      END AS completada
               FROM rutas r
               LEFT JOIN usuarios u ON u.id = r.worker_id
               LEFT JOIN usuarios adm ON adm.id = r.creado_por
               WHERE r.worker_id = $1
               ORDER BY r.fecha_asignacion DESC, r.nombre`;
      params = [req.user.id];
    }

    const { rows } = await db.query(query, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener rutas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/rutas/worker/:workerId
 * Lista rutas de un worker específico (admin)
 */
router.get('/worker/:workerId', adminOnly, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, nombre, fecha_asignacion, total_clientes 
       FROM rutas 
       WHERE worker_id = $1 
       ORDER BY fecha_asignacion DESC`,
      [req.params.workerId]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener rutas por worker:', err);
    res.status(500).json({ error: 'Error al obtener rutas' });
  }
});

/**
 * GET /api/rutas/:id
 * Detalle de una ruta con sus clientes
 */
router.get('/:id', async (req, res) => {
  try {
    // Obtener ruta
    const rutaResult = await db.query(
      `SELECT r.id, r.nombre, r.worker_id, r.creado_por, r.total_clientes, r.fecha_asignacion, r.created_at,
              u.nombres AS worker_nombre, u.apellidos AS worker_apellido,
              CASE 
                WHEN (SELECT COUNT(*) FROM ruta_clientes rc JOIN clientes c ON c.id = rc.cliente_id WHERE rc.ruta_id = r.id AND c.estado IN ('LIBRE', 'EN_VISITA')) = 0 THEN TRUE
                ELSE FALSE
              END AS completada
       FROM rutas r
       JOIN usuarios u ON u.id = r.worker_id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (rutaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }

    // Obtener clientes de la ruta
    const clientesResult = await db.query(
      `SELECT rc.orden, c.id, c.nombres, c.apellidos, c.dni, c.estado,
              c.fecha_pago, c.deuda_total, c.dias_retraso as dias_atraso,
              ub.latitud, ub.longitud, ub.direccion, ub.distrito,
              bw.nombres AS bloqueado_por_nombre
       FROM ruta_clientes rc
       JOIN clientes c ON c.id = rc.cliente_id
       LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       LEFT JOIN usuarios bw ON bw.id = c.bloqueado_por
       WHERE rc.ruta_id = $1
       ORDER BY rc.orden`,
      [req.params.id]
    );

    res.json({
      data: {
        ...rutaResult.rows[0],
        clientes: clientesResult.rows,
      },
    });
  } catch (err) {
    console.error('Error al obtener ruta:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/rutas
 * Crea una nueva ruta (solo admin)
 * Body: { nombre, worker_id, cliente_ids: [id1, id2, ...] }
 */
router.post('/', adminOnly, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { nombre, worker_id, cliente_ids, fecha_asignacion } = req.body;

    if (!nombre || !worker_id || !cliente_ids || !Array.isArray(cliente_ids) || cliente_ids.length === 0) {
      return res.status(400).json({ error: 'nombre, worker_id y cliente_ids (array no vacío) son requeridos' });
    }

    await client.query('BEGIN');

    // Crear ruta con fecha opcional y sede_id
    const sedeId = req.headers['x-sede-id'];
    const rutaResult = await client.query(
      `INSERT INTO rutas (nombre, worker_id, creado_por, sede_id, total_clientes, fecha_asignacion)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE))
       RETURNING *`,
      [nombre, worker_id, req.user.id, sedeId, cliente_ids.length, fecha_asignacion]
    );

    const ruta = rutaResult.rows[0];

    // Insertar clientes en la ruta
    for (let i = 0; i < cliente_ids.length; i++) {
      await client.query(
        'INSERT INTO ruta_clientes (ruta_id, cliente_id, orden) VALUES ($1, $2, $3)',
        [ruta.id, cliente_ids[i], i + 1]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({ data: ruta });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear ruta:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/rutas/:id
 * Elimina una ruta (solo admin)
 */
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM rutas WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    res.json({ message: 'Ruta eliminada correctamente' });
  } catch (err) {
    console.error('Error al eliminar ruta:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PATCH /api/rutas/:id
 * Actualiza una ruta (nombre, worker, clientes)
 */
router.patch('/:id', adminOnly, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { nombre, worker_id, cliente_ids } = req.body;
    const rutaId = req.params.id;

    await client.query('BEGIN');

    // Actualizar datos base
    await client.query(
      `UPDATE rutas SET
        nombre = COALESCE($1, nombre),
        worker_id = COALESCE($2, worker_id),
        total_clientes = COALESCE($3, total_clientes)
       WHERE id = $4`,
      [nombre, worker_id, cliente_ids ? cliente_ids.length : null, rutaId]
    );

    // Si se envían nuevos cliente_ids, reemplazamos la lista
    if (cliente_ids && Array.isArray(cliente_ids)) {
      await client.query('DELETE FROM ruta_clientes WHERE ruta_id = $1', [rutaId]);
      for (let i = 0; i < cliente_ids.length; i++) {
        await client.query(
          'INSERT INTO ruta_clientes (ruta_id, cliente_id, orden) VALUES ($1, $2, $3)',
          [rutaId, cliente_ids[i], i + 1]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Ruta actualizada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar ruta:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
});

module.exports = router;
