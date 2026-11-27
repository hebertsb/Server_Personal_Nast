import { GestionarAccesosProyecto } from './aplicacion/accesos/GestionarAccesosProyecto';
import { GestionarAutomatizaciones } from './aplicacion/automatizaciones/GestionarAutomatizaciones';
import { Gestionar2FA } from './aplicacion/autenticacion/Gestionar2FA';
import { GestionarAccesoYUsuarios } from './aplicacion/autenticacion/GestionarAccesoYUsuarios';
import { GestionarBiometriaWebAuthn } from './aplicacion/autenticacion/GestionarBiometriaWebAuthn';
import { IniciarSesion } from './aplicacion/autenticacion/IniciarSesion';
import { RenovarSesion } from './aplicacion/autenticacion/RenovarSesion';
import { ValidarSegundoFactor } from './aplicacion/autenticacion/ValidarSegundoFactor';
import { ControlarContenedor } from './aplicacion/contenedores/ControlarContenedor';
import { ListarContenedores } from './aplicacion/contenedores/ListarContenedores';
import { ObtenerLogsContenedor } from './aplicacion/contenedores/ObtenerLogsContenedor';
import { GestionarConexionGithub } from './aplicacion/despliegues/GestionarConexionGithub';
import { GestionarProyectosDespliegue } from './aplicacion/despliegues/GestionarProyectosDespliegue';
import { AsistenteIA } from './aplicacion/ia/AsistenteIA';
import { EjecutorHerramientasMcp } from './aplicacion/mcp/EjecutorHerramientasMcp';
import { GestionarTokensMcp } from './aplicacion/mcp/GestionarTokensMcp';
import { NotificarEvento } from './aplicacion/notificaciones/NotificarEvento';
import { ObtenerHistoricoRecursos } from './aplicacion/recursos/ObtenerHistoricoRecursos';
import { ObtenerRecursosHost } from './aplicacion/recursos/ObtenerRecursosHost';
import { ConsultarSeguridad } from './aplicacion/seguridad/ConsultarSeguridad';
import { DetectarFuerzaBruta } from './aplicacion/seguridad/DetectarFuerzaBruta';
import { GestionarBloqueoIps } from './aplicacion/seguridad/GestionarBloqueoIps';
import { crearAplicacion } from './app';
import { cargarConfiguracion } from './config/env';
import { PoliticaBloqueoFuerzaBruta } from './dominio/reglas/PoliticaBloqueoFuerzaBruta';
import { ColectorDocker } from './infraestructura/docker/ColectorDocker';
import { ClienteGithubApi } from './infraestructura/github/ClienteGithubApi';
import { ClienteGithubSimulado } from './infraestructura/github/ClienteGithubSimulado';
import { ProveedorIAHibrido } from './infraestructura/ia/ProveedorIAHibrido';
import { crearLogger } from './infraestructura/logging/logger';
import { NotificadorTelegram } from './infraestructura/notificadores/NotificadorTelegram';
import { ColectorPihole } from './infraestructura/pihole/ColectorPihole';
import {
  cerrarPoolPostgres,
  obtenerPoolPostgres,
  verificarConexionPostgres,
} from './infraestructura/postgres/conexion';
import { RepositorioAccesosProyectoPostgres } from './infraestructura/postgres/RepositorioAccesosProyectoPostgres';
import { RepositorioAuditoriaPostgres } from './infraestructura/postgres/RepositorioAuditoriaPostgres';
import { RepositorioBiometriaPostgres } from './infraestructura/postgres/RepositorioBiometriaPostgres';
import { RepositorioAutomatizacionesPostgres } from './infraestructura/postgres/RepositorioAutomatizacionesPostgres';
import { RepositorioConexionGithubPostgres } from './infraestructura/postgres/RepositorioConexionGithubPostgres';
import { RepositorioContenedoresPostgres } from './infraestructura/postgres/RepositorioContenedoresPostgres';
import { RepositorioDesplieguesPostgres } from './infraestructura/postgres/RepositorioDesplieguesPostgres';
import { RepositorioEventosPostgres } from './infraestructura/postgres/RepositorioEventosPostgres';
import { RepositorioRecursosHostPostgres } from './infraestructura/postgres/RepositorioRecursosHostPostgres';
import { RepositorioSeguridad2FAPostgres } from './infraestructura/postgres/RepositorioSeguridad2FAPostgres';
import { RepositorioSeguridadRedPostgres } from './infraestructura/postgres/RepositorioSeguridadRedPostgres';
import { RepositorioTokensMcpPostgres } from './infraestructura/postgres/RepositorioTokensMcpPostgres';
import { RepositorioUsuariosPostgres } from './infraestructura/postgres/RepositorioUsuariosPostgres';
import { ejecutarSeedDesarrollo } from './infraestructura/postgres/seedDesarrollo';
import { ServicioCifradoAes } from './infraestructura/seguridad/ServicioCifradoAes';
import { ServicioHashBcrypt } from './infraestructura/seguridad/ServicioHashBcrypt';
import { ServicioTokensJwt } from './infraestructura/seguridad/ServicioTokensJwt';
import { ServicioTotpCrypto } from './infraestructura/seguridad/ServicioTotpCrypto';
import { ColectorAuthLog } from './infraestructura/sistema/ColectorAuthLog';
import { ColectorEnergiaHost } from './infraestructura/sistema/ColectorEnergiaHost';
import { ColectorRecursosHost } from './infraestructura/sistema/ColectorRecursosHost';
import { AccesosProyectoController } from './presentacion/controladores/AccesosProyectoController';
import { AuthController } from './presentacion/controladores/AuthController';
import { BiometriaController } from './presentacion/controladores/BiometriaController';
import { AutomatizacionesController } from './presentacion/controladores/AutomatizacionesController';
import { ContenedoresController } from './presentacion/controladores/ContenedoresController';
import { DesplieguesController } from './presentacion/controladores/DesplieguesController';
import { GithubController } from './presentacion/controladores/GithubController';
import { HealthController } from './presentacion/controladores/HealthController';
import { IaMcpController } from './presentacion/controladores/IaMcpController';
import { RecursosController } from './presentacion/controladores/RecursosController';
import { SeguridadController } from './presentacion/controladores/SeguridadController';
import { UsuariosController } from './presentacion/controladores/UsuariosController';
import { crearMiddlewareAutenticacion } from './presentacion/middlewares/autenticacion.middleware';
import {
  crearLimitadorApiGeneral,
  crearLimitadorLogin,
} from './presentacion/middlewares/rateLimit.middleware';

const INTERVALO_MUESTREO_HOST_MS = 30_000;
const INTERVALO_AUTOMATIZACIONES_MS = 60_000;

async function iniciarServidor(): Promise<void> {
  const config = cargarConfiguracion();
  const logger = crearLogger(config.LOG_LEVEL);

  const pool = obtenerPoolPostgres(config.DATABASE_URL);
  const repositorioUsuarios = new RepositorioUsuariosPostgres(pool);
  const repositorioBiometria = new RepositorioBiometriaPostgres(pool);
  const repositorioSeguridad2FA = new RepositorioSeguridad2FAPostgres(pool);
  const repositorioSeguridadRed = new RepositorioSeguridadRedPostgres(pool);
  const repositorioEventos = new RepositorioEventosPostgres(pool);
  const repositorioContenedores = new RepositorioContenedoresPostgres(pool);
  const repositorioRecursosHost = new RepositorioRecursosHostPostgres(pool);
  const repositorioAuditoria = new RepositorioAuditoriaPostgres(pool);
  const repositorioAccesosProyecto = new RepositorioAccesosProyectoPostgres(pool);
  const repositorioConexionGithub = new RepositorioConexionGithubPostgres(pool);
  const repositorioDespliegues = new RepositorioDesplieguesPostgres(pool);
  const repositorioAutomatizaciones = new RepositorioAutomatizacionesPostgres(pool);
  const repositorioTokensMcp = new RepositorioTokensMcpPostgres(pool);

  const servicioHash = new ServicioHashBcrypt();
  const servicioCifrado = new ServicioCifradoAes(config.ENCRYPTION_KEY);
  const servicioTotp = new ServicioTotpCrypto('HomeSOC');
  const servicioTokens = new ServicioTokensJwt({
    secretoAcceso: config.JWT_ACCESS_SECRET,
    secretoRefresh: config.JWT_REFRESH_SECRET,
    expiraAcceso: config.JWT_ACCESS_EXPIRES_IN,
    expiraRefresh: config.JWT_REFRESH_EXPIRES_IN,
  });

  const colectorDocker = new ColectorDocker();
  const colectorRecursosHost = new ColectorRecursosHost(config.DISCOS_MONITOREADOS);
  const colectorEnergia = new ColectorEnergiaHost(config.ENERGIA_MODO);
  const colectorAuthLog = new ColectorAuthLog(config.RUTA_AUTH_LOG);
  const colectorPihole = new ColectorPihole({
    modo: config.PIHOLE_MODO,
    apiUrl: config.PIHOLE_API_URL,
  });
  const clienteGithub =
    config.GITHUB_MODO === 'real' ? new ClienteGithubApi() : new ClienteGithubSimulado();

  const notificarEvento = new NotificarEvento(repositorioSeguridadRed);
  notificarEvento.suscribir(
    new NotificadorTelegram(config.TELEGRAM_TOKEN, config.TELEGRAM_CHAT_ID),
  );

  const rangosConfiablesCidr = config.REDES_CONFIABLES_CIDR.split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  await ejecutarSeedDesarrollo(config, repositorioUsuarios, servicioHash, logger);

  const casoUsoIniciarSesion = new IniciarSesion(
    repositorioUsuarios,
    servicioHash,
    servicioTokens,
    repositorioSeguridad2FA,
    rangosConfiablesCidr,
  );
  const casoUsoRenovarSesion = new RenovarSesion(repositorioUsuarios, servicioTokens);
  const casoUsoValidar2FA = new ValidarSegundoFactor(
    repositorioUsuarios,
    repositorioSeguridad2FA,
    servicioCifrado,
    servicioTotp,
    servicioHash,
    servicioTokens,
    config.DIAS_DISPOSITIVO_CONFIABLE,
  );
  const casoUsoGestionar2FA = new Gestionar2FA(
    repositorioUsuarios,
    repositorioSeguridad2FA,
    repositorioAuditoria,
    servicioCifrado,
    servicioTotp,
    servicioHash,
  );
  const casoUsoAccesoYUsuarios = new GestionarAccesoYUsuarios(
    repositorioUsuarios,
    repositorioSeguridad2FA,
    repositorioAuditoria,
    servicioHash,
    servicioCifrado,
    servicioTotp,
    servicioTokens,
  );
  const casoUsoBiometria = new GestionarBiometriaWebAuthn(
    repositorioBiometria,
    repositorioUsuarios,
    repositorioAuditoria,
    repositorioSeguridad2FA,
    servicioTokens,
  );

  const casoUsoListarContenedores = new ListarContenedores(
    colectorDocker,
    repositorioContenedores,
  );
  const casoUsoControlarContenedor = new ControlarContenedor(
    colectorDocker,
    repositorioAuditoria,
  );
  const casoUsoObtenerLogs = new ObtenerLogsContenedor(colectorDocker);
  const casoUsoObtenerRecursosHost = new ObtenerRecursosHost(
    colectorRecursosHost,
    repositorioRecursosHost,
  );
  const casoUsoObtenerHistoricoRecursos = new ObtenerHistoricoRecursos(
    repositorioRecursosHost,
  );
  const casoUsoConsultarSeguridad = new ConsultarSeguridad(repositorioEventos);
  const casoUsoFuerzaBruta = new DetectarFuerzaBruta(
    colectorAuthLog,
    new PoliticaBloqueoFuerzaBruta(),
    repositorioSeguridad2FA,
    notificarEvento,
    config.UMBRAL_FUERZA_BRUTA_SSH,
    config.VENTANA_FUERZA_BRUTA_MIN,
  );
  const casoUsoBloqueoIps = new GestionarBloqueoIps(
    repositorioSeguridadRed,
    repositorioSeguridad2FA,
    repositorioAuditoria,
    notificarEvento,
  );
  const casoUsoAccesosProyecto = new GestionarAccesosProyecto(repositorioAccesosProyecto);
  const casoUsoConexionGithub = new GestionarConexionGithub(
    clienteGithub,
    repositorioConexionGithub,
    servicioCifrado,
    repositorioAuditoria,
  );
  const casoUsoProyectosDespliegue = new GestionarProyectosDespliegue(
    clienteGithub,
    repositorioConexionGithub,
    repositorioDespliegues,
    servicioCifrado,
    repositorioAuditoria,
    notificarEvento,
  );
  const casoUsoAutomatizaciones = new GestionarAutomatizaciones(
    repositorioAutomatizaciones,
    colectorDocker,
    colectorRecursosHost,
    colectorEnergia,
    repositorioAuditoria,
    notificarEvento,
    repositorioSeguridad2FA,
    config.RUTA_ACTUALIZACIONES_SO,
    config.NOTIFICAR_ARRANQUE,
  );
  const proveedorIA = new ProveedorIAHibrido({
    modo: config.IA_PROVEEDOR,
    apiKey: config.IA_API_KEY,
    ollamaUrl: config.IA_OLLAMA_URL,
    modelo: config.IA_MODELO,
  });
  const casoUsoAsistenteIA = new AsistenteIA(
    proveedorIA,
    repositorioDespliegues,
    repositorioEventos,
    repositorioSeguridadRed,
    colectorRecursosHost,
    colectorDocker,
  );
  const casoUsoTokensMcp = new GestionarTokensMcp(repositorioTokensMcp, repositorioAuditoria);
  const ejecutorMcp = new EjecutorHerramientasMcp(
    casoUsoObtenerRecursosHost,
    casoUsoListarContenedores,
    casoUsoConsultarSeguridad,
    casoUsoProyectosDespliegue,
    casoUsoAsistenteIA,
    repositorioAuditoria,
  );

  const esProduccion = config.NODE_ENV === 'production';

  const authController = new AuthController(
    casoUsoIniciarSesion,
    casoUsoRenovarSesion,
    casoUsoValidar2FA,
    casoUsoGestionar2FA,
    esProduccion,
    config.DIAS_DISPOSITIVO_CONFIABLE,
    casoUsoAccesoYUsuarios,
  );
  const usuariosController = new UsuariosController(casoUsoAccesoYUsuarios);
  const biometriaController = new BiometriaController(casoUsoBiometria, esProduccion);
  const contenedoresController = new ContenedoresController(
    casoUsoListarContenedores,
    casoUsoControlarContenedor,
    casoUsoObtenerLogs,
  );
  const recursosController = new RecursosController(
    casoUsoObtenerRecursosHost,
    casoUsoObtenerHistoricoRecursos,
  );
  const seguridadController = new SeguridadController(
    casoUsoConsultarSeguridad,
    casoUsoFuerzaBruta,
    casoUsoBloqueoIps,
    repositorioSeguridadRed,
    notificarEvento,
    colectorAuthLog,
    colectorPihole,
    config.NODE_ENV === 'development',
    servicioTokens,
  );
  const accesosProyectoController = new AccesosProyectoController(
    casoUsoAccesosProyecto,
    config.NODE_ENV === 'development',
  );
  const githubController = new GithubController(casoUsoConexionGithub);
  const desplieguesController = new DesplieguesController(
    casoUsoProyectosDespliegue,
    repositorioSeguridad2FA,
    config.GITHUB_WEBHOOK_SECRET,
    config.NODE_ENV === 'development',
  );
  const automatizacionesController = new AutomatizacionesController(
    casoUsoAutomatizaciones,
    config.NODE_ENV === 'development',
  );
  const iaMcpController = new IaMcpController(
    casoUsoAsistenteIA,
    casoUsoTokensMcp,
    ejecutorMcp,
  );
  const healthController = new HealthController({
    verificarPostgres: () => verificarConexionPostgres(pool),
    verificarDocker: () => colectorDocker.verificarConexion(),
  });
  const middlewareAutenticacion = crearMiddlewareAutenticacion(servicioTokens, repositorioUsuarios);

  const registrarEvento = (
    evento: Parameters<typeof repositorioSeguridad2FA.registrarEventoSeguridad>[0],
  ) => repositorioSeguridad2FA.registrarEventoSeguridad(evento);

  const limitadorLogin = crearLimitadorLogin({
    maxIntentos: config.RATE_LIMIT_LOGIN_MAX,
    ventanaMinutos: config.RATE_LIMIT_LOGIN_VENTANA_MIN,
    registrarEvento,
    logger,
  });

  const limitadorApiGeneral = crearLimitadorApiGeneral({
    maxPorMinuto: config.RATE_LIMIT_API_MAX,
    registrarEvento,
    logger,
  });

  const app = crearAplicacion({
    corsOrigin: config.CORS_ORIGIN,
    esProduccion,
    logger,
    rutas: {
      authController,
      usuariosController,
      biometriaController,
      contenedoresController,
      recursosController,
      seguridadController,
      accesosProyectoController,
      githubController,
      desplieguesController,
      automatizacionesController,
      iaMcpController,
      healthController,
      middlewareAutenticacion,
      limitadorLogin,
      limitadorApiGeneral,
    },
  });

  void casoUsoObtenerRecursosHost.ejecutar({ persistir: true }).catch((error) => {
    logger.warn({ err: error }, 'Error en captura inicial de recursos del host');
  });

  void casoUsoAutomatizaciones.notificarArranqueServidor().catch((error) => {
    logger.warn({ err: error }, 'Error al emitir notificación de arranque del servidor');
  });

  const intervaloMuestreo = setInterval(() => {
    void casoUsoObtenerRecursosHost.ejecutar({ persistir: true }).catch((error) => {
      logger.warn({ err: error }, 'Error en muestreo periódico de recursos del host');
    });
  }, INTERVALO_MUESTREO_HOST_MS);

  const intervaloAutomatizaciones = setInterval(() => {
    void casoUsoAutomatizaciones.evaluarReglasActivas().catch((error) => {
      logger.warn({ err: error }, 'Error en evaluación periódica de automatizaciones');
    });
  }, INTERVALO_AUTOMATIZACIONES_MS);

  const servidor = app.listen(config.PORT, () => {
    logger.info(
      { puerto: config.PORT, entorno: config.NODE_ENV },
      'Backend de HomeSOC iniciado correctamente',
    );
  });

  const cerrarOrdenadamente = async (senal: string): Promise<void> => {
    logger.info({ senal }, 'Deteniendo backend de HomeSOC');
    clearInterval(intervaloMuestreo);
    clearInterval(intervaloAutomatizaciones);
    servidor.close(async () => {
      await cerrarPoolPostgres();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void cerrarOrdenadamente('SIGINT'));
  process.on('SIGTERM', () => void cerrarOrdenadamente('SIGTERM'));
}

iniciarServidor().catch((error) => {
  process.stderr.write(`Error fatal al iniciar el backend: ${String(error)}\n`);
  process.exit(1);
});
