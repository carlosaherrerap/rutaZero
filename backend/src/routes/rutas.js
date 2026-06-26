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
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Liberar clientes de la ruta que NO tengan gestiones
    await client.query(
      `UPDATE clientes 
       SET estado = 'LIBRE', bloqueado_por = NULL 
       WHERE id IN (SELECT cliente_id FROM ruta_clientes WHERE ruta_id = $1)
       AND estado NOT IN ('VISITADO_PAGO', 'REPROGRAMADO', 'NO_ENCONTRADO')`,
      [req.params.id]
    );

    // 2. Eliminar la ruta (ON DELETE CASCADE en DB asume ruta_clientes)
    const { rowCount } = await client.query('DELETE FROM rutas WHERE id = $1', [req.params.id]);
    
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ruta no encontrada' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Ruta eliminada y clientes liberados correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar ruta:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    client.release();
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

/**
 * POST /api/rutas/auto-crear
 * Permite al worker crear/actualizar su propia ruta del día
 */
router.post('/auto-crear', async (req, res) => {
  const { cliente_ids } = req.body;
  if (!cliente_ids || !Array.isArray(cliente_ids) || cliente_ids.length === 0) {
    return res.status(400).json({ error: 'cliente_ids (array no vacío) es requerido' });
  }

  const worker_id = req.user.id;
  const sedeId = req.user.sede_id;
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Buscar si ya existe una ruta para este worker el día de hoy
    const existingRutaRes = await client.query(
      `SELECT id FROM rutas 
       WHERE worker_id = $1 AND fecha_asignacion = CURRENT_DATE 
       LIMIT 1`,
      [worker_id]
    );

    let rutaId;
    if (existingRutaRes.rows.length > 0) {
      rutaId = existingRutaRes.rows[0].id;

      // Eliminar asignaciones anteriores que NO estén completadas
      await client.query(
        `DELETE FROM ruta_clientes 
         WHERE ruta_id = $1 AND completado = FALSE`,
        [rutaId]
      );
    } else {
      // Crear nueva ruta
      const { rows: workerInfo } = await client.query('SELECT nombres, apellidos FROM usuarios WHERE id = $1', [worker_id]);
      const workerName = workerInfo.length > 0 ? `${workerInfo[0].nombres} ${workerInfo[0].apellidos}` : 'Asesor';
      const rutaNombre = `Ruta ${workerName} - ${new Date().toLocaleDateString('es-PE')}`;

      const insertRutaRes = await client.query(
        `INSERT INTO rutas (nombre, worker_id, creado_por, sede_id, total_clientes, fecha_asignacion)
         VALUES ($1, $2, $2, $3, $4, CURRENT_DATE)
         RETURNING id`,
        [rutaNombre, worker_id, (sedeId || null), cliente_ids.length]
      );
      rutaId = insertRutaRes.rows[0].id;
    }

    // 2. Insertar los nuevos clientes asignados
    const maxOrderRes = await client.query(
      `SELECT COALESCE(MAX(orden), 0) as max_ord FROM ruta_clientes WHERE ruta_id = $1`,
      [rutaId]
    );
    const startOrder = parseInt(maxOrderRes.rows[0].max_ord);

    for (let i = 0; i < cliente_ids.length; i++) {
      const checkDup = await client.query(
        `SELECT id FROM ruta_clientes WHERE ruta_id = $1 AND cliente_id = $2`,
        [rutaId, cliente_ids[i]]
      );
      if (checkDup.rows.length === 0) {
        await client.query(
          `INSERT INTO ruta_clientes (ruta_id, cliente_id, orden) VALUES ($1, $2, $3)`,
          [rutaId, cliente_ids[i], startOrder + i + 1]
        );
      }
    }

    // Recalcular total_clientes
    await client.query(
      `UPDATE rutas SET total_clientes = (SELECT COUNT(*) FROM ruta_clientes WHERE ruta_id = $1)
       WHERE id = $1`,
      [rutaId]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { ruta_id: rutaId } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al auto-crear ruta:', err);
    res.status(500).json({ error: 'Error interno del servidor al crear la ruta' });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/rutas/:id/ordenar
 * Permite al worker reordenar las visitas de su ruta
 */
router.patch('/:id/ordenar', async (req, res) => {
  const { id } = req.params;
  const { cliente_ids } = req.body;

  if (!cliente_ids || !Array.isArray(cliente_ids)) {
    return res.status(400).json({ error: 'cliente_ids (array) es requerido' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < cliente_ids.length; i++) {
      await client.query(
        `UPDATE ruta_clientes 
         SET orden = $1 
         WHERE ruta_id = $2 AND cliente_id = $3`,
        [i + 1, id, cliente_ids[i]]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Orden de clientes actualizado con éxito' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al reordenar clientes de ruta:', err);
    res.status(500).json({ error: 'Error al reordenar clientes de ruta' });
  } finally {
    client.release();
  }
});

module.exports = router;
