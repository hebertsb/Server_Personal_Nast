# HomeSOC — Homelab Security & Operations Center

Dashboard open source de monitoreo, seguridad, despliegue de proyectos y automatización para servidores domésticos (homelabs), diseñado con Clean Architecture y pensado para operar con un solo inicio de sesión y 2FA adaptativo por origen de red.

## Características principales

- **Recursos del servidor en vivo (`RF-24`–`RF-27`):** CPU total y por núcleo, RAM, múltiples discos, temperatura y gráficas históricas persistidas en PostgreSQL.
- **Control de contenedores Docker (`RF-05`–`RF-08`):** listado en vivo, consumo por contenedor, `start/stop/restart` auditados y visor de logs.
- **Seguridad perimetral y endurecimiento (`RF-01`–`RF-04`):**
  - Autenticación JWT + cookies `HttpOnly` y **2FA TOTP adaptativo** (dispositivos de confianza en red local, códigos de recuperación).
  - Rate limiting en login y API, cabeceras estrictas con Helmet, **Row-Level Security (RLS)** y tabla de auditoría inmutable.
  - Detección de fuerza bruta SSH, bloqueo de IPs y alertas vía patrón Observer (Telegram).
- **Red y flujo de datos (`RF-10`–`RF-19`):** estadísticas DNS Pi-hole, clientes en red local y analítica de accesos HTTP por proyecto desplegado (rutas, horarios pico, geolocalización aproximada y bloqueo rápido de IP).
- **Despliegue de proyectos desde GitHub (`RF-28`–`RF-50`):**
  - Conexión con PAT cifrado en reposo (AES-256-GCM) y listado de repositorios.
  - Auto-detección (`Dockerfile` prioritario, plantillas base para Node.js y HTML estático).
  - Variables de entorno cifradas por proyecto (nunca expuestas en logs ni API).
  - Auto-deploy por **Webhook con firma HMAC-SHA256** (`/api/v1/webhooks/github`) o **Polling**.
  - **Gate de seguridad pre-deploy** (`gitleaks`, `npm audit`, `trivy`), health check con **rollback automático** y reversión manual en 1 clic.
- **Automatización y resiliencia (`RF-51`–`RF-53`):** horarios de contenedores, reglas condición-acción con tiempo sostenido y *cooldown*, auto-healing con límite de reintentos, limpieza de imágenes Docker huérfanas, heartbeat externo (*Dead Man's Switch*), aviso de actualizaciones, monitoreo de batería/cortes de luz y notificación de arranque.
- **Web responsive + PWA (`RF-23a`):** instalable en móvil, tablet y escritorio, con Modo Día / Modo Noche y 5 tonalidades aurora.

## Inicio rápido en desarrollo local

```bash
cp .env.example .env.dev
# Edita .env.dev con secretos locales de prueba
docker compose -f docker-compose.dev.yml up -d
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000/health`

## Pruebas

```bash
cd backend
npm run build
npm test
```

## Licencia

Distribuido bajo licencia **MIT**. Ver [LICENSE](LICENSE).
