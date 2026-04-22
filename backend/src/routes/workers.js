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
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar jornada' });
  }
});

// Iniciar Refrigerio
router.post('/jornada/almuerzo/inicio', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE jornadas SET estado = 'EN_REFRIGERIO', hora_inicio_almuerzo = NOW()
       WHERE worker_id = $1 AND fecha = CURRENT_DATE AND estado = 'JORNADA_INICIADA'
       RETURNING *`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'Debes iniciar jornada primero' });
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar refrigerio' });
  }
});

// Fin de Refrigerio
router.post('/jornada/almuerzo/fin', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE jornadas SET estado = 'JORNADA_INICIADA', hora_fin_almuerzo = NOW()
       WHERE worker_id = $1 AND fecha = CURRENT_DATE AND estado = 'EN_REFRIGERIO'
       RETURNING *`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'No estás en refrigerio' });
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al finalizar refrigerio' });
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
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al finalizar jornada' });
  }
});

/**
 * VISITAS Y GESTIÓN
 */

// Obtener mis rutas activas (agrupadas o listadas)
router.get('/me/ruta', async (req, res) => {
  try {
    // Usamos LEFT JOIN para que la ruta aparezca aunque no tenga clientes asignados aún
    const { rows } = await db.query(
      `SELECT r.id as ruta_id, r.nombre as ruta_nombre, r.fecha_asignacion,
              rc.orden, c.id as cliente_id, c.nombres, c.apellidos, ub.direccion as cliente_direccion, 
              c.estado as cliente_estado, ub.latitud, ub.longitud, ub.distrito
       FROM rutas r
       LEFT JOIN ruta_clientes rc ON rc.ruta_id = r.id
       LEFT JOIN clientes c ON c.id = rc.cliente_id
       LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       WHERE r.worker_id = $1
       ORDER BY r.fecha_asignacion DESC, r.id, rc.orden`,
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
    // Verificar si el worker ya tiene OTRO cliente bloqueado (excluyendo el actual)
    const check = await db.query(
      "SELECT id FROM clientes WHERE bloqueado_por = $1 AND estado = 'EN_VISITA' AND id != $2",
      [req.user.id, req.params.id]
    );
    if (check.rows.length > 0) {
      return res.status(403).json({ error: 'Ya tienes una visita en curso con otro cliente. Finalízala primero.' });
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

// Liberar cliente (Quitar bloqueo y volver a estado LIBRE)
router.patch('/clientes/:id/liberar', async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE clientes SET estado = 'LIBRE', bloqueado_por = NULL, updated_at = NOW()
       WHERE id = $1 AND bloqueado_por = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'No puedes liberar un cliente que no tienes bloqueado' });
    }

    const io = req.app.get('io');
    io.emit('visit_released', { worker_id: req.user.id, cliente_id: req.params.id });

    res.json({ message: 'Cliente liberado correctamente', data: rows[0] });
  } catch (err) {
    console.error('Error al liberar cliente:', err);
    res.status(500).json({ error: 'Error al liberar cliente' });
  }
});

// Guardar ficha de gestión (Tipificar)
router.post('/clientes/:id/ficha', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { 
      tipificacion, observacion, monto_cuota,
      tipo_credito, fecha_desembolso, monto_desembolso,
      moneda, nro_cuotas, nro_cuotas_pagadas,
      condicion_contable, saldo_capital, evidencias
    } = req.body;
    const cliente_id = req.params.id;

    await client.query('BEGIN');

    // 1. Crear ficha con campos extendidos
    const fichaRes = await client.query(
      `INSERT INTO fichas (
        cliente_id, worker_id, tipificacion, observacion, monto_cuota, 
        tipo_credito, fecha_desembolso, monto_desembolso, moneda, 
        nro_cuotas, nro_cuotas_pagadas, condicion_contable, saldo_capital,
        estado, hora_cierre_ficha
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'COMPLETADA', NOW()) 
       RETURNING id`,
      [
        cliente_id, req.user.id, tipificacion, observacion, monto_cuota,
        tipo_credito, fecha_desembolso, monto_desembolso, moneda || 'PEN',
        nro_cuotas, nro_cuotas_pagadas, condicion_contable, saldo_capital
      ]
    );

    const fichaId = fichaRes.rows[0].id;

    // 2. Guardar evidencias (URLs de fotos)
    if (evidencias && Array.isArray(evidencias)) {
      for (const url of evidencias) {
        await client.query(
          `INSERT INTO ficha_evidencias (ficha_id, url_archivo) VALUES ($1, $2)`,
          [fichaId, url]
        );
      }
    }

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

