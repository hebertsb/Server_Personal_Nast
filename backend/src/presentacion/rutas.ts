import { RequestHandler, Router } from 'express';
import {
  AccesosProyectoController,
  esquemaRegistrarAcceso,
} from './controladores/AccesosProyectoController';
import {
  AutomatizacionesController,
  esquemaReglaAutomatizacion,
  esquemaSimularEnergia,
  esquemaToggleAutomatizacion,
} from './controladores/AutomatizacionesController';
import { AuthController } from './controladores/AuthController';
import { ContenedoresController } from './controladores/ContenedoresController';
import {
  DesplieguesController,
  esquemaActualizarProyecto,
  esquemaCrearProyecto,
  esquemaDetectarProyecto,
  esquemaGuardarVariable,
  esquemaSimularPush,
} from './controladores/DesplieguesController';
import {
  esquemaConectarGithub,
  GithubController,
} from './controladores/GithubController';
import {
  esquemaConsultaIa,
  esquemaCrearTokenMcp,
  esquemaExplicarDespliegue,
  IaMcpController,
} from './controladores/IaMcpController';
import { HealthController } from './controladores/HealthController';
import { RecursosController } from './controladores/RecursosController';
import {
  esquemaActualizarNotificacion,
  esquemaBloquearIp,
  SeguridadController,
} from './controladores/SeguridadController';
import {
  esquemaConfirmar2FA,
  esquemaDesactivar2FA,
  esquemaLogin,
  esquemaRecuperarTotp,
  esquemaRegistroInvitacion,
  esquemaSetupInicial,
  esquemaVerificar2FA,
} from './dto/LoginDTO';
import {
  BiometriaController,
  esquemaOpcionesLoginBiometrico,
  esquemaVerificarLoginBiometrico,
  esquemaVerificarRegistroBiometrico,
} from './controladores/BiometriaController';
import {
  esquemaActualizarPermisos,
  esquemaCambiarEstadoUsuario,
  esquemaConfigEditor,
  esquemaCrearInvitacion,
  UsuariosController,
} from './controladores/UsuariosController';
import {
  requerirModulo,
  requerirSuperadmin,
} from './middlewares/autenticacion.middleware';
import { validarCuerpo } from './middlewares/validacion.middleware';

export interface DependenciasRutas {
  authController: AuthController;
  usuariosController?: UsuariosController;
  biometriaController?: BiometriaController;
  contenedoresController: ContenedoresController;
  recursosController: RecursosController;
  seguridadController: SeguridadController;
  accesosProyectoController: AccesosProyectoController;
  githubController: GithubController;
  desplieguesController: DesplieguesController;
  automatizacionesController: AutomatizacionesController;
  iaMcpController: IaMcpController;
  healthController: HealthController;
  middlewareAutenticacion: RequestHandler;
  limitadorLogin: RequestHandler;
  limitadorApiGeneral: RequestHandler;
}

export function crearRutas(deps: DependenciasRutas): Router {
  const router = Router();

  router.get('/health', deps.healthController.verificarSalud);

  const routerApiV1 = Router();
  routerApiV1.use(deps.limitadorApiGeneral);

  // Autenticación, Setup inicial, Registro por invitación, Recuperación 2FA y TOTP
  routerApiV1.get('/auth/estado-inicial', deps.authController.obtenerEstadoInicial);
  routerApiV1.post(
    '/auth/setup-inicial',
    deps.limitadorLogin,
    validarCuerpo(esquemaSetupInicial),
    deps.authController.setupInicial,
  );
  routerApiV1.post(
    '/auth/registrar-con-invitacion',
    deps.limitadorLogin,
    validarCuerpo(esquemaRegistroInvitacion),
    deps.authController.registrarConInvitacion,
  );
  routerApiV1.post(
    '/auth/recuperar-totp',
    deps.limitadorLogin,
    validarCuerpo(esquemaRecuperarTotp),
    deps.authController.recuperarConTotp,
  );
  routerApiV1.post(
    '/auth/login',
    deps.limitadorLogin,
    validarCuerpo(esquemaLogin),
    deps.authController.iniciarSesion,
  );
  routerApiV1.post(
    '/auth/2fa/verificar',
    deps.limitadorLogin,
    validarCuerpo(esquemaVerificar2FA),
    deps.authController.verificarSegundoFactor,
  );
  routerApiV1.get(
    '/auth/2fa/estado',
    deps.middlewareAutenticacion,
    deps.authController.obtenerEstado2FA,
  );
  routerApiV1.post(
    '/auth/2fa/iniciar',
    deps.middlewareAutenticacion,
    deps.authController.iniciarConfiguracion2FA,
  );
  routerApiV1.post(
    '/auth/2fa/confirmar',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaConfirmar2FA),
    deps.authController.confirmarActivacion2FA,
  );
  routerApiV1.post(
    '/auth/2fa/desactivar',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaDesactivar2FA),
    deps.authController.desactivar2FA,
  );
  routerApiV1.delete(
    '/auth/2fa/dispositivos/:id',
    deps.middlewareAutenticacion,
    deps.authController.revocarDispositivo2FA,
  );
  routerApiV1.post('/auth/refresh', deps.authController.renovarSesion);
  routerApiV1.post('/auth/logout', deps.authController.cerrarSesion);
  routerApiV1.get('/auth/perfil', deps.middlewareAutenticacion, deps.authController.obtenerPerfil);

  // Autenticación y 2FA biométrico WebAuthn (Huella Digital / Face ID / Windows Hello)
  if (deps.biometriaController) {
    routerApiV1.get(
      '/auth/biometria/credenciales',
      deps.middlewareAutenticacion,
      deps.biometriaController.listarCredenciales,
    );
    routerApiV1.post(
      '/auth/biometria/registrar/opciones',
      deps.middlewareAutenticacion,
      deps.biometriaController.opcionesRegistro,
    );
    routerApiV1.post(
      '/auth/biometria/registrar/verificar',
      deps.middlewareAutenticacion,
      validarCuerpo(esquemaVerificarRegistroBiometrico),
      deps.biometriaController.verificarRegistro,
    );
    routerApiV1.delete(
      '/auth/biometria/credenciales/:id',
      deps.middlewareAutenticacion,
      deps.biometriaController.revocarCredencial,
    );
    routerApiV1.post(
      '/auth/biometria/login/opciones',
      deps.limitadorLogin,
      validarCuerpo(esquemaOpcionesLoginBiometrico),
      deps.biometriaController.opcionesLogin,
    );
    routerApiV1.post(
      '/auth/biometria/login/verificar',
      deps.limitadorLogin,
      validarCuerpo(esquemaVerificarLoginBiometrico),
      deps.biometriaController.verificarLogin,
    );
  }

  // Módulo de contenedores Docker (RF-05 a RF-08)
  routerApiV1.get(
    '/contenedores',
    deps.middlewareAutenticacion,
    deps.contenedoresController.listar,
  );
  routerApiV1.post(
    '/contenedores/:id/iniciar',
    deps.middlewareAutenticacion,
    deps.contenedoresController.crearManejadorAccion('iniciar'),
  );
  routerApiV1.post(
    '/contenedores/:id/detener',
    deps.middlewareAutenticacion,
    deps.contenedoresController.crearManejadorAccion('detener'),
  );
  routerApiV1.post(
    '/contenedores/:id/reiniciar',
    deps.middlewareAutenticacion,
    deps.contenedoresController.crearManejadorAccion('reiniciar'),
  );
  routerApiV1.get(
    '/contenedores/:id/logs',
    deps.middlewareAutenticacion,
    deps.contenedoresController.obtenerLogs,
  );

  // Módulo de recursos del host (RF-24 a RF-27)
  routerApiV1.get(
    '/recursos/host',
    deps.middlewareAutenticacion,
    deps.recursosController.obtenerActual,
  );
  routerApiV1.get(
    '/recursos/host/historico',
    deps.middlewareAutenticacion,
    deps.recursosController.obtenerHistorico,
  );

  // Módulo de seguridad, SSH, bloqueo de IPs, notificaciones y Pi-hole (Fase 0.7 + Fase 1)
  routerApiV1.use('/seguridad', deps.middlewareAutenticacion, requerirModulo('seguridad'));
  routerApiV1.get(
    '/seguridad/eventos',
    deps.middlewareAutenticacion,
    deps.seguridadController.listarEventos,
  );
  routerApiV1.get(
    '/seguridad/auditoria',
    deps.middlewareAutenticacion,
    deps.seguridadController.listarAuditoria,
  );
  routerApiV1.get(
    '/seguridad/ssh',
    deps.middlewareAutenticacion,
    deps.seguridadController.obtenerEstadoSsh,
  );
  routerApiV1.post(
    '/seguridad/ssh/analizar',
    deps.middlewareAutenticacion,
    deps.seguridadController.analizarSsh,
  );
  routerApiV1.post(
    '/seguridad/ssh/simular',
    deps.middlewareAutenticacion,
    deps.seguridadController.simularAtaqueSsh,
  );
  routerApiV1.get(
    '/seguridad/ips-bloqueadas',
    deps.middlewareAutenticacion,
    deps.seguridadController.listarIpsBloqueadas,
  );
  routerApiV1.post(
    '/seguridad/ips-bloqueadas',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaBloquearIp),
    deps.seguridadController.bloquearIp,
  );
  routerApiV1.delete(
    '/seguridad/ips-bloqueadas/:id',
    deps.middlewareAutenticacion,
    deps.seguridadController.desbloquearIp,
  );
  routerApiV1.get(
    '/notificaciones/alertas',
    deps.middlewareAutenticacion,
    deps.seguridadController.listarAlertasEnviadas,
  );
  routerApiV1.post(
    '/notificaciones/probar',
    deps.middlewareAutenticacion,
    deps.seguridadController.probarNotificacion,
  );
  routerApiV1.put(
    '/notificaciones/configuracion',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaActualizarNotificacion),
    deps.seguridadController.actualizarConfiguracionNotificacion,
  );
  routerApiV1.get(
    '/notificaciones/stream',
    deps.seguridadController.streamNotificaciones,
  );
  routerApiV1.get(
    '/red/pihole',
    deps.middlewareAutenticacion,
    deps.seguridadController.obtenerEstadisticasPihole,
  );

  // Módulo de flujo de datos y accesos a proyectos desplegados (Fase 2: RF-16 a RF-19)
  routerApiV1.get(
    '/accesos-proyectos',
    deps.middlewareAutenticacion,
    deps.accesosProyectoController.consultarAnalitica,
  );
  routerApiV1.post(
    '/accesos-proyectos',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaRegistrarAcceso),
    deps.accesosProyectoController.registrar,
  );
  routerApiV1.post(
    '/accesos-proyectos/simular',
    deps.middlewareAutenticacion,
    deps.accesosProyectoController.simular,
  );

  // Módulo de despliegues desde GitHub (Fase 3a: RF-28 y RF-29 + OAuth)
  routerApiV1.get(
    '/github/conexion',
    deps.middlewareAutenticacion,
    deps.githubController.obtenerEstado,
  );
  routerApiV1.post(
    '/github/oauth/iniciar',
    deps.middlewareAutenticacion,
    deps.githubController.iniciarOAuth,
  );
  routerApiV1.get('/github/oauth/callback', deps.githubController.callbackOAuth);
  routerApiV1.post(
    '/github/conexion',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaConectarGithub),
    deps.githubController.conectar,
  );
  routerApiV1.delete(
    '/github/conexion',
    deps.middlewareAutenticacion,
    deps.githubController.desconectar,
  );
  routerApiV1.get(
    '/github/repositorios',
    deps.middlewareAutenticacion,
    deps.githubController.listarRepositorios,
  );

  // Módulo de proyectos desplegados y variables cifradas (Fase 3b: RF-30..31, RF-34..39)
  routerApiV1.get(
    '/despliegues/puerto-sugerido',
    deps.middlewareAutenticacion,
    deps.desplieguesController.sugerirPuerto,
  );
  routerApiV1.get(
    '/despliegues/proyectos',
    deps.middlewareAutenticacion,
    deps.desplieguesController.listarProyectos,
  );
  routerApiV1.post(
    '/despliegues/proyectos/detectar',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaDetectarProyecto),
    deps.desplieguesController.detectar,
  );
  routerApiV1.post(
    '/despliegues/proyectos',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaCrearProyecto),
    deps.desplieguesController.crearProyecto,
  );
  routerApiV1.patch(
    '/despliegues/proyectos/:id',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaActualizarProyecto),
    deps.desplieguesController.actualizarProyecto,
  );
  routerApiV1.delete(
    '/despliegues/proyectos/:id',
    deps.middlewareAutenticacion,
    deps.desplieguesController.eliminarProyecto,
  );
  routerApiV1.post(
    '/despliegues/proyectos/:id/redeploy',
    deps.middlewareAutenticacion,
    deps.desplieguesController.redeploy,
  );
  routerApiV1.get(
    '/despliegues/proyectos/:id/historial',
    deps.middlewareAutenticacion,
    deps.desplieguesController.listarHistorial,
  );
  routerApiV1.get(
    '/despliegues/proyectos/:id/variables',
    deps.middlewareAutenticacion,
    deps.desplieguesController.listarVariables,
  );
  routerApiV1.post(
    '/despliegues/proyectos/:id/variables',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaGuardarVariable),
    deps.desplieguesController.guardarVariable,
  );
  routerApiV1.delete(
    '/despliegues/proyectos/:id/variables/:varId',
    deps.middlewareAutenticacion,
    deps.desplieguesController.eliminarVariable,
  );

  // Fase 3c: Webhook HMAC público, Polling, Gate de seguridad, Aprobación y Rollback manual
  routerApiV1.post('/webhooks/github', deps.desplieguesController.recibirWebhookGithub);
  routerApiV1.post(
    '/despliegues/polling/ejecutar',
    deps.middlewareAutenticacion,
    deps.desplieguesController.ejecutarPolling,
  );
  routerApiV1.post(
    '/despliegues/proyectos/:id/despliegues/:despliegueId/aprobar',
    deps.middlewareAutenticacion,
    deps.desplieguesController.aprobarDespliegue,
  );
  routerApiV1.post(
    '/despliegues/proyectos/:id/despliegues/:despliegueId/revertir',
    deps.middlewareAutenticacion,
    deps.desplieguesController.revertirDespliegue,
  );
  routerApiV1.post(
    '/despliegues/proyectos/:id/simular-push',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaSimularPush),
    deps.desplieguesController.simularPush,
  );

  // Fase 4: Automatización de servicios y reglas condición-acción (RF-51 a RF-53)
  routerApiV1.use('/automatizaciones', deps.middlewareAutenticacion, requerirModulo('automatizacion'));
  routerApiV1.get(
    '/automatizaciones',
    deps.middlewareAutenticacion,
    deps.automatizacionesController.listar,
  );
  routerApiV1.post(
    '/automatizaciones',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaReglaAutomatizacion),
    deps.automatizacionesController.crear,
  );
  routerApiV1.put(
    '/automatizaciones/:id',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaReglaAutomatizacion),
    deps.automatizacionesController.actualizar,
  );
  routerApiV1.patch(
    '/automatizaciones/:id/estado',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaToggleAutomatizacion),
    deps.automatizacionesController.alternarEstado,
  );
  routerApiV1.delete(
    '/automatizaciones/:id',
    deps.middlewareAutenticacion,
    deps.automatizacionesController.eliminar,
  );
  routerApiV1.post(
    '/automatizaciones/:id/ejecutar',
    deps.middlewareAutenticacion,
    deps.automatizacionesController.ejecutarManual,
  );
  routerApiV1.post(
    '/automatizaciones/evaluar',
    deps.middlewareAutenticacion,
    deps.automatizacionesController.evaluarActivas,
  );
  routerApiV1.get(
    '/automatizaciones/logs',
    deps.middlewareAutenticacion,
    deps.automatizacionesController.listarLogs,
  );
  routerApiV1.get(
    '/automatizaciones/energia',
    deps.middlewareAutenticacion,
    deps.automatizacionesController.obtenerEnergia,
  );
  routerApiV1.post(
    '/automatizaciones/energia/simular',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaSimularEnergia),
    deps.automatizacionesController.simularEnergia,
  );

  // Fase 5: Módulo de IA con voz (RF-54..58) y Servidor MCP (RF-63..65)
  routerApiV1.post(
    '/ia/explicar-despliegue',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaExplicarDespliegue),
    deps.iaMcpController.explicarDespliegue,
  );
  routerApiV1.get(
    '/ia/resumen-seguridad',
    deps.middlewareAutenticacion,
    deps.iaMcpController.resumenSeguridad,
  );
  routerApiV1.post(
    '/ia/consultar',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaConsultaIa),
    deps.iaMcpController.consultar,
  );
  routerApiV1.get(
    '/mcp/tokens',
    deps.middlewareAutenticacion,
    deps.iaMcpController.listarTokensMcp,
  );
  routerApiV1.post(
    '/mcp/tokens',
    deps.middlewareAutenticacion,
    validarCuerpo(esquemaCrearTokenMcp),
    deps.iaMcpController.crearTokenMcp,
  );
  routerApiV1.delete(
    '/mcp/tokens/:id',
    deps.middlewareAutenticacion,
    deps.iaMcpController.revocarTokenMcp,
  );
  routerApiV1.post('/mcp', deps.iaMcpController.manejarJsonRpcMcp);

  // Gestión de usuarios, permisos e invitaciones temporales (exclusivo Superadmin)
  if (deps.usuariosController) {
    routerApiV1.get(
      '/usuarios',
      deps.middlewareAutenticacion,
      requerirSuperadmin,
      deps.usuariosController.listarUsuarios,
    );
    routerApiV1.put(
      '/usuarios/:id/permisos',
      deps.middlewareAutenticacion,
      requerirSuperadmin,
      validarCuerpo(esquemaActualizarPermisos),
      deps.usuariosController.actualizarPermisos,
    );
    routerApiV1.patch(
      '/usuarios/:id/estado',
      deps.middlewareAutenticacion,
      requerirSuperadmin,
      validarCuerpo(esquemaCambiarEstadoUsuario),
      deps.usuariosController.cambiarEstado,
    );
    routerApiV1.post(
      '/usuarios/:id/revocar-sesiones',
      deps.middlewareAutenticacion,
      requerirSuperadmin,
      deps.usuariosController.revocarSesiones,
    );
    routerApiV1.get(
      '/usuarios/invitaciones',
      deps.middlewareAutenticacion,
      requerirSuperadmin,
      deps.usuariosController.listarInvitaciones,
    );
    routerApiV1.post(
      '/usuarios/invitaciones',
      deps.middlewareAutenticacion,
      requerirSuperadmin,
      validarCuerpo(esquemaCrearInvitacion),
      deps.usuariosController.crearInvitacion,
    );
    routerApiV1.delete(
      '/usuarios/invitaciones/:id',
      deps.middlewareAutenticacion,
      requerirSuperadmin,
      deps.usuariosController.revocarInvitacion,
    );
    routerApiV1.get(
      '/configuracion/editor',
      deps.middlewareAutenticacion,
      deps.usuariosController.obtenerConfigEditor,
    );
    routerApiV1.put(
      '/configuracion/editor',
      deps.middlewareAutenticacion,
      validarCuerpo(esquemaConfigEditor),
      deps.usuariosController.guardarConfigEditor,
    );
  }

  router.use('/api/v1', routerApiV1);

  return router;
}
