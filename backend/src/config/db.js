const { Pool } = require('pg');
require('dotenv').config();

const isLocalhost = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'));

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rutazero',
      user: process.env.DB_USER || 'rutazero_admin',
      password: process.env.DB_PASSWORD || 'rutazero_2026',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

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
