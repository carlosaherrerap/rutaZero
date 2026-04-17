const jwt = require('jsonwebtoken');

/**
 * Middleware: Verifica JWT en header Authorization: Bearer <token>
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, rol }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Middleware: Solo permite acceso a administradores
 */
function adminOnly(req, res, next) {
  if (req.user.rol !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
