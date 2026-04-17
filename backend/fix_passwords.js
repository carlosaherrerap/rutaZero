const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5433, database: 'rutazero', user: 'postgres', password: 'pass123' });
const newHash = '$2b$10$t2x4P7YiebnzdGflHEjbTev18a4914y1LT4ooNcipSUSk/tLMBPyu';
pool.query('UPDATE usuarios SET password_hash = $1', [newHash])
  .then(r => { console.log('OK - Actualizados:', r.rowCount, 'usuarios'); pool.end(); })
  .catch(e => { console.error('ERROR:', e.message); pool.end(); });
