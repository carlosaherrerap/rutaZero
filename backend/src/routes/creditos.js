const { Router } = require('express');
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/clientes/:id/credito
 * Retorna los detalles financieros y socioeconómicos del crédito de un cliente.
 */
router.get('/clientes/:id/credito', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT * FROM creditos WHERE cliente_id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró información de crédito para este cliente' });
    }

    res.json({ data: rows[0] });
  } catch (err) {
    console.error('Error al obtener crédito:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/clientes/:id/verificacion
 * Guarda el reporte de auditoría y verificación cruzada de Caja Huancayo.
 */
router.post('/clientes/:id/verificacion', async (req, res) => {
  const { id: cliente_id } = req.params;
  const worker_id = req.user.id;
  const {
    ruta_id,
    liveness_photo_dni_front,
    liveness_photo_dni_back,
    liveness_selfie_photo,
    liveness_similarity_pct,
    liveness_calculated_age,
    liveness_written_age,
    dni_issue_date,
    firma_digital_url,
    preguntas_respuestas,
    observaciones,
    estado_verificacion,
    tipificacion,
    es_offline
  } = req.body;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insertar verificación en verificaciones_caja_huancayo
    const verRes = await client.query(
      `INSERT INTO verificaciones_caja_huancayo (
        cliente_id, worker_id, ruta_id,
        liveness_photo_dni_front, liveness_photo_dni_back, liveness_selfie_photo,
        liveness_similarity_pct, liveness_calculated_age, liveness_written_age,
        dni_issue_date, firma_digital_url, preguntas_respuestas, observaciones,
        estado_verificacion, es_offline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
      [
        cliente_id, worker_id, ruta_id || null,
        liveness_photo_dni_front, liveness_photo_dni_back, liveness_selfie_photo,
        liveness_similarity_pct, liveness_calculated_age, liveness_written_age,
        dni_issue_date || null, firma_digital_url,
        typeof preguntas_respuestas === 'string' ? preguntas_respuestas : JSON.stringify(preguntas_respuestas),
        observaciones, estado_verificacion || 'COMPLETADA', !!es_offline
      ]
    );

    // 2. Cambiar estado de cliente
    let nuevoEstado = 'LIBRE';
    if (tipificacion === 'PAGO')           nuevoEstado = 'VISITADO_PAGO';
    if (tipificacion === 'REPROGRAMARA')   nuevoEstado = 'REPROGRAMADO';
    if (tipificacion === 'NO_ENCONTRADO')  nuevoEstado = 'NO_ENCONTRADO';

    await client.query(
      `UPDATE clientes SET 
        estado = $1, 
        bloqueado_por = NULL, 
        fecha_gestion = CURRENT_DATE,
        updated_at = NOW() 
       WHERE id = $2`,
      [nuevoEstado, cliente_id]
    );

    // 3. Completar en ruta
    if (ruta_id) {
      await client.query(
        `UPDATE ruta_clientes SET completado = TRUE 
         WHERE ruta_id = $1 AND cliente_id = $2`,
        [ruta_id, cliente_id]
      );
    }

    // 4. Agregar a gestiones_historial para reportería/historial
    await client.query(
      `INSERT INTO gestiones_historial (
        cliente_id, worker_id, ruta_id, tipificacion, estado_nuevo, observacion, es_offline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [cliente_id, worker_id, ruta_id || null, tipificacion || 'PAGO', nuevoEstado, observaciones || '', !!es_offline]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { verificacion_id: verRes.rows[0].id } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al guardar verificacion Caja Huancayo:', err);
    res.status(500).json({ error: 'Error al guardar verificación' });
  } finally {
    client.release();
  }
});

module.exports = router;
