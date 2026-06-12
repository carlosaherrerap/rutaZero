const fs = require('fs');

const dates = [
  '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30',
  '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04',
  '2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08',
  '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
  '2026-06-13', '2026-06-14', '2026-06-15'
];

let sql = `-- Seed para 1500 clientes adicionales con fechas de pago entre 27 de Abril y 15 de Mayo de 2026\n`;
sql += `INSERT INTO clientes (id, nombres, apellidos, dni, telefono, email, ubicacion_id, estado, fecha_pago, deuda_total, dias_retraso, fecha_gestion) VALUES\n`;

const names = ['Carlos', 'Ana', 'Luis', 'Maria', 'Jorge', 'Elena', 'Pedro', 'Marta', 'Juan', 'Rosa', 'Miguel', 'Lucia', 'Jose', 'Carmen', 'Raul', 'Diana', 'Fernando', 'Sofia', 'Ricardo', 'Teresa'];
const surnames = ['Perez', 'Gomez', 'Lopez', 'Diaz', 'Torres', 'Ramirez', 'Cruz', 'Flores', 'Rojas', 'Morales', 'Silva', 'Mendoza', 'Herrera', 'Castillo', 'Campos', 'Salazar', 'Vargas', 'Rios', 'Guerrero', 'Espinoza'];

const records = [];
let idCounter = 1;

for (let i = 0; i < 1500; i++) {
  const id = `e0000001-0001-0001-0000-${idCounter.toString().padStart(12, '0')}`;
  idCounter++;
  
  const nombre = names[Math.floor(Math.random() * names.length)];
  const apellido = surnames[Math.floor(Math.random() * surnames.length)] + ' ' + surnames[Math.floor(Math.random() * surnames.length)];
  const dni = '4' + Math.floor(1000000 + Math.random() * 9000000).toString();
  const telefono = '9' + Math.floor(10000000 + Math.random() * 90000000).toString();
  
  const xx = Math.floor(Math.random() * 20) + 1;
  const yy = Math.floor(Math.random() * 10) + 1;
  const ubicacion_id = `a0000001-0001-0001-${xx.toString().padStart(4, '0')}-${yy.toString().padStart(12, '0')}`;
  
  const fecha_pago = dates[Math.floor(Math.random() * dates.length)];
  const deuda = (Math.random() * 10000 + 500).toFixed(2);
  const dias_retraso = Math.floor(Math.random() * 30);
  
  records.push(`('${id}', '${nombre}', '${apellido}', '${dni}', '${telefono}', NULL, '${ubicacion_id}', 'LIBRE', '${fecha_pago}', ${deuda}, ${dias_retraso}, '2026-04-16')`);
}

sql += records.join(',\n') + ';\n';
fs.writeFileSync('seed_masivo.sql', sql);
console.log('Successfully generated database/seed_masivo.sql');
