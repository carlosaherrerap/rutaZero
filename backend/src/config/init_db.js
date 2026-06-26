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
    
    const initPath = path.join(__dirname, '../../../database/init.sql');
    const schemaPath = path.join(__dirname, '../../../database/schema.sql');
    const targetPath = fs.existsSync(initPath) ? initPath : schemaPath;
    
    if (fs.existsSync(targetPath)) {
      console.log(`📖 [InitDB] Ejecutando ${path.basename(targetPath)}...`);
      const schemaSql = fs.readFileSync(targetPath, 'utf8');
      await db.query(schemaSql);
      console.log(`✅ [InitDB] ${path.basename(targetPath)} ejecutado con éxito.`);
    } else {
      console.warn('⚠️ [InitDB] No se encontró init.sql ni schema.sql');
    }
  } catch (err) {
    console.error('❌ [InitDB] Error al inicializar esquema:', err.message);
  }

  // ── Migraciones de seguridad (siempre se ejecutan para garantizar integridad) ──
  const safetyMigrations = [
    // Tabla de radar GPS (puede fallar en schema.sql si el índice se creó antes)
    `CREATE TABLE IF NOT EXISTS worker_radar_puntos (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      worker_id        UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      latitud          DOUBLE PRECISION NOT NULL,
      longitud         DOUBLE PRECISION NOT NULL,
      estado_worker    VARCHAR(50) DEFAULT 'LIBRE',
      duracion_segundos INTEGER DEFAULT 0,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_radar_worker_time ON worker_radar_puntos(worker_id, created_at DESC)`,
  ];

  for (const sql of safetyMigrations) {
    try {
      await db.query(sql);
    } catch (e) {
      // Ignorar si ya existe (duplicate_object, etc.)
      if (!e.message.includes('already exists')) {
        console.warn('⚠️ [InitDB] Safety migration warning:', e.message);
      }
    }
  }
  console.log('✅ [InitDB] Migraciones de seguridad aplicadas.');
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
    
    // Seed Configuración del Portal (Minimalismo Funcional B2B por defecto)
    await db.query(`
      INSERT INTO configuracion_portal (clave, valor) VALUES 
      ('main_bg', '#dddddd'),
      ('sidebar_bg', '#4465EA'),
      ('primary_color', '#4465EA'),
      ('main_text', '#212529'),
      ('sidebar_text', '#FFFFFF'),
      ('logo_filter', 'none')
      ON CONFLICT (clave) DO NOTHING;
    `);

    // Verificar si necesitamos correr el SEED masivo
    const { rows: clientCount } = await db.query('SELECT COUNT(*) FROM clientes');
    if (parseInt(clientCount[0].count) === 0) {
      console.log('🌱 [InitDB] Base de datos vacía. Iniciando carga de 1,000 clientes (seed.sql)...');
      const path = require('path');
      const fs = require('fs');
      const seedPath = path.join(__dirname, '../../../database/seed.sql');
      
      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        // El seed.sql es grande, lo ejecutamos en un solo bloque
        await db.query(seedSql);
        console.log('✅ [InitDB] Carga masiva de clientes completada.');
      } else {
        console.error('❌ [InitDB] No se encontró seed.sql en:', seedPath);
      }
    }

  } catch (err) {
    console.error('❌ [InitDB] Error en inicialización:', err.message);
  }
};

module.exports = { ensureAdminUser };
