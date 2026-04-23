const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'rutazero',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'pass123'
});

async function rebuild() {
  const client = await pool.connect();
  try {
    console.log('🚀 Iniciando RECONSTRUCCIÓN TOTAL de la tabla fichas...');
    
    await client.query('BEGIN');

    // 1. Borrar tabla actual y dependencias
    console.log('🗑️ Borrando tabla antigua...');
    await client.query('DROP TABLE IF EXISTS evidencias CASCADE');
    await client.query('DROP TABLE IF EXISTS fichas CASCADE');

    // 2. Crear tabla fichas con el esquema PERFECTO
    console.log('🏗️ Creando nueva tabla fichas...');
    await client.query(`
      CREATE TABLE fichas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cliente_id UUID NOT NULL REFERENCES clientes(id),
        worker_id UUID NOT NULL REFERENCES usuarios(id),
        tipificacion VARCHAR(50),
        observacion TEXT,
        monto_cuota NUMERIC(15,2) DEFAULT 0,
        tipo_credito VARCHAR(255),
        fecha_desembolso DATE,
        monto_desembolso NUMERIC(15,2) DEFAULT 0,
        moneda VARCHAR(10) DEFAULT 'PEN',
        nro_cuotas INTEGER DEFAULT 0,
        nro_cuotas_pagadas INTEGER DEFAULT 0,
        condicion_contable VARCHAR(50),
        saldo_capital NUMERIC(15,2) DEFAULT 0,
        estado VARCHAR(50) DEFAULT 'COMPLETADA',
        hora_inicio_visita TIMESTAMP WITH TIME ZONE,
        hora_apertura_ficha TIMESTAMP WITH TIME ZONE,
        hora_cierre_ficha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        duracion_llenado_seg INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // 3. Recrear tabla evidencias
    console.log('🏗️ Recreando tabla evidencias...');
    await client.query(`
      CREATE TABLE evidencias (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ficha_id UUID NOT NULL REFERENCES fichas(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        tipo VARCHAR(50) DEFAULT 'foto',
        orden INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('✅ TABLAS RECREADAS EXITOSAMENTE.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR FATAL:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

rebuild();
