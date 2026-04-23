const db = require('./src/config/db');

async function checkEnums() {
  try {
    const res = await db.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      ORDER BY t.typname, e.enumsortorder;
    `);
    console.log('--- ENUM VALUES ---');
    res.rows.forEach(row => {
      console.log(`${row.typname}: ${row.enumlabel}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkEnums();
