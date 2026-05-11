const db = require('./db');
const bcrypt = require('bcryptjs');

/**
 * Asegura que las tablas tengan todas las columnas necesarias.
 * Útil cuando se recrean contenedores desde cero.
 */
const verifySchema = async () => {
  console.log('🔍 [InitDB] Verificando esquema de base de datos...');
  const migrations = [
    // EXTENSIONES
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    'CREATE EXTENSION IF NOT EXISTS "postgis"',

    // CLIENTES
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS plantilla_id UUID",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bloqueado_por UUID",

    // TABLA DE SEDES (Sucursales)
    `CREATE TABLE IF NOT EXISTS sedes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      nombre VARCHAR(100) NOT NULL UNIQUE,
      ciudad VARCHAR(100),
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    // AGREGAR COLUMNA DE SEDE A TABLAS PRINCIPALES
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sede_id UUID REFERENCES sedes(id)",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS sede_id UUID REFERENCES sedes(id)",
    "ALTER TABLE rutas ADD COLUMN IF NOT EXISTS sede_id UUID REFERENCES sedes(id)",

    // TABLA DE PLANTILLAS DE FORMULARIOS
    `CREATE TABLE IF NOT EXISTS plantillas_formularios (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      configuracion JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`
  ];

  for (const sql of migrations) {
    try {
      await db.query(sql);
    } catch (err) {
      console.warn(`⚠️ [InitDB] Error en migración: ${sql.slice(0, 50)}... -> ${err.message}`);
    }
  }
  console.log('✅ [InitDB] Esquema verificado.');
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
