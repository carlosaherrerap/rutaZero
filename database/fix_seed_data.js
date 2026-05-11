const fs = require('fs');

// ─── Direcciones reales por distrito (Lima y Arequipa) ───────────────────────
const ADDRESS_POOL = {
  'CALLAO':                ['Jr. Constitución 456', 'Av. Sáenz Peña 1234', 'Jr. Miller 789', 'Av. Buenos Aires 321', 'Jr. Colón 654', 'Av. Faucett 890'],
  'LIMA':                  ['Jr. Lampa 340', 'Av. Abancay 1560', 'Jr. Camaná 780', 'Av. Emancipación 430', 'Jr. Ucayali 218', 'Av. Tacna 950'],
  'LOS OLIVOS':            ['Av. Universitaria Norte 2345', 'Jr. Las Palmeras 678', 'Av. Naranjal 1102', 'Jr. Las Begonias 345', 'Av. Antúnez de Mayolo 876'],
  'ATE':                   ['Av. Separadora Industrial 980', 'Jr. Las Gardenias 213', 'Av. Nicolás Ayllón 450', 'Jr. Los Rosales 123', 'Av. Salamanca 670'],
  'SAN JUAN DE LURIGANCHO':['Av. Gran Chimú 1290', 'Jr. Las Flores 567', 'Av. Próceres de la Independencia 3400', 'Jr. Canto Grande 890', 'Av. El Sol 234'],
  'COMAS':                 ['Av. Túpac Amaru 1890', 'Jr. El Bosque 432', 'Av. Belaúnde 765', 'Jr. Las Casuarinas 210', 'Av. Carlos Izaguirre 540'],
  'CHORRILLOS':            ['Av. Huaylas 1234', 'Jr. Néstor Gambetta 321', 'Av. El Sol de la Molina 567', 'Jr. Los Pinos 890', 'Av. Defensores del Morro 450'],
  'VILLA EL SALVADOR':     ['Av. María Elena Moyano 678', 'Jr. Cesar Vallejo 234', 'Av. Juan Velasco Alvarado 890', 'Jr. Las Américas 456', 'Av. Separadora Industrial 123'],
  'SAN MARTIN DE PORRES':  ['Av. Perú 4560', 'Jr. San Martín 789', 'Av. Tomás Valle 1230', 'Jr. Los Jazmines 345', 'Av. Canta Callao 2100'],
  'MIRAFLORES':            ['Av. Larco 1234', 'Jr. Schell 456', 'Av. Benavides 890', 'Calle Berlín 123', 'Av. Arequipa 5000'],
  'SAN BORJA':             ['Av. San Luis 2345', 'Jr. Angamos Este 678', 'Av. del Aire 123', 'Jr. San Borja Norte 890', 'Av. Aviación 3450'],
  'SURCO':                 ['Av. Caminos del Inca 234', 'Jr. Monte Umbroso 567', 'Av. Primavera 1890', 'Jr. Los Laureles 345', 'Av. La Encalada 780'],
  'LA MOLINA':             ['Av. La Molina 890', 'Jr. Los Fresnos 234', 'Av. Raúl Ferrero 567', 'Jr. Las Camelias 123', 'Av. Melgarejo 450'],
  'JESÚS MARÍA':           ['Av. Inca Garcilaso de la Vega 1230', 'Jr. Manuel Candamo 456', 'Av. Salaverry 2100', 'Jr. Chavín 789'],
  // Arequipa
  'CERCADO':               ['Calle San Francisco 123', 'Av. Independencia 456', 'Jr. Mercaderes 789', 'Calle Moral 234', 'Av. Juan de la Torre 567'],
  'CAYMA':                 ['Av. Cayma 890', 'Jr. El Filtro 123', 'Calle El Solar 456', 'Av. Pumacahua 789', 'Jr. Grau 234'],
  'YANAHUARA':             ['Av. Ejército 567', 'Jr. Zarumilla 890', 'Calle Lima 123', 'Av. Jerusalén 456', 'Jr. Bolognesi 789'],
  'MIRAFLORES (AQP)':      ['Av. Víctor Andrés Belaunde 234', 'Jr. Alto de la Luna 567', 'Calle Paucarpata 890', 'Av. Kennedy 123'],
  'MARIANO MELGAR':        ['Av. Mariano Melgar 456', 'Jr. 28 de Julio 789', 'Calle Alto Selva Alegre 123', 'Av. Los Incas 234'],
  'PAUCARPATA':            ['Av. Paucarpata 890', 'Jr. El Nazareno 123', 'Calle Los Ángeles 456', 'Av. Primero de Mayo 789'],
  'JOSE LUIS BUSTAMANTE':  ['Av. Dolores 234', 'Jr. Simón Bolívar 567', 'Calle La Salle 890', 'Av. Porongoche 123'],
  'SACHACA':               ['Calle Sachaca 456', 'Jr. El Palomar 789', 'Av. Arancota 234', 'Calle La Rinconada 567'],
  // Fallback genérico
  'DEFAULT':               ['Jr. Los Pinos 123', 'Av. Principal 456', 'Jr. Las Flores 789', 'Av. Central 234', 'Jr. El Carmen 567'],
};

const getAddress = (() => {
  const counters = {};
  return (district) => {
    const key = district.toUpperCase().trim();
    const pool = ADDRESS_POOL[key] || ADDRESS_POOL['DEFAULT'];
    const idx = (counters[key] || 0) % pool.length;
    counters[key] = idx + 1;
    return pool[idx];
  };
})();

// ─── Nombres y apellidos reales peruanos ─────────────────────────────────────
const NOMBRES = [
  'Carlos Andrés', 'Ana María', 'Luis Alberto', 'María Elena', 'Jorge Luis',
  'Elena Patricia', 'Rosa Isabel', 'Miguel Ángel', 'Lucía Fernanda', 'José Antonio',
  'Carmen Rosa', 'Fernando Alonso', 'Teresa Milagros', 'Ricardo Enrique',
  'Diana Carolina', 'Raúl Eduardo', 'Marta Cecilia', 'Juan Carlos', 'Sofia Beatriz',
  'Pedro Pablo', 'Claudia Lorena', 'Alex Rodrigo', 'Verónica Susana', 'Martín Renato',
  'Gabriela Vanessa', 'Oscar Daniel', 'Paola Andrea', 'Roberto César', 'Katia Lizeth',
  'Ángel Jesús', 'Nathaly Roxana', 'Edwin Humberto', 'Sonia Patricia', 'Hugo Sebastián',
  'Carla Stephanie', 'Víctor Manuel', 'Silvia Maribel', 'Frank Anthony', 'Gloria Esperanza',
  'Ronald Giancarlo', 'Jessica Pamela', 'Elvis Darwin', 'Yolanda del Pilar', 'Christian Paul',
  'Lizbeth Yessenia', 'David Mauricio', 'Flor de María', 'Walter Iván', 'Nancy Esperanza',
];

const APELLIDOS = [
  'García Quispe', 'Rodríguez Mamani', 'López Flores', 'Martínez Cáceres', 'González Huanca',
  'Pérez Ccallo', 'Sánchez Medina', 'Ramírez Torres', 'Cruz Salinas', 'Flores Condori',
  'Reyes Apaza', 'Morales Huamán', 'Jiménez Tapia', 'Ruiz Vargas', 'Díaz Coaquira',
  'Moreno Pinto', 'Álvarez Churata', 'Romero Quispe', 'Alonso Mendoza', 'Gutiérrez Lazo',
  'Navarro Ccama', 'Torres Mamani', 'Domínguez Vilca', 'Vásquez Coillo', 'Ramos Huanca',
  'Gil Pari', 'Serrano Cusi', 'Blanco Mamani', 'Molina Cárdenas', 'Castillo Pilco',
  'Ortega Condori', 'Delgado Sucapuca', 'Moran Quisocala', 'Núñez Apaza', 'Herrera Lima',
  'Medina Calsin', 'Castro Llanos', 'Fuentes Pilco', 'Lara Vilcahuaman', 'Carvajal Roque',
  'Bravo Cutipa', 'Aguilar Puma', 'Rojas Mamani', 'Cabrera Ticona', 'Guerrero Llanqui',
  'Peña Calcina', 'Mendoza Coaquira', 'Santana Huchpa', 'Espinoza Rios', 'Vargas Limachi',
];

const getName = (() => {
  let idx = 0;
  return () => {
    const nombre = NOMBRES[idx % NOMBRES.length];
    const apellido = APELLIDOS[idx % APELLIDOS.length];
    idx++;
    return { nombre, apellido };
  };
})();

// ─── Función principal de transformación ────────────────────────────────────
function transformSQL(content) {
  let result = content;
  let nameIndex = 0;
  const usedNames = [];

  // 1. Reemplazar 'Dirección Masiva X' con dirección real según distrito
  result = result.replace(
    /'Dirección Masiva \d+',\s*'([^']+)'/g,
    (match, district) => {
      const addr = getAddress(district);
      return `'${addr}', '${district}'`;
    }
  );

  // 2. Reemplazar 'Cliente', 'Masivo X' y variantes con nombres reales
  // Patrón: 'nombre', 'apellidos' donde el apellido contiene "Masivo"
  result = result.replace(
    /'Cliente',\s*'Masivo\s*\d+'/g,
    () => {
      const { nombre, apellido } = getName();
      const [ap1, ap2] = apellido.split(' ');
      return `'${nombre}', '${ap1} ${ap2}'`;
    }
  );

  return result;
}

// ─── Procesar ambos archivos ──────────────────────────────────────────────────
const FILES = [
  'c:/Users/ASUS/Documents/github_Projects/Ruta_Zero/database/seed.sql',
  'c:/Users/ASUS/Documents/github_Projects/Ruta_Zero/massive_seed.sql',
];

FILES.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Archivo no encontrado: ${filePath}`);
    return;
  }
  console.log(`📖 Procesando: ${filePath}`);
  const original = fs.readFileSync(filePath, 'utf8');
  const transformed = transformSQL(original);

  const addrCount = (original.match(/Dirección Masiva \d+/g) || []).length;
  const nameCount = (original.match(/'Cliente',\s*'Masivo\s*\d+'/g) || []).length;

  fs.writeFileSync(filePath, transformed, 'utf8');
  console.log(`✅ ${filePath.split('/').pop()}: ${addrCount} direcciones y ${nameCount} nombres reemplazados.`);
});

console.log('\n🎉 ¡Transformación completa! Listo para docker compose down -v && docker compose up --build');
