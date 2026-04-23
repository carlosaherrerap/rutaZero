const db = require('./src/config/db');

async function checkSchema() {
  try {
    // 1. Ver tipos actuales
    let res = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fichas' AND column_name IN ('tipo_credito', 'monto_desembolso', 'moneda');
    `);
    console.log('--- TIPOS ACTUALES ---');
    res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

    // 2. Forzar cambio con USING para evitar conflictos de casteo
    console.log('Ejecutando ALTER COLUMN con FORCE...');
    await db.query(`
      ALTER TABLE fichas 
      ALTER COLUMN tipo_credito TYPE VARCHAR(255) USING tipo_credito::text,
      ALTER COLUMN moneda TYPE VARCHAR(50) USING moneda::text,
      ALTER COLUMN monto_desembolso TYPE NUMERIC USING monto_desembolso::numeric;
    `);

    // 3. Verificar de nuevo
    res = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fichas' AND column_name IN ('tipo_credito', 'monto_desembolso', 'moneda');
    `);
    console.log('--- TIPOS FINALES ---');
    res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
