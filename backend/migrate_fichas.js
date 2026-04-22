const db = require('./src/config/db');

async function migrate() {
  console.log('🚀 Iniciando migración de base de datos...');
  
  try {
    // 1. Añadir columnas a la tabla fichas
    await db.query(`
      ALTER TABLE fichas 
      ADD COLUMN IF NOT EXISTS tipo_credito VARCHAR(100),
      ADD COLUMN IF NOT EXISTS fecha_desembolso DATE,
      ADD COLUMN IF NOT EXISTS monto_desembolso DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT 'PEN',
      ADD COLUMN IF NOT EXISTS nro_cuotas INTEGER,
      ADD COLUMN IF NOT EXISTS nro_cuotas_pagadas INTEGER,
      ADD COLUMN IF NOT EXISTS condicion_contable VARCHAR(100),
      ADD COLUMN IF NOT EXISTS saldo_capital DECIMAL(12,2);
    `);
    console.log('✅ Columnas añadidas a la tabla fichas');

    // 2. Crear tabla de evidencias si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS ficha_evidencias (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ficha_id UUID REFERENCES fichas(id) ON DELETE CASCADE,
        url_archivo TEXT NOT NULL,
        tipo_archivo VARCHAR(50) DEFAULT 'IMAGE',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla ficha_evidencias creada/verificada');

    // 3. Añadir columna monto_cuota si no existía (por si acaso)
    await db.query(`
      ALTER TABLE fichas ADD COLUMN IF NOT EXISTS monto_cuota DECIMAL(12,2);
    `);

    console.log('🎉 Migración completada con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración:', err);
    process.exit(1);
  }
}

migrate();
