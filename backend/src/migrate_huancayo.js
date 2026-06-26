const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const isLocalhost = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'));

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: isLocalhost ? false : { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rutazero',
      user: process.env.DB_USER || 'rutazero_admin',
      password: process.env.DB_PASSWORD || 'rutazero_2026',
    };

const pool = new Pool(poolConfig);

async function run() {
  try {
    console.log('🔄 Iniciando migración de Caja Huancayo...');

    // 1. Crear tabla creditos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS creditos (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
          monto_credito DECIMAL(12,2) DEFAULT 0,
          tipo_credito VARCHAR(100),
          cuota_mensual DECIMAL(12,2) DEFAULT 0,
          nro_cuotas INTEGER DEFAULT 1,
          tasa_interes DECIMAL(5,2) DEFAULT 0,
          plazo_meses INTEGER DEFAULT 12,
          objetivo_credito TEXT,
          porcentaje_confianza DECIMAL(5,2) DEFAULT 100.0,
          historial_crediticio JSONB DEFAULT '[]'::JSONB,
          situacion_economica JSONB DEFAULT '{}'::JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(cliente_id)
      )
    `);
    console.log('✅ Tabla "creditos" creada.');

    // 2. Crear tabla verificaciones_caja_huancayo
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verificaciones_caja_huancayo (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
          worker_id UUID NOT NULL REFERENCES usuarios(id),
          ruta_id UUID REFERENCES rutas(id),
          liveness_photo_dni_front TEXT,
          liveness_photo_dni_back TEXT,
          liveness_selfie_photo TEXT,
          liveness_similarity_pct DECIMAL(5,2),
          liveness_calculated_age INTEGER,
          liveness_written_age INTEGER,
          dni_issue_date DATE,
          firma_digital_url TEXT,
          preguntas_respuestas JSONB DEFAULT '{}'::JSONB,
          observaciones TEXT,
          estado_verificacion VARCHAR(50) DEFAULT 'COMPLETADA',
          es_offline BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ Tabla "verificaciones_caja_huancayo" creada.');

    // 3. Obtener clientes de prueba para asociarles créditos
    const { rows: clientes } = await pool.query('SELECT id, nombres, apellidos FROM clientes LIMIT 20');
    console.log(`ℹ️ Encontrados ${clientes.length} clientes en la base de datos.`);

    for (let i = 0; i < clientes.length; i++) {
      const c = clientes[i];
      // Crear datos de crédito de prueba
      const monto = (1000 + (i * 500)).toFixed(2);
      const cuota = (monto / 12 * 1.15).toFixed(2);
      const tipo = i % 2 === 0 ? 'Microempresa' : 'Consumo';
      const obj = i % 2 === 0 ? 'Compra de mercadería para negocio' : 'Gastos médicos y escolares';
      const confianza = (85 + (i % 16)).toFixed(1);
      
      const historial = [
        { entidad: 'Banco de la Nación', deuda: (monto * 0.2).toFixed(2), calificacion: 'NORMAL' },
        { entidad: 'Caja Huancayo (Anterior)', deuda: '0.00', calificacion: 'PUNTUAL' }
      ];

      const situacion = {
        ingresos: (monto * 0.8).toFixed(2),
        egresos: (monto * 0.4).toFixed(2),
        situacion_familiar: 'Casado, 2 hijos',
        trabajo: i % 2 === 0 ? 'Comerciante Independiente' : 'Empleado Público',
      };

      await pool.query(`
        INSERT INTO creditos (
          cliente_id, monto_credito, tipo_credito, cuota_mensual, nro_cuotas,
          tasa_interes, plazo_meses, objetivo_credito, porcentaje_confianza,
          historial_crediticio, situacion_economica
        ) VALUES ($1, $2, $3, $4, 12, 18.5, 12, $5, $6, $7, $8)
        ON CONFLICT (cliente_id) DO NOTHING
      `, [c.id, monto, tipo, cuota, obj, confianza, JSON.stringify(historial), JSON.stringify(situacion)]);
    }

    console.log('✅ Créditos de prueba insertados con éxito.');
  } catch (err) {
    console.error('❌ Error en la migración:', err);
  } finally {
    await pool.end();
    console.log('🔄 Conexión de base de datos cerrada.');
  }
}

run();
