require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.io para tiempo real
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: true, // Echoes the request origin back to allow any client
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

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
});
