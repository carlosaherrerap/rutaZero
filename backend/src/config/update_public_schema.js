const db = require('./db');

const updateSchema = async () => {
  try {
    console.log('🔄 [Schema Update] Verificando columnas para registros públicos...');

    const columnsToAdd = [
      { name: 'tipo_documento', type: 'VARCHAR(20)' },
      { name: 'departamento', type: 'VARCHAR(100)' },
      { name: 'provincia', type: 'VARCHAR(100)' },
      { name: 'referencia', type: 'TEXT' },
      { name: 'fotos_registro', type: 'JSONB DEFAULT \'[]\'' } // Para guardar URLs de fotos
    ];

    for (const col of columnsToAdd) {
      await db.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='${col.name}') THEN
            ALTER TABLE clientes ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    // Para usuarios (workers)
    const userColumns = [
      { name: 'tipo_documento', type: 'VARCHAR(20)' },
      { name: 'departamento', type: 'VARCHAR(100)' },
      { name: 'provincia', type: 'VARCHAR(100)' },
      { name: 'distrito', type: 'VARCHAR(100)' },
      { name: 'direccion', type: 'TEXT' },
      { name: 'referencia', type: 'TEXT' },
      { name: 'ubicacion_id', type: 'UUID REFERENCES ubicaciones(id)' }
    ];

    for (const col of userColumns) {
      await db.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='${col.name}') THEN
            ALTER TABLE usuarios ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `);
    }

    console.log('✅ Esquema actualizado para registros públicos');
  } catch (err) {
    console.error('❌ Error actualizando esquema:', err.message);
  }
};

updateSchema().then(() => process.exit());
