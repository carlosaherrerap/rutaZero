const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const router = Router();

// Stricter rate limit for login endpoint (Adjusted for shared office IPs)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login requests per `window` to prevent blocking the whole office WiFi
  message: { error: 'Demasiados intentos de login fallidos, por favor intente en 15 minutos.' }
});

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
router.post('/login', loginLimiter, [
  body('username').notEmpty().withMessage('Username es requerido').trim().escape(),
  body('password').notEmpty().withMessage('Password es requerido').trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, password } = req.body;

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

    // Generar JWT de forma segura sin fallback en duro
    const SECRET = process.env.JWT_SECRET;
    if (!SECRET) {
      console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
      return res.status(500).json({ error: 'Error interno de configuración de seguridad del servidor' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol },
      SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } // Changed default to 15m
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
    const SECRET = process.env.JWT_SECRET;
    if (!SECRET) {
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }
    const decoded = jwt_lib.verify(token, SECRET);

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
