const db = require('./db');
const bcrypt = require('bcryptjs');

const ensureAdminUser = async () => {
  try {
    const adminUsername = 'admin';
    const adminPassword = 'rutazero123';
    
    // Generar un hash fresco cada vez (opcional, pero asegura consistencia)
    const hash = await bcrypt.hash(adminPassword, 10);
    
    // Usar un UPSERT (INSERT ... ON CONFLICT)
    // Nota: El ID 'c0000001-0001-0001-0001-000000000001' es el estandar del seed
    const query = `
      INSERT INTO usuarios (id, username, password_hash, rol, nombres, apellidos, dni, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          rol = EXCLUDED.rol,
          estado = EXCLUDED.estado;
    `;
    
    const values = [
      'c0000001-0001-0001-0001-000000000001',
      adminUsername,
      hash,
      'ADMIN',
      'Carlos',
      'Mendoza Ríos',
      '72345678',
      'ACTIVO'
    ];
    
    await db.query(query, values);
    console.log('✅ [InitDB] Usuario Admin verificado/actualizado');
    
  } catch (err) {
    console.error('❌ [InitDB] Error al asegurar usuario Admin:', err.message);
  }
};

module.exports = { ensureAdminUser };
