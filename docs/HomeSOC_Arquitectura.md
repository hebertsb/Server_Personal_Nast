# HomeSOC — Arquitectura de Software

## 1. Estilo arquitectónico

**Patrón elegido: Arquitectura por Capas (Layered) con principios de Arquitectura Limpia (Clean Architecture), adaptada para un proyecto de tamaño mediano gestionado por un desarrollador/equipo pequeño.**

Se descarta microservicios (sobreingeniería para este alcance: un solo host, un solo equipo) y se descarta monolito sin estructura (dificulta pruebas y mantenimiento). Se elige un **monolito modular** con separación estricta de responsabilidades por capas, preparado para extraerse a servicios independientes en el futuro si el proyecto creciera (ej. el módulo de colectores podría convertirse en un microservicio de recolección aparte).

### 1.1 Las 4 capas

```
┌─────────────────────────────────────────────────────┐
│  1. PRESENTACIÓN (Presentation)                      │
│  Controladores REST, WebSocket, Servidor MCP, DTOs   │
├─────────────────────────────────────────────────────┤
│  2. APLICACIÓN (Application / Casos de uso)          │
│     Orquestación de lógica de negocio, servicios      │
├─────────────────────────────────────────────────────┤
│  3. DOMINIO (Domain)                                 │
│     Entidades, reglas de negocio puras, interfaces    │
├─────────────────────────────────────────────────────┤
│  4. INFRAESTRUCTURA (Infrastructure)                 │
│     Repositorios PostgreSQL, Docker SDK, Telegram,   │
│     sistema de archivos (logs), TOTP                 │
└─────────────────────────────────────────────────────┘
```

**Regla de dependencia (la más importante de Clean Architecture):** las capas internas (Dominio) **nunca** conocen a las externas (Infraestructura). El Dominio define **interfaces** (ej. `RepositorioUsuarios`), y la capa de Infraestructura las **implementa** (ej. `RepositorioUsuariosPostgres`). Esto permite cambiar PostgreSQL por otra base de datos, o Telegram por otro canal de notificación, sin tocar la lógica de negocio.

## 2. Patrones de diseño aplicados

| Patrón | Dónde se usa | Por qué |
|---|---|---|
| **Repository** | Acceso a datos (`RepositorioUsuarios`, `RepositorioEventos`) | Desacopla la lógica de negocio de PostgreSQL; facilita testing con mocks |
| **Strategy** | Colectores de datos (Docker, SSH logs, Pi-hole, red) | Cada colector implementa la misma interfaz `Colector.recolectar()`; agregar uno nuevo no modifica los existentes |
| **Strategy** | Analizador de IA (nube vs. local) | `AnalizadorIA.analizar()` con implementaciones intercambiables (`AnalizadorIACloud`, `AnalizadorIALocal`), sin acoplar el resto del sistema a un proveedor específico |
| **Factory** | Creación de colectores según configuración | Decide en tiempo de ejecución qué colectores instanciar (ej. solo crear el colector de Pi-hole si Pi-hole está presente) |
| **Observer / Event Emitter** | Sistema de notificaciones | Un evento de seguridad se "emite" y múltiples suscriptores (Telegram, email, log de auditoría) reaccionan sin acoplarse entre sí |
| **Middleware / Chain of Responsibility** | Pipeline HTTP (auth → rate limit → validación → controlador) | Cada preocupación transversal se resuelve en su propio eslabón, en orden explícito |
| **Dependency Injection** | Todo el backend | Los servicios reciben sus dependencias (repositorios, clientes externos) por constructor, nunca las instancian directamente — esencial para testear |
| **DTO (Data Transfer Object)** | Entrada/salida de la API | Nunca se expone la entidad de dominio o el modelo de base de datos directamente al cliente; se mapea a un objeto plano validado |
| **Singleton** | Conexión a base de datos (pool de conexiones) | Una sola instancia del pool compartida en toda la aplicación |
| **Circuit Breaker** (opcional, fase avanzada) | Llamadas a servicios externos (Docker socket, Pi-hole API) | Si un colector falla repetidamente, deja de intentarlo temporalmente en vez de bloquear el sistema completo |

## 3. Estructura de carpetas propuesta (monorepo)

```
homesoc/
├── backend/
│   ├── src/
│   │   ├── dominio/                    # Capa 3 — sin dependencias externas
│   │   │   ├── entidades/
│   │   │   │   ├── Usuario.ts
│   │   │   │   ├── EventoSeguridad.ts
│   │   │   │   └── Contenedor.ts
│   │   │   ├── interfaces/
│   │   │   │   ├── RepositorioUsuarios.ts
│   │   │   │   ├── RepositorioEventos.ts
│   │   │   │   └── Colector.ts
│   │   │   └── reglas/
│   │   │       └── PoliticaBloqueoFuerzaBruta.ts
│   │   │
│   │   ├── aplicacion/                 # Capa 2 — casos de uso
│   │   │   ├── autenticacion/
│   │   │   │   ├── IniciarSesion.ts
│   │   │   │   ├── ValidarCodigoTotp.ts
│   │   │   │   └── EvaluarConfianzaOrigen.ts
│   │   │   ├── contenedores/
│   │   │   │   ├── ListarContenedores.ts
│   │   │   │   └── ControlarContenedor.ts
│   │   │   ├── seguridad/
│   │   │   │   ├── RegistrarEventoSeguridad.ts
│   │   │   │   └── DetectarFuerzaBruta.ts
│   │   │   ├── recursos/
│   │   │   │   ├── ObtenerRecursosHost.ts
│   │   │   │   └── ObtenerConsumoPorContenedor.ts
│   │   │   ├── despliegues/
│   │   │   │   ├── ConectarGithub.ts
│   │   │   │   ├── ListarRepositorios.ts
│   │   │   │   ├── DesplegarProyecto.ts
│   │   │   │   ├── EjecutarGateSeguridad.ts
│   │   │   │   ├── EjecutarHealthCheck.ts
│   │   │   │   ├── PromoverORevertirDespliegue.ts
│   │   │   │   └── GestionarVariablesEntorno.ts
│   │   │   ├── automatizacion/
│   │   │   │   └── EjecutarAutomatizacion.ts
│   │   │   └── notificaciones/
│   │   │       └── NotificarEvento.ts
│   │   │
│   │   ├── infraestructura/            # Capa 4 — implementaciones concretas
│   │   │   ├── postgres/
│   │   │   │   ├── conexion.ts
│   │   │   │   ├── RepositorioUsuariosPostgres.ts
│   │   │   │   └── RepositorioEventosPostgres.ts
│   │   │   ├── docker/
│   │   │   │   └── ColectorDocker.ts
│   │   │   ├── sistema/
│   │   │   │   ├── ColectorAuthLog.ts
│   │   │   │   └── ColectorRecursosHost.ts
│   │   │   ├── pihole/
│   │   │   │   └── ColectorPihole.ts
│   │   │   ├── github/
│   │   │   │   └── ClienteGithubOctokit.ts
│   │   │   ├── seguridad/
│   │   │   │   ├── EscanerSecretosGitleaks.ts
│   │   │   │   ├── EscanerDependencias.ts
│   │   │   │   └── EscanerImagenTrivy.ts
│   │   │   ├── ia/
│   │   │   │   ├── AnalizadorIACloud.ts
│   │   │   │   └── AnalizadorIALocalOllama.ts
│   │   │   └── notificadores/
│   │   │       └── NotificadorTelegram.ts
│   │   │
│   │   ├── presentacion/               # Capa 1 — HTTP/WebSocket
│   │   │   ├── controladores/
│   │   │   │   ├── AuthController.ts
│   │   │   │   ├── ContenedoresController.ts
│   │   │   │   └── SeguridadController.ts
│   │   │   ├── middlewares/
│   │   │   │   ├── autenticacion.middleware.ts
│   │   │   │   ├── rateLimit.middleware.ts
│   │   │   │   └── validacion.middleware.ts
│   │   │   ├── dto/
│   │   │   │   └── LoginDTO.ts
│   │   │   ├── websocket/
│   │   │   │   └── gateway.ts
│   │   │   ├── mcp/                    # Opcional (Fase 5) — adaptador MCP
│   │   │   │   ├── servidorMcp.ts
│   │   │   │   └── herramientasMcp.ts
│   │   │   └── rutas.ts
│   │   │
│   │   ├── config/
│   │   │   └── env.ts
│   │   └── main.ts                     # Punto de entrada, wiring de DI
│   │
│   ├── tests/
│   │   ├── unitarias/                  # Dominio + Aplicación (con mocks)
│   │   ├── integracion/                # Infraestructura + Postgres real (test DB)
│   │   └── e2e/                        # API completa end-to-end
│   │
│   ├── migraciones/                    # SQL migrations versionadas
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── componentes/
│   │   │   ├── comunes/                # Botones, tarjetas, etc. reutilizables
│   │   │   ├── dashboard/
│   │   │   ├── contenedores/
│   │   │   ├── seguridad/
│   │   │   └── autenticacion/
│   │   ├── paginas/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── Configuracion.tsx
│   │   ├── servicios/                  # Clientes de la API (fetch/axios)
│   │   ├── hooks/                      # useContenedores, useEventosSeguridad...
│   │   ├── contexto/                   # AuthContext
│   │   └── App.tsx
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml                  # Orquesta backend + frontend + postgres
├── docker-compose.dev.yml              # Variante para desarrollo local
├── .github/
│   └── workflows/
│       └── ci.yml                      # Lint, tests, build, escaneo de seguridad
├── docs/
│   ├── HomeSOC_Requerimientos.md
│   ├── HomeSOC_Arquitectura.md
│   └── capturas/
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## 3.1 Estructura del Frontend: 6 módulos de navegación

Para evitar fragmentar la interfaz, el frontend se organiza en seis módulos principales, cada uno con sub-pestañas internas en lugar de pantallas independientes sueltas:

1. **Recursos del Servidor** — uso de CPU/RAM/disco/temperatura del host (estilo administrador de tareas), gráficas históricas, desglose por contenedor.
2. **Servicios y Despliegues** — gestión de contenedores + módulo completo de despliegue GitHub (repos, variables de entorno, health check, rollback, historial). Fusiona lo que conceptualmente sería "Portainer" y "Git/CI-CD" en una sola actividad.
3. **Red y Conectividad** — Pi-hole, ancho de banda, dispositivos de red, Tailscale y túneles Cloudflare (activar/desactivar, cambiar destino sin salir del panel).
4. **Seguridad** — intentos de acceso, fuerza bruta, IPs bloqueadas, 2FA, auditoría, resultados del gate de seguridad de despliegues.
5. **Automatización** — horarios de encendido/apagado, reglas condición-acción, log de ejecución.
6. **Configuración General** — notificaciones, backups, usuarios/roles, conexión GitHub, preferencias.

## 3.1.1 Plataforma de entrega: Web responsive + PWA (no app nativa)

Se evaluó explícitamente construir una aplicación móvil nativa (Flutter) además del frontend web, dado el uso previsto en tablet. Se decidió **no implementarla**, por las siguientes razones documentadas:

| Criterio | Web responsive + PWA | App nativa Flutter (descartada) |
|---|---|---|
| Bases de código a mantener | Una sola | Dos, sincronizadas contra la misma API |
| Cobertura de dispositivos | Celular, tablet y escritorio con el mismo código | Celular/tablet nativo; escritorio requiere Flutter Desktop aparte |
| Alineación con el estado del arte | Estándar de facto (Portainer, Pi-hole, Uptime Kuma, Cosmos-Server, secwatch son todos web) | Ningún competidor analizado ofrece app nativa |
| Riesgo de cronograma | Bajo — se agrega al final sin rehacer nada | Alto — duplica el esfuerzo de frontend con 40 HU ya planificadas |
| Experiencia tipo app en tablet | Cubierta por manifest.json + service worker (instalación, pantalla completa, notificaciones push) | N/A |

El frontend se implementa como Progressive Web App: instalable en la pantalla de inicio, con ícono propio y modo de pantalla completa, sin depender de tiendas de aplicaciones ni de un segundo framework.

## 3.2 Notas de seguridad específicas del módulo de despliegue

- El Personal Access Token de GitHub se cifra en reposo (no solo se hashea, ya que debe recuperarse para llamar a la API) usando una clave de cifrado separada de la base de datos, inyectada por variable de entorno.
- **Modos de disparo (Webhook vs. Polling):** si se usa webhook, se expone a internet únicamente `/api/v1/webhooks/github` (vía Cloudflare Tunnel) y todo evento entrante debe validar su firma HMAC (`X-Hub-Signature-256`) contra un secreto compartido; un webhook sin firma válida se descarta y se registra como evento de seguridad. Como alternativa sin exposición pública, el proyecto puede configurarse en modo **polling** (consulta a la API de GitHub cada 1–2 minutos).
- **Variables de entorno y Dockerfile:** el MVP soporta cualquier lenguaje mediante `Dockerfile` y plantillas automáticas para HTML estático y Node.js. Las variables de entorno nuevas nunca se leen del repositorio; deben cargarse en el panel antes del `git push` (si falta una variable requerida, el health check falla y revierte automáticamente a la versión anterior).
- El backend nunca expone el socket de Docker directamente al frontend; toda creación/control de contenedores para despliegue pasa por la capa de Aplicación, que aplica el gate de seguridad antes de autorizar la operación.
- El análisis de IA (cuando está habilitado) recibe únicamente los datos estrictamente necesarios para la tarea puntual (ej. el log de un despliegue fallido), nunca el token de GitHub, variables de entorno, ni contraseñas.
- **Servidor MCP (Fase 5, opcional):** vive en la Capa 1 (Presentación) y delega siempre en los casos de uso de la Capa 2 (Aplicación), sin acceso directo al socket de Docker ni a PostgreSQL. Requiere un token de API propio con separación estricta de permisos (`lectura` vs. `escritura`), registra toda acción en auditoría indicando origen `mcp`, respeta el gate de seguridad y el modo de aprobación manual, y tiene prohibido retornar valores de variables de entorno o secretos.

## 4. Diseño de la API (convenciones REST)

- **Prefijo de versión:** `/api/v1/...` (permite evolucionar sin romper clientes existentes)
- **Recursos en plural, en español:** `/api/v1/contenedores`, `/api/v1/eventos-seguridad`, `/api/v1/usuarios`
- **Verbos HTTP estándar:** GET (leer), POST (crear/acción), PATCH (actualizar parcial), DELETE (eliminar)
- **Acciones que no son CRUD puro** (ej. reiniciar un contenedor) se modelan como sub-recurso: `POST /api/v1/contenedores/:id/reiniciar`
- **Respuestas de error consistentes:**
```json
{
  "error": {
    "codigo": "CREDENCIALES_INVALIDAS",
    "mensaje": "Usuario o contraseña incorrectos"
  }
}
```
- **Paginación** en listados largos (eventos, solicitudes): `?pagina=1&limite=50`
- **WebSocket** en `/ws` para métricas en tiempo real (CPU, RAM, estado de contenedores), autenticado con el mismo token de sesión.
- **Endpoints del módulo de despliegue:** `POST /api/v1/github/conexion`, `GET /api/v1/github/repositorios`, `POST /api/v1/despliegues`, `POST /api/v1/despliegues/:id/redeploy`, `POST /api/v1/despliegues/:id/revertir`, `GET /api/v1/despliegues/:id/log`, `POST /api/v1/webhooks/github` (endpoint público con validación HMAC obligatoria).

## 5. Flujo de datos — ejemplo concreto (detección de fuerza bruta)

```
1. ColectorAuthLog (infraestructura) lee /var/log/auth.log cada 10s
        │
2. Detecta 6 intentos fallidos SSH desde la misma IP en 5 minutos
        │
3. Invoca caso de uso: DetectarFuerzaBruta.ejecutar(ip, intentos)
        │
4. El caso de uso aplica la regla de dominio: PoliticaBloqueoFuerzaBruta
   (pura, sin dependencias externas — fácilmente testeable)
        │
5. Si se cumple la política → RegistrarEventoSeguridad.ejecutar(evento)
   → RepositorioEventosPostgres.guardar(evento)
        │
6. Se emite el evento → NotificarEvento (Observer)
   → NotificadorTelegram.enviar(mensaje)
        │
7. WebSocket gateway empuja el nuevo evento al frontend conectado
        │
8. Dashboard muestra la alerta en tiempo real, sin necesitar refrescar
```

## 6. Arquitectura de despliegue (docker-compose)

```yaml
# docker-compose.yml (resumen conceptual)
services:
  homesoc-backend:
    build: ./backend
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://homesoc_app:***@homesoc-db:5432/homesoc
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro   # Solo lectura
      - /var/log/auth.log:/logs/auth.log:ro
    networks:
      - homesoc-net

  homesoc-frontend:
    build: ./frontend
    restart: unless-stopped
    depends_on:
      - homesoc-backend
    networks:
      - homesoc-net

  homesoc-db:
    image: postgres:16
    restart: unless-stopped
    environment:
      - POSTGRES_DB=homesoc
      - POSTGRES_USER=homesoc_app
    volumes:
      - homesoc-db-data:/var/lib/postgresql/data
    networks:
      - homesoc-net

networks:
  homesoc-net:
    driver: bridge

volumes:
  homesoc-db-data:
```

**Nota de seguridad de despliegue:** el socket de Docker se monta en modo `:ro` (solo lectura) — aunque el backend necesita ejecutar acciones (start/stop), estas se hacen a través del SDK de Docker con el socket montado, pero el *usuario* de la aplicación dentro del contenedor no tiene privilegios de escritura en el filesystem host; toda acción de control pasa por validación explícita en la capa de aplicación (RNF-SEC-20).

## 7. Metodología de trabajo

**Metodología elegida: Kanban personal + Trunk-Based Development ligero**, apropiada para un desarrollador/equipo pequeño (a diferencia de Scrum, que asume ceremonias de equipo que no aportan valor en solitario).

### 7.1 Tablero Kanban (columnas sugeridas)
`Backlog → En diseño → En desarrollo → En revisión/testing → Desplegado`

Herramienta sugerida: GitHub Projects (gratis, integrado con el repo).

### 7.2 Flujo de ramas (Git)
- `main`: siempre desplegable, protegida.
- `feature/nombre-corto`: una rama corta por funcionalidad (ej. `feature/2fa-totp`).
- Commits siguiendo **Conventional Commits**: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `security:`.
- Pull Request obligatorio hacia `main`, incluso trabajando solo (fuerza revisión propia con distancia, y deja historial claro).

### 7.3 Definición de "Terminado" (Definition of Done) por funcionalidad
1. Código implementado siguiendo la capa correspondiente (no lógica de negocio en controladores).
2. Pruebas unitarias del caso de uso (mínimo camino feliz + un caso de error).
3. Sin vulnerabilidades críticas nuevas (`npm audit`).
4. Documentado en el README si afecta la instalación/uso.
5. Probado manualmente en el homelab real antes de mergear a `main`.

### 7.4 CI/CD (GitHub Actions)
```
En cada Pull Request:
  1. Lint (ESLint/Prettier)
  2. Type-check (TypeScript)
  3. Tests unitarios + integración
  4. npm audit / escaneo de dependencias
  5. Build de imágenes Docker (verificación, sin publicar)

En merge a main:
  6. Build y push de imágenes a GitHub Container Registry
  7. (Opcional futuro) Webhook de auto-deploy al homelab
```

## 8. Estrategia de testing

| Tipo | Qué cubre | Herramienta sugerida |
|---|---|---|
| Unitarias | Dominio y Aplicación, con repositorios/colectores mockeados | Jest / Vitest |
| Integración | Repositorios reales contra una PostgreSQL de test (Docker) | Jest + Testcontainers |
| E2E | Flujos completos vía API (login → 2FA → acción) | Supertest / Playwright (API) |
| Seguridad | Políticas RLS, rate limiting, validación de inputs maliciosos | Tests dedicados por cada RNF-SEC |

**Cobertura mínima objetivo:** 70% en capas de Dominio y Aplicación (donde vive la lógica de negocio crítica); no se exige alta cobertura en Infraestructura (mucho boilerplate de I/O).

## 9. Observabilidad del propio HomeSOC

Irónicamente, HomeSOC también debe poder monitorearse a sí mismo:
- Logs estructurados en JSON (no `console.log` plano) usando una librería como `pino` o `winston`.
- Un endpoint `/health` que reporte el estado de sus propias dependencias (conexión a Postgres, acceso al socket de Docker).
- Este mismo endpoint puede registrarse en Uptime Kuma (ya desplegado en el homelab) para monitoreo externo del monitor.

## 10. Principios de diseño transversales (resumen ejecutivo)

1. **Separación de responsabilidades estricta** — cada capa tiene un único motivo para cambiar.
2. **Inversión de dependencias** — el dominio no sabe que existe PostgreSQL, Docker o Telegram.
3. **Seguridad por diseño, no como parche** — validación, rate limiting y RLS están en la arquitectura desde el inicio, no se agregan al final.
4. **Extensibilidad sobre completitud** — es más importante poder agregar un colector nuevo fácilmente que cubrir todos los casos de uso posibles en la v1.
5. **Todo en español, consistente** — nombres de tablas, entidades, endpoints y commits siguen el mismo idioma para no mezclar convenciones.
