const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/tracking/posicion
 * Registra la posición GPS del worker (enviada cada X segundos)
 */
router.post('/posicion', async (req, res) => {
  try {
    const { latitud, longitud, precision_m } = req.body;
    const worker_id = req.user.id;

    if (!latitud || !longitud) return res.status(400).json({ error: 'Faltan coordenadas' });

    // 1. Guardar en historial de tracking (para dibujar el trazo)
    await db.query(
      `INSERT INTO ubicaciones_worker_tracking (worker_id, latitud, longitud, precision_m)
       VALUES ($1, $2, $3, $4)`,
      [worker_id, latitud, longitud, precision_m || 0]
    );

    // 2. Actualizar la ubicación "actual" en la tabla usuarios (para ver el punto actual en el mapa)
    // Primero necesitamos asegurar que el usuario tiene una ubicación_id vinculada
    const userRes = await db.query('SELECT ubicacion_id FROM usuarios WHERE id = $1', [worker_id]);
    const u_id = userRes.rows[0].ubicacion_id;

    if (u_id) {
      await db.query(
        `UPDATE ubicaciones SET latitud = $1, longitud = $2, updated_at = NOW() WHERE id = $3`,
        [latitud, longitud, u_id]
      );
    } else {
      const ubRes = await db.query(
        `INSERT INTO ubicaciones (latitud, longitud) VALUES ($1, $2) RETURNING id`,
        [latitud, longitud]
      );
      await db.query(`UPDATE usuarios SET ubicacion_id = $1 WHERE id = $2`, [ubRes.rows[0].id, worker_id]);
    }

    // 3. Emitir por Socket.io para actualización en tiempo real en el portal
    const io = req.app.get('io');
    io.emit('worker_gps_update', { worker_id, latitud, longitud, timestamp: new Date() });

    res.status(201).json({ message: 'Posición actualizada' });
  } catch (err) {
    console.error('Error en tracking posicion:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * GET /api/tracking/ruta-dia/:worker_id
 * Obtiene todos los puntos de tracking de un worker para un día (para dibujar el trazo)
 */
router.get('/ruta-dia/:worker_id', async (req, res) => {
  try {
    const { worker_id } = req.params;
    const { fecha } = req.query;
    const targetDate = fecha || new Date().toISOString().split('T')[0];

    const { rows } = await db.query(
      `SELECT latitud, longitud, created_at 
       FROM ubicaciones_worker_tracking 
       WHERE worker_id = $1 AND created_at::date = $2
       ORDER BY created_at ASC`,
       [worker_id, targetDate]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('Error al obtener ruta de tracking:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
