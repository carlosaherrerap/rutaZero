const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/monitoreo/log
 * Registra una acción granular del worker para cálculo de tiempos muertos
 */
router.post('/log', async (req, res) => {
  try {
    const { accion, cliente_id, ficha_id, metadata } = req.body;
    const worker_id = req.user.id;

    if (!accion) return res.status(400).json({ error: 'Falta el campo accion' });

    await db.query(
      `INSERT INTO monitoreo_acciones (worker_id, cliente_id, ficha_id, accion, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [worker_id, cliente_id, ficha_id, accion, metadata || {}]
    );

    res.status(201).json({ message: 'Acción registrada' });
  } catch (err) {
    console.error('Error en monitoreo log:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * GET /api/monitoreo/tiempos-muertos
 * Calcula los tiempos muertos solicitados:
 * - dato_1: GUARDAR FICHA (X) -> VISITAR (Y)
 * - dato_2: GUARDAR FICHA -> ABRIR FICHA
 * - dato_3: INICIA JORNADA -> PRIMER VISITAR
 */
router.get('/tiempos-muertos', async (req, res) => {
  try {
    const { fecha, worker_id } = req.query;
    const targetDate = fecha || new Date().toISOString().split('T')[0];

    let query = `
      WITH eventos AS (
        SELECT 
          worker_id,
          accion,
          created_at,
          cliente_id,
          LAG(accion) OVER (PARTITION BY worker_id ORDER BY created_at) as accion_previa,
          LAG(created_at) OVER (PARTITION BY worker_id ORDER BY created_at) as timestamp_previo,
          LAG(cliente_id) OVER (PARTITION BY worker_id ORDER BY created_at) as cliente_previo
        FROM monitoreo_acciones
        WHERE created_at::date = $1
    `;
    
    const params = [targetDate];
    if (worker_id) {
      params.push(worker_id);
      query += ` AND worker_id = $2`;
    }

    query += `
      )
      SELECT 
        e.*,
        u.nombres || ' ' || u.apellidos as worker_nombre,
        c.nombres || ' ' || c.apellidos as cliente_nombre
      FROM eventos e
      JOIN usuarios u ON u.id = e.worker_id
      LEFT JOIN clientes c ON c.id = e.cliente_id
      ORDER BY e.worker_id, e.created_at
    `;

    const { rows } = await db.query(query, params);

    // Procesar los datos en JS para facilitar el cálculo de las 3 métricas específicas
    const result = [];
    const workers = {};

    rows.forEach(row => {
      if (!workers[row.worker_id]) {
        workers[row.worker_id] = {
          worker_nombre: row.worker_nombre,
          eventos: [],
          metricas: { dato_1: [], dato_2: [], dato_3: null }
        };
      }
      workers[row.worker_id].eventos.push(row);
    });

    Object.keys(workers).forEach(wid => {
      const w = workers[wid];
      let primeraVisita = false;

      w.eventos.forEach((ev, idx) => {
        // dato_3: INICIA JORNADA -> PRIMERA VISITA
        if (!primeraVisita && ev.accion === 'VISITAR_PRESIONADO') {
          const inicioJornada = w.eventos.find(x => x.accion === 'JORNADA_INICIADA');
          if (inicioJornada && ev.created_at > inicioJornada.created_at) {
            w.metricas.dato_3 = Math.round((new Date(ev.created_at) - new Date(inicioJornada.created_at)) / 60000); // minutos
          }
          primeraVisita = true;
        }

        // dato_1: GUARDAR FICHA (X) -> VISITAR (Y)
        if (ev.accion === 'VISITAR_PRESIONADO' && ev.accion_previa === 'FICHA_GUARDADA') {
          const diff = Math.round((new Date(ev.created_at) - new Date(ev.timestamp_previo)) / 60000);
          w.metricas.dato_1.push({ cliente_desde: ev.cliente_previo, cliente_hacia: ev.cliente_id, minutos: diff });
        }

        // dato_2: GUARDAR FICHA -> ABRIR FICHA
        if (ev.accion === 'FICHA_ABIERTA' && ev.accion_previa === 'FICHA_GUARDADA') {
          const diff = Math.round((new Date(ev.created_at) - new Date(ev.timestamp_previo)) / 60000);
          w.metricas.dato_2.push({ minutos: diff });
        }
      });
      result.push({
        worker_id: wid,
        worker_nombre: w.worker_nombre,
        metricas: w.metricas
      });
    });

    res.json({ data: result });
  } catch (err) {
    console.error('Error calculando tiempos muertos:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * GET /api/monitoreo/logs/:worker_id
 * Obtiene la lista cronológica de acciones de un worker para un día específico
 */
router.get('/logs/:worker_id', async (req, res) => {
  try {
    const { worker_id } = req.params;
    const { fecha } = req.query;
    const targetDate = fecha || new Date().toISOString().split('T')[0];

    const { rows } = await db.query(
      `SELECT m.*, c.nombres as cliente_nombre, c.apellidos as cliente_apellido
       FROM monitoreo_acciones m
       LEFT JOIN clientes c ON c.id = m.cliente_id
       WHERE m.worker_id = $1 AND m.created_at::date = $2
       ORDER BY m.created_at ASC`,
      [worker_id, targetDate]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('Error obteniendo logs de monitoreo:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
