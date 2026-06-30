const fs = require('fs');

const LIMA_SEDE = '11111111-1111-1111-1111-000000000001';
const AREQUIPA_SEDE = '11111111-1111-1111-1111-000000000002';

const LIMA_DISTRICTS = ['LIMA','ATE','CALLAO','COMAS','CHORRILLOS','LOS OLIVOS','SAN JUAN DE LURIGANCHO','SAN MARTIN DE PORRES','VILLA EL SALVADOR'];
const AREQUIPA_DISTRICTS = ['AREQUIPA','CERRO COLORADO','CAYMA','YANAHUARA','JOSE LUIS BUSTAMANTE','PAUCARPATA','MIRAFLORES'];

let sql = '';

function toUUID(prefix, id) {
  // Format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
  // We use prefix (4 chars) + id (8 chars) for the last block
  const hexId = id.toString(16).padStart(12, '0');
  return `${prefix}-0000-0000-0000-${hexId}`;
}

function generate(count, sede, districts, prefix, idStart) {
  let uLines = [];
  let cLines = [];
  
  for (let i = 0; i < count; i++) {
    const id = i + idStart;
    // Prefixes: Lima Ubicaciones (a001), Arequipa Ubicaciones (a002)
    // Lima Clientes (c001), Arequipa Clientes (c002)
    const uPrefix = sede === LIMA_SEDE ? 'a0010000' : 'a0020000';
    const cPrefix = sede === LIMA_SEDE ? 'c0010000' : 'c0020000';
    
    const uId = toUUID(uPrefix, id);
    const cId = toUUID(cPrefix, id);
    
    const district = districts[Math.floor(Math.random() * districts.length)];
    const dni = (Math.floor(Math.random() * 90000000) + 10000000).toString();
    const tel = '9' + (Math.floor(Math.random() * 90000000) + 10000000).toString();
    
    // UBICACIONES (lat/long roughly around city centers)
    let lat, lon;
    if (sede === LIMA_SEDE) {
      lat = (-12.04 + (Math.random() - 0.5) * 0.2).toFixed(6);
      lon = (-77.03 + (Math.random() - 0.5) * 0.2).toFixed(6);
    } else {
      lat = (-16.40 + (Math.random() - 0.5) * 0.1).toFixed(6);
      lon = (-71.53 + (Math.random() - 0.5) * 0.1).toFixed(6);
    }

    uLines.push(`('${uId}', '${lat}', '${lon}', 'Dirección Masiva ${id}', '${district}', '${sede === LIMA_SEDE ? 'LIMA' : 'AREQUIPA'}', '${sede === LIMA_SEDE ? 'LIMA' : 'AREQUIPA'}')`);
    const targetIdx = (id % 22);
    const paymentDate = targetIdx === 0 ? '2026-06-29' : (targetIdx === 1 ? '2026-06-30' : `2026-07-${targetIdx - 1}`);
    cLines.push(`('${cId}', 'Cliente', 'Masivo ${id}', '${dni}', '${tel}', NULL, '${uId}', '${sede}', 'LIBRE', '${paymentDate}', ${(Math.random() * 5000).toFixed(2)}, ${(Math.random() * 15).toFixed(0)}, '2026-05-08')`);
  }
  
  sql += `INSERT INTO ubicaciones (id, latitud, longitud, direccion, distrito, provincia, departamento) VALUES\n` + uLines.join(',\n') + ' ON CONFLICT DO NOTHING;\n\n';
  sql += `INSERT INTO clientes (id, nombres, apellidos, dni, telefono, email, ubicacion_id, sede_id, estado, fecha_pago, deuda_total, dias_retraso, fecha_gestion) VALUES\n` + cLines.join(',\n') + ' ON CONFLICT DO NOTHING;\n\n';
}

sql += '-- MASSIVE LIMA DATA (1500)\n';
generate(1500, LIMA_SEDE, LIMA_DISTRICTS, '00000011', 1);

sql += '-- MASSIVE AREQUIPA DATA (500)\n';
generate(500, AREQUIPA_SEDE, AREQUIPA_DISTRICTS, '00000022', 1);

fs.writeFileSync('massive_seed.sql', sql);
console.log('Generated massive_seed.sql with VALID UUIDs');
