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
      query = `SELECT r.*, 
                      u.nombres AS worker_nombre, u.apellidos AS worker_apellido,
                      adm.nombres AS creador_nombre, adm.apellidos AS creador_apellido
               FROM rutas r
               LEFT JOIN usuarios u ON u.id = r.worker_id
               LEFT JOIN usuarios adm ON adm.id = r.creado_por
               ORDER BY r.fecha_asignacion DESC, r.nombre`;
      params = [];
    } else {
      query = `SELECT r.*, 
                      u.nombres AS worker_nombre, u.apellidos AS worker_apellido,
                      adm.nombres AS creador_nombre, adm.apellidos AS creador_apellido
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
 * GET /api/rutas/:id
 * Detalle de una ruta con sus clientes
 */
router.get('/:id', async (req, res) => {
  try {
    // Obtener ruta
    const rutaResult = await db.query(
      `SELECT r.*, u.nombres AS worker_nombre, u.apellidos AS worker_apellido
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
              c.fecha_pago, c.deuda_total, c.dias_retraso,
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
    const { nombre, worker_id, cliente_ids } = req.body;

    if (!nombre || !worker_id || !cliente_ids || !Array.isArray(cliente_ids) || cliente_ids.length === 0) {
      return res.status(400).json({ error: 'nombre, worker_id y cliente_ids (array no vacío) son requeridos' });
    }

    await client.query('BEGIN');

    // Crear ruta
    const rutaResult = await client.query(
      `INSERT INTO rutas (nombre, worker_id, creado_por, total_clientes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre, worker_id, req.user.id, cliente_ids.length]
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

module.exports = router;
