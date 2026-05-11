const { Router } = require('express');
const db = require('../config/db');
const router = Router();

// GET /api/config
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT clave, valor FROM configuracion_portal');
        const config = {};
        rows.forEach(r => config[r.clave] = r.valor);
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/config
router.post('/', async (req, res) => {
    try {
        const settings = req.body; // { clave: valor, ... }
        for (const [clave, valor] of Object.entries(settings)) {
            await db.query(
                'INSERT INTO configuracion_portal (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = $2',
                [clave, valor]
            );
        }
        res.json({ message: 'Configuración actualizada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
