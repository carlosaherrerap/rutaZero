const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar multer para evidencias de fichas (S3/R2 o Local)
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

let upload;

if (process.env.S3_BUCKET) {
  // Configuración para Cloudflare R2 o S3
  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });

  upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.S3_BUCKET,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `evidencias/ev_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
      }
    }),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB
  });
  console.log('☁️ Almacenamiento en la nube (S3/R2) activado');
} else {
  // Fallback a almacenamiento local
  const uploadDir = path.join(__dirname, '../../uploads/evidencias');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `ev_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    }
  });

  upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Solo se permiten imágenes'));
    }
  });
  console.log('📂 Almacenamiento local activado');
}

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
       AND (u.sede_id = $1 OR $1 IS NULL)
       ORDER BY u.apellidos, u.nombres`,
       [req.headers['x-sede-id']]
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
              j.estado AS estado_jornada, j.hora_inicio_sesion, 
              j.hora_inicio_almuerzo, j.hora_fin_almuerzo, j.hora_fin_jornada
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

    const sedeId = req.headers['x-sede-id'];
    
    // Crear ubicación si se proporciona
    let ubicacion_id = null;
    if (latitud && longitud) {
      // Obtener nombre de la ciudad de la sede para departamento/provincia
      const sedeRes = await db.query('SELECT ciudad FROM sedes WHERE id = $1', [sedeId]);
      const sedeCiudad = sedeRes.rows.length > 0 ? sedeRes.rows[0].ciudad : 'Lima';

      const ubResult = await db.query(
        `INSERT INTO ubicaciones (latitud, longitud, direccion, departamento, provincia, distrito)
         VALUES ($1, $2, $3, $4, $4, $5) RETURNING id`,
        [latitud, longitud, direccion || '', sedeCiudad, distrito || '']
      );
      ubicacion_id = ubResult.rows[0].id;
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const password_hash = await bcrypt.hash(password, 10);

    const { rows } = await db.query(
      `INSERT INTO usuarios (username, password_hash, rol, nombres, apellidos, dni, telefono, email, ubicacion_id, sede_id)
       VALUES ($1, $2, 'WORKER', $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, username, nombres, apellidos, estado`,
      [username, password_hash, nombres, apellidos, dni, telefono, email, ubicacion_id, sedeId]
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
    const { nombres, apellidos, telefono, email, estado, password } = req.body;
    const bcrypt = require('bcryptjs');

    let password_hash = undefined;
    if (password) {
      password_hash = await bcrypt.hash(password, 10);
    }

    const { rows } = await db.query(
      `UPDATE usuarios SET
        nombres = COALESCE($1, nombres),
        apellidos = COALESCE($2, apellidos),
        telefono = COALESCE($3, telefono),
        email = COALESCE($4, email),
        estado = COALESCE($5, estado),
        password_hash = COALESCE($6, password_hash)
       WHERE id = $7 AND rol = 'WORKER'
       RETURNING id, username, nombres, apellidos, estado`,
      [nombres, apellidos, telefono, email, estado, password_hash, req.params.id]
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
       ON CONFLICT (worker_id, fecha) 
       DO UPDATE SET estado = 'JORNADA_INICIADA', hora_inicio_sesion = NOW()
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
       WHERE worker_id = $1 AND fecha = CURRENT_DATE AND estado != 'JORNADA_FINALIZADA'
       RETURNING *`,
      [req.user.id]
    );
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al finalizar jornada' });
  }
});

// Historial de jornadas del worker autenticado (para el calendario de asistencia)
router.get('/me/jornadas', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        j.id, j.fecha, j.estado,
        j.hora_inicio_sesion, j.hora_inicio_almuerzo, j.hora_fin_almuerzo, j.hora_fin_jornada,
        j.validado,
        -- Duracion refrigerio en minutos
        CASE 
          WHEN j.hora_inicio_almuerzo IS NOT NULL AND j.hora_fin_almuerzo IS NOT NULL
          THEN ROUND(EXTRACT(EPOCH FROM (j.hora_fin_almuerzo - j.hora_inicio_almuerzo)) / 60)
          ELSE 0
        END AS duracion_refrigerio_min,
        -- Horas trabajadas (descontando refrigerio)
        CASE
          WHEN j.hora_inicio_sesion IS NOT NULL AND j.hora_fin_jornada IS NOT NULL
          THEN ROUND(
            (EXTRACT(EPOCH FROM (j.hora_fin_jornada - j.hora_inicio_sesion)) / 3600 -
             COALESCE(EXTRACT(EPOCH FROM (j.hora_fin_almuerzo - j.hora_inicio_almuerzo)) / 3600, 0))::numeric,
          2)
          ELSE NULL
        END AS horas_trabajadas
      FROM jornadas j
      WHERE j.worker_id = $1
      ORDER BY j.fecha DESC
    `, [req.user.id]);
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener jornadas:', err);
    res.status(500).json({ error: 'Error al obtener jornadas' });
  }
});

/**
 * VISITAS Y GESTIÓN
 */

// Obtener mis rutas activas (agrupadas o listadas)
router.get('/me/ruta', async (req, res) => {
  try {
    // SIN filtro de fecha — muestra TODAS las rutas activas del worker (no COMPLETADO)
    // Evita cualquier problema de zona horaria UTC vs Lima (UTC-5)
    const { rows } = await db.query(
      `SELECT r.id as ruta_id, r.nombre as ruta_nombre, r.fecha_asignacion, r.estado as ruta_estado,
              rc.orden, c.id as cliente_id, c.nombres, c.apellidos, c.deuda_total, ub.direccion as cliente_direccion, 
              c.estado as cliente_estado, c.bloqueado_por, ub.latitud, ub.longitud, ub.distrito
       FROM rutas r
       LEFT JOIN ruta_clientes rc ON rc.ruta_id = r.id
       LEFT JOIN clientes c ON c.id = rc.cliente_id
       LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
       WHERE r.worker_id = $1 AND r.estado != 'COMPLETADO'
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
    // 1. Validar si el worker ya tiene una visita en curso
    const activeVisitCheck = await db.query(
      `SELECT id FROM clientes WHERE bloqueado_por = $1 AND estado = 'EN_VISITA'`,
      [req.user.id]
    );

    if (activeVisitCheck.rows.length > 0) {
      // Si ya está visitando a alguien, y no es el mismo cliente, bloqueamos.
      if (activeVisitCheck.rows[0].id !== req.params.id) {
        return res.status(409).json({ error: 'Ya tienes una visita en curso. Finaliza o cancela la visita actual antes de iniciar otra.' });
      }
    }

    const { rows } = await db.query(
      `UPDATE clientes SET estado = 'EN_VISITA', bloqueado_por = $1, updated_at = NOW()
       WHERE id = $2 AND (estado = 'LIBRE' OR bloqueado_por = $1)
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (rows.length === 0) {
       return res.status(409).json({ error: 'El cliente ya está siendo visitado por otro worker o no está disponible' });
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
// upload.array('evidencias', 5) procesa el multipart/form-data y deja los campos en req.body
router.post('/clientes/:id/ficha', upload.array('evidencias', 5), async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { 
      tipificacion, observacion, monto_cuota,
      tipo_credito, fecha_desembolso, monto_desembolso,
      moneda, nro_cuotas, nro_cuotas_pagadas,
      condicion_contable, saldo_capital,
      hora_inicio_visita, hora_apertura_ficha, duracion_llenado_seg,
      es_offline
    } = req.body;
    const cliente_id = req.params.id;

    // Fotos subidas via multer (req.files)
    // En S3, el campo es 'location'. En Local, construimos la URL relativa.
    // Construir URLs de evidencias usando URL pública si existe
    const publicBase = process.env.S3_PUBLIC_URL;
    const evidenciaUrls = req.files ? req.files.map(f => {
      if (publicBase) {
        // f.key es el path dentro del bucket (ej: evidencias/foto.jpg)
        return `${publicBase.endsWith('/') ? publicBase : publicBase + '/'}${f.key || f.filename}`;
      }
      return f.location || `/uploads/evidencias/${f.filename}`;
    }) : [];

    // Helpers de sanitización
    const safeNum   = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const safeInt   = v => { const n = parseInt(v);   return isNaN(n) ? 0 : n; };
    const safeStr   = v => (v && String(v).trim() !== '' ? String(v).trim() : null);
    const safeDate  = v => (v && String(v).trim() !== '' ? String(v).trim() : null);
    const safeEnum  = (v, allowed) => (allowed.includes(String(v || '').trim()) ? String(v).trim() : null);

    const cleanData = {
      tipificacion:       tipificacion === 'REPROGRAMAR' ? 'REPROGRAMARA' : safeEnum(tipificacion, ['PAGO', 'REPROGRAMARA', 'NO_ENCONTRADO']),
      observacion:        safeStr(observacion) || '',
      monto_cuota:        safeNum(monto_cuota),
      tipo_credito:       safeStr(tipo_credito),
      fecha_desembolso:   safeDate(fecha_desembolso),
      monto_desembolso:   safeNum(monto_desembolso),
      moneda:             safeStr(moneda) || 'PEN',
      nro_cuotas:         safeInt(nro_cuotas),
      nro_cuotas_pagadas: safeInt(nro_cuotas_pagadas),
      condicion_contable: safeEnum(condicion_contable, ['MOROSO', 'RESPONSABLE']),
      saldo_capital:      safeNum(saldo_capital),
      hora_inicio_visita: safeDate(hora_inicio_visita),
      hora_apertura_ficha:safeDate(hora_apertura_ficha),
      duracion:           safeInt(duracion_llenado_seg)
    };

    // Log con posición de parámetro para depuración
    console.log('📋 FICHA PARAMS:',
      '\n  $1 cliente_id:', cliente_id,
      '\n  $2 worker_id:', req.user.id,
      '\n  $3 tipificacion:', cleanData.tipificacion,
      '\n  $4 observacion:', cleanData.observacion,
      '\n  $5 monto_cuota:', cleanData.monto_cuota,
      '\n  $6 tipo_credito:', cleanData.tipo_credito,
      '\n  $7 fecha_desembolso:', cleanData.fecha_desembolso,
      '\n  $8 monto_desembolso:', cleanData.monto_desembolso,
      '\n  $9 moneda:', cleanData.moneda,
      '\n  $10 nro_cuotas:', cleanData.nro_cuotas,
      '\n  $11 nro_cuotas_pagadas:', cleanData.nro_cuotas_pagadas,
      '\n  $12 condicion_contable:', cleanData.condicion_contable,
      '\n  $13 saldo_capital:', cleanData.saldo_capital,
      '\n  $14 hora_inicio_visita:', cleanData.hora_inicio_visita,
      '\n  $15 hora_apertura_ficha:', cleanData.hora_apertura_ficha,
      '\n  $16 duracion:', cleanData.duracion
    );

    await client.query('BEGIN');

    // INSERT con 16 parámetros explícitos
    const fichaRes = await client.query(
      `INSERT INTO fichas (
        cliente_id, worker_id, tipificacion, observacion, monto_cuota,
        tipo_credito, fecha_desembolso, monto_desembolso, moneda,
        nro_cuotas, nro_cuotas_pagadas, condicion_contable, saldo_capital,
        hora_inicio_visita, hora_apertura_ficha, duracion_llenado_seg,
        estado, hora_cierre_ficha
      ) VALUES ($1,$2,$3::tipificacion_gestion,$4,$5,$6,$7,$8,$9,$10,$11,$12::condicion_contable,$13,$14,$15,$16,'COMPLETADA',NOW())
      RETURNING id`,
      [
        cliente_id,               // $1
        req.user.id,              // $2
        cleanData.tipificacion,   // $3
        cleanData.observacion,    // $4
        cleanData.monto_cuota,    // $5
        cleanData.tipo_credito,   // $6
        cleanData.fecha_desembolso, // $7
        cleanData.monto_desembolso, // $8
        cleanData.moneda,         // $9
        cleanData.nro_cuotas,     // $10
        cleanData.nro_cuotas_pagadas, // $11
        cleanData.condicion_contable, // $12
        cleanData.saldo_capital,  // $13
        cleanData.hora_inicio_visita, // $14
        cleanData.hora_apertura_ficha, // $15
        cleanData.duracion        // $16
      ]
    );

    const fichaId = fichaRes.rows[0].id;

    // Guardar evidencias
    for (const url of evidenciaUrls) {
      await client.query(
        `INSERT INTO evidencias (ficha_id, url) VALUES ($1, $2)`,
        [fichaId, url]
      );
    }

    // 2. Actualizar cliente: estado basado en la tipificación limpia
    let nuevoEstado = 'LIBRE';
    if (cleanData.tipificacion === 'PAGO')           nuevoEstado = 'VISITADO_PAGO';
    if (cleanData.tipificacion === 'REPROGRAMARA')   nuevoEstado = 'REPROGRAMADO';
    if (cleanData.tipificacion === 'NO_ENCONTRADO')  nuevoEstado = 'NO_ENCONTRADO';

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
      `INSERT INTO gestiones_historial (cliente_id, worker_id, ficha_id, tipificacion, estado_nuevo, observacion, es_offline)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [cliente_id, req.user.id, fichaRes.rows[0].id, cleanData.tipificacion, nuevoEstado, cleanData.observacion, es_offline === 'true' || es_offline === true]
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

router.get('/clientes/:id/ficha', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT f.*, gh.es_offline
      FROM fichas f
      JOIN gestiones_historial gh ON f.id = gh.ficha_id
      WHERE f.cliente_id = $1
      ORDER BY f.created_at DESC
      LIMIT 1
    `;
    const fichaRes = await db.query(query, [id]);
    if (fichaRes.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró ficha para este cliente' });
    }
    const ficha = fichaRes.rows[0];
    const evRes = await db.query('SELECT url FROM evidencias WHERE ficha_id = $1', [ficha.id]);
    ficha.evidencias = evRes.rows.map(r => r.url);
    res.json({ data: ficha });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener ficha' });
  }
});

/**
 * PERMISOS
 */

// Obtener mis permisos
router.get('/me/permisos', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM permisos WHERE worker_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener permisos:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Obtener mis amonestaciones
router.get('/me/amonestaciones', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM amonestaciones WHERE worker_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener amonestaciones:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Solicitar un permiso
router.post('/me/permisos', async (req, res) => {
  try {
    const { tipo, fecha_inicio, fecha_fin, descripcion } = req.body;
    
    if (!fecha_inicio || !descripcion) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const { rows } = await db.query(
      `INSERT INTO permisos (worker_id, tipo, fecha_inicio, fecha_fin, descripcion, estado)
       VALUES ($1, $2, $3, $4, $5, 'PENDIENTE')
       RETURNING *`,
      [req.user.id, tipo || 'Medico', fecha_inicio, fecha_fin || fecha_inicio, descripcion]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error('Error al solicitar permiso:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

module.exports = router;

