const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware, adminOnly);

/**
 * GET /api/stats/worker/:workerId
 * Calcula estadísticas avanzadas de tracking para un worker hoy
 */
router.get('/worker/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;
    const { fecha = new Date().toISOString().split('T')[0] } = req.query;

    // 1. Obtener puntos de tracking ordenados
    const { rows: tracking } = await db.query(`
      SELECT latitud, longitud, created_at
      FROM ubicaciones_worker_tracking
      WHERE worker_id = $1 AND DATE(created_at AT TIME ZONE 'America/Lima') = $2
      ORDER BY created_at ASC
    `, [workerId, fecha]);

    // 2. Obtener gestiones para saber cuándo estuvo con clientes
    const { rows: gestiones } = await db.query(`
      SELECT gh.created_at, c.nombres || ' ' || c.apellidos AS cliente,
             ub.latitud, ub.longitud
      FROM gestiones_historial gh
      JOIN clientes c ON c.id = gh.cliente_id
      LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
      WHERE gh.worker_id = $1 AND DATE(gh.created_at AT TIME ZONE 'America/Lima') = $2
      ORDER BY gh.created_at ASC
    `, [workerId, fecha]);

    // 3. Obtener ubicación base del worker (casa)
    const { rows: homeLoc } = await db.query(`
      SELECT ub.latitud, ub.longitud
      FROM usuarios u
      JOIN ubicaciones ub ON ub.id = u.ubicacion_id
      WHERE u.id = $1
    `, [workerId]);

    const home = homeLoc[0] || (tracking.length > 0 ? { latitud: tracking[0].latitud, longitud: tracking[0].longitud } : null);

    // Función Haversine para distancia en KM
    const getDist = (lat1, lon1, lat2, lon2) => {
      if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 0;
      if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    let totalDist = 0;
    for (let i = 0; i < tracking.length - 1; i++) {
      const d = getDist(
        parseFloat(tracking[i].latitud), parseFloat(tracking[i].longitud),
        parseFloat(tracking[i + 1].latitud), parseFloat(tracking[i + 1].longitud)
      );
      if (!isNaN(d)) totalDist += d;
    }

    // Calcular segmentos
    const segmentos = [];
    if (home && home.latitud && home.longitud && gestiones.length > 0) {
      // Segmento 1: Casa -> Cliente 1
      const firstGestionTime = new Date(gestiones[0].created_at);
      const pts1 = tracking.filter(t => new Date(t.created_at) <= firstGestionTime);
      
      if (gestiones[0].latitud && gestiones[0].longitud) {
        segmentos.push({
          razon: `De casa a ${gestiones[0].cliente}`,
          distancia: getDist(parseFloat(home.latitud), parseFloat(home.longitud), parseFloat(gestiones[0].latitud), parseFloat(gestiones[0].longitud)),
          puntos: [
            { lat: home.latitud, lng: home.longitud, label: 'Casa' },
            ...pts1.map(t => ({ lat: t.latitud, lng: t.longitud, label: 'Tracking' })),
            { lat: gestiones[0].latitud, lng: gestiones[0].longitud, label: gestiones[0].cliente }
          ].filter(p => p.lat && p.lng)
        });
      }

      // Segmentos entre clientes
      for (let i = 0; i < gestiones.length - 1; i++) {
        const startTime = new Date(gestiones[i].created_at);
        const endTime = new Date(gestiones[i+1].created_at);
        const pts = tracking.filter(t => {
          const tTime = new Date(t.created_at);
          return tTime > startTime && tTime <= endTime;
        });

        if (gestiones[i].latitud && gestiones[i].longitud && gestiones[i+1].latitud && gestiones[i+1].longitud) {
          segmentos.push({
            razon: `De ${gestiones[i].cliente} a ${gestiones[i+1].cliente}`,
            distancia: getDist(parseFloat(gestiones[i].latitud), parseFloat(gestiones[i].longitud), parseFloat(gestiones[i+1].latitud), parseFloat(gestiones[i+1].longitud)),
            puntos: [
              { lat: gestiones[i].latitud, lng: gestiones[i].longitud, label: gestiones[i].cliente },
              ...pts.map(t => ({ lat: t.latitud, lng: t.longitud, label: 'Tracking' })),
              { lat: gestiones[i+1].latitud, lng: gestiones[i+1].longitud, label: gestiones[i+1].cliente }
            ].filter(p => p.lat && p.lng)
          });
        }
      }
    }

    // Tiempo promedio de llenado (de fichas cerradas hoy)
    const { rows: avgFilling } = await db.query(`
      SELECT AVG(f.duracion_llenado_seg) as promedio
      FROM fichas f
      JOIN gestiones_historial gh ON gh.ficha_id = f.id
      WHERE gh.worker_id = $1 AND DATE(gh.created_at AT TIME ZONE 'America/Lima') = $2
    `, [workerId, fecha]);

    res.json({
      data: {
        distancia_total: totalDist.toFixed(2),
        segmentos,
        tiempo_llenado_avg: Math.round(avgFilling[0]?.promedio || 0),
        puntos_ruta: tracking // Para pintar en el mapa
      }
    });

  } catch (err) {
    console.error('Error en stats:', err);
    res.status(500).json({ error: 'Error al calcular estadísticas' });
  }
});

module.exports = router;
