-- ============================================================================
-- 🛵  RUTA ZERO — Schema de Base de Datos (PostgreSQL)
-- ============================================================================
-- Versión : 2.0
-- Fecha   : 2026-04-24
-- Autor   : Ruta Zero Team
-- ============================================================================
-- Para levantar desde cero:
--   psql -U postgres -c "CREATE DATABASE rutazero_db;"
--   psql -U postgres -d rutazero_db -f schema.sql
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONES
-- ────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ────────────────────────────────────────────────────────────────────────────
-- 1. TIPOS ENUMERADOS
-- ────────────────────────────────────────────────────────────────────────────

-- Estado visible en el mapa y en la app
CREATE TYPE estado_cliente AS ENUM (
    'LIBRE',            -- 🔵 Disponible para asignación
    'EN_VISITA',        -- 🟣 Worker en camino / visitando
    'VISITADO_PAGO',    -- 🟢 Ficha completada (PAGO)
    'REPROGRAMADO',     -- 🟡 Se reprogramará la visita
    'NO_ENCONTRADO'     -- 🔴 No se encontró al cliente
);

-- Estado interno de la ficha de gestión
CREATE TYPE estado_ficha AS ENUM (
    'SIN_DATOS',        -- Nunca se abrió
    'EN_PROCESO',       -- Se abrió pero no se completó
    'COMPLETADA'        -- Guardada exitosamente
);

-- Condición contable del cliente
CREATE TYPE condicion_contable AS ENUM (
    'MOROSO',
    'RESPONSABLE'
);

-- Estado de cuenta del worker
CREATE TYPE estado_worker AS ENUM (
    'ACTIVO',
    'INACTIVO'
);

-- Estado de la jornada laboral diaria
CREATE TYPE estado_jornada AS ENUM (
    'INACTIVO',
    'JORNADA_INICIADA',
    'EN_REFRIGERIO',
    'JORNADA_FINALIZADA'
);

-- Resultado de la gestión (tipificación)
CREATE TYPE tipificacion_gestion AS ENUM (
    'PAGO',
    'REPROGRAMARA',
    'NO_ENCONTRADO'
);

-- Tipos de alerta entre workers
CREATE TYPE tipo_alerta AS ENUM (
    'CERCANIA',
    'CLIENTE_REGISTRADO'
);

-- Roles del sistema
CREATE TYPE rol_usuario AS ENUM (
    'ADMIN',
    'WORKER'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. FUNCIÓN UTILITARIA: auto-actualizar updated_at
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. TABLA: ubicaciones
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE ubicaciones (
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

-- Auto-calcular campo PostGIS desde lat/lng
CREATE OR REPLACE FUNCTION fn_ubicacion_set_coordenadas()
RETURNS TRIGGER AS $$
BEGIN
    NEW.coordenadas = ST_SetSRID(ST_MakePoint(NEW.longitud, NEW.latitud), 4326)::geography;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ubicacion_coordenadas
    BEFORE INSERT OR UPDATE OF latitud, longitud ON ubicaciones
    FOR EACH ROW EXECUTE FUNCTION fn_ubicacion_set_coordenadas();

CREATE INDEX idx_ubicaciones_geo      ON ubicaciones USING GIST (coordenadas);
CREATE INDEX idx_ubicaciones_distrito ON ubicaciones (departamento, provincia, distrito);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. TABLA: usuarios (admin + workers unificados)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    rol             rol_usuario NOT NULL DEFAULT 'WORKER',

    nombres         VARCHAR(150) NOT NULL,
    apellidos       VARCHAR(150) NOT NULL,
    dni             VARCHAR(20) UNIQUE,
    telefono        VARCHAR(20),
    email           VARCHAR(255),
    foto_perfil_url TEXT,

    -- Ubicación base del worker (para mostrarlo en el mapa del admin)
    ubicacion_id    UUID REFERENCES ubicaciones(id),

    estado          estado_worker NOT NULL DEFAULT 'ACTIVO',

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usuarios_rol    ON usuarios (rol);
CREATE INDEX idx_usuarios_estado ON usuarios (estado);

CREATE TRIGGER trg_update_usuarios
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ────────────────────────────────────────────────────────────────────────────
-- 5. TABLA: clientes
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE clientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    nombres         VARCHAR(150) NOT NULL,
    apellidos       VARCHAR(150) NOT NULL,
    dni             VARCHAR(20) UNIQUE,
    telefono        VARCHAR(20),
    email           VARCHAR(255),
    nombre_comercial VARCHAR(200),

    -- Ubicación del cliente
    ubicacion_id    UUID REFERENCES ubicaciones(id),

    -- Estado de gestión (visible para todos los workers)
    estado          estado_cliente NOT NULL DEFAULT 'LIBRE',

    -- Datos financieros
    fecha_pago      DATE,
    deuda_total     NUMERIC(12,2) DEFAULT 0,
    dias_retraso    INTEGER DEFAULT 0,

    -- Fecha de última gestión (snapshot diario)
    fecha_gestion   DATE,

    -- Worker que tiene bloqueado este cliente (EN_VISITA)
    bloqueado_por   UUID REFERENCES usuarios(id),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_estado       ON clientes (estado);
CREATE INDEX idx_clientes_fecha_pago   ON clientes (fecha_pago);
CREATE INDEX idx_clientes_fecha_gestion ON clientes (fecha_gestion);
CREATE INDEX idx_clientes_bloqueado    ON clientes (bloqueado_por) WHERE bloqueado_por IS NOT NULL;

-- Solo un cliente EN_VISITA por worker a la vez
CREATE UNIQUE INDEX idx_un_cliente_en_visita_por_worker
    ON clientes (bloqueado_por)
    WHERE estado = 'EN_VISITA' AND bloqueado_por IS NOT NULL;

CREATE TRIGGER trg_update_clientes
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ────────────────────────────────────────────────────────────────────────────
-- 6. TABLA: rutas
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE rutas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,
    worker_id       UUID NOT NULL REFERENCES usuarios(id),
    creado_por      UUID NOT NULL REFERENCES usuarios(id),

    total_clientes      INTEGER DEFAULT 0,
    clientes_visitados  INTEGER DEFAULT 0,
    completada          BOOLEAN DEFAULT FALSE,

    fecha_asignacion    DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rutas_worker ON rutas (worker_id);
CREATE INDEX idx_rutas_fecha  ON rutas (fecha_asignacion);

CREATE TRIGGER trg_update_rutas
    BEFORE UPDATE ON rutas
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ────────────────────────────────────────────────────────────────────────────
-- 7. TABLA: ruta_clientes (M:N entre rutas y clientes)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE ruta_clientes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id     UUID NOT NULL REFERENCES rutas(id) ON DELETE CASCADE,
    cliente_id  UUID NOT NULL REFERENCES clientes(id),
    orden       INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (ruta_id, cliente_id)
);

CREATE INDEX idx_ruta_clientes_ruta    ON ruta_clientes (ruta_id);
CREATE INDEX idx_ruta_clientes_cliente ON ruta_clientes (cliente_id);

-- Auto-actualizar contador total_clientes en rutas
CREATE OR REPLACE FUNCTION fn_actualizar_contadores_ruta()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE rutas SET
        total_clientes = (SELECT COUNT(*) FROM ruta_clientes WHERE ruta_id = COALESCE(NEW.ruta_id, OLD.ruta_id)),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.ruta_id, OLD.ruta_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ruta_clientes_count
    AFTER INSERT OR DELETE ON ruta_clientes
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_contadores_ruta();

-- ────────────────────────────────────────────────────────────────────────────
-- 8. TABLA: fichas (formulario de gestión)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE fichas (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id              UUID NOT NULL REFERENCES clientes(id),
    worker_id               UUID NOT NULL REFERENCES usuarios(id),

    estado                  estado_ficha NOT NULL DEFAULT 'SIN_DATOS',

    -- Información crediticia
    tipo_credito            VARCHAR(200),
    fecha_desembolso        DATE,
    monto_desembolso        NUMERIC(15,2),
    moneda                  VARCHAR(10) DEFAULT 'PEN',
    nro_cuotas              INTEGER,
    nro_cuotas_pagadas      INTEGER,
    monto_cuota             NUMERIC(12,2),
    condicion_contable      condicion_contable,
    saldo_capital           NUMERIC(12,2),

    -- Tipificación final de la gestión
    tipificacion            tipificacion_gestion,

    -- Timestamps de monitoreo de campo
    hora_inicio_visita      TIMESTAMPTZ,    -- Cuando presionó VISITAR
    hora_apertura_ficha     TIMESTAMPTZ,    -- Cuando abrió el formulario
    hora_cierre_ficha       TIMESTAMPTZ,    -- Cuando guardó la ficha
    duracion_llenado_seg    INTEGER,        -- Segundos que tardó en llenar

    observacion             TEXT,

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fichas_cliente      ON fichas (cliente_id);
CREATE INDEX idx_fichas_worker       ON fichas (worker_id);
CREATE INDEX idx_fichas_estado       ON fichas (estado);
CREATE INDEX idx_fichas_tipificacion ON fichas (tipificacion);

CREATE TRIGGER trg_update_fichas
    BEFORE UPDATE ON fichas
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ────────────────────────────────────────────────────────────────────────────
-- 9. TABLA: evidencias (imágenes adjuntas a una ficha — máx. 5)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE evidencias (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id    UUID NOT NULL REFERENCES fichas(id) ON DELETE CASCADE,
    tipo        VARCHAR(20) NOT NULL DEFAULT 'imagen',
    url         TEXT NOT NULL,
    orden       SMALLINT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidencias_ficha ON evidencias (ficha_id);

-- Máximo 5 evidencias por ficha (regla de negocio)
CREATE OR REPLACE FUNCTION fn_validar_max_evidencias()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM evidencias WHERE ficha_id = NEW.ficha_id) >= 5 THEN
        RAISE EXCEPTION 'Máximo 5 evidencias por ficha';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_max_evidencias
    BEFORE INSERT ON evidencias
    FOR EACH ROW EXECUTE FUNCTION fn_validar_max_evidencias();

-- ────────────────────────────────────────────────────────────────────────────
-- 10. TABLA: gestiones_historial (auditoría completa de gestiones)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE gestiones_historial (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id),
    worker_id       UUID NOT NULL REFERENCES usuarios(id),
    ficha_id        UUID REFERENCES fichas(id),

    tipificacion    tipificacion_gestion,
    estado_previo   estado_cliente,
    estado_nuevo    estado_cliente NOT NULL,

    fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
    hora            TIME NOT NULL DEFAULT CURRENT_TIME,
    timestamp_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    observacion     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gestiones_cliente      ON gestiones_historial (cliente_id);
CREATE INDEX idx_gestiones_worker       ON gestiones_historial (worker_id);
CREATE INDEX idx_gestiones_fecha        ON gestiones_historial (fecha);
CREATE INDEX idx_gestiones_tipificacion ON gestiones_historial (tipificacion);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. TABLA: jornadas (control de asistencia laboral diaria)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE jornadas (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id            UUID NOT NULL REFERENCES usuarios(id),
    fecha                DATE NOT NULL DEFAULT CURRENT_DATE,

    estado               estado_jornada NOT NULL DEFAULT 'INACTIVO',

    hora_inicio_sesion   TIMESTAMPTZ,        -- INICIAR DÍA
    hora_inicio_almuerzo TIMESTAMPTZ,        -- ALMUERZO
    hora_fin_almuerzo    TIMESTAMPTZ,        -- FIN ALMUERZO
    hora_fin_jornada     TIMESTAMPTZ,        -- FINALIZAR DÍA

    -- Validación del admin (aparece verde en el calendario del worker)
    validado             BOOLEAN DEFAULT FALSE,
    validado_por         UUID REFERENCES usuarios(id),
    validado_at          TIMESTAMPTZ,

    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (worker_id, fecha)
);

CREATE INDEX idx_jornadas_worker       ON jornadas (worker_id);
CREATE INDEX idx_jornadas_fecha        ON jornadas (fecha);
CREATE INDEX idx_jornadas_validado     ON jornadas (validado);
CREATE INDEX idx_jornadas_worker_fecha ON jornadas (worker_id, fecha);

CREATE TRIGGER trg_update_jornadas
    BEFORE UPDATE ON jornadas
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ────────────────────────────────────────────────────────────────────────────
-- 12. TABLA: alertas (notificaciones entre workers)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE alertas (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo        tipo_alerta NOT NULL,
    emisor_id   UUID NOT NULL REFERENCES usuarios(id),
    receptor_id UUID NOT NULL REFERENCES usuarios(id),
    cliente_id  UUID REFERENCES clientes(id),
    mensaje     TEXT NOT NULL,
    leida       BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alertas_receptor ON alertas (receptor_id, leida);
CREATE INDEX idx_alertas_tipo     ON alertas (tipo);

-- ────────────────────────────────────────────────────────────────────────────
-- 13. TABLA: sync_queue (cola de sincronización offline → online)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE sync_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID NOT NULL REFERENCES usuarios(id),
    tabla_destino   VARCHAR(100) NOT NULL,
    operacion       VARCHAR(10) NOT NULL,    -- INSERT | UPDATE | DELETE
    payload         JSONB NOT NULL,
    sincronizado    BOOLEAN DEFAULT FALSE,
    intentos        INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    synced_at       TIMESTAMPTZ
);

CREATE INDEX idx_sync_pendiente ON sync_queue (sincronizado) WHERE sincronizado = FALSE;
CREATE INDEX idx_sync_worker    ON sync_queue (worker_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 14. TABLA: monitoreo_acciones (trazabilidad granular de campo)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE monitoreo_acciones (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id   UUID NOT NULL REFERENCES usuarios(id),
    cliente_id  UUID REFERENCES clientes(id),
    ficha_id    UUID REFERENCES fichas(id),

    -- Acciones posibles:
    --   VISITAR_PRESIONADO | VISITA_CANCELADA
    --   FICHA_ABIERTA      | FICHA_GUARDADA
    --   JORNADA_INICIADA   | JORNADA_FINALIZADA
    --   ALMUERZO_INICIO    | ALMUERZO_FIN
    accion          VARCHAR(50) NOT NULL,
    timestamp_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monitoreo_worker    ON monitoreo_acciones (worker_id);
CREATE INDEX idx_monitoreo_cliente   ON monitoreo_acciones (cliente_id);
CREATE INDEX idx_monitoreo_accion    ON monitoreo_acciones (accion);
CREATE INDEX idx_monitoreo_timestamp ON monitoreo_acciones (timestamp_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 15. TABLA: ubicaciones_worker_tracking (GPS en tiempo real)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE ubicaciones_worker_tracking (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id    UUID NOT NULL REFERENCES usuarios(id),
    latitud      DOUBLE PRECISION NOT NULL,
    longitud     DOUBLE PRECISION NOT NULL,
    precision_m  REAL,
    timestamp_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracking_worker ON ubicaciones_worker_tracking (worker_id);
CREATE INDEX idx_tracking_time   ON ubicaciones_worker_tracking (timestamp_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 16. VISTAS
-- ────────────────────────────────────────────────────────────────────────────

-- Resumen de productividad por worker (para el Dashboard del admin)
CREATE OR REPLACE VIEW v_resumen_worker AS
SELECT
    u.id                                                          AS worker_id,
    u.nombres || ' ' || u.apellidos                              AS worker_nombre,
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
GROUP BY u.id, u.nombres, u.apellidos, j.estado, j.validado;

-- Última gestión por cliente (para la tabla de Clientes del portal)
CREATE OR REPLACE VIEW v_clientes_ultima_gestion AS
SELECT DISTINCT ON (c.id)
    c.id            AS cliente_id,
    c.nombres || ' ' || c.apellidos AS cliente_nombre,
    c.estado,
    c.fecha_pago,
    c.deuda_total,
    c.dias_retraso,
    gh.tipificacion AS ultima_tipificacion,
    gh.timestamp_at AS ultima_gestion_at,
    u.nombres || ' ' || u.apellidos AS ultimo_worker,
    ub.departamento,
    ub.provincia,
    ub.distrito
FROM clientes c
LEFT JOIN gestiones_historial gh ON gh.cliente_id = c.id
LEFT JOIN usuarios u             ON u.id = gh.worker_id
LEFT JOIN ubicaciones ub         ON ub.id = c.ubicacion_id
ORDER BY c.id, gh.timestamp_at DESC NULLS LAST;

-- Métricas de asistencia (para la página Asistencia del portal)
CREATE OR REPLACE VIEW v_asistencia_metricas AS
SELECT
    j.id,
    j.fecha,
    j.estado,
    j.validado,
    j.validado_at,
    j.hora_inicio_sesion,
    j.hora_inicio_almuerzo,
    j.hora_fin_almuerzo,
    j.hora_fin_jornada,
    u.id   AS worker_id,
    u.nombres,
    u.apellidos,
    -- Receso en minutos
    CASE
        WHEN j.hora_inicio_almuerzo IS NOT NULL AND j.hora_fin_almuerzo IS NOT NULL
        THEN ROUND(EXTRACT(EPOCH FROM (j.hora_fin_almuerzo - j.hora_inicio_almuerzo)) / 60)
        ELSE 0
    END AS duracion_refrigerio_min,
    -- Horas trabajadas (sin contar receso)
    CASE
        WHEN j.hora_inicio_sesion IS NOT NULL AND j.hora_fin_jornada IS NOT NULL
        THEN ROUND((
            EXTRACT(EPOCH FROM (j.hora_fin_jornada - j.hora_inicio_sesion)) / 3600 -
            COALESCE(EXTRACT(EPOCH FROM (j.hora_fin_almuerzo - j.hora_inicio_almuerzo)) / 3600, 0)
        )::numeric, 2)
        ELSE NULL
    END AS horas_trabajadas
FROM jornadas j
JOIN usuarios u ON u.id = j.worker_id;

-- ============================================================================
-- RESUMEN DE TABLAS
-- ============================================================================
--  1.  ubicaciones                   Coordenadas y direcciones (compartida)
--  2.  usuarios                      Admin + workers unificados
--  3.  clientes                      Datos personales + estado global
--  4.  rutas                         Rutas creadas por admin
--  5.  ruta_clientes                 Clientes por ruta (M:N)
--  6.  fichas                        Formulario de gestión
--  7.  evidencias                    Fotos adjuntas a fichas (máx. 5)
--  8.  gestiones_historial           Auditoría completa de gestiones
--  9.  jornadas                      Asistencia laboral diaria
--  10. alertas                       Notificaciones entre workers
--  11. sync_queue                    Cola offline→online
--  12. monitoreo_acciones            Trazabilidad granular de campo
--  13. ubicaciones_worker_tracking   GPS en tiempo real
--
-- VISTAS
--  v_resumen_worker                  Productividad por worker (Dashboard)
--  v_clientes_ultima_gestion         Última gestión de cada cliente
--  v_asistencia_metricas             Asistencia con horas calculadas
--
-- REGLAS DE NEGOCIO EN BD
--  - 1 cliente EN_VISITA por worker (índice parcial único)
--  - Máx. 5 evidencias por ficha (trigger)
--  - updated_at auto-actualizado (triggers)
--  - total_clientes en rutas auto-calculado (trigger)
-- ============================================================================
