const db = require('./src/config/db');
async function run() {
  const r = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fichas' 
    ORDER BY ordinal_position
  `);
  console.log('ESTRUCTURA ACTUAL DE FICHAS:');
  r.rows.forEach(c => console.log(`- ${c.column_name}: ${c.data_type}`));
  process.exit(0);
}
run();
