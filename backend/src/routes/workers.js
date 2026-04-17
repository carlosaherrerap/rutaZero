const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/workers
 * Lista todos los workers con su estado de jornada
 */
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.nombres, u.apellidos, u.dni, u.telefono, u.email,
              u.foto_perfil_url, u.estado,
              ub.latitud, ub.longitud, ub.direccion, ub.distrito,
              j.estado AS estado_jornada,
              j.hora_inicio_sesion, j.hora_inicio_almuerzo, j.hora_fin_almuerzo, j.hora_fin_jornada,
              (SELECT COUNT(*) FROM rutas r WHERE r.worker_id = u.id AND r.fecha_asignacion = CURRENT_DATE) as rutas_activas
       FROM usuarios u
       LEFT JOIN ubicaciones ub ON ub.id = u.ubicacion_id
       LEFT JOIN jornadas j ON j.worker_id = u.id AND j.fecha = CURRENT_DATE
       WHERE u.rol = 'WORKER'
       ORDER BY u.apellidos, u.nombres`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener workers:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/workers/resumen
 * Dashboard: resumen de productividad de todos los workers
 */
router.get('/resumen', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM v_resumen_worker');
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener resumen:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/workers/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.*, ub.latitud, ub.longitud, ub.direccion, ub.distrito,
              j.estado AS estado_jornada
       FROM usuarios u
       LEFT JOIN ubicaciones ub ON ub.id = u.ubicacion_id
       LEFT JOIN jornadas j ON j.worker_id = u.id AND j.fecha = CURRENT_DATE
       WHERE u.id = $1 AND u.rol = 'WORKER'`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Worker no encontrado' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error al obtener worker:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/workers
 * Crea un nuevo worker (solo admin)
 */
router.post('/', adminOnly, async (req, res) => {
  try {
    const { username, password, nombres, apellidos, dni, telefono, email, latitud, longitud, direccion, distrito } = req.body;

    if (!username || !password || !nombres || !apellidos) {
      return res.status(400).json({ error: 'Campos obligatorios: username, password, nombres, apellidos' });
    }

    // Crear ubicación si se proporciona
    let ubicacion_id = null;
    if (latitud && longitud) {
      const bcrypt = require('bcryptjs');
      const ubResult = await db.query(
        `INSERT INTO ubicaciones (latitud, longitud, direccion, departamento, provincia, distrito)
         VALUES ($1, $2, $3, 'Lima', 'Lima', $4) RETURNING id`,
        [latitud, longitud, direccion || '', distrito || '']
      );
      ubicacion_id = ubResult.rows[0].id;
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const password_hash = await bcrypt.hash(password, 10);

    const { rows } = await db.query(
      `INSERT INTO usuarios (username, password_hash, rol, nombres, apellidos, dni, telefono, email, ubicacion_id)
       VALUES ($1, $2, 'WORKER', $3, $4, $5, $6, $7, $8)
       RETURNING id, username, nombres, apellidos, estado`,
      [username, password_hash, nombres, apellidos, dni, telefono, email, ubicacion_id]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El username o DNI ya existe' });
    }
    console.error('Error al crear worker:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PATCH /api/workers/:id
 * Actualiza un worker (solo admin)
 */
router.patch('/:id', adminOnly, async (req, res) => {
  try {
    const { nombres, apellidos, telefono, email, estado } = req.body;

    const { rows } = await db.query(
      `UPDATE usuarios SET
        nombres = COALESCE($1, nombres),
        apellidos = COALESCE($2, apellidos),
        telefono = COALESCE($3, telefono),
        email = COALESCE($4, email),
        estado = COALESCE($5, estado)
       WHERE id = $6 AND rol = 'WORKER'
       RETURNING id, username, nombres, apellidos, estado`,
      [nombres, apellidos, telefono, email, estado, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Worker no encontrado' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error al actualizar worker:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * JORNADA (JOURNEY) ENDPOINTS
 */

// Iniciar jornada
router.post('/jornada/iniciar', async (req, res) => {
  try {
    const { rows } = await db.query(
      `INSERT INTO jornadas (worker_id, fecha, estado, hora_inicio_sesion)
       VALUES ($1, CURRENT_DATE, 'JORNADA_INICIADA', NOW())
       ON CONFLICT (worker_id, fecha) DO UPDATE SET estado = 'JORNADA_INICIADA'
       RETURNING *`,
      [req.user.id]
    );
    const io = req.app.get('io');
    io.emit('journey_started', { worker_id: req.user.id, data: rows[0] });

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error al iniciar jornada:', err);
    res.status(500).json({ error: 'Error al iniciar jornada' });
  }
});

// Finalizar jornada
router.post('/jornada/finalizar', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE jornadas SET estado = 'JORNADA_FINALIZADA', hora_fin_jornada = NOW()
       WHERE worker_id = $1 AND fecha = CURRENT_DATE
       RETURNING *`,
      [req.user.id]
    );
    const io = req.app.get('io');
    io.emit('journey_finished', { worker_id: req.user.id, data: rows[0] });

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error al finalizar jornada:', err);
    res.status(500).json({ error: 'Error al finalizar jornada' });
  }
});

/**
 * VISITAS Y GESTIÓN
 */

// Obtener mi ruta de hoy
router.get('/me/ruta', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT rc.orden, c.*, ub.latitud, ub.longitud, ub.direccion, ub.distrito
       FROM rutas r
       JOIN ruta_clientes rc ON rc.ruta_id = r.id
       JOIN clientes c ON c.id = rc.cliente_id
       LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       WHERE r.worker_id = $1 AND r.fecha_asignacion = CURRENT_DATE
       ORDER BY rc.orden`,
      [req.user.id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener ruta propia:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Marcar inicio de visita (Bloquear cliente)
router.post('/clientes/:id/visitar', async (req, res) => {
  try {
    // Verificar si el worker ya tiene otro cliente bloqueado
    const check = await db.query(
      "SELECT id FROM clientes WHERE bloqueado_por = $1 AND estado = 'EN_VISITA'",
      [req.user.id]
    );
    if (check.rows.length > 0) {
      return res.status(403).json({ error: 'Ya tienes una visita en curso. Finalízala primero.' });
    }

    const { rows } = await db.query(
      `UPDATE clientes SET estado = 'EN_VISITA', bloqueado_por = $1, updated_at = NOW()
       WHERE id = $2 AND (estado = 'LIBRE' OR bloqueado_por = $1)
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (rows.length === 0) {
       return res.status(409).json({ error: 'El cliente ya está siendo visitado por otro worker' });
    }

    const io = req.app.get('io');
    io.emit('visit_started', { worker_id: req.user.id, cliente_id: req.params.id });

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error al iniciar visita:', err);
    res.status(500).json({ error: 'Error al iniciar visita' });
  }
});

// Guardar ficha de gestión (Tipificar)
router.post('/clientes/:id/ficha', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { tipificacion, observacion, monto_cuota } = req.body;
    const cliente_id = req.params.id;

    await client.query('BEGIN');

    // 1. Crear ficha
    const fichaRes = await client.query(
      `INSERT INTO fichas (cliente_id, worker_id, tipificacion, observacion, monto_cuota, estado, hora_cierre_ficha)
       VALUES ($1, $2, $3, $4, $5, 'COMPLETADA', NOW()) RETURNING id`,
      [cliente_id, req.user.id, tipificacion, observacion, monto_cuota]
    );

    // 2. Actualizar cliente
    let nuevoEstado = 'LIBRE';
    if (tipificacion === 'PAGO') nuevoEstado = 'VISITADO_PAGO';
    if (tipificacion === 'REPROGRAMARA') nuevoEstado = 'REPROGRAMADO';
    if (tipificacion === 'NO_ENCONTRADO') nuevoEstado = 'NO_ENCONTRADO';

    await client.query(
      `UPDATE clientes SET 
        estado = $1, 
        bloqueado_por = NULL, 
        fecha_gestion = CURRENT_DATE,
        updated_at = NOW()
       WHERE id = $2`,
      [nuevoEstado, cliente_id]
    );

    // 3. Registrar en historial
    await client.query(
      `INSERT INTO gestiones_historial (cliente_id, worker_id, ficha_id, tipificacion, estado_nuevo, observacion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [cliente_id, req.user.id, fichaRes.rows[0].id, tipificacion, nuevoEstado, observacion]
    );

    await client.query('COMMIT');
    
    const io = req.app.get('io');
    io.emit('ficha_completed', { worker_id: req.user.id, cliente_id: cliente_id, tipificacion });

    res.json({ message: 'Gestión guardada exitosamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al guardar ficha:', err);
    res.status(500).json({ error: 'Error al guardar gestión' });
  } finally {
    client.release();
  }
});

module.exports = router;

