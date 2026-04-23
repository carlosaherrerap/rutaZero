const db = require('./src/config/db');

async function testInsert() {
  try {
    // Intentamos una inserción manual con los mismos datos que fallan
    console.log('Probando inserción manual...');
    const query = `
      INSERT INTO fichas (
        cliente_id, worker_id, tipificacion, observacion, monto_cuota, 
        tipo_credito, fecha_desembolso, monto_desembolso, moneda, 
        nro_cuotas, nro_cuotas_pagadas, condicion_contable, saldo_capital,
        estado, hora_cierre_ficha
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'COMPLETADA', NOW())
    `;
    
    // IDs de prueba (usaremos UUIDs válidos si existen, o strings)
    // Buscamos un cliente y worker real para la prueba
    const c = await db.query('SELECT id FROM clientes LIMIT 1');
    const u = await db.query("SELECT id FROM usuarios WHERE rol='WORKER' LIMIT 1");
    
    if (c.rows.length === 0 || u.rows.length === 0) {
      console.log('No hay datos para probar.');
      process.exit(0);
    }

    const values = [
      c.rows[0].id, 
      u.rows[0].id, 
      'PAGO', 
      'test', 
      100, 
      'personal hipotecario', // ESTO ES LO QUE FALLA SEGUN EL LOG ($6)
      '2026-01-01', 
      2200, 
      'PEN', 
      16, 
      14, 
      'RESPONSABLE', 
      26000
    ];

    await db.query(query, values);
    console.log('✅ Inserción de prueba EXITOSA. El problema no es el tipo de dato en esta query.');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR DETECTADO:', err);
    process.exit(1);
  }
}

testInsert();
