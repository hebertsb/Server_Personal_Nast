# HomeSOC — Plan de Implementación (entorno local → homelab)

Este documento complementa `HomeSOC_Documentacion_Proyecto.docx` (formal, académico, con calendario Scrum de referencia) y `AGENTS.md` (reglas para el agente de IA). Aquí se detalla **cómo se implementa en la práctica**: dónde se desarrolla, cuándo se despliega al servidor real, y cómo se maneja un ritmo de trabajo no lineal (avance rápido, sesiones nocturnas, sprints que se completan antes de lo previsto).

## 1. Filosofía del plan: documentación formal vs. ejecución real

| | Documento formal (Scrum académico) | Este plan (ejecución real) |
|---|---|---|
| Calendario | Sprints fijos de 2 semanas, fechas concretas | Sin fechas fijas; se avanza por disponibilidad real del autor |
| Orden | Estrictamente por sprint | Se respeta el orden de **dependencias entre HU**, no el número de sprint |
| Entorno | No especificado | Local primero, siempre; servidor real solo al cerrar fase |
| Propósito | Evaluación académica / portafolio | Guía operativa día a día |

El calendario de sprints del documento formal sigue siendo válido como **referencia de alcance** (qué va en cada fase) y como entregable académico, pero no debe interpretarse como un límite de velocidad real.

## 2. Entorno local de desarrollo

### 2.1 Requisitos en la laptop de desarrollo (no en el servidor)
- Docker Desktop (o Docker Engine + Compose)
- Node.js 20+
- Git
- Editor de código (VS Code local, o el mismo Code-Server del homelab usado solo como editor, sin apuntar a datos reales)

### 2.2 Levantar el entorno de desarrollo

```bash
git clone https://github.com/hebertsb/homesoc.git
cd homesoc
cp .env.example .env.dev
docker compose -f docker-compose.dev.yml up --build
```

`docker-compose.dev.yml` debe diferir del de producción en:
- Hot-reload activado (nodemon / vite dev server) en vez de build optimizado.
- Base de datos PostgreSQL local con **datos ficticios/semilla** (`seed.sql`), nunca una copia de datos reales del homelab.
- El colector de Docker en modo desarrollo debe apuntar a contenedores de **prueba** creados localmente (ver 2.3), no al socket real del homelab.
- Variables de entorno con valores de ejemplo (`TELEGRAM_TOKEN=dummy`, notificaciones reales desactivadas por defecto).

### 2.3 Simulando el homelab en local (para no depender del servidor real)

Para probar los colectores (Docker, logs SSH, Pi-hole) sin tocar el servidor de producción:
- **Colector Docker:** el Docker Desktop/Engine local ya expone su propio socket (`/var/run/docker.sock`) — se puede levantar un par de contenedores de prueba (`docker run -d --name test-nginx nginx`) para tener algo real que listar/controlar.
- **Colector de logs SSH:** usar un archivo `auth.log` de ejemplo (fixture) con líneas simuladas de intentos fallidos, en vez de leer el log real del sistema.
- **Colector Pi-hole:** usar una respuesta simulada (mock) de la API de Pi-hole en los tests; solo probar contra el Pi-hole real del homelab en la validación final antes de desplegar esa HU específica.

Esto permite desarrollar y probar el 95% de las funcionalidades sin tocar nunca el homelab real hasta el momento del despliegue.

### 2.4 Probando el módulo de despliegue (GitHub → Portainer) sin arriesgar cuentas ni proyectos reales

- **Cuenta de GitHub de prueba:** usar un repositorio de prueba propio (puede ser un fork simple o un repo vacío con un `index.html`), nunca probar el flujo de auto-deploy por primera vez contra un proyecto en producción real (como BarberApp) hasta confirmar que el pipeline funciona correctamente.
- **Webhook local vs. Polling:** GitHub no puede enviar webhooks a `localhost` directamente; para probar el modo **webhook**, usar un túnel temporal (`ngrok` o `cloudflared tunnel`) exponiendo únicamente `/api/v1/webhooks/github` durante la sesión de prueba. Para probar el modo **polling** (cada 1–2 minutos), no hace falta túnel ni exposición pública.
- **Plantillas MVP y variables de entorno:** probar el despliegue tanto con un repositorio que incluya `Dockerfile` como con repositorios sin `Dockerfile` (HTML estático y Node.js). Validar además que, si el código requiere una variable de entorno nueva aún no cargada en el panel, el health check falle y dispare el rollback automático.
- **Simular fallos de health check:** para probar el rollback automático, desplegar intencionalmente una versión que falle a propósito (ej. un contenedor que no expone el puerto esperado o al que le falta una variable requerida) y confirmar que el sistema revierte solo, sin intervención manual.
- **Pruebas del servidor MCP (Fase 5, opcional):** conectar el agente de IA exclusivamente contra la instancia local (`localhost`) con un token de prueba; nunca apuntar herramientas MCP de escritura al servidor `home-lab` en producción durante el desarrollo.
- **Gate de seguridad:** probar con un commit de prueba que contenga intencionalmente un secreto falso (ej. `API_KEY=test123` en un archivo) para confirmar que gitleaks lo detecta y bloquea el despliegue antes de continuar.

## 3. Criterios para decidir cuándo desplegar al homelab real

No se despliega HU por HU. Se despliega cuando se cumple **todo** lo siguiente para una fase completa (ej. todas las HU de un sprint, o un conjunto que el autor considere un incremento coherente):

1. Todas las HU de esa fase pasan sus pruebas en local.
2. Se probó al menos una vez contra un servicio real simulado localmente (no solo mocks) para cada colector nuevo.
3. El autor revisó manualmente el checklist de seguridad de `AGENTS.md` (sección 7).
4. Se hizo un respaldo de la base de datos de producción existente en el homelab (reutilizando el sistema de backups ya implementado) antes de introducir un nuevo esquema o migración.
5. El despliegue se realiza en un momento en que el autor puede supervisarlo (no dejar un despliegue corriendo desatendido la primera vez).

### 3.1 Procedimiento de despliegue (cuando se decide desplegar)

```bash
# En el servidor, dentro de la carpeta del proyecto (clonado o actualizado)
git pull origin main

# Backup preventivo antes de aplicar migraciones nuevas
docker exec postgres-homesoc pg_dump -U homesoc_app homesoc > backup_pre_deploy_$(date +%F).sql

# Levantar con el compose de producción (build optimizado, sin hot-reload)
docker compose -f docker-compose.yml up -d --build

# Verificar salud
curl -f http://localhost:PUERTO/health
```

Este procedimiento se ejecuta manualmente por el autor; no se automatiza con un webhook de auto-deploy hasta fases avanzadas (ver backlog futuro en `HomeSOC_Requerimientos.md`, sección 7.1).

## 4. Manejo de un ritmo de avance no lineal

Situaciones esperadas y cómo manejarlas:

- **"Terminé un sprint completo en dos días":** se continúa directamente con las HU del siguiente sprint del backlog (respetando dependencias), sin esperar a que se cumpla el tiempo calendario del documento formal. El documento formal se actualiza al final para reflejar fechas reales si se requiere para entrega académica.
- **"Quiero probar esto rápido esta noche, sin pulir todo":** se prioriza tener el flujo principal funcionando end-to-end en local, aceptando dejar pendientes marcados explícitamente (tests incompletos, manejo de errores básico) — nunca aceptando saltarse los tres puntos no negociables de seguridad de `AGENTS.md` (parametrización SQL, validación de entrada, hash de contraseñas).
- **"Avancé varias HU de sprints distintos a la vez":** es válido, siempre que las dependencias lógicas entre ellas estén resueltas (ej. no se puede probar HU-06 sin que HU-05 ya exista). El registro de qué HU están realmente terminadas se mantiene en el tablero Kanban (GitHub Projects), no en el calendario del documento formal.

## 5. Definición de "Hecho" adaptada (Definition of Done operativa)

Para uso diario (más ágil que la formal de la sección 7.3 del documento de arquitectura):

- [ ] Funciona en local, probado manualmente al menos una vez por el autor.
- [ ] No rompe ninguna funcionalidad de una HU previa ya desplegada.
- [ ] Los tres no-negociables de seguridad están cubiertos.
- [ ] Commit hecho con referencia a la HU.
- [ ] Si se decide desplegar: pasos de la sección 3.1 completados y verificados.

## 6. Resumen visual del flujo

```
Backlog (HomeSOC_Requerimientos.md)
        │
        ▼
Desarrollo LOCAL (docker-compose.dev.yml + datos/servicios simulados)
        │
        ▼
Pruebas locales + checklist de seguridad (AGENTS.md)
        │
        ▼
¿Fase completa y criterios de la sección 3 cumplidos?
        │                              │
       NO                             SÍ
        │                              │
        ▼                              ▼
Seguir en local con              Backup del homelab real
la siguiente HU                        │
                                        ▼
                              Despliegue manual supervisado
                              al servidor home-lab (producción)
                                        │
                                        ▼
                          Verificación en el homelab real
                          (Uptime Kuma monitorea /health)
```

## 7. Validación con el tutor/ingeniero de la materia

Antes de considerar el alcance de este plan como definitivo, se presentará esta documentación completa (Requerimientos, Arquitectura, este Plan, y el documento formal de Proyecto de Grado) al ingeniero/tutor asignado a la materia de Proyecto de Grado, para recibir retroalimentación sobre:

- Si el alcance propuesto es adecuado como Proyecto de Grado o requiere ajustes (ampliar o acotar).
- Si el diferenciador frente a los trabajos relacionados (secwatch, Cosmos-Server) es suficientemente sólido.
- Si el formato de documentación (APA, Scrum con HU y sprints) cumple con el reglamento específico de la carrera.

El desarrollo del MVP y los primeros módulos puede continuar en paralelo a esta validación, dado que la base técnica (autenticación, contenedores, arquitectura) es necesaria en cualquier escenario de ajuste de alcance.
