const db = require('./src/config/db');
async function check() {
  const r = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%evidencia%';");
  console.log('Tablas encontradas:', r.rows);
  
  // También ver el error real de la ficha
  const r2 = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;");
  console.log('Todas las tablas:', r2.rows.map(x => x.table_name));
  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
