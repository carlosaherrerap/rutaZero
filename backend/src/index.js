require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();
const server = http.createServer(app);

// Socket.io para tiempo real
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
  },
});

// Configuración de Redis Adapter para escalabilidad en Render
if (process.env.REDIS_URL) {
  const { createClient } = require('redis');
  const { createAdapter } = require('@socket.io/redis-adapter');
  
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('📡 Redis Adapter conectado para Socket.io');
  }).catch(err => {
    console.error('❌ Error conectando Redis Adapter:', err);
  });
}

// Middleware de Seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Vite/React
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
})); // OWASP: Secure HTTP Headers & Anti-XSS

// Rate Limiting (Protección contra DDoS L7 y Fuerza Bruta)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 peticiones por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde esta IP, por favor intente más tarde.' }
});

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (ej. mobile app curl, etc) o que estén en la lista
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origen rechazado: ${origin}`);
      callback(new Error('CORS Error: Origen no permitido por la política estricta de seguridad.'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Aplicar rate limiting a todas las rutas de la API
app.use('/api', apiLimiter);
app.use('/uploads', express.static('uploads'));
app.use('/public-site', express.static(path.join(__dirname, '../../hosting')));

// Crear carpeta de evidencias si no existe
const fs = require('fs');
if (!fs.existsSync('uploads/evidencias')) {
  fs.mkdirSync('uploads/evidencias', { recursive: true });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/workers', require('./routes/workers'));
app.use('/api/rutas', require('./routes/rutas'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/asistencia', require('./routes/asistencia'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/monitoreo', require('./routes/monitoreo'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/formularios', require('./routes/formularios'));
app.use('/api/public', require('./routes/public'));
app.use('/api/config', require('./routes/config'));
app.use('/api/amonestaciones', require('./routes/amonestaciones'));
app.use('/api/permisos', require('./routes/permisos'));

// Socket.io events
io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

// Hacer io accesible en las rutas
app.set('io', io);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;
const { ensureAdminUser } = require('./config/init_db');

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Routing API corriendo en http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket activo en ws://0.0.0.0:${PORT}`);
  
  // Asegurar que el admin siempre exista con la clave correcta
  await ensureAdminUser();

  console.log('📦 Sistema de Almacenamiento:', process.env.S3_BUCKET ? `CONECTADO a R2 (${process.env.S3_BUCKET})` : 'LOCAL (No se detectó S3_BUCKET)');
});
