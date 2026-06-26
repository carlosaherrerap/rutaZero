const db = require('./src/config/db');

async function fix() {
  try {
    const res = await db.query("UPDATE clientes SET estado = 'LIBRE', bloqueado_por = NULL WHERE estado = 'EN_VISITA'");
    console.log('Clientes liberados:', res.rowCount);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
fix();
