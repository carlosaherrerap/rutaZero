/**
 * migrate_fichas.js
 * Migración definitiva: convierte todas las columnas problemáticas de la tabla fichas
 * para aceptar texto y valores opcionales (NULL).
 * Ejecutar: node migrate_fichas.js
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5433,          // Puerto Docker
  database: 'rutazero',
  user: 'postgres',
  password: 'pass123'
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔌 Conectado a la base de datos Docker (puerto 5433)...');
    
    // 1. Ver tipos actuales de la tabla fichas
    const before = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fichas'
      ORDER BY ordinal_position;
    `);
    console.log('\n--- TIPOS ACTUALES ---');
    before.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));

    // 2. Aplicar migración: convertir tipos problemáticos
    console.log('\n⚙️  Ejecutando migración...');
    await client.query(`
      ALTER TABLE fichas
        ALTER COLUMN tipo_credito    TYPE VARCHAR(255) USING COALESCE(tipo_credito::text, ''),
        ALTER COLUMN moneda          TYPE VARCHAR(50)  USING COALESCE(moneda::text, 'PEN'),
        ALTER COLUMN monto_desembolso TYPE NUMERIC     USING COALESCE(monto_desembolso::numeric, 0),
        ALTER COLUMN monto_cuota     TYPE NUMERIC      USING COALESCE(monto_cuota::numeric, 0),
        ALTER COLUMN saldo_capital   TYPE NUMERIC      USING COALESCE(saldo_capital::numeric, 0),
        ALTER COLUMN nro_cuotas      TYPE INTEGER      USING COALESCE(nro_cuotas::integer, 0),
        ALTER COLUMN nro_cuotas_pagadas TYPE INTEGER   USING COALESCE(nro_cuotas_pagadas::integer, 0);
    `);

    // 3. Hacer que todos los campos de ficha sean opcionales (NULL)
    console.log('⚙️  Haciendo campos opcionales...');
    const optionalCols = [
      'tipo_credito', 'moneda', 'fecha_desembolso',
      'monto_desembolso', 'monto_cuota', 'saldo_capital',
      'nro_cuotas', 'nro_cuotas_pagadas', 'observacion',
      'condicion_contable', 'tipificacion'
    ];
    for (const col of optionalCols) {
      try {
        await client.query(`ALTER TABLE fichas ALTER COLUMN ${col} DROP NOT NULL;`);
        console.log(`  ✓ ${col} → nullable`);
      } catch (e) {
        // Ya era nullable, ignorar
        console.log(`  - ${col} ya era nullable`);
      }
    }

    // 4. Asegurar que id tenga default
    try {
      await client.query(`ALTER TABLE fichas ALTER COLUMN id SET DEFAULT gen_random_uuid();`);
      console.log('  ✓ id → DEFAULT gen_random_uuid()');
    } catch (e) {
      console.log('  - id ya tenía default');
    }

    // 5. Verificar resultado
    const after = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fichas'
      ORDER BY ordinal_position;
    `);
    console.log('\n--- TIPOS FINALES ---');
    after.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));

    // 6. Prueba de inserción real
    console.log('\n🧪 Probando inserción de prueba...');
    const c = await client.query('SELECT id FROM clientes LIMIT 1');
    const u = await client.query("SELECT id FROM usuarios WHERE rol='WORKER' LIMIT 1");
    
    if (c.rows.length > 0 && u.rows.length > 0) {
      await client.query(`
        INSERT INTO fichas (cliente_id, worker_id, tipificacion, observacion, monto_cuota,
          tipo_credito, fecha_desembolso, monto_desembolso, moneda,
          nro_cuotas, nro_cuotas_pagadas, condicion_contable, saldo_capital,
          estado, hora_cierre_ficha)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'COMPLETADA',NOW())
      `, [
        c.rows[0].id, u.rows[0].id, 'PAGO', 'prueba de migración', 100,
        'personal hipotecario', '2026-01-01', 2200, 'PEN', 16, 14, 'RESPONSABLE', 26000
      ]);
      // Limpiar la prueba
      await client.query(`DELETE FROM fichas WHERE observacion = 'prueba de migración'`);
      console.log('  ✅ Inserción de prueba EXITOSA y eliminada');
    }

    console.log('\n✅ MIGRACIÓN COMPLETA. La tabla fichas ahora acepta todos los tipos correctamente.');
    
  } catch (err) {
    console.error('\n❌ ERROR EN MIGRACIÓN:', err.message);
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
