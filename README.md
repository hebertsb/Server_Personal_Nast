# HomeSOC — Homelab Security & Operations Center

[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-059669.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**HomeSOC** es una plataforma *open source* de monitoreo, seguridad perimetral, despliegue continuo desde GitHub y automatización diseñada específicamente para servidores domésticos (*homelabs*).

Su enfoque central integra, bajo **un único panel responsive + PWA** y un solo inicio de sesión con **2FA adaptativo por origen de red**, el ciclo completo de operación de un homelab:

> **Código (GitHub) → Gate de Seguridad → Despliegue con Health Check y Rollback Automático → Analítica de Accesos HTTP → Seguridad de Red y Automatización de Servicios**

---

## Tabla de Contenidos

1. [Características Principales](#características-principales)
2. [Arquitectura](#arquitectura)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Requisitos Previos](#requisitos-previos)
5. [Inicio Rápido (Desarrollo Local)](#inicio-rápido-desarrollo-local)
6. [Despliegue en Producción (Homelab)](#despliegue-en-producción-homelab)
7. [Seguridad y Endurecimiento](#seguridad-y-endurecimiento)
8. [Servidor MCP e Integración con Agentes](#servidor-mcp-e-integración-con-agentes)
9. [Pruebas Automatizadas](#pruebas-automatizadas)
10. [Contribución y Licencia](#contribución-y-licencia)

---

## Características Principales

### 1. Recursos del Servidor en Tiempo Real
- Monitoreo en vivo de **CPU total y por núcleo**, **memoria RAM**, **múltiples puntos de montaje de disco** y sensores de temperatura.
- Captura periódica persistida en PostgreSQL con gráficas históricas configurables (`1h`, `24h`, `7d`) y desglose de consumo por contenedor activo.

### 2. Contenedores Docker y Despliegues desde GitHub
- Listado en vivo de contenedores, métricas de red (`RX/TX`), acciones auditadas (`start`, `stop`, `restart`) con protección para contenedores núcleo y visor de logs en tiempo real.
- Conexión con GitHub mediante **Personal Access Token cifrado en reposo (AES-256-GCM)** y navegación de repositorios.
- **Auto-detección de stack:** prioriza `Dockerfile` y, en su ausencia, genera plantillas base para **Node.js** (`package.json`) y **HTML estático** (`index.html`).
- **Variables de entorno cifradas por proyecto:** almacenadas cifradas en PostgreSQL, inyectadas únicamente en memoria durante el despliegue y nunca expuestas en logs ni respuestas de la API.
- **Auto-deploy configurable por proyecto:** modo **Webhook** (`/api/v1/webhooks/github` con firma HMAC-SHA256) o modo **Polling** (sin exponer puertos).
- **Gate de seguridad pre-deploy (`gitleaks`, `npm audit`, `trivy`):** detiene despliegues ante hallazgos críticos y exige confirmación manual.
- **Health Check, Rollback automático y Reversión manual:** si la nueva versión falla la verificación de salud, se mantiene la versión previa sin interrupción; cualquier versión anterior del historial puede restaurarse con un clic.

### 3. Seguridad Perimetral y Auditoría
- Autenticación JWT + cookies `HttpOnly` con **2FA TOTP adaptativo (RFC 6238)** según red confiable (CIDR) y dispositivos de confianza por 30 días, más códigos de recuperación de un solo uso.
- Detección de fuerza bruta SSH (`auth.log`), bloqueo/desbloqueo manual de IPs y alertas multicanal vía patrón **Observer** (Telegram + notificaciones en tiempo real **SSE** en la PWA).
- **Endurecimiento de base de datos:** *Row-Level Security (RLS)*, rol de mínimo privilegio, tabla de auditoría inmutable mediante trigger, rate limiting diferenciado y cabeceras estrictas con Helmet.

### 4. Red, Pi-hole y Analítica de Accesos a Proyectos
- Telemetría DNS de Pi-hole (consultas totales, bloqueadas, top dominios y clientes activos en la red local).
- Analítica HTTP por proyecto desplegado: visitas totales, visitantes únicos, participación por proyecto, curva continua de horarios pico de 24 horas (`2xx/3xx` vs. `4xx/5xx`), geolocalización aproximada (*best-effort*) y botón directo para **Bloquear IP** desde la bitácora.

### 5. Automatización y Resiliencia Operativa
- Horarios programados de encendido/apagado/reinicio de contenedores.
- Reglas condición-acción con **tiempo sostenido** y **enfriamiento (*cooldown*)** sobre CPU, RAM, disco y temperatura (incluyendo detención selectiva de contenedores no críticos).
- **Auto-healing** de contenedores con límite de reintentos y escalado a alerta crítica.
- Limpieza segura de imágenes Docker huérfanas (`prune`), chequeo HTTP / **Heartbeat externo** (*Dead Man's Switch*), aviso de actualizaciones pendientes (sin auto-actualizar) y resiliencia ante cortes de luz (monitoreo de batería y notificación automática al arrancar el servidor).

### 6. Asistente IA (Voz / Texto), Servidor MCP y PWA
- **Proveedor IA intercambiable (patrón Strategy):** soporta API en la nube (Gemini), Ollama local y analizador determinista de respaldo para explicar fallos de despliegue, resumir actividad diaria de seguridad y responder consultas de voz/texto.
- **Servidor MCP (`POST /api/v1/mcp`):** interfaz JSON-RPC 2.0 autenticada con tokens acotados (`lectura` vs. `escritura`) y auditoría con origen `mcp`, lista para conectar asistentes externos o agentes de voz.
- **Web Responsive + PWA:** instalable en escritorio, tablet y móvil con Modo Día / Modo Noche y 5 paletas aurora armonizadas.

---

## Arquitectura

El backend sigue **Clean Architecture** en 4 capas estrictas con inyección de dependencias y patrones **Repository**, **Strategy** y **Observer**:

```text
backend/src/
├── dominio/          # Entidades, reglas puras, errores e interfaces (sin dependencias de framework)
├── aplicacion/       # Casos de uso orquestando puertos y reglas de negocio
├── infraestructura/  # Adaptadores PostgreSQL, Docker, sistema, GitHub, IA y notificadores
└── presentacion/     # Controladores Express, middlewares (JWT, Zod, rate-limit) y rutas HTTP/MCP
```

Para detalles técnicos completos, consulta la documentación en [`docs/`](docs/):
- [Especificación de Requerimientos](docs/HomeSOC_Requerimientos.md)
- [Arquitectura del Sistema](docs/HomeSOC_Arquitectura.md)
- [Plan de Implementación y Despliegue](docs/HomeSOC_Plan_Implementacion.md)

---

## Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Backend** | Node.js 20, TypeScript, Express, Zod, `pg`, `dockerode`, `bcryptjs`, `jsonwebtoken`, Pino, Helmet |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, PWA (`manifest.json` + Service Worker) |
| **Base de Datos** | PostgreSQL 16 (migraciones SQL, RLS, triggers de auditoría inmutable) |
| **Pruebas** | Vitest (pruebas unitarias sobre capas de Dominio y Aplicación) |
| **Contenedores** | Docker & Docker Compose |

---

## Requisitos Previos

- **Docker** y **Docker Compose** v2+
- **Node.js 20+** (opcional, para ejecutar pruebas unitarias o compilación fuera de contenedor)

---

## Inicio Rápido (Desarrollo Local)

1. Clona el repositorio y crea tu archivo de variables locales:

```bash
git clone https://github.com/<tu-usuario>/HomeSOC.git
cd HomeSOC
cp .env.example .env.dev
```

2. Ajusta en `.env.dev` los secretos locales de desarrollo (`POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `SEED_ADMIN_PASSWORD`).

3. Levanta el entorno de desarrollo:

```bash
docker compose -f docker-compose.dev.yml up -d
```

4. Aplica las migraciones en orden (`backend/migraciones/001_*.sql` a `011_*.sql`) y accede al panel:
   - **Frontend Web / PWA:** `http://localhost:3000`
   - **API Backend (Health):** `http://localhost:4000/health`

---

## Despliegue en Producción (Homelab)

```bash
cp .env.example .env
# Configura secretos fuertes, DATABASE_URL, CORS_ORIGIN, TELEGRAM_TOKEN y GITHUB_WEBHOOK_SECRET
docker compose up -d --build
```

> **Recomendación de red:** mantén el dashboard accesible únicamente por red local o mediante **Tailscale / Cloudflare Tunnel**. Si habilitas auto-deploy por Webhook, expón exclusivamente el endpoint `/api/v1/webhooks/github` protegido con firma HMAC-SHA256.

---

## Seguridad y Endurecimiento

- Todas las consultas SQL son **100 % parametrizadas** (`$1`, `$2`, ...).
- Toda entrada HTTP es validada mediante esquemas **Zod** antes de llegar a los casos de uso.
- Contraseñas hasheadas con **bcrypt**; tokens MCP almacenados únicamente como hash **SHA-256**; secretos TOTP, PAT de GitHub y variables de entorno cifrados con **AES-256-GCM**.
- **Sin terminal SSH del host en el panel:** explícitamente descartada para reducir la superficie de ataque.

---

## Servidor MCP e Integración con Agentes

1. En **Configuración General → Servidor MCP**, genera un token con permiso `lectura` o `escritura`.
2. Invoca `POST /api/v1/mcp` con `Authorization: Bearer hs_mcp_...` usando JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`).
3. Herramientas disponibles:
   - **Lectura:** `obtener_estado_servidor`, `listar_contenedores`, `listar_eventos_seguridad`, `listar_proyectos_despliegue`, `listar_variables_proyecto` (solo claves enmascaradas), `resumen_seguridad_ia`, `consultar_asistente_voz`.
   - **Escritura:** `conectar_proyecto_despliegue`, `guardar_variable_proyecto` (solo escritura cifrada AES-256-GCM, nunca devuelve el valor), `redeploy_proyecto` (respeta Gate de Seguridad, modo de aprobación manual y registra auditoría con `origen: 'mcp'`).

---

## Pruebas Automatizadas

```bash
cd backend
npm install
npm run build
npm test
```

---

## Contribución y Licencia

Las contribuciones son bienvenidas. Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para las guías de arquitectura y formato de commits.

Distribuido bajo la licencia **MIT**. Consulta [LICENSE](LICENSE) para más detalles.

---

Desarrollado por **Hebert Suarez Burgos** — Ingeniería Informática (UAGRM).
