# Métodos de Seguridad de Ruta Zero

Este documento detalla, de forma sencilla y sin tecnicismos complejos, las medidas de protección que actualmente tiene configuradas tu sistema para mantener los datos y accesos seguros.

## 1. Protección de Contraseñas (Cifrado Irreversible)
El sistema **nunca guarda las contraseñas reales** de los usuarios. En su lugar, aplica un proceso matemático (llamado "hashing") que transforma la contraseña en texto incomprensible. Si alguien robara la base de datos, no podría saber cuáles son las contraseñas verdaderas.

## 2. Llaves de Acceso Temporales (Sesiones Seguras)
Cuando un usuario inicia sesión correctamente, el sistema le entrega un "pase temporal" (Token). Este pase:
* Es el que se usa para moverse por el sistema sin tener que poner la contraseña a cada rato.
* Tiene una **caducidad corta y automática** (15 minutos). Si alguien roba el pase, dejará de servir muy rápido.
* El sistema verifica en cada clic que el pase sea válido y haya sido emitido por el servidor.

## 3. Bloqueo de Intentos Masivos (Antispam y Anti-hackeo)
El sistema tiene reglas estrictas para evitar que personas malintencionadas "adivinen" contraseñas o saturen el servidor:
* **En el inicio de sesión:** Si alguien se equivoca 5 veces seguidas, se le bloquea el acceso durante 15 minutos. Esto hace imposible adivinar contraseñas probando millones de veces.
* **En el resto del sistema:** Hay un límite general de peticiones (100 peticiones cada 15 minutos por persona). Si alguien intenta atacar el servidor bombardeándolo con peticiones, el sistema lo ignora automáticamente.

## 4. Control de Puertas y Orígenes (CORS y Cabeceras Seguras)
* **Invitados exclusivos:** El sistema solo permite que las aplicaciones web o móviles "autorizadas" se comuniquen con él. Si otra página web intenta conectarse a tu sistema a escondidas, la puerta permanecerá cerrada.
* **Casco de seguridad:** El servidor incluye una protección automática (Helmet) que oculta detalles técnicos de cómo está construido y prohíbe que el navegador ejecute scripts o códigos de fuentes desconocidas.

## 5. Filtro de Datos (Protección contra Códigos Maliciosos)
Toda la información que un usuario escribe (en formularios, al iniciar sesión, etc.) pasa por un **filtro de limpieza estricto**. El sistema:
* Elimina cualquier intento de enviar códigos dañinos (ataques de inyección).
* Limita el peso de la información que se puede enviar de golpe, para evitar que colapsen la memoria del servidor.

## 6. Consultas a la Base de Datos Blindadas
Cuando el sistema busca información en la base de datos (por ejemplo, buscar a un usuario), lo hace usando "plantillas seguras". Esto significa que un hacker no puede engañar a la base de datos escribiendo comandos disfrazados de texto normal (lo que se conoce como Inyección SQL).

## 7. Control de Cargos y Suspensión de Cuentas
* **Roles:** El sistema sabe exactamente quién es un "Administrador" y quién no. Ciertas zonas están totalmente restringidas si tu "pase temporal" no dice que eres Administrador.
* **Cuentas inactivas:** Cuando alguien intenta entrar, el sistema primero verifica si la cuenta sigue activa. Si un empleado fue dado de baja, se le niega el acceso inmediatamente, aunque se sepa la contraseña.

## 8. Secretos Ocultos Bajo Llave
Las "contraseñas maestras" que el servidor usa para funcionar internamente (para crear los pases temporales o conectarse a la base de datos) no están escritas en el código que un programador puede ver. Están ocultas en variables de entorno seguras que solo el servidor conoce.
