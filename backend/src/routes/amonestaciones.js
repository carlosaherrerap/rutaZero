const { Router } = require('express');
const db = require('../config/db');
const router = Router();

// GET /api/amonestaciones
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT a.*, u.nombres || ' ' || u.apellidos as operador
            FROM amonestaciones a
            JOIN usuarios u ON u.id = a.worker_id
            ORDER BY a.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/amonestaciones
router.post('/', async (req, res) => {
    try {
        const { worker_id, tipo, fecha, descripcion, monto, creado_por } = req.body;
        const { rows } = await db.query(
            'INSERT INTO amonestaciones (worker_id, tipo, fecha, descripcion, monto, creado_por) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [worker_id, tipo, fecha, descripcion, monto, creado_por]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
