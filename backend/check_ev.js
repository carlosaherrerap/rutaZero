const db = require('./src/config/db');
async function check() {
  const r = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='evidencias';");
  console.log('Columnas de evidencias:', r.rows);
  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
