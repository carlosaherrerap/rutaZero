-- ============================================================================
-- 🗺️  RUTA ZERO — Borrador de Base de Datos (PostgreSQL)
-- ============================================================================
-- Versión : 1.0
-- Fecha   : 2026-04-16
-- Notas   : Normalizado (3NF+). Sin redundancias. Aplica 3F.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONES
-- ────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";        -- Para coordenadas geográficas

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ENUMS (Catálogos de estados)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TYPE estado_cliente AS ENUM (
    'LIBRE',            -- 🔵 Azul   — disponible
    'EN_VISITA',        -- 🟣 Morado — un worker está en camino/visitando
    'VISITADO_PAGO',    -- 🟢 Verde  — pagó, ficha completada
    'REPROGRAMADO',     -- 🟡 Amarillo — se reprogramará
    'NO_ENCONTRADO'     -- 🔴 Rojo   — no se encontró (con fecha/hora)
);

CREATE TYPE estado_ficha AS ENUM (
    'SIN_DATOS',        -- Nunca se abrió
    'EN_PROCESO',       -- Se abrió pero no se completó
    'COMPLETADA'        -- Guardada exitosamente
);

CREATE TYPE condicion_contable AS ENUM (
    'MOROSO',
    'RESPONSABLE'
);

CREATE TYPE estado_worker AS ENUM (
    'ACTIVO',           -- Puede iniciar sesión
    'INACTIVO'          -- No puede iniciar sesión
);

CREATE TYPE estado_jornada AS ENUM (
    'INACTIVO',
    'JORNADA_INICIADA',
    'EN_CAMINO',
    'LLENANDO_FICHA',
    'ALMUERZO',
    'TIEMPO_MUERTO',
    'JORNADA_FINALIZADA'
);

CREATE TYPE tipificacion_gestion AS ENUM (
    'PAGO',
    'REPROGRAMARA',
    'NO_ENCONTRADO'
);

CREATE TYPE tipo_alerta AS ENUM (
    'CERCANIA',              -- "Libera al cliente, estoy más cerca"
    'CLIENTE_REGISTRADO'     -- "Worker X registró un cliente tuyo"
);

CREATE TYPE rol_usuario AS ENUM (
    'ADMIN',
    'WORKER'
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. TABLA: ubicaciones (reutilizable por clientes y workers)
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
    coordenadas     GEOGRAPHY(POINT, 4326),  -- PostGIS para queries espaciales
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-calcular coordenadas desde lat/lng
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

CREATE INDEX idx_ubicaciones_geo ON ubicaciones USING GIST (coordenadas);
CREATE INDEX idx_ubicaciones_distrito ON ubicaciones (departamento, provincia, distrito);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. TABLA: usuarios (unificada para admin y workers)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    rol             rol_usuario NOT NULL DEFAULT 'WORKER',

    -- Datos personales
    nombres         VARCHAR(150) NOT NULL,
    apellidos       VARCHAR(150) NOT NULL,
    dni             VARCHAR(20) UNIQUE,
    telefono        VARCHAR(20),
    email           VARCHAR(255),
    foto_perfil_url TEXT,                   -- Ruta al filesystem

    -- Ubicación del worker (obligatoria para workers)
    ubicacion_id    UUID REFERENCES ubicaciones(id),

    -- Estado de cuenta
    estado          estado_worker NOT NULL DEFAULT 'ACTIVO',

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usuarios_rol ON usuarios (rol);
CREATE INDEX idx_usuarios_estado ON usuarios (estado);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. TABLA: clientes
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE clientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Datos personales
    nombres         VARCHAR(150) NOT NULL,
    apellidos       VARCHAR(150) NOT NULL,
    dni             VARCHAR(20) UNIQUE,
    telefono        VARCHAR(20),
    email           VARCHAR(255),

    -- Ubicación
    ubicacion_id    UUID REFERENCES ubicaciones(id),

    -- Estado global de gestión (visible por TODOS los workers)
    estado          estado_cliente NOT NULL DEFAULT 'LIBRE',

    -- Datos financieros básicos (para hover info en mapa del admin)
    fecha_pago      DATE,
    deuda_total     NUMERIC(12,2) DEFAULT 0,
    dias_retraso    INTEGER DEFAULT 0,

    -- Fecha de gestión (para snapshot diario)
    fecha_gestion   DATE,

    -- Bloqueo: worker que tiene al cliente EN_VISITA (NULL si libre)
    bloqueado_por   UUID REFERENCES usuarios(id),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clientes_estado ON clientes (estado);
CREATE INDEX idx_clientes_fecha_gestion ON clientes (fecha_gestion);
CREATE INDEX idx_clientes_fecha_pago ON clientes (fecha_pago);
CREATE INDEX idx_clientes_bloqueado ON clientes (bloqueado_por) WHERE bloqueado_por IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. TABLA: rutas
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE rutas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(200) NOT NULL,          -- Ej: "LIMA SUR"
    worker_id       UUID NOT NULL REFERENCES usuarios(id),
    creado_por      UUID NOT NULL REFERENCES usuarios(id),  -- Admin que la creó

    -- Estado derivado (se puede calcular, pero se cachea para rendimiento)
    total_clientes      INTEGER DEFAULT 0,
    clientes_visitados  INTEGER DEFAULT 0,
    completada          BOOLEAN DEFAULT FALSE,       -- true si todos visitados

    fecha_asignacion    DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rutas_worker ON rutas (worker_id);
CREATE INDEX idx_rutas_fecha ON rutas (fecha_asignacion);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. TABLA: ruta_clientes (relación M:N entre rutas y clientes)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE ruta_clientes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id     UUID NOT NULL REFERENCES rutas(id) ON DELETE CASCADE,
    cliente_id  UUID NOT NULL REFERENCES clientes(id),
    orden       INTEGER,                -- Orden sugerido de visita

    created_at  TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (ruta_id, cliente_id)         -- Un cliente no se repite en la misma ruta
);

CREATE INDEX idx_ruta_clientes_ruta ON ruta_clientes (ruta_id);
CREATE INDEX idx_ruta_clientes_cliente ON ruta_clientes (cliente_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. TABLA: fichas (formulario de gestión del cliente)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE fichas (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id              UUID NOT NULL REFERENCES clientes(id),
    worker_id               UUID NOT NULL REFERENCES usuarios(id),   -- Worker que llenó la ficha

    -- Estado de la ficha
    estado                  estado_ficha NOT NULL DEFAULT 'SIN_DATOS',

    -- Campos del formulario (Paso 2)
    tipo_credito            INTEGER,
    fecha_desembolso        DATE,
    monto_desembolso        INTEGER,
    moneda                  NUMERIC(12,4),
    nro_cuotas              INTEGER,
    nro_cuotas_pagadas      INTEGER,
    monto_cuota             NUMERIC(12,2),
    condicion_contable      condicion_contable,
    saldo_capital           NUMERIC(12,2),

    -- Tipificación final
    tipificacion            tipificacion_gestion,

    -- Timestamps de monitoreo (RN-13)
    hora_inicio_visita      TIMESTAMPTZ,    -- Cuando presionó VISITAR
    hora_apertura_ficha     TIMESTAMPTZ,    -- Cuando abrió el formulario
    hora_cierre_ficha       TIMESTAMPTZ,    -- Cuando guardó el formulario
    duracion_llenado_seg    INTEGER,        -- Tiempo en segundos que tardó

    -- Observaciones
    observacion             TEXT,

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fichas_cliente ON fichas (cliente_id);
CREATE INDEX idx_fichas_worker ON fichas (worker_id);
CREATE INDEX idx_fichas_estado ON fichas (estado);
CREATE INDEX idx_fichas_tipificacion ON fichas (tipificacion);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. TABLA: evidencias (imágenes adjuntas a una ficha — máx. 5)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE evidencias (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id    UUID NOT NULL REFERENCES fichas(id) ON DELETE CASCADE,
    tipo        VARCHAR(20) NOT NULL DEFAULT 'imagen',   -- imagen, video, audio
    url         TEXT NOT NULL,                            -- Ruta en el filesystem/storage
    orden       SMALLINT,                                 -- 1..5
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidencias_ficha ON evidencias (ficha_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. TABLA: gestiones_historial (historial completo de gestiones por cliente)
--    Evita redundancia: NO se duplica info del worker. Se referencia.
--    Cumple la necesidad de "ver todos los workers que visitaron a un cliente"
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE gestiones_historial (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id),
    worker_id       UUID NOT NULL REFERENCES usuarios(id),
    ficha_id        UUID REFERENCES fichas(id),         -- NULL si fue solo EN_VISITA sin ficha

    -- Tipo de evento
    tipificacion    tipificacion_gestion,                -- NULL si fue solo EN_VISITA/cancelación
    estado_previo   estado_cliente,
    estado_nuevo    estado_cliente NOT NULL,

    -- Timestamps
    fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
    hora            TIME NOT NULL DEFAULT CURRENT_TIME,
    timestamp_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    observacion     TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gestiones_cliente ON gestiones_historial (cliente_id);
CREATE INDEX idx_gestiones_worker ON gestiones_historial (worker_id);
CREATE INDEX idx_gestiones_fecha ON gestiones_historial (fecha);
CREATE INDEX idx_gestiones_tipificacion ON gestiones_historial (tipificacion);

-- ────────────────────────────────────────────────────────────────────────────
-- 10. TABLA: jornadas (registro de la jornada laboral diaria del worker)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE jornadas (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id           UUID NOT NULL REFERENCES usuarios(id),
    fecha               DATE NOT NULL DEFAULT CURRENT_DATE,

    estado              estado_jornada NOT NULL DEFAULT 'INACTIVO',

    hora_inicio_sesion  TIMESTAMPTZ,
    hora_inicio_almuerzo TIMESTAMPTZ,
    hora_fin_almuerzo   TIMESTAMPTZ,
    hora_fin_jornada    TIMESTAMPTZ,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (worker_id, fecha)   -- Una jornada por worker por día
);

CREATE INDEX idx_jornadas_worker ON jornadas (worker_id);
CREATE INDEX idx_jornadas_fecha ON jornadas (fecha);

-- ────────────────────────────────────────────────────────────────────────────
-- 11. TABLA: monitoreo_acciones (trazabilidad detallada de cada acción)
--     Resuelve: a qué hora marcó VISITAR, abrió ficha, guardó, tiempo muerto
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE monitoreo_acciones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID NOT NULL REFERENCES usuarios(id),
    cliente_id      UUID REFERENCES clientes(id),       -- NULL si es acción sin cliente
    ficha_id        UUID REFERENCES fichas(id),

    accion          VARCHAR(50) NOT NULL,
    -- Valores posibles:
    --   'VISITAR_PRESIONADO'
    --   'VISITA_CANCELADA'
    --   'FICHA_ABIERTA'
    --   'FICHA_GUARDADA'
    --   'TIEMPO_MUERTO_INICIO'
    --   'TIEMPO_MUERTO_FIN'

    timestamp_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB,          -- Datos extra (ej: coordenadas al momento)

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monitoreo_worker ON monitoreo_acciones (worker_id);
CREATE INDEX idx_monitoreo_cliente ON monitoreo_acciones (cliente_id);
CREATE INDEX idx_monitoreo_accion ON monitoreo_acciones (accion);
CREATE INDEX idx_monitoreo_timestamp ON monitoreo_acciones (timestamp_at);

-- ────────────────────────────────────────────────────────────────────────────
-- 12. TABLA: alertas
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE alertas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo            tipo_alerta NOT NULL,

    -- Origen y destino
    emisor_id       UUID NOT NULL REFERENCES usuarios(id),      -- Worker que emite
    receptor_id     UUID NOT NULL REFERENCES usuarios(id),      -- Worker que recibe
    cliente_id      UUID REFERENCES clientes(id),               -- Cliente en cuestión

    mensaje         TEXT NOT NULL,
    leida           BOOLEAN DEFAULT FALSE,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alertas_receptor ON alertas (receptor_id, leida);
CREATE INDEX idx_alertas_tipo ON alertas (tipo);

-- ────────────────────────────────────────────────────────────────────────────
-- 13. TABLA: sync_queue (cola de sincronización offline → online)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE sync_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id       UUID NOT NULL REFERENCES usuarios(id),

    tabla_destino   VARCHAR(100) NOT NULL,       -- Nombre de la tabla a sincronizar
    operacion       VARCHAR(10) NOT NULL,        -- INSERT, UPDATE, DELETE
    payload         JSONB NOT NULL,              -- Datos a sincronizar
    sincronizado    BOOLEAN DEFAULT FALSE,
    intentos        INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    synced_at       TIMESTAMPTZ
);

CREATE INDEX idx_sync_pendiente ON sync_queue (sincronizado) WHERE sincronizado = FALSE;
CREATE INDEX idx_sync_worker ON sync_queue (worker_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 14. TABLA: ubicaciones_worker_tracking (tracking GPS en tiempo real)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE ubicaciones_worker_tracking (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id   UUID NOT NULL REFERENCES usuarios(id),
    latitud     DOUBLE PRECISION NOT NULL,
    longitud    DOUBLE PRECISION NOT NULL,
    precision_m REAL,                         -- Precisión en metros del GPS
    timestamp_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracking_worker ON ubicaciones_worker_tracking (worker_id);
CREATE INDEX idx_tracking_time ON ubicaciones_worker_tracking (timestamp_at DESC);

-- Partición por fecha recomendada para grandes volúmenes:
-- CREATE TABLE ubicaciones_worker_tracking (...) PARTITION BY RANGE (timestamp_at);

-- ────────────────────────────────────────────────────────────────────────────
-- 15. VISTAS ÚTILES
-- ────────────────────────────────────────────────────────────────────────────

-- Vista: Dashboard - Resumen de gestiones por worker
CREATE OR REPLACE VIEW v_resumen_worker AS
SELECT
    u.id AS worker_id,
    u.nombres || ' ' || u.apellidos AS worker_nombre,
    j.estado AS estado_jornada,
    COUNT(DISTINCT rc.cliente_id) FILTER (WHERE TRUE) AS total_asignados,
    COUNT(DISTINCT gh.cliente_id) FILTER (WHERE gh.tipificacion = 'PAGO') AS total_pagos,
    COUNT(DISTINCT gh.cliente_id) FILTER (WHERE gh.tipificacion = 'REPROGRAMARA') AS total_reprogramados,
    COUNT(DISTINCT gh.cliente_id) FILTER (WHERE gh.tipificacion = 'NO_ENCONTRADO') AS total_no_encontrados
FROM usuarios u
LEFT JOIN jornadas j ON j.worker_id = u.id AND j.fecha = CURRENT_DATE
LEFT JOIN rutas r ON r.worker_id = u.id AND r.fecha_asignacion = CURRENT_DATE
LEFT JOIN ruta_clientes rc ON rc.ruta_id = r.id
LEFT JOIN gestiones_historial gh ON gh.worker_id = u.id AND gh.fecha = CURRENT_DATE
WHERE u.rol = 'WORKER'
GROUP BY u.id, u.nombres, u.apellidos, j.estado;

-- Vista: Clientes con su última gestión
CREATE OR REPLACE VIEW v_clientes_ultima_gestion AS
SELECT DISTINCT ON (c.id)
    c.id AS cliente_id,
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
LEFT JOIN usuarios u ON u.id = gh.worker_id
LEFT JOIN ubicaciones ub ON ub.id = c.ubicacion_id
ORDER BY c.id, gh.timestamp_at DESC NULLS LAST;

-- ────────────────────────────────────────────────────────────────────────────
-- 16. TRIGGERS
-- ────────────────────────────────────────────────────────────────────────────

-- Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_usuarios   BEFORE UPDATE ON usuarios   FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_update_clientes   BEFORE UPDATE ON clientes   FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_update_rutas      BEFORE UPDATE ON rutas      FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_update_fichas     BEFORE UPDATE ON fichas     FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_update_jornadas   BEFORE UPDATE ON jornadas   FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Auto-actualizar contadores de ruta cuando cambia ruta_clientes
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
-- 17. CONSTRAINTS ADICIONALES (Reglas de negocio en BD)
-- ────────────────────────────────────────────────────────────────────────────

-- RN-01: Un worker solo puede tener 1 cliente EN_VISITA a la vez
-- Se implementa con un índice parcial único:
CREATE UNIQUE INDEX idx_un_cliente_en_visita_por_worker
    ON clientes (bloqueado_por)
    WHERE estado = 'EN_VISITA' AND bloqueado_por IS NOT NULL;

-- RN-12: Solo workers activos pueden tener jornadas
-- (Validado a nivel de aplicación, pero reforzado aquí)
-- Se puede agregar un CHECK via trigger si es necesario

-- Máximo 5 evidencias por ficha
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

-- ============================================================================
-- FIN DEL BORRADOR
-- ============================================================================
-- 
-- RESUMEN DE TABLAS:
--   1.  ubicaciones                  - Coordenadas y direcciones (compartida)
--   2.  usuarios                     - Admin y workers unificados
--   3.  clientes                     - Datos personales + estado global
--   4.  rutas                        - Rutas creadas por admin
--   5.  ruta_clientes                - Clientes asignados a cada ruta (M:N)
--   6.  fichas                       - Formulario de gestión con timestamps
--   7.  evidencias                   - Fotos/videos adjuntos a fichas (máx 5)
--   8.  gestiones_historial          - Historial completo de gestiones (auditoría)
--   9.  jornadas                     - Jornada laboral diaria del worker
--   10. monitoreo_acciones           - Trazabilidad granular de acciones
--   11. alertas                      - Notificaciones entre workers
--   12. sync_queue                   - Cola de sincronización offline
--   13. ubicaciones_worker_tracking  - GPS tracking en tiempo real
-- 
-- VISTAS:
--   v_resumen_worker                 - Dashboard de productividad por worker
--   v_clientes_ultima_gestion        - Última gestión de cada cliente
-- 
-- REGLAS DE NEGOCIO IMPLEMENTADAS EN BD:
--   - Un worker solo puede tener 1 cliente EN_VISITA (idx parcial único)
--   - Máximo 5 evidencias por ficha (trigger)
--   - Auto-actualización de timestamps (triggers)
--   - Contadores de ruta auto-calculados (trigger)
-- ============================================================================
