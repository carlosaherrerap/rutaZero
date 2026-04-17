const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = Router();

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password son requeridos' });
    }

    // Buscar usuario
    const { rows } = await db.query(
      'SELECT id, username, password_hash, rol, nombres, apellidos, estado FROM usuarios WHERE username = $1',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = rows[0];

    // Verificar estado activo
    if (user.estado !== 'ACTIVO') {
      return res.status(403).json({ error: 'Cuenta inactiva. Contacte al administrador.' });
    }

    // Verificar password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Generar JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol,
        nombres: user.nombres,
        apellidos: user.apellidos,
      },
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/auth/me
 * Requiere token JWT
 */
router.get('/me', async (req, res) => {
  try {
    // El token se verifica en el middleware
    const jwt_lib = require('jsonwebtoken');
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt_lib.verify(token, process.env.JWT_SECRET);

    const { rows } = await db.query(
      `SELECT u.id, u.username, u.rol, u.nombres, u.apellidos, u.dni, u.telefono, u.email, u.estado,
              ub.latitud, ub.longitud, ub.direccion, ub.distrito
       FROM usuarios u
       LEFT JOIN ubicaciones ub ON ub.id = u.ubicacion_id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Error en /me:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
