const jwt = require('jsonwebtoken');

/**
 * Middleware: Verifica JWT en header Authorization: Bearer <token>
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const SECRET = process.env.JWT_SECRET;
  if (!SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is missing');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    console.log('[-] Auth Fail: No Bearer token in header or query');
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
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
