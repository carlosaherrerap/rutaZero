const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Required for most managed DBs like Render/Neon
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rutazero',
      user: process.env.DB_USER || 'rutazero_admin',
      password: process.env.DB_PASSWORD || 'rutazero_2026',
    };

const pool = new Pool(poolConfig);

// Forzar zona horaria local en cada cliente del pool
pool.on('connect', (client) => {
  client.query("SET timezone = 'America/Lima'");
});

// Test connection con reintentos para entornos Docker
const testConnection = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ PostgreSQL conectado');
      return;
    } catch (err) {
      console.log(`⚠️ [DB] Intento ${i + 1}/${retries} fallido, reintentando en 2s...`);
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  console.error('❌ Error de conexión a PostgreSQL tras varios intentos.');
};

testConnection();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
