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
server.listen(PORT, () => {
  console.log(`🚀 Ruta Zero API corriendo en http://localhost:${PORT}`);
  console.log(`📡 WebSocket activo en ws://localhost:${PORT}`);
});
