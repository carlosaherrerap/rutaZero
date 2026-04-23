const db = require('./src/config/db');

async function checkNullability() {
  try {
    const res = await db.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fichas';
    `);
    console.log('--- NULLABILITY ---');
    res.rows.forEach(r => {
      console.log(`${r.column_name}: ${r.is_nullable} (${r.data_type})`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkNullability();
