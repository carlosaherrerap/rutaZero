const db = require('./src/config/db');
require('dotenv').config();

async function checkSystem() {
  console.log("=== SISTEMA DE DIAGNÓSTICO RUTA ZERO ===");
  console.log("1. Verificando JWT_SECRET...");
  console.log("Secret en ENV:", process.env.JWT_SECRET ? "DEFINIDO" : "NO DEFINIDO");
  
  try {
    console.log("\n2. Verificando Ruta de Ana Castro...");
    const ana = await db.query("SELECT id FROM usuarios WHERE username = 'ana.castro'");
    if (ana.rows.length === 0) {
      console.log("[-] Error: El usuario 'ana.castro' no existe.");
    } else {
      const anaId = ana.rows[0].id;
      const rutas = await db.query("SELECT * FROM rutas WHERE worker_id = $1", [anaId]);
      console.log(`[+] Ana existe (ID: ${anaId}). Tiene ${rutas.rows.length} rutas en total.`);
      
      const hoy = await db.query("SELECT * FROM rutas WHERE worker_id = $1 AND fecha_asignacion = CURRENT_DATE", [anaId]);
      console.log(`[+] Rutas para HOY (${new Date().toISOString().split('T')[0]}): ${hoy.rows.length}`);
    }

    console.log("\n3. Verificando Filtro de Clientes (Zonas)...");
    const distritos = await db.query("SELECT DISTINCT distrito FROM ubicaciones");
    console.log("[+] Distritos registrados en DB:", distritos.rows.map(r => r.distrito).join(', '));

  } catch (e) {
    console.error("[-] Error en diagnóstico:", e.message);
  } finally {
    process.exit();
  }
}

checkSystem();
