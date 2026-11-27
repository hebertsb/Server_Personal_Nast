# HomeSOC — Dashboard de administración y seguridad para homelabs

> Panel centralizado open source para monitorear, controlar y auditar servidores personales / homelabs: flujo de red, seguridad, accesos y servicios, desde cualquier dispositivo y cualquier red.

## 1. Visión del proyecto

Actualmente, administrar un homelab implica saltar entre varias herramientas independientes (Portainer, Pi-hole, Uptime Kuma, logs del sistema). **HomeSOC** unifica esa información en un solo dashboard, con foco en tres ejes: **flujo de datos**, **flujo de seguridad** y **flujo de red**, agregando capacidades de control (encender/apagar servicios) que las herramientas de monitoreo puro no ofrecen.

**Público objetivo:** entusiastas de homelab, estudiantes de sistemas/redes, pequeños equipos que auto-hospedan sus propios proyectos.

**Nota sobre el ritmo de desarrollo:** este es un proyecto personal, desarrollado por un solo autor. El ritmo real de avance no sigue un calendario fijo — puede completarse un módulo entero en un día de trabajo intensivo, o avanzar de forma más espaciada según disponibilidad. El calendario formal de sprints (ver `HomeSOC_Documentacion_Proyecto.docx`) es una referencia de alcance y evaluación académica, no un límite de velocidad real (ver `HomeSOC_Plan_Implementacion.md` para el detalle operativo). Antes de considerar el alcance final cerrado, se planea validar esta propuesta con el ingeniero/tutor asignado a la materia de Proyecto de Grado.

## 1.1 Trabajos relacionados (estado del arte)

Se investigó el ecosistema existente de herramientas de administración de homelabs para identificar solapamientos y diferenciadores genuinos antes de definir el alcance final.

| Herramienta | Enfoque principal | Limitaciones frente a HomeSOC |
|---|---|---|
| **secwatch** (Paco5687, código abierto) | Seguridad todo-en-uno: auto-ban de IPs, FIM, escaneo de CVE con flag CISA-KEV, análisis de tráfico opcional vía LLM local | No gestiona despliegue de proyectos, no tiene control de contenedores más allá de lectura, no tiene 2FA de usuario ni analítica de accesos por proyecto |
| **Cosmos-Server** (azukaar, código abierto + versión Cloud de paga) | Plataforma todo-en-uno: reverse proxy, gestión completa de contenedores, 2FA, anti-DDoS | El 2FA es fijo (siempre activo o inactivo), no condicional por origen de red; no analiza accesos por proyecto; el despliegue se limita a importar docker-compose, sin navegación de repositorios GitHub ni pipeline de verificación automática |
| **Dashy / Homepage / Nimbus / Muximux** | Portales de enlaces con status checks | Sin seguridad real, sin control de servicios, sin despliegue |
| **Zabbix / Grafana + Prometheus / Netdata** | Monitoreo genérico de métricas | No orientados a homelab ni a seguridad de aplicaciones; requieren integración manual de múltiples piezas |
| **Domotz / PRTG / Site24x7** (comerciales) | Monitoreo de red para MSPs/empresas | Modelo de precio por dispositivo (desde 1.5–35 USD/mes), pensado para clientes empresariales, no para un homelab personal |

**Diferenciador central de HomeSOC:** ningún trabajo relacionado combina, en un solo panel con un solo inicio de sesión, el ciclo completo de *código → verificación de seguridad → despliegue con reversión automática → observabilidad de accesos → seguridad de red del host*, con autenticación de dos factores adaptativa según el origen de la conexión.

## 2. Requerimientos funcionales (RF)

### 2.1 Autenticación y control de acceso
- **RF-01:** El sistema debe requerir inicio de sesión (usuario/contraseña) para acceder al dashboard.
- **RF-02:** Debe soportar al menos un rol de administrador (control total) y opcionalmente un rol de solo lectura.
- **RF-03:** Las sesiones deben expirar tras un período de inactividad configurable.
- **RF-04:** Debe registrar cada inicio de sesión (exitoso y fallido) con fecha, hora e IP de origen.
- **RF-04a (2FA condicional):** El sistema debe soportar autenticación de dos factores (TOTP, compatible con Google Authenticator/Authy) como segundo paso del login.
- **RF-04b:** El 2FA debe activarse automáticamente cuando la IP de origen **no** pertenezca al rango de red local configurado (ej. fuera de 192.168.1.0/24) — es decir, accesos vía Tailscale o Cloudflare Tunnel desde el exterior.
- **RF-04c:** El 2FA debe activarse también ante un dispositivo/navegador no reconocido previamente (basado en cookie/fingerprint de dispositivo), independientemente de la red de origen.
- **RF-04d:** El usuario debe poder marcar un dispositivo como "de confianza" tras un 2FA exitoso, evitando pedirlo de nuevo en ese mismo dispositivo por un período configurable (ej. 30 días), salvo que el acceso venga de red externa.
- **RF-04e:** Debe existir una pantalla de configuración para vincular la app de autenticación (mostrar QR code + secreto en texto para escanear con Google Authenticator).
- **RF-04f:** Debe generarse un set de códigos de recuperación de un solo uso al activar 2FA, para el caso de pérdida del dispositivo con la app autenticadora.
- **RF-04g:** Todo intento de acceso desde red externa sin completar el 2FA correctamente debe registrarse como evento de seguridad (ver sección 2.4) y notificarse (ver sección 2.6).

### 2.2 Monitoreo de servicios (contenedores)
- **RF-05:** Listar todos los contenedores Docker corriendo en el host, con su estado (running/stopped/unhealthy).
- **RF-06:** Mostrar uso de CPU, RAM y red por contenedor, en tiempo real o casi real (polling cada 5-10s).
- **RF-07:** Permitir iniciar, detener y reiniciar un contenedor desde el dashboard (vía Docker API).
- **RF-08:** Mostrar los logs recientes de un contenedor seleccionado.

### 2.3 Flujo de red
- **RF-09:** Mostrar el ancho de banda consumido por el host (entrante/saliente) en una gráfica temporal.
- **RF-10:** Integrar y mostrar estadísticas de Pi-hole (consultas totales, bloqueadas, top dominios) si Pi-hole está presente.
- **RF-11:** Listar los dispositivos/clientes activos en la red local (IP, hostname si disponible, última actividad).

### 2.4 Flujo de seguridad
- **RF-12:** Registrar y mostrar intentos de acceso SSH fallidos (origen: `/var/log/auth.log` u equivalente), con IP, usuario intentado y timestamp.
- **RF-13:** Detectar y alertar patrones de fuerza bruta (ej. más de N intentos fallidos desde la misma IP en X minutos).
- **RF-14:** Mostrar un listado de puertos abiertos/expuestos en el host.
- **RF-15:** Permitir bloquear una IP manualmente desde el dashboard (integración con `ufw`/`iptables`).

### 2.5 Flujo de datos / accesos a proyectos desplegados
- **RF-16:** Registrar cada solicitud HTTP entrante a los proyectos desplegados (IP origen, ruta solicitada, timestamp, código de respuesta, user-agent).
- **RF-17:** Mostrar métricas agregadas por proyecto: total de visitas, visitas únicas, rutas más solicitadas, horarios pico.
- **RF-18:** Geolocalizar (a nivel de país/ciudad, best-effort) las IPs de acceso, sin almacenar datos personales identificables.
- **RF-19:** Permitir filtrar el historial de accesos por rango de fechas y por proyecto.

### 2.6 Alertas y notificaciones
- **RF-20:** Enviar notificaciones (Telegram, email, webhook genérico) ante eventos críticos: servicio caído, intento de intrusión detectado, uso de disco/CPU por encima de un umbral.
- **RF-21:** Permitir configurar qué eventos generan notificación y a través de qué canal.

### 2.7 Acceso remoto
- **RF-22:** El dashboard debe ser accesible tanto en red local como remotamente (compatible con Tailscale / Cloudflare Tunnel, sin requerir cambios de código).
- **RF-23:** Debe funcionar correctamente en dispositivos móviles y tablets (diseño responsive), sin necesidad de una aplicación nativa separada.
- **RF-23a (PWA):** El sistema debe implementarse como Progressive Web App (manifest.json + service worker), permitiendo instalarse en la pantalla de inicio de celulares y tablets, ejecutarse en modo de pantalla completa sin la barra del navegador, y recibir notificaciones push del navegador.
- **RF-23b:** El diseño responsive debe validarse explícitamente en al menos tres tamaños de pantalla: celular, tablet y escritorio.

### 2.8 Monitoreo de recursos del servidor (host y por proyecto)
- **RF-24:** El sistema debe mostrar el uso de CPU, RAM, disco y temperatura del host en tiempo casi real, de forma similar a un administrador de tareas del sistema operativo.
- **RF-25:** Debe mostrar gráficas de línea históricas (últimas 24 horas y últimos 7 días) del consumo de CPU, RAM y red del host.
- **RF-26:** Debe mostrar el desglose de consumo de CPU y RAM **por cada contenedor/proyecto** individualmente, no solo el total del host.
- **RF-27:** Debe mostrar el espacio libre y usado en cada disco relevante (disco del sistema y disco de almacenamiento/NAS), con alertas configurables al superar un porcentaje de uso.

### 2.9 Despliegue de proyectos desde GitHub
- **RF-28:** El sistema debe permitir conectar una cuenta de GitHub mediante un Personal Access Token (classic), almacenado cifrado.
- **RF-29:** Debe listar todos los repositorios accesibles con ese token (nombre, rama principal, último commit).
- **RF-30:** Debe permitir desplegar un repositorio seleccionado con un flujo guiado (puerto, tipo de proyecto), creando el contenedor correspondiente automáticamente vía la API de Docker/Portainer, sin que el usuario deba crearlo manualmente.
- **RF-31:** Debe priorizar el uso de `Dockerfile` (compatible con cualquier lenguaje) y, en ausencia de este, auto-detectar el tipo de proyecto mediante plantillas base: en el MVP soporta **HTML estático y Node.js** (`index.html`, `package.json`), dejando otros stacks (Python, etc.) como extensión posterior.
- **RF-32:** Debe soportar dos modos configurables por repositorio para detectar nuevos commits: (a) **Webhook de GitHub** (creado automáticamente vía API apuntando a `/api/v1/webhooks/github`, exponiendo únicamente ese endpoint mediante Cloudflare Tunnel y validando firma HMAC), o (b) **Polling** (HomeSOC consulta GitHub periódicamente cada 1–2 minutos sin necesidad de exponer ningún endpoint a internet).
- **RF-33:** Debe re-desplegar automáticamente el proyecto ante cada push detectado en la rama configurada (ya sea por webhook validado con HMAC o por polling).
- **RF-34:** Debe ofrecer un botón de "Redeploy" manual, independiente del webhook automático.
- **RF-35:** Debe permitir, por proyecto, alternar entre "auto-deploy en cada push" y "requiere aprobación manual antes de desplegar".

### 2.10 Variables de entorno por proyecto
- **RF-36:** El sistema debe permitir definir variables de entorno (nombre/valor) para cada proyecto desplegado, mediante un formulario en el dashboard.
- **RF-37:** Las variables de entorno deben almacenarse cifradas en la base de datos y nunca escribirse en el código fuente ni en el repositorio.
- **RF-38:** Las variables deben inyectarse automáticamente en el contenedor al desplegar o re-desplegar el proyecto.
- **RF-39:** El usuario debe poder editar las variables de un proyecto en cualquier momento; el cambio se aplica en el siguiente despliegue. Las variables o secretos nuevos nunca se leen ni se suben desde el repositorio: deben cargarse en este apartado antes del `git push` (de lo contrario, el health check fallará y disparará el rollback automático para proteger la versión activa).

### 2.11 Gate de seguridad previo al despliegue
- **RF-40:** Antes de construir la imagen de un proyecto, el sistema debe escanear el código fuente en busca de secretos expuestos accidentalmente (claves, contraseñas, tokens) usando una herramienta de escaneo de secretos (ej. gitleaks).
- **RF-41:** El sistema debe auditar las dependencias del proyecto en busca de vulnerabilidades conocidas (npm audit / pip-audit según el stack detectado).
- **RF-42:** El sistema debe escanear la imagen Docker final en busca de vulnerabilidades del sistema base y librerías instaladas (ej. con Trivy).
- **RF-43:** Si cualquiera de los escaneos anteriores encuentra un hallazgo crítico, el despliegue automático debe detenerse, notificar al usuario, y requerir confirmación manual explícita para continuar.
- **RF-44:** El resultado de los tres escaneos debe quedar visible en el historial de despliegue del proyecto.

### 2.12 Health check, rollback automático e historial de despliegues
- **RF-45:** Al desplegar una nueva versión, el sistema debe construir y levantar la nueva versión en paralelo, sin detener la versión actualmente en producción.
- **RF-46:** El sistema debe ejecutar un chequeo de salud automático (health check) contra la nueva versión antes de promoverla a servir tráfico real.
- **RF-47:** Si el health check falla, el sistema debe descartar automáticamente la nueva versión, mantener la versión anterior sirviendo sin interrupción, y registrar el despliegue como fallido con el detalle del error.
- **RF-48:** Si el health check pasa, el sistema debe promover la nueva versión y detener la anterior, minimizando el tiempo de inactividad.
- **RF-49:** El sistema debe mantener un historial de despliegues por proyecto (commit, fecha, resultado, log de construcción y de health check).
- **RF-50:** El usuario debe poder revertir manualmente a cualquier despliegue anterior del historial con una sola acción, incluso si dicho despliegue fue exitoso en su momento.

### 2.13 Automatización de servicios
- **RF-51:** El sistema debe permitir programar horarios de encendido/apagado automático por servicio/contenedor.
- **RF-52:** El sistema debe permitir definir reglas simples de tipo condición-acción (ej. "si CPU > 90% durante 5 minutos, notificar").
- **RF-53:** Toda automatización ejecutada debe quedar registrada en un log con resultado (éxito/error).

### 2.14 Módulo de IA (opcional, diseño híbrido)
- **RF-54:** El sistema debe poder generar, bajo demanda, una explicación en lenguaje natural de por qué falló un despliegue, a partir de su log técnico.
- **RF-55:** El sistema debe poder generar un resumen periódico (diario) de la actividad de seguridad relevante del día.
- **RF-56:** El análisis de IA debe implementarse mediante una interfaz intercambiable (patrón Strategy) que permita usar un proveedor en la nube (API) o un modelo local (Ollama), sin modificar el resto del sistema.
- **RF-57:** Por defecto, y dado el hardware de referencia del proyecto (sin GPU dedicada), el proveedor de IA debe ser una API externa; el modelo local queda como opción futura configurable.
- **RF-58 (prioridad Could):** El análisis de IA no debe ser una dependencia crítica de ninguna funcionalidad core (ej. el health check de despliegue nunca depende de una respuesta de IA para funcionar).

### 2.15 Consola limitada por contenedor (prioridad Could, opcional)
- **RF-59:** El sistema puede ofrecer, opcionalmente y con baja prioridad, una consola de comandos restringida a un contenedor específico (equivalente a `docker exec`), nunca acceso a una terminal del sistema operativo host.
- **RF-60:** De implementarse, cada comando ejecutado en dicha consola debe registrarse en auditoría (usuario, comando, contenedor, fecha/hora).
- **RF-61:** De implementarse, el acceso a la consola debe requerir reconfirmación de identidad (contraseña o 2FA), igual que las demás acciones destructivas del sistema.
- **RF-62:** Explícitamente fuera de alcance: una terminal SSH completa del host dentro del dashboard. Esta función se considera redundante (ya cubierta por acceso SSH directo) y un riesgo de seguridad innecesario que contradice el resto del diseño de seguridad del sistema.

### 2.16 Integración con agentes de IA mediante servidor MCP (prioridad Could, opcional)
- **RF-63:** El sistema puede exponer un servidor **MCP (Model Context Protocol)** para que un agente de IA externo autorizado consulte el estado del servidor (recursos, contenedores, logs, historial de despliegues y resultados del gate de seguridad) y dispare despliegues o reversiones.
- **RF-64:** El servidor MCP debe autenticarse mediante un token de API propio con permisos acotados (separando herramientas de solo lectura de acciones de escritura/despliegue) y registrar en auditoría cada acción ejecutada por el agente indicando su origen (`mcp`).
- **RF-65:** Ninguna herramienta MCP podrá devolver secretos en texto plano (variables de entorno, tokens de GitHub, claves de cifrado) ni acceder directamente al socket de Docker o a la base de datos; toda operación debe pasar por la capa de Aplicación respetando el gate de seguridad y el modo de aprobación manual configurado en cada proyecto.

## 2.17 Estructura de navegación (6 módulos/paneles)

Para evitar fragmentar la interfaz en demasiadas pantallas sueltas, el sistema se organiza en seis módulos principales, cada uno con sub-pestañas internas:

1. **Recursos del Servidor** — uso de CPU/RAM/disco/temperatura del host, gráficas históricas, desglose por contenedor (RF-24 a RF-27).
2. **Servicios y Despliegues** — lista de contenedores, control (start/stop/restart), logs, y el módulo completo de despliegue GitHub (repos, variables de entorno, health check, rollback, historial) (RF-05 a RF-08, RF-28 a RF-50).
3. **Red y Conectividad** — estadísticas de Pi-hole, ancho de banda, dispositivos de red, estado de Tailscale y de túneles Cloudflare activos, con posibilidad de activarlos/desactivarlos o cambiar su destino sin salir del panel (RF-09 a RF-11).
4. **Seguridad** — intentos de acceso fallidos, fuerza bruta, IPs bloqueadas, configuración de 2FA, auditoría de acciones, resultados del gate de seguridad de despliegues (RF-12 a RF-17, RF-04a a RF-04g, RF-40 a RF-44).
5. **Automatización** — horarios de encendido/apagado, reglas condición-acción, log de ejecución (RF-51 a RF-53).
6. **Configuración General** — notificaciones, backups, usuarios/roles, conexión con GitHub, preferencias (RF-20, RF-21, y configuración transversal).

## 3. Requerimientos no funcionales (RNF)

- **RNF-01 (Seguridad):** Las contraseñas deben almacenarse con hash (bcrypt/argon2), nunca en texto plano.
- **RNF-02 (Seguridad):** Toda comunicación con el dashboard debe soportar HTTPS.
- **RNF-03 (Rendimiento):** El polling de métricas no debe generar una carga de CPU mayor al 5% en un host de gama media (referencia: Ryzen 5 5500U).
- **RNF-04 (Portabilidad):** El sistema debe distribuirse como imagen Docker / docker-compose, desplegable en cualquier host Linux con Docker.
- **RNF-05 (Extensibilidad):** La arquitectura debe permitir agregar nuevos "colectores" de datos (nuevas fuentes de métricas) sin modificar el núcleo del sistema.
- **RNF-06 (Persistencia):** El historial de eventos y métricas debe persistir en base de datos (no solo en memoria), sobreviviendo a reinicios del contenedor.
- **RNF-07 (Privacidad):** Por ser open source y usado por terceros, no debe recolectar ni enviar telemetría a servidores externos sin consentimiento explícito.
- **RNF-08 (Documentación):** Debe incluir README con instrucciones de instalación en menos de 10 minutos (docker-compose up).

## 3.1 Seguridad de la aplicación (OWASP-aligned)

Estos requerimientos aplican transversalmente a todo el sistema, no solo al login, y deben tratarse como criterios de aceptación obligatorios, no opcionales.

### Prevención de inyección SQL
- **RNF-SEC-01:** Toda consulta a la base de datos debe usar **queries parametrizadas** o un ORM (ej. Prisma, SQLAlchemy, Sequelize) — prohibido concatenar strings de usuario directamente en SQL.
- **RNF-SEC-02:** Los mensajes de error de base de datos nunca deben exponerse tal cual al cliente (evitar fuga de estructura de tablas); deben loguearse internamente y devolver un error genérico al usuario.

### Validación y sanitización de entradas
- **RNF-SEC-03:** Toda entrada del usuario (formularios, query params, headers) debe validarse en el backend con un esquema explícito (ej. Zod, Joi, Pydantic) — nunca confiar solo en validación del frontend.
- **RNF-SEC-04:** Definir tipos, longitud máxima y formato esperado para cada campo (ej. IPs con regex válido, emails, nombres de contenedor alfanuméricos).
- **RNF-SEC-05:** Sanitizar cualquier dato que se vaya a renderizar en el frontend para prevenir XSS (usar el escapado automático de React; evitar `dangerouslySetInnerHTML`).
- **RNF-SEC-06:** Rechazar payloads JSON excesivamente grandes (límite de tamaño de body, ej. 1MB) para prevenir abuso.

### Rate limiting (limitación de tasa)
- **RNF-SEC-07:** Aplicar rate limiting en el endpoint de login (ej. máximo 5 intentos por IP cada 15 minutos), respondiendo 429 tras exceder el límite.
- **RNF-SEC-08:** Aplicar rate limiting general a nivel de API (ej. 100 solicitudes/minuto por IP) para prevenir abuso o scraping del dashboard.
- **RNF-SEC-09:** Los intentos bloqueados por rate limiting deben registrarse como evento de seguridad (tabla `eventos_seguridad`).
- **RNF-SEC-10:** Considerar rate limiting progresivo (backoff exponencial) para intentos de login repetidamente fallidos desde la misma IP, antes de llegar al bloqueo total.

### Row Level Security (RLS) en PostgreSQL
- **RNF-SEC-11:** Habilitar RLS en las tablas que contengan datos sensibles o multi-usuario (`usuarios`, `dispositivos_confiables`, `codigos_recuperacion`), restringiendo que un usuario solo pueda leer/modificar sus propias filas cuando aplique el rol "solo lectura" con alcance limitado.
- **RNF-SEC-12:** Las conexiones del backend a PostgreSQL deben usar un rol de base de datos con privilegios mínimos necesarios (principio de menor privilegio) — nunca conectar como superusuario `postgres` desde la aplicación.
- **RNF-SEC-13:** Las políticas RLS deben probarse explícitamente (tests) para confirmar que un rol no puede leer datos fuera de su alcance, incluso si hay un error en la lógica de la aplicación.

### Autenticación y sesiones
- **RNF-SEC-14:** Tokens de sesión (JWT o similar) deben tener expiración corta (ej. 15-30 min) con refresh token de vida más larga almacenado de forma segura (httpOnly, secure cookie).
- **RNF-SEC-15:** Los secretos TOTP y códigos de recuperación deben almacenarse cifrados en reposo (no solo hasheados, ya que el TOTP secret debe poder recuperarse para validar), usando una clave de cifrado separada de la base de datos (variable de entorno / secreto).
- **RNF-SEC-16:** Invalidar todas las sesiones activas de un usuario si cambia su contraseña o desactiva 2FA.

### Seguridad de infraestructura y despliegue
- **RNF-SEC-17:** El contenedor de la aplicación debe correr con un usuario no-root dentro de Docker.
- **RNF-SEC-18:** Las credenciales (contraseñas de DB, tokens de Telegram, claves de cifrado) deben inyectarse por variables de entorno / secretos de Docker, nunca hardcodeadas en el código ni comiteadas al repositorio.
- **RNF-SEC-19:** Incluir cabeceras de seguridad HTTP estándar (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security) en las respuestas del backend.
- **RNF-SEC-20:** Los endpoints que ejecutan acciones destructivas o de control (start/stop de contenedores, bloquear IP, apagar servicios) deben requerir re-confirmación (ej. reingresar contraseña o código 2FA) además de la sesión activa, dado su nivel de impacto.
- **RNF-SEC-21:** Registrar en auditoría toda acción de control ejecutada (quién, qué, cuándo) de forma inmutable (no editable ni borrable desde la propia aplicación).

### Dependencias y superficie de ataque
- **RNF-SEC-22:** Escanear dependencias del proyecto (npm audit / pip-audit) como parte del proceso de build, fallando el build ante vulnerabilidades críticas conocidas.
- **RNF-SEC-23:** Minimizar la superficie expuesta: el dashboard no debe exponer directamente el socket de Docker al frontend; toda interacción con Docker pasa por el backend, que valida y autoriza cada acción.

## 4. Arquitectura propuesta

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│         Dashboard web responsive, gráficas, control      │
└───────────────────────┬───────────────────────────────────┘
                         │ REST API / WebSocket (tiempo real)
┌───────────────────────┴───────────────────────────────────┐
│                    Backend (Node.js / FastAPI)             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────────┐ │
│  │  Auth     │ │ Collector │ │ Collector │ │ Notifier   │ │
│  │  (JWT)    │ │  Docker   │ │  Security │ │ (Telegram) │ │
│  └───────────┘ └───────────┘ └───────────┘ └────────────┘ │
└───────────────────────┬───────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │   PostgreSQL         │
              │  (eventos, métricas, │
              │   usuarios, logs)    │
              └──────────────────────┘

Fuentes de datos: Docker API · /var/log/auth.log · nginx access.log
                  · Pi-hole API (opcional) · /proc (red/CPU)
```

## 5. Esquema de base de datos (PostgreSQL, nombres en español)

**Motor:** PostgreSQL, desplegado en el mismo servidor homelab (mismo contenedor Postgres ya utilizado para otros proyectos, en una base de datos independiente, ej. `homesoc`).

**usuarios**
`id, nombre_usuario, hash_contrasena, rol, secreto_totp (cifrado, nullable), totp_habilitado (bool), creado_en`

**dispositivos_confiables**
`id, usuario_id, huella_dispositivo, etiqueta_dispositivo, ultima_ip, confiable_hasta, creado_en`

**codigos_recuperacion**
`id, usuario_id, hash_codigo, usado (bool), creado_en`

**intentos_inicio_sesion**
`id, nombre_usuario, direccion_ip, exitoso (bool), fecha_hora`

**contenedores_snapshot**
`id, nombre_contenedor, estado, porcentaje_cpu, ram_mb, fecha_hora`

**eventos_seguridad**
`id, tipo_evento (ssh_fallido, fuerza_bruta, escaneo_puertos...), ip_origen, detalles (jsonb), severidad, fecha_hora`

**ips_bloqueadas**
`id, direccion_ip, motivo, bloqueado_por, creado_en`

**solicitudes_proyecto**
`id, nombre_proyecto, ip_origen, ruta, metodo, codigo_estado, user_agent, pais (nullable), fecha_hora`

**configuracion_notificaciones**
`id, tipo_evento, canal (telegram/email/webhook), destino, habilitado`

**alertas_enviadas**
`id, tipo_evento, mensaje, canal, enviado_en`

**backups_registro**
`id, servicio, ruta_archivo, tamano_mb, exitoso (bool), fecha_hora`

**dispositivos_tailscale**
`id, nombre_dispositivo, ip_tailscale, ultima_conexion, estado`

**recursos_host_snapshot**
`id, porcentaje_cpu, ram_usada_mb, ram_total_mb, temperatura_c, fecha_hora`

**discos_snapshot**
`id, punto_montaje, espacio_total_gb, espacio_usado_gb, fecha_hora`

**conexion_github**
`id, usuario_id, token_cifrado, nombre_cuenta_github, creado_en`

**repositorios_conectados**
`id, nombre_repositorio, rama_principal, tipo_proyecto_detectado, puerto, modo_deploy (auto/manual), modo_disparo (webhook/polling), intervalo_polling_seg (nullable), webhook_id_github (nullable), creado_en`

**variables_entorno**
`id, repositorio_id, nombre_variable, valor_cifrado, actualizado_en`

**despliegues**
`id, repositorio_id, commit_hash, resultado (exitoso/fallido/en_espera), log_construccion, log_health_check, iniciado_en, finalizado_en`

**escaneos_seguridad_despliegue**
`id, despliegue_id, tipo_escaneo (secretos/dependencias/imagen), hallazgos (jsonb), severidad_maxima, fecha_hora`

**automatizaciones**
`id, nombre, tipo (horario/condicion), configuracion (jsonb), habilitado, creado_en`

**automatizaciones_log**
`id, automatizacion_id, resultado (exitoso/error), detalle, fecha_hora`

**consola_auditoria**
`id, usuario_id, contenedor, comando, fecha_hora`

**tokens_mcp**
`id, usuario_id, nombre_token, hash_token, permisos (lectura/escritura), revocado (bool), ultimo_uso, creado_en`

## 6. Stack tecnológico sugerido

| Capa | Tecnología | Motivo |
|---|---|---|
| Backend | Node.js + Express o Python + FastAPI | Ecosistema maduro, fácil integración con Docker SDK |
| Frontend | React + Tailwind + Recharts | Responsive, gráficas simples, buen soporte comunidad |
| Base de datos | PostgreSQL (español en nombres de tablas/columnas) | Ya usada en el homelab (mismo servidor); admite JSON, robusta |
| Tiempo real | WebSocket (Socket.io) | Para métricas en vivo sin polling agresivo |
| Contenedores | Docker + docker-compose | Distribución estándar para el público objetivo |
| Notificaciones | node-telegram-bot-api / smtp | Reutiliza patrones ya usados en Uptime Kuma |
| 2FA / TOTP | speakeasy (Node) o pyotp (Python) + qrcode | Estándar TOTP, compatible con Google Authenticator sin dependencias propietarias |
| Validación de entradas | Zod (Node) o Pydantic (Python) | Esquemas explícitos, previene datos malformados/maliciosos |
| Rate limiting | express-rate-limit / slowapi | Protección contra fuerza bruta y abuso de API |
| Escaneo de dependencias | npm audit / pip-audit / Trivy | Detección de vulnerabilidades conocidas antes de desplegar |
| Escaneo de secretos | gitleaks | Detecta claves/contraseñas hardcodeadas antes de construir la imagen |
| Integración GitHub | Octokit (API oficial de GitHub) | Listar repos, crear webhooks, validar firma HMAC |
| IA (opcional, híbrida) | API de Anthropic/OpenAI por defecto; Ollama como alternativa local futura | Interfaz intercambiable (Strategy); evita sobrecargar el hardware sin GPU dedicada |
| PWA | Web App Manifest + Service Worker (Workbox) | Experiencia tipo app en tablet/celular sin mantener una segunda base de código nativa |
| Servidor MCP (opcional) | `@modelcontextprotocol/sdk` (Node) o `mcp` (Python) | Interfaz estándar para conectar agentes de IA externos sin duplicar lógica de negocio |

## 7. Roadmap por fases (MVP → v1 → v2)

**Fase 0 — MVP (mínimo viable)**
- Login básico
- Lista de contenedores + start/stop/restart
- Gráfica simple de CPU/RAM del host
- Persistencia en PostgreSQL

**Fase 0.5 — Autenticación reforzada**
- 2FA (TOTP) opcional, activable desde configuración
- Lógica de "red de confianza" (local vs externa) para exigir 2FA condicionalmente
- Reconocimiento de dispositivo de confianza + códigos de recuperación

**Fase 0.7 — Endurecimiento de seguridad (security hardening)**
- Validación de esquemas en todos los endpoints (Zod/Pydantic)
- Rate limiting en login y en API general
- Habilitar RLS en tablas sensibles + rol de base de datos con privilegios mínimos
- Cabeceras de seguridad HTTP, contenedor corriendo como usuario no-root
- Auditoría inmutable de acciones de control

**Fase 1 — Seguridad y red**
- Colector de intentos SSH fallidos + detección de fuerza bruta
- Integración con Pi-hole (si está presente)
- Notificaciones por Telegram

**Fase 2 — Flujo de datos / proyectos**
- Middleware/logger para registrar accesos a proyectos desplegados
- Dashboard de visitas por proyecto (rutas, horarios, geolocalización básica)
- Bloqueo manual de IPs

**Fase 2.5 — Monitoreo de recursos del servidor**
- Panel de recursos del host (CPU, RAM, disco, temperatura) con gráficas históricas
- Desglose de consumo por contenedor/proyecto

**Fase 3 — Despliegue de proyectos desde GitHub (módulo diferenciador principal)**
- Conexión con GitHub vía PAT, listado de repositorios
- Deploy con un click + auto-detección de tipo de proyecto
- Gestión de variables de entorno cifradas
- Auto-deploy en cada push con modo configurable: Webhook (Cloudflare Tunnel + HMAC) o Polling (cada 1–2 min)
- Gate de seguridad pre-deploy (secretos, dependencias, imagen)
- Health check, rollback automático, historial de despliegues con reversión manual

**Fase 4 — Automatización**
- Horarios de encendido/apagado por servicio
- Reglas condición-acción simples
- Log de ejecución de automatizaciones

**Fase 5 — Módulo de IA y servidor MCP (opcional)**
- Explicación en lenguaje natural de fallos de despliegue
- Resumen diario de seguridad
- Diseño intercambiable (nube por defecto, local como opción futura)
- Servidor MCP opcional para consulta de estado y despliegue asistido por agentes de IA (con permisos separados lectura/escritura y auditoría)

**Fase 6 — Open source / pulido**
- Documentación completa (README, capturas, video demo)
- docker-compose.yml de un solo comando
- Licencia (MIT sugerida), CONTRIBUTING.md
- Publicación en GitHub, posible listado en awesome-selfhosted

## 7.1 Ideas evaluadas y ya incorporadas al alcance

Las siguientes ideas, originalmente consideradas backlog futuro, fueron evaluadas y ya se incorporaron como requerimientos formales en las secciones 2.8 a 2.15: monitoreo de recursos del host y por proyecto, despliegue desde GitHub con webhook automático, gestión de variables de entorno, gate de seguridad pre-deploy, health check con rollback automático e historial de despliegues, automatización de encendido/apagado, y módulo de IA híbrido opcional.

## 7.2 Ideas evaluadas y descartadas o pospuestas conscientemente

- **Terminal completa del sistema operativo host dentro del dashboard:** descartada explícitamente (ver RF-62) por ser redundante con el acceso SSH ya existente y representar un riesgo de seguridad desproporcionado frente al beneficio.
- **Aplicación móvil nativa con Flutter:** evaluada y descartada conscientemente. Se comparó frente a la opción de web responsive + PWA (Progressive Web App) ya planificada (RF-23, RF-23a, RF-23b), concluyendo que: (a) ninguna herramienta comparable del estado del arte (Portainer, Pi-hole, Uptime Kuma, Cosmos-Server, secwatch) ofrece app nativa, siendo web responsive el estándar de facto para este tipo de panel de administración; (b) una app Flutter implicaría mantener una segunda base de código sincronizada con la misma API, duplicando el esfuerzo de desarrollo y el riesgo de no completar ningún frontend a tiempo dado el alcance ya extenso del proyecto (40 historias de usuario, 10 sprints); y (c) la combinación de diseño responsive con Tailwind más las capacidades de una PWA (instalación en pantalla de inicio, modo de pantalla completa, notificaciones push) cubre la necesidad de uso en tablet sin el costo de una segunda plataforma.
- **Backups:** verificación avanzada (salud SMART de discos, restauración con un click) queda como mejora futura; el sistema de backups automático diario ya existe de forma independiente en el homelab (ver bitácora de instalación) y se integrará como fuente de datos en una fase posterior.
- **Grafo de dependencias entre servicios, reportes en PDF exportables:** pospuestos a una versión posterior por no ser críticos para la validación del MVP.
- **Multi-idioma, modo oscuro/claro:** mejoras de experiencia de usuario, no prioritarias frente a la funcionalidad core.

## 8. Consideraciones para portafolio / open source

- **Nombre del repo sugerido:** `homesoc`, `openhomesoc` o `lab-sentinel` (verificar disponibilidad).
- **Licencia:** MIT (la más permisiva y común en proyectos self-hosted).
- **README debe incluir:** capturas de pantalla del dashboard, diagrama de arquitectura, instrucciones `docker-compose up`, lista de variables de entorno.
- **Diferenciador frente a herramientas existentes:** ningún trabajo relacionado (ver sección 1.1: secwatch, Cosmos-Server, Uptime Kuma, Portainer, Grafana) cierra el ciclo completo código → seguridad → despliegue verificado → observabilidad en un solo panel con 2FA adaptativo según el origen de la conexión. Esa integración vertical, no cada pieza individual, es el aporte diferenciador de HomeSOC.
- Vale la pena mencionar en el README que fue construido y probado en un homelab real (esta laptop convertida en servidor), como caso de uso genuino, no solo teórico.
- **Validación pendiente:** esta propuesta de alcance se presentará al ingeniero/tutor de la materia de Proyecto de Grado para retroalimentación antes de considerar el diseño cerrado definitivamente.
