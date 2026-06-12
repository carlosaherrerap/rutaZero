-- Clean start (Optional but recommended for consistency)
DROP VIEW IF EXISTS v_asistencia_metricas CASCADE;
DROP VIEW IF EXISTS v_clientes_ultima_gestion CASCADE;
DROP VIEW IF EXISTS v_resumen_worker CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ────────────────────────────────────────────────────────────────────────────
-- 1. TIPOS ENUMERADOS
-- ────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE estado_cliente AS ENUM ('LIBRE', 'EN_VISITA', 'VISITADO_PAGO', 'REPROGRAMADO', 'NO_ENCONTRADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE estado_ficha AS ENUM ('SIN_DATOS', 'EN_PROCESO', 'COMPLETADA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE condicion_contable AS ENUM ('MOROSO', 'RESPONSABLE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE estado_worker AS ENUM ('ACTIVO', 'INACTIVO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE estado_jornada AS ENUM ('INACTIVO', 'JORNADA_INICIADA', 'EN_REFRIGERIO', 'JORNADA_FINALIZADA');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tipificacion_gestion AS ENUM ('PAGO', 'REPROGRAMARA', 'NO_ENCONTRADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('ADMIN', 'WORKER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. TABLAS
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sedes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(100) NOT NULL UNIQUE,
    ciudad          VARCHAR(100),
    codigo          VARCHAR(10) UNIQUE,
    activo          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ubicaciones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    latitud         DOUBLE PRECISION NOT NULL,
    longitud        DOUBLE PRECISION NOT NULL,
    direccion       TEXT,
    departamento    VARCHAR(100),
    provincia       VARCHAR(100),
    distrito        VARCHAR(100),
    referencia      TEXT,
    coordenadas     GEOGRAPHY(POINT, 4326),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    nombres         VARCHAR(100) NOT NULL,
    apellidos       VARCHAR(100) NOT NULL,
    dni             VARCHAR(20),
    telefono        VARCHAR(20),
    email           VARCHAR(100),
    foto_perfil_url TEXT,
    rol             rol_usuario NOT NULL DEFAULT 'WORKER',
    estado          estado_worker NOT NULL DEFAULT 'ACTIVO',
    sede_id         UUID REFERENCES sedes(id),
    ubicacion_id    UUID REFERENCES ubicaciones(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plantillas_formularios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(100) NOT NULL,
    descripcion     TEXT,
    campos          JSONB NOT NULL,
    requiere_firma  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombres         VARCHAR(100) NOT NULL,
    apellidos       VARCHAR(100) NOT NULL,
    dni             VARCHAR(20) UNIQUE,
    telefono        VARCHAR(20),
    email           VARCHAR(100),
    ubicacion_id    UUID REFERENCES ubicaciones(id),
    sede_id         UUID REFERENCES sedes(id),
    plantilla_id    UUID REFERENCES plantillas_formularios(id),
    estado          estado_cliente DEFAULT 'LIBRE',
    bloqueado_por   UUID REFERENCES usuarios(id),
    fecha_pago      DATE,
    deuda_total     DECIMAL(12,2) DEFAULT 0,
    dias_retraso    INTEGER DEFAULT 0,
    fecha_gestion   DATE,
    tipo_documento  VARCHAR(20) DEFAULT 'DNI',
    departamento    VARCHAR(100),
    provincia       VARCHAR(100),
    distrito        VARCHAR(100),
    direccion       TEXT,
    referencia      TEXT,
    fotos_registro  JSONB DEFAULT '[]'::JSONB,
    nombre_comercial VARCHAR(200),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rutas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(100) NOT NULL,
    worker_id       UUID REFERENCES usuarios(id),
    creado_por      UUID REFERENCES usuarios(id),
    sede_id         UUID REFERENCES sedes(id),
    total_clientes  INTEGER DEFAULT 0,
    estado          VARCHAR(20) DEFAULT 'PENDIENTE',
    fecha_asignacion DATE DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ruta_clientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id         UUID REFERENCES rutas(id) ON DELETE CASCADE,
    cliente_id      UUID REFERENCES clientes(id),
    orden           INTEGER NOT NULL,
    completado      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fichas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id         UUID REFERENCES rutas(id),
    cliente_id      UUID REFERENCES clientes(id),
    worker_id       UUID REFERENCES usuarios(id),
    plantilla_id    UUID REFERENCES plantillas_formularios(id),
    tipificacion    tipificacion_gestion NOT NULL,
    observacion     TEXT,
    monto_cuota     DECIMAL(12,2),
    tipo_credito    VARCHAR(100),
    fecha_desembolso DATE,
    monto_desembolso DECIMAL(12,2),
    moneda          VARCHAR(10) DEFAULT 'PEN',
    nro_cuotas      INTEGER,
    nro_cuotas_pagadas INTEGER,
    condicion_contable condicion_contable,
    saldo_capital   DECIMAL(12,2),
    hora_inicio_visita   TIMESTAMPTZ,
    hora_apertura_ficha  TIMESTAMPTZ,
    hora_cierre_ficha    TIMESTAMPTZ,
    duracion_llenado_seg INTEGER,
    estado               estado_ficha DEFAULT 'COMPLETADA',
    datos           JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidencias (
    id              SERIAL PRIMARY KEY,
    ficha_id        UUID REFERENCES fichas(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gestiones_historial (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID REFERENCES clientes(id),
    worker_id       UUID REFERENCES usuarios(id),
    ruta_id         UUID REFERENCES rutas(id),
    ficha_id        UUID REFERENCES fichas(id),
    tipificacion    VARCHAR(50),
    estado_nuevo    VARCHAR(50),
    observacion     TEXT,
    es_offline      BOOLEAN DEFAULT FALSE,
    fecha           DATE DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jornadas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID NOT NULL REFERENCES usuarios(id),
    fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
    estado          estado_jornada DEFAULT 'INACTIVO',
    validado        BOOLEAN DEFAULT FALSE,
    validado_at     TIMESTAMPTZ,
    validado_por    UUID REFERENCES usuarios(id),
    hora_inicio_sesion TIMESTAMPTZ,
    hora_inicio_almuerzo TIMESTAMPTZ,
    hora_fin_almuerzo TIMESTAMPTZ,
    hora_fin_jornada TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(worker_id, fecha)
);

CREATE TABLE IF NOT EXISTS monitoreo_acciones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID NOT NULL REFERENCES usuarios(id),
    cliente_id      UUID REFERENCES clientes(id),
    ficha_id        UUID, -- Relación opcional con el resultado final
    accion          VARCHAR(50) NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ubicaciones_worker_tracking (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id    UUID NOT NULL REFERENCES usuarios(id),
    latitud      DOUBLE PRECISION NOT NULL,
    longitud     DOUBLE PRECISION NOT NULL,
    precision_m  REAL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS amonestaciones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID NOT NULL REFERENCES usuarios(id),
    tipo            VARCHAR(100) NOT NULL,
    fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
    descripcion     TEXT,
    monto           DECIMAL(12,2) DEFAULT 0,
    estado          VARCHAR(20) DEFAULT 'PENDIENTE',
    creado_por      UUID REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permisos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID NOT NULL REFERENCES usuarios(id),
    tipo            VARCHAR(100) NOT NULL,
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE NOT NULL,
    descripcion     TEXT,
    estado          VARCHAR(20) DEFAULT 'PENDIENTE',
    validado_por    UUID REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS configuracion_portal (
    id              SERIAL PRIMARY KEY,
    clave           VARCHAR(100) NOT NULL UNIQUE,
    valor           TEXT NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. VISTAS (Qualified)
-- ────────────────────────────────────────────────────────────────────────────

CREATE VIEW v_resumen_worker AS
SELECT
    u.id                                                          AS worker_id,
    u.nombres || ' ' || u.apellidos                              AS worker_nombre,
    u.sede_id,
    j.estado                                                      AS estado_jornada,
    j.validado,
    COUNT(DISTINCT rc.cliente_id)                                 AS total_asignados,
    COUNT(DISTINCT gh.cliente_id) FILTER (WHERE gh.tipificacion = 'PAGO')          AS total_pagos,
    COUNT(DISTINCT gh.cliente_id) FILTER (WHERE gh.tipificacion = 'REPROGRAMARA')  AS total_reprogramados,
    COUNT(DISTINCT gh.cliente_id) FILTER (WHERE gh.tipificacion = 'NO_ENCONTRADO') AS total_no_encontrados
FROM usuarios u
LEFT JOIN jornadas j         ON j.worker_id  = u.id AND j.fecha = CURRENT_DATE
LEFT JOIN rutas r            ON r.worker_id  = u.id AND r.fecha_asignacion = CURRENT_DATE
LEFT JOIN ruta_clientes rc   ON rc.ruta_id   = r.id
LEFT JOIN gestiones_historial gh ON gh.worker_id = u.id AND gh.fecha = CURRENT_DATE
WHERE u.rol = 'WORKER' AND u.estado = 'ACTIVO'
GROUP BY u.id, u.nombres, u.apellidos, u.sede_id, j.estado, j.validado;

CREATE VIEW v_clientes_ultima_gestion AS
SELECT DISTINCT ON (c.id)
    c.id            AS cliente_id,
    c.nombres || ' ' || c.apellidos AS cliente_nombre,
    c.sede_id,
    c.estado,
    c.fecha_pago,
    c.deuda_total,
    c.dias_retraso,
    gh.tipificacion AS ultima_tipificacion,
    gh.created_at   AS ultima_gestion_at,
    u.nombres || ' ' || u.apellidos AS ultimo_worker,
    ub.distrito
FROM clientes c
LEFT JOIN gestiones_historial gh ON gh.cliente_id = c.id
LEFT JOIN usuarios u             ON u.id = gh.worker_id
LEFT JOIN ubicaciones ub         ON ub.id = c.ubicacion_id
ORDER BY c.id, gh.created_at DESC NULLS LAST;

CREATE VIEW v_asistencia_metricas AS
SELECT
    j.id,
    j.fecha,
    j.estado,
    j.validado,
    j.hora_inicio_sesion,
    j.hora_inicio_almuerzo,
    j.hora_fin_almuerzo,
    j.hora_fin_jornada,
    u.id   AS worker_id,
    u.nombres,
    u.apellidos,
    u.sede_id,
    CASE
        WHEN j.hora_inicio_almuerzo IS NOT NULL AND j.hora_fin_almuerzo IS NOT NULL
        THEN ROUND(EXTRACT(EPOCH FROM (j.hora_fin_almuerzo - j.hora_inicio_almuerzo)) / 60)
        ELSE 0
    END AS duracion_refrigerio_min,
    CASE
        WHEN j.hora_inicio_sesion IS NOT NULL AND j.hora_fin_jornada IS NOT NULL
        THEN ROUND((EXTRACT(EPOCH FROM (j.hora_fin_jornada - j.hora_inicio_sesion)) / 3600)::numeric, 2)
        ELSE NULL
    END AS horas_trabajadas
FROM jornadas j
JOIN usuarios u ON u.id = j.worker_id;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ÍNDICES
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clientes_sede ON clientes(sede_id);
CREATE INDEX IF NOT EXISTS idx_rutas_sede    ON rutas(sede_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_sede ON usuarios(sede_id);
CREATE INDEX IF NOT EXISTS idx_monitoreo_worker ON monitoreo_acciones(worker_id);
CREATE INDEX IF NOT EXISTS idx_tracking_worker ON ubicaciones_worker_tracking(worker_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. TABLA RADAR GPS WORKERS
-- ────────────────────────────────────────────────────────────────────────────
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
