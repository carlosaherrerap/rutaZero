const { Router } = require('express');
const db = require('../config/db');
const router = Router();

// GET /api/permisos
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT p.*, u.nombres || ' ' || u.apellidos as operador
            FROM permisos p
            JOIN usuarios u ON u.id = p.worker_id
            ORDER BY p.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/permisos/:id/validar
router.patch('/:id/validar', async (req, res) => {
    try {
        const { id } = req.params;
        const { validado_por } = req.body;
        const { rows } = await db.query(
            'UPDATE permisos SET estado = $1, validado_por = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            ['VALIDADO', validado_por, id]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
