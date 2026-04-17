const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'rutazero',
  user: process.env.DB_USER || 'rutazero_admin',
  password: process.env.DB_PASSWORD || 'rutazero_2026',
});

// Test connection
pool.query('SELECT NOW()')
  .then(() => console.log('✅ PostgreSQL conectado'))
  .catch(err => console.error('❌ Error de conexión a PostgreSQL:', err.message));

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
