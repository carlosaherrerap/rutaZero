const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'schema.sql');
const seedPath = path.join(__dirname, 'seed.sql');
const initPath = path.join(__dirname, 'init.sql');

console.log('🔄 Compilando init.sql...');

let initSql = '';

// 1. Leer schema.sql
if (fs.existsSync(schemaPath)) {
  initSql += fs.readFileSync(schemaPath, 'utf8');
  initSql += '\n\n';
} else {
  console.error('ERROR: schema.sql no encontrado');
  process.exit(1);
}

// 2. Agregar tablas de Caja Huancayo
initSql += `-- ============================================================================
-- 📊 TABLAS ADICIONALES PARA CAJA HUANCAYO
-- ============================================================================

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
);

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
);

CREATE TABLE IF NOT EXISTS worker_radar_puntos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id        UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  latitud          DOUBLE PRECISION NOT NULL,
  longitud         DOUBLE PRECISION NOT NULL,
  estado_worker    VARCHAR(50) DEFAULT 'LIBRE',
  duracion_segundos INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_worker_time ON worker_radar_puntos(worker_id, created_at DESC);
\n\n`;

// 3. Leer seed.sql
if (fs.existsSync(seedPath)) {
  initSql += fs.readFileSync(seedPath, 'utf8');
  initSql += '\n\n';
} else {
  console.error('ERROR: seed.sql no encontrado');
  process.exit(1);
}

// 4. Agregar generador dinámico de créditos para Caja Huancayo
initSql += `-- ============================================================================
-- 🌱 GENERADOR DINÁMICO DE CRÉDITOS PARA CAJA HUANCAYO
-- ============================================================================

INSERT INTO creditos (cliente_id, monto_credito, tipo_credito, cuota_mensual, nro_cuotas, tasa_interes, plazo_meses, objetivo_credito, porcentaje_confianza, historial_crediticio, situacion_economica)
SELECT 
    id as cliente_id,
    (1500.00 + (ROW_NUMBER() OVER () * 250.00)) as monto_credito,
    CASE WHEN (ROW_NUMBER() OVER ()) % 2 = 0 THEN 'Microempresa' ELSE 'Consumo' END as tipo_credito,
    (200.00 + (ROW_NUMBER() OVER () * 15.00)) as cuota_mensual,
    12 as nro_cuotas,
    18.5 as tasa_interes,
    12 as plazo_meses,
    CASE WHEN (ROW_NUMBER() OVER ()) % 2 = 0 THEN 'Compra de mercadería para negocio' ELSE 'Gastos médicos y de educación' END as objetivo_credito,
    (85.0 + ((ROW_NUMBER() OVER ()) % 15)) as porcentaje_confianza,
    '[{"entidad": "Banco de la Nación", "deuda": 500.00, "calificacion": "NORMAL"}, {"entidad": "Caja Huancayo", "deuda": 0.00, "calificacion": "PUNTUAL"}]'::jsonb as historial_crediticio,
    json_build_object(
      'ingresos', (2500.00 + (ROW_NUMBER() OVER () * 100.00)),
      'egresos', (1200.00 + (ROW_NUMBER() OVER () * 50.00)),
      'situacion_familiar', 'Casado, 2 hijos',
      'trabajo', CASE WHEN (ROW_NUMBER() OVER ()) % 2 = 0 THEN 'Comerciante Independiente' ELSE 'Empleado' END
    )::jsonb as situacion_economica
FROM clientes
ON CONFLICT (cliente_id) DO NOTHING;
\n`;

// 5. Escribir init.sql
fs.writeFileSync(initPath, initSql, 'utf8');

console.log('✅ init.sql creado con éxito en:', initPath);
