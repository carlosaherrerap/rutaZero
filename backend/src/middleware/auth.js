const jwt = require('jsonwebtoken');

/**
 * Middleware: Verifica JWT en header Authorization: Bearer <token>
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const SECRET = process.env.JWT_SECRET || 'ruta_zero_secret_2024_secure';
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[-] Auth Fail: No Bearer token in header');
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    // console.log(`[+] Auth Success: User ${decoded.username} (${decoded.rol})`); // Silenciado para evitar spam
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[Auth Error] Token inválido o expirado');
    return res.status(401).json({ error: 'Sesión inválida' });
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
