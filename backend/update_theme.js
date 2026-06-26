const db = require('./src/config/db');

const run = async () => {
  try {
    const config = {
      main_bg: '#dddddd',
      sidebar_bg: '#4465EA',
      primary_color: '#4465EA',
      main_text: '#212529',
      sidebar_text: '#FFFFFF',
      logo_filter: 'none'
    };

    console.log('Updating portal theme configurations in database...');
    for (const [clave, valor] of Object.entries(config)) {
      await db.query(
        'INSERT INTO configuracion_portal (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = $2',
        [clave, valor]
      );
      console.log(`Updated ${clave} -> ${valor}`);
    }
    console.log('✅ Configuration successfully updated in database.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating theme configuration:', err);
    process.exit(1);
  }
};

run();
