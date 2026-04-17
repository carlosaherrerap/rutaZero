# 🗺️ Ruta Zero — Diagrama de Flujo del Sistema

> **Versión:** 1.0 · **Fecha:** 2026-04-16
> **Metodología:** 3F (Forma · Fondo · Flujo)

---

## 1. Arquitectura General

```mermaid
graph TB
    subgraph "Frontend"
        WEB["🖥️ Portal Web<br/>(Administrador)"]
        APP["📱 App Móvil<br/>(Trabajador)"]
    end

    subgraph "Backend"
        API["⚙️ API REST / WebSocket"]
        SYNC["🔄 Motor de Sincronización"]
    end

    subgraph "Almacenamiento"
        PG["🐘 PostgreSQL<br/>(Base de datos principal)"]
        CACHE["📦 SQLite Local<br/>(Cache offline móvil)"]
        FS["📁 File Storage<br/>(Imágenes/Evidencias)"]
    end

    WEB -->|HTTPS| API
    APP -->|HTTPS + WS| API
    APP -->|Sin señal| CACHE
    CACHE -->|Al recuperar señal| SYNC
    SYNC --> API
    API --> PG
    API --> FS
```

---

## 2. Catálogo de Estados

### 2.1 Estados del Cliente (respecto a gestión)

| Estado | Color Card | Significado | ¿Visitable? |
|---|---|---|---|
| `LIBRE` | 🔵 Azul | Sin gestión, disponible | ✅ Sí |
| `EN_VISITA` | 🟣 Morado | Un worker está en camino / visitando | ❌ No (bloqueado) |
| `VISITADO_PAGO` | 🟢 Verde | Ficha completa, cliente pagó | ❌ No |
| `REPROGRAMADO` | 🟡 Amarillo | Ficha guardada, se reprogramará visita | ⚠️ Solo admin reasigna fecha |
| `NO_ENCONTRADO` | 🔴 Rojo | No se encontró al cliente (con fecha/hora) | ✅ Sí (otro worker o mismo, pasado un tiempo) |

> **IMPORTANTE:** El estado del cliente es **global**: todos los workers ven el mismo estado en tiempo real, independientemente de si el cliente les fue asignado.

### 2.2 Estados del Worker (jornada laboral)

| Estado | Significado |
|---|---|
| `INACTIVO` | No ha iniciado sesión hoy |
| `JORNADA_INICIADA` | Inició su día de trabajo |
| `EN_CAMINO` | Se dirige a visitar a un cliente |
| `LLENANDO_FICHA` | Está completando el formulario de un cliente |
| `ALMUERZO` | En horario de almuerzo |
| `TIEMPO_MUERTO` | Sin actividad registrada / sin señal |
| `JORNADA_FINALIZADA` | Marcó fin de jornada |

### 2.3 Estados de la Ficha

| Estado | Significado |
|---|---|
| `SIN_DATOS` | Ficha vacía, nunca se abrió |
| `EN_PROCESO` | Se abrió pero no se completó |
| `COMPLETADA` | Guardada exitosamente con tipificación |

---

## 3. Flujo de Autenticación (App Móvil)

```mermaid
flowchart TD
    A["Trabajador abre la app"] --> B{"¿Tiene sesión activa?"}
    B -- Sí --> D
    B -- No --> C["Pantalla de Login<br/>(usuario + contraseña)"]
    C --> V{"¿Credenciales válidas<br/>Y estado = ACTIVO?"}
    V -- No --> E["❌ Acceso denegado<br/>Mensaje: cuenta inactiva"]
    V -- Sí --> D["✅ Sesión iniciada"]
    D --> F["Descargar snapshot diario<br/>(clientes con fecha_gestion = HOY)"]
    F --> G["Guardar en SQLite local"]
    G --> H["Mostrar menú principal"]
```

> **NOTA:** Al iniciar sesión se descarga el **snapshot del día**: todos los clientes cuya `fecha_gestion` es la fecha actual. Este snapshot alimenta la app durante toda la jornada, incluso sin internet.

---

## 4. Flujo del Administrador — Creación de Rutas

```mermaid
flowchart TD
    A["Admin abre Portal Web"] --> B["Vista de Mapa General"]
    B --> B1["Mapa muestra:<br/>📌 Pins de TODOS los clientes<br/>🧑 Markers de TODOS los workers"]
    B1 --> C["Hover sobre pin de cliente:<br/>nombre, fecha_pago, retraso, deuda"]
    C --> D{"¿Filtrar?"}
    D -- "Por fecha de pago" --> D1["Filtro aplicado"]
    D -- "Por gestión REPROGRAMADO" --> D2["Ver clientes reprogramados<br/>→ Reasignar fecha_pago"]
    D -- "Continuar" --> E
    D1 --> E
    D2 --> E
    E["Seleccionar un Worker<br/>(ej: PEDRO)"]
    E --> F["Click sobre pins de clientes<br/>para agregar a la ruta"]
    F --> G["Lista lateral muestra<br/>clientes seleccionados<br/>(se pueden quitar)"]
    G --> H["Asignar nombre de ruta<br/>(ej: LIMA SUR)"]
    H --> I["💾 Guardar ruta"]
    I --> J["Ruta asignada al worker<br/>y visible en su app"]
```

---

## 5. Flujo del Worker — Visita a Cliente

Este es el flujo principal de la app móvil.

```mermaid
flowchart TD
    HOME["🏠 HOME<br/>Lista de TODOS los clientes<br/>(con filtros por gestión,<br/>departamento, provincia, distrito)"]
    RUTAS["📋 MIS RUTAS<br/>Cards de rutas asignadas<br/>(icono/mapa + nombre + progreso)"]
    
    HOME --> RUTAS
    RUTAS --> R1{"¿Todos los clientes<br/>de esta ruta visitados?"}
    R1 -- Sí --> R2["Card de ruta OPACA<br/>Botones bloqueados"]
    R1 -- No --> R3["Abrir ruta → Lista de clientes"]
    
    R3 --> CL["Card del cliente<br/>(color según estado)"]
    CL --> MAP["Vista Mapa:<br/>Punto del worker ↔ Punto del cliente<br/>+ línea de ruta<br/>+ distancia en metros + tiempo estimado"]
    
    MAP --> V{"¿Presiona VISITAR?"}
    V -- Sí --> V1{"¿Worker ya tiene<br/>otro cliente EN_VISITA?"}
    V1 -- Sí --> V2["❌ Debe cancelar<br/>visita actual primero"]
    V1 -- No --> V3{"¿Cliente está LIBRE<br/>o NO_ENCONTRADO?"}
    V3 -- No --> V4["❌ Cliente no disponible<br/>(bloqueado por otro worker)"]
    V3 -- Sí --> V5["✅ Estado cliente → EN_VISITA<br/>Botón cambia a CANCELAR VISITA<br/>Se registra timestamp"]
    
    V5 --> F{"¿Qué acción toma?"}
    F -- "Cancelar visita" --> F1["Estado cliente → LIBRE<br/>Se libera bloqueo"]
    F -- "Presiona LLENAR FICHA" --> F2["Abrir flujo de ficha<br/>(requiere haber presionado VISITAR)"]
```

> **ADVERTENCIA — Bloqueo exclusivo:** Un worker solo puede tener **un cliente en estado `EN_VISITA`** a la vez. Ningún otro worker puede visitar ese cliente mientras esté bloqueado.

---

## 6. Flujo de Llenado de Ficha (3 Pasos)

```mermaid
flowchart TD
    PASO1["📄 PASO 1: Validación de Identidad<br/>─────────────────────<br/>Datos personales del cliente<br/>(solo lectura, no editables)<br/>Nombre, DNI, dirección, etc."]
    PASO1 --> PASO2

    PASO2["📝 PASO 2: Formulario de Ficha<br/>─────────────────────<br/>Tipo de Crédito - entero<br/>Fecha de Desembolso - calendario<br/>Monto de Desembolso - entero<br/>Moneda - flotante<br/>Nro de Cuotas - entero<br/>Nro de Cuotas Pagadas - entero<br/>Monto de la Cuota - flotante<br/>Condición Contable - MOROSO o RESPONSABLE<br/>Saldo Capital - flotante"]
    PASO2 --> PASO3

    PASO3["📸 PASO 3: Evidencia<br/>─────────────────────<br/>Adjuntar hasta 5 imágenes<br/>como prueba de visita"]
    PASO3 --> TIP

    TIP{"Seleccionar tipificación"}
    TIP -- "PAGÓ" --> G1["Estado → VISITADO_PAGO 🟢<br/>Ficha → COMPLETADA"]
    TIP -- "REPROGRAMARÁ" --> G2["Estado → REPROGRAMADO 🟡<br/>Ficha → COMPLETADA"]
    TIP -- "NO SE ENCONTRÓ" --> G3["Estado → NO_ENCONTRADO 🔴<br/>Se registra fecha + hora<br/>Ficha → COMPLETADA"]

    G1 --> SAVE["💾 Guardar en BD<br/>(o en cache si offline)"]
    G2 --> SAVE
    G3 --> SAVE
    SAVE --> BACK["← Regresar a vista RUTAS"]
```

> **TIP:** Al guardar, se registran automáticamente los **timestamps de monitoreo**: hora de apertura de ficha, hora de cierre, y duración total.

---

## 7. Flujo de Sincronización Offline / Online

```mermaid
flowchart TD
    A["Worker realiza acción<br/>(visitar, llenar ficha, etc.)"]
    A --> B{"¿Hay conexión<br/>a internet?"}
    
    B -- Sí --> C["Guardar en BD remota PostgreSQL<br/>+ Actualizar SQLite local"]
    B -- No --> D["Guardar SOLO en SQLite local<br/>Marcar como pendiente de sync"]
    
    D --> E{"¿Recuperó señal?"}
    E -- No --> F["Continuar trabajando<br/>con datos locales"]
    F --> E
    E -- Sí --> G["Motor de sincronización<br/>detecta conexión"]
    G --> H["Enviar cambios pendientes<br/>al servidor por lotes"]
    H --> I{"¿Conflictos?"}
    I -- No --> J["✅ Sincronización exitosa"]
    I -- Sí --> K["Resolver por timestamp<br/>(último cambio gana)"]
    K --> J
```

> **IMPORTANTE:** Los datos que se cachean localmente al inicio de sesión incluyen: `id_cliente`, `id_ficha`, `id_worker`, y toda la información necesaria para operar sin conexión durante la jornada.

---

## 8. Flujo de Alertas y Notificaciones

```mermaid
flowchart TD
    subgraph "Alerta: Cercanía"
        A1["Worker DANIEL detecta que<br/>está más cerca del cliente PABLO"]
        A1 --> A2["DANIEL envía alerta personalizada:<br/>LIBERA AL CLIENTE XXXXX<br/>yo estoy más cerca"]
        A2 --> A3["Worker PEDRO recibe notificación<br/>y decide si liberar al cliente"]
    end

    subgraph "Notificación: Cliente registrado por otro"
        B1["Worker DANIEL visita y registra<br/>al cliente PABLO asignado a PEDRO"]
        B1 --> B2["Notificación automática a PEDRO:<br/>El worker DANIEL ha registrado<br/>un cliente tuyo"]
    end

    subgraph "Filtro por ubicación"
        C1["Worker abre HOME"]
        C1 --> C2["Filtrar por:<br/>Departamento → Provincia → Distrito"]
        C2 --> C3["Ver solo clientes<br/>de su zona cercana"]
    end
```

---

## 9. Navegación de la App Móvil (Mapa de Pantallas)

```mermaid
flowchart LR
    subgraph "Menú Principal"
        HOME["🏠 HOME<br/>Todos los clientes"]
        RUTAS["📋 Mis Rutas"]
        STATS["📊 Stats"]
        PERFIL["👤 Mi Perfil"]
    end

    HOME --> FILTROS["Filtros:<br/>Gestión · Ubicación"]
    HOME --> CARD_C["Card Cliente<br/>→ Detalle"]

    RUTAS --> RUTA_DET["Detalle de Ruta<br/>lista clientes"]
    RUTA_DET --> CLI_MAP["Mapa + Ruta al cliente"]
    CLI_MAP --> VISITAR["Botón VISITAR"]
    VISITAR --> FICHA["Flujo Ficha 3 pasos"]
    FICHA --> RUTAS

    STATS --> ST1["Total asignados"]
    STATS --> ST2["Total visitados"]
    STATS --> ST3["Fichas completadas"]
    STATS --> ST4["No encontrados"]
```

---

## 10. Panel del Administrador (Portal Web)

```mermaid
flowchart TB
    subgraph "Portal Web — Módulos"
        DASH["📊 Dashboard<br/>KPIs y métricas"]
        WORKERS["👷 Gestión Workers<br/>CRUD + estados"]
        CLIENTS["👥 Gestión Clientes<br/>Fichas + búsqueda"]
        ROUTES["🗺️ Creador de Rutas<br/>Mapa interactivo"]
        LOGS["📋 Logs de Gestión<br/>Avances por worker"]
        ALERTS["🔔 Alertas"]
    end

    DASH --> D1["Clientes totales vs visitados"]
    DASH --> D2["Workers activos / almuerzo / finalizados"]
    DASH --> D3["Rutas completadas"]
    DASH --> D4["Clientes por estado"]

    WORKERS --> W1["Crear / Editar / Desactivar"]
    WORKERS --> W2["Ver estado en tiempo real"]
    WORKERS --> W3["Ver jornada: inicio, almuerzo, fin"]

    CLIENTS --> C1["Búsqueda por nombre/DNI"]
    CLIENTS --> C2["Ver ficha completa"]
    CLIENTS --> C3["Historial de gestiones"]

    ROUTES --> CREAR_RUTA["Flujo de creación<br/>(ver sección 4)"]
```

---

## 11. Reglas de Negocio Consolidadas

| # | Regla | Módulo |
|---|---|---|
| RN-01 | Un worker solo puede tener **1 cliente en `EN_VISITA`** a la vez | App Móvil |
| RN-02 | Solo se puede llenar ficha si previamente se presionó `VISITAR` | App Móvil |
| RN-03 | Un cliente `EN_VISITA` está **bloqueado** para todos los demás workers | Global |
| RN-04 | Los estados de cliente son **globales y en tiempo real** | Global |
| RN-05 | `NO_ENCONTRADO` registra fecha+hora y el cliente **vuelve a ser visitable** | App Móvil |
| RN-06 | Si todos los clientes de una ruta fueron visitados, la card se pone **opaca** y botones se **bloquean** | App Móvil |
| RN-07 | Al guardar ficha/tipificación se retorna automáticamente a la vista de Rutas | App Móvil |
| RN-08 | El snapshot diario se descarga al iniciar sesión (clientes con `fecha_gestion = HOY`) | App Móvil |
| RN-09 | Los datos offline se sincronizan automáticamente al recuperar conexión | App Móvil |
| RN-10 | Las imágenes de evidencia se almacenan en filesystem, solo la ruta en BD | Backend |
| RN-11 | El admin puede filtrar clientes por fecha de pago y por gestión `REPROGRAMADO` | Portal Web |
| RN-12 | Un worker solo puede loguearse si su estado en BD es `ACTIVO` | Backend |
| RN-13 | Cada acción del worker se registra con timestamp para monitoreo | Backend |

---

> **3F Aplicadas:**
> - **Forma:** Catálogos normalizados de estados, colores y tipificaciones. Nomenclatura consistente.
> - **Fondo:** Todas las reglas de negocio documentadas. Datos del cliente, ficha, evidencias y monitoreo sin pérdida.
> - **Flujo:** Navegación lineal en la app (Rutas → Cliente → Mapa → Visitar → Ficha → Regreso). Sincronización bidireccional offline/online.
