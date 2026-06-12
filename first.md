# 🏦 Propuesta Técnica: Ecosistema FSM para Agrobanco
## Arquitectura de Alta Disponibilidad y Onboarding Digital

Este documento detalla la infraestructura necesaria para desplegar una solución que cumpla con los requerimientos de auditoría, seguridad y escala del banco.

### 1. Infraestructura Enterprise (AWS Tier) - Recomendado
| Servicio | Propósito | Precio Est. | Sustento Bancario |
| :--- | :--- | :--- | :--- |
| **AWS ECS (Fargate)** | Backend API (Node.js) | $150 - $400 | Ejecución en contenedores sin servidor. Escala automáticamente ante picos de demanda. |
| **Amazon RDS (Multi-AZ)** | DB PostgreSQL | $200 - $500 | Réplica en tiempo real en 2 zonas. Garantiza disponibilidad del 99.95% y backups íntegros. |
| **AWS Textract** | Motor de OCR nativo | Pago x Uso | Extrae datos de DNI y recibos automáticamente, eliminando errores de digitación. |
| **AWS Cognito** | Gestión de Identidad | $0.05/user | Cumple con estándares de seguridad bancaria (OAuth2, MFA, Auditoría de accesos). |
| **AWS WAF** | Firewall de Aplicación | $100 | Protege contra ataques de denegación de servicio (DDoS) e inyecciones de código. |

### 2. Alternativa Calidad-Precio (Scale-up Tier)
| Proveedor | Servicio | Precio Est. | Ventaja |
| :--- | :--- | :--- | :--- |
| **DigitalOcean** | App Platform + Managed DB | $120 | Gestión mucho más sencilla y costos predecibles (sin sorpresas). |
| **Cloudflare R2** | Storage de Expedientes | $10 - $30 | Almacenamiento de documentos sin costos de transferencia (Egress fees). |
| **Google Vision** | OCR de DNI | $1.50/k docs | Alternativa económica y altamente precisa para escaneo de documentos de identidad. |


# 🚩 Retos y Dificultades: El Camino del Desarrollador Fullstack

Asumir un proyecto de este calibre implica desafíos que trascienden el código. Aquí los puntos críticos:

### 1. Desafíos Técnicos (La "Capa Oculta")
*   **Sincronización Delta (Offline-First)**: El mayor reto técnico. No es solo guardar datos en el celular; es manejar conflictos cuando dos personas editan el mismo expediente u observar un documento mientras el oficial está sin red.
*   **Seguridad y Encriptación**: Los bancos requieren que los datos estén encriptados "en reposo" (en la base de datos) y "en tránsito". Deberás implementar protocolos estrictos de manejo de llaves.
*   **Integración con Core Legacy**: Los sistemas bancarios suelen ser lentos. Tu app debe ser rápida, por lo que necesitarás capas de caché (Redis) para que el oficial no sienta la lentitud del banco.

### 2. Desafíos Conceptuales y de Negocio
*   **De Logística a Finanzas**: Debes aprender sobre **SLA (Service Level Agreements)**. Si un documento se "observa", el tiempo (TAT) no se detiene; debes medir cada segundo para identificar cuellos de botella.
*   **Marketing de Eficiencia**: Tu mayor reto de marketing no es vender una "app bonita", sino vender **"Reducción de Fuga de Capital"**. Debes hablar el lenguaje del gerente: soles perdidos por ineficiencia.
