const express = require('express');
const db = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(adminOnly);

// Listar plantillas de formularios
router.get('/plantillas', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM plantillas_formularios ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Crear plantilla
router.post('/plantillas', async (req, res) => {
  const { nombre, campos, requiere_firma } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO plantillas_formularios (nombre, campos, requiere_firma) VALUES ($1, $2, $3) RETURNING *',
      [nombre, JSON.stringify(campos), requiere_firma]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Asignar formulario a clientes por filtros
router.post('/asignar', async (req, res) => {
  const { plantilla_id, filtros } = req.body;
  // filtros: { dias_atraso_min, dias_atraso_max, distritos, etc }
  try {
    let query = 'UPDATE clientes SET plantilla_id = $1 WHERE 1=1';
    const params = [plantilla_id];
    
    if (filtros.dias_atraso_min !== undefined) {
      params.push(filtros.dias_atraso_min);
      query += ` AND dias_retraso >= $${params.length}`;
    }
    if (filtros.dias_atraso_max !== undefined) {
      params.push(filtros.dias_atraso_max);
      query += ` AND dias_retraso <= $${params.length}`;
    }
    if (filtros.distritos && filtros.distritos.length > 0) {
      params.push(filtros.distritos);
      query += ` AND distrito = ANY($${params.length})`;
    }

    const result = await db.query(query, params);
    res.json({ success: true, message: `${result.rowCount} clientes actualizados` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
