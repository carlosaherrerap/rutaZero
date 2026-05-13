const db = require('./db');
const bcrypt = require('bcryptjs');

/**
 * Asegura que las tablas tengan todas las columnas necesarias.
 * Útil cuando se recrean contenedores desde cero.
 */
const verifySchema = async () => {
  console.log('🔍 [InitDB] Verificando esquema de base de datos...');
  try {
    const path = require('path');
    const fs = require('fs');
    
    // Intentar leer el archivo schema.sql desde la raíz (funciona en Render con la nueva config)
    const schemaPath = path.join(__dirname, '../../../database/schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      console.log('📖 [InitDB] Ejecutando schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await db.query(schemaSql);
      console.log('✅ [InitDB] schema.sql ejecutado con éxito.');
    } else {
      console.warn('⚠️ [InitDB] No se encontró schema.sql en:', schemaPath);
      // Fallback a las migraciones manuales si el archivo no está
      const migrations = [
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
        'CREATE EXTENSION IF NOT EXISTS "postgis"',
        "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS requiere_firma BOOLEAN DEFAULT FALSE"
      ];
      for (const sql of migrations) {
        await db.query(sql);
      }
    }
  } catch (err) {
    console.error('❌ [InitDB] Error al inicializar esquema:', err.message);
  }
};

const ensureAdminUser = async () => {
  try {
    // Primero verificar esquema
    await verifySchema();

    // Seed Sedes iniciales
    await db.query(`
      INSERT INTO sedes (id, nombre, ciudad) 
      VALUES 
        ('11111111-1111-1111-1111-000000000001', 'Lima', 'LIMA'),
        ('11111111-1111-1111-1111-000000000002', 'Arequipa', 'AREQUIPA')
      ON CONFLICT (nombre) DO NOTHING
    `);

    const adminUsername = 'Informatech';
    const adminPassword = 'informaperu';
    
    const hash = await bcrypt.hash(adminPassword, 10);
    
    const query = `
      INSERT INTO usuarios (id, username, password_hash, rol, nombres, apellidos, dni, estado, sede_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE
      SET username = EXCLUDED.username,
          password_hash = EXCLUDED.password_hash,
          rol = EXCLUDED.rol,
          estado = EXCLUDED.estado,
          sede_id = EXCLUDED.sede_id;
    `;
    
    const values = [
      'c0000001-0001-0001-0001-000000000001',
      adminUsername,
      hash,
      'ADMIN',
      'Administrador',
      'General',
      '72345678',
      'ACTIVO',
      '11111111-1111-1111-1111-000000000001' // Default a Lima
    ];
    
    await db.query(query, values);
    console.log('✅ [InitDB] Usuario Admin verificado/actualizado');
    
    // El worker daniel.flores ya está en el seed.sql con el formato correcto, 
    // no es necesario recrearlo aquí con datos distintos.

  } catch (err) {
    console.error('❌ [InitDB] Error en inicialización:', err.message);
  }
};

module.exports = { ensureAdminUser };
