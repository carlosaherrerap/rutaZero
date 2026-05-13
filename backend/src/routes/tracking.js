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
    const { latitud, longitud, precision_m, estado_worker } = req.body;
    const worker_id = req.user.id;

    if (!latitud || !longitud) return res.status(400).json({ error: 'Faltan coordenadas' });

    // 1. LÓGICA DE RADAR / MAPA DE CALOR
    // Obtener el último punto registrado hace poco
    const lastPointRes = await db.query(
      `SELECT id, latitud, longitud, created_at, duracion_segundos 
       FROM worker_radar_puntos 
       WHERE worker_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [worker_id]
    );

    const now = new Date();
    let shouldCreateNew = true;

    if (lastPointRes.rows.length > 0) {
      const last = lastPointRes.rows[0];
      
      // Calcular distancia aproximada en metros (Haversine simple)
      const R = 6371e3; // Radio de la tierra en metros
      const φ1 = latitud * Math.PI/180;
      const φ2 = last.latitud * Math.PI/180;
      const Δφ = (last.latitud - latitud) * Math.PI/180;
      const Δλ = (last.longitud - longitud) * Math.PI/180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      // Si se movió menos de 5 metros, actualizamos el punto existente
      if (distance < 5) {
        const diffSeconds = Math.floor((now - new Date(last.created_at)) / 1000);
        await db.query(
          `UPDATE worker_radar_puntos SET duracion_segundos = $1, estado_worker = $2 WHERE id = $3`,
          [diffSeconds, estado_worker || 'LIBRE', last.id]
        );
        shouldCreateNew = false;
      }
    }

    if (shouldCreateNew) {
      await db.query(
        `INSERT INTO worker_radar_puntos (worker_id, latitud, longitud, estado_worker)
         VALUES ($1, $2, $3, $4)`,
        [worker_id, latitud, longitud, estado_worker || 'LIBRE']
      );
    }

    // 2. Historial estándar (Legacy support)
    await db.query(
      `INSERT INTO ubicaciones_worker_tracking (worker_id, latitud, longitud, precision_m)
       VALUES ($1, $2, $3, $4)`,
      [worker_id, latitud, longitud, precision_m || 0]
    );

    // 3. Ubicación actual del usuario
    const userRes = await db.query('SELECT ubicacion_id FROM usuarios WHERE id = $1', [worker_id]);
    const u_id = userRes.rows[0]?.ubicacion_id;

    if (u_id) {
      await db.query(
        `UPDATE ubicaciones SET latitud = $1, longitud = $2, updated_at = NOW() WHERE id = $3`,
        [latitud, longitud, u_id]
      );
    }

    // 4. Tiempo real via Sockets
    const io = req.app.get('io');
    io.emit('worker_gps_update', { 
      worker_id, 
      latitud, 
      longitud, 
      estado_worker: estado_worker || 'LIBRE',
      timestamp: now 
    });

    res.status(201).json({ message: 'Posición procesada en radar' });
  } catch (err) {
    console.error('Error en tracking radar:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * GET /api/tracking/radar/:worker_id
 * Obtiene los puntos de radar de las últimas 24 horas
 */
router.get('/radar/:worker_id', async (req, res) => {
  try {
    const { worker_id } = req.params;
    const { rows } = await db.query(
      `SELECT latitud, longitud, duracion_segundos, estado_worker, created_at 
       FROM worker_radar_puntos 
       WHERE worker_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at ASC`,
      [worker_id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener radar' });
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
