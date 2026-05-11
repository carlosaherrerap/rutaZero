const db = require('./db');

const setup = async () => {
  try {
    console.log('🚀 [Setup] Iniciando actualización de esquema...');

    // 1. Tabla de monitoreo de acciones
    await db.query(`
      CREATE TABLE IF NOT EXISTS monitoreo_acciones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        worker_id UUID REFERENCES usuarios(id),
        cliente_id UUID REFERENCES clientes(id),
        ficha_id UUID,
        accion VARCHAR(50) NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla monitoreo_acciones verificada');

    // 2. Tabla de tracking GPS
    await db.query(`
      CREATE TABLE IF NOT EXISTS ubicaciones_worker_tracking (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        worker_id UUID REFERENCES usuarios(id),
        latitud DOUBLE PRECISION NOT NULL,
        longitud DOUBLE PRECISION NOT NULL,
        precision_m REAL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla ubicaciones_worker_tracking verificada');

    // 3. Tabla de plantillas de formularios
    await db.query(`
      CREATE TABLE IF NOT EXISTS plantillas_formularios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100) NOT NULL,
        campos JSONB NOT NULL,
        requiere_firma BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla plantillas_formularios verificada');

    // 4. Agregar columna plantilla_id a clientes si no existe
    await db.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='plantilla_id') THEN
          ALTER TABLE clientes ADD COLUMN plantilla_id UUID REFERENCES plantillas_formularios(id);
        END IF;
      END $$;
    `);
    console.log('✅ Columna plantilla_id en clientes verificada');

    // 5. Insertar una plantilla de ejemplo si no hay ninguna
    const plantillas = await db.query('SELECT count(*) FROM plantillas_formularios');
    if (parseInt(plantillas.rows[0].count) === 0) {
      await db.query(`
        INSERT INTO plantillas_formularios (nombre, campos, requiere_firma)
        VALUES ($1, $2, $3)`,
        ['Ficha Estándar GHT', JSON.stringify([
          { label: 'Tipo de Vivienda', type: 'text', placeholder: 'Ej. Propia, Alquilada' },
          { label: 'Ingreso Mensual', type: 'number', placeholder: '0.00' },
          { label: 'Observaciones Campo', type: 'text', placeholder: 'Detalles de la visita' }
        ]), true]
      );
      console.log('✅ Plantilla de ejemplo creada');
    }

    console.log('🏁 [Setup] Esquema actualizado con éxito.');
  } catch (err) {
    console.error('❌ [Setup] Error actualizando esquema:', err.message);
  }
};

setup().then(() => process.exit());
