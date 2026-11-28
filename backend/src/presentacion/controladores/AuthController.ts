import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { Gestionar2FA } from '../../aplicacion/autenticacion/Gestionar2FA';
import { GestionarAccesoYUsuarios } from '../../aplicacion/autenticacion/GestionarAccesoYUsuarios';
import { IniciarSesion } from '../../aplicacion/autenticacion/IniciarSesion';
import { RenovarSesion } from '../../aplicacion/autenticacion/RenovarSesion';
import { ValidarSegundoFactor } from '../../aplicacion/autenticacion/ValidarSegundoFactor';
import { ErrorTokenInvalido } from '../../dominio/errores/ErroresAutenticacion';
import {
  Confirmar2FADTO,
  Desactivar2FADTO,
  esquemaParametroUuid,
  LoginDTO,
  RecuperarTotpDTO,
  RegistroInvitacionDTO,
  RegistroPublicoDTO,
  SetupInicialDTO,
  Verificar2FADTO,
} from '../dto/LoginDTO';

const NOMBRE_COOKIE_REFRESH = 'homesoc_refresh_token';
const NOMBRE_COOKIE_DISPOSITIVO = 'homesoc_dispositivo_confiable';
const UN_DIA_MS = 24 * 60 * 60 * 1000;
const SIETE_DIAS_MS = 7 * UN_DIA_MS;

function opcionesCookieRefresh(
  base: { httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string },
  dias?: number,
) {
  if (dias === 0) return base;
  const diasFinales = dias && dias > 0 ? dias : 7;
  return { ...base, maxAge: diasFinales * UN_DIA_MS };
}

function extraerCookie(cabeceraCookie: string | undefined, nombre: string): string | null {
  if (!cabeceraCookie) return null;
  for (const parte of cabeceraCookie.split(';')) {
    const [clave, ...valorPartes] = parte.trim().split('=');
    if (clave === nombre) {
      return decodeURIComponent(valorPartes.join('='));
    }
  }
  return null;
}

function resumirUserAgent(userAgent: string | undefined): string {
  if (!userAgent) return 'Navegador web';
  if (userAgent.includes('Edg/')) return 'Microsoft Edge';
  if (userAgent.includes('Chrome/')) return 'Google Chrome';
  if (userAgent.includes('Firefox/')) return 'Mozilla Firefox';
  if (userAgent.includes('Safari/')) return 'Safari';
  return userAgent.slice(0, 60);
}

export class AuthController {
  constructor(
    private readonly casoUsoIniciarSesion: IniciarSesion,
    private readonly casoUsoRenovarSesion: RenovarSesion,
    private readonly casoUsoValidar2FA: ValidarSegundoFactor,
    private readonly casoUsoGestionar2FA: Gestionar2FA,
    private readonly esProduccion: boolean,
    private readonly diasDispositivoConfiable = 30,
    private readonly casoUsoAccesoYUsuarios?: GestionarAccesoYUsuarios,
  ) {}

  private obtenerOpcionesCookie(req?: Request) {
    const esHttps = Boolean(
      req && (req.secure || req.headers['x-forwarded-proto'] === 'https'),
    );
    return {
      httpOnly: true,
      secure: this.esProduccion && esHttps,
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
    };
  }

  public obtenerEstadoInicial = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.casoUsoAccesoYUsuarios) {
        res.status(200).json({ requiereSetup: false });
        return;
      }
      const estado = await this.casoUsoAccesoYUsuarios.obtenerEstadoInicial();
      res.status(200).json(estado);
    } catch (error) {
      next(error);
    }
  };

  public setupInicial = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.casoUsoAccesoYUsuarios) {
        res.status(501).json({ error: { codigo: 'NO_DISPONIBLE', mensaje: 'Setup no disponible' } });
        return;
      }
      const { nombreUsuario, contrasena, recordarSesionDias } = req.body as SetupInicialDTO;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const resultado = await this.casoUsoAccesoYUsuarios.ejecutarSetupInicial({
        nombreUsuario,
        contrasena,
        direccionIp,
      });

      res.cookie(
        NOMBRE_COOKIE_REFRESH,
        resultado.tokenRefresh,
        opcionesCookieRefresh(this.obtenerOpcionesCookie(req), recordarSesionDias),
      );

      res.status(201).json({
        requiere2FA: false,
        usuario: resultado.usuario,
        tokenAcceso: resultado.tokenAcceso,
        expiraEn: resultado.expiraEn,
      });
    } catch (error) {
      next(error);
    }
  };

  public registrarConInvitacion = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.casoUsoAccesoYUsuarios) {
        res.status(501).json({ error: { codigo: 'NO_DISPONIBLE', mensaje: 'Registro no disponible' } });
        return;
      }
      const { tokenInvitacion, nombreUsuario, contrasena, recordarSesionDias } =
        req.body as RegistroInvitacionDTO;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const resultado = await this.casoUsoAccesoYUsuarios.registrarConInvitacion({
        tokenInvitacion,
        nombreUsuario,
        contrasena,
        direccionIp,
      });

      res.cookie(
        NOMBRE_COOKIE_REFRESH,
        resultado.tokenRefresh,
        opcionesCookieRefresh(this.obtenerOpcionesCookie(req), recordarSesionDias),
      );

      res.status(201).json({
        requiere2FA: false,
        usuario: resultado.usuario,
        tokenAcceso: resultado.tokenAcceso,
        expiraEn: resultado.expiraEn,
      });
    } catch (error) {
      next(error);
    }
  };

  public registrarCuentaPublica = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.casoUsoAccesoYUsuarios) {
        res.status(501).json({ error: { codigo: 'NO_DISPONIBLE', mensaje: 'Registro no disponible' } });
        return;
      }
      const { nombreUsuario, contrasena, whatsappNumero, telegramChatId, recordarSesionDias } =
        req.body as RegistroPublicoDTO;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const resultado = await this.casoUsoAccesoYUsuarios.registrarCuentaPublica({
        nombreUsuario,
        contrasena,
        whatsappNumero,
        telegramChatId,
        direccionIp,
      });

      res.cookie(
        NOMBRE_COOKIE_REFRESH,
        resultado.tokenRefresh,
        opcionesCookieRefresh(this.obtenerOpcionesCookie(req), recordarSesionDias),
      );

      res.status(201).json({
        requiere2FA: false,
        usuario: resultado.usuario,
        tokenAcceso: resultado.tokenAcceso,
        expiraEn: resultado.expiraEn,
      });
    } catch (error) {
      next(error);
    }
  };

  public recuperarConTotp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.casoUsoAccesoYUsuarios) {
        res.status(501).json({ error: { codigo: 'NO_DISPONIBLE', mensaje: 'Recuperación no disponible' } });
        return;
      }
      const { nombreUsuario, codigo, nuevaContrasena } = req.body as RecuperarTotpDTO;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const resultado = await this.casoUsoAccesoYUsuarios.recuperarContrasenaConTotp({
        nombreUsuario,
        codigo,
        nuevaContrasena,
        direccionIp,
      });
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public iniciarSesion = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { nombreUsuario, contrasena, recordarSesionDias } = req.body as LoginDTO;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const tokenDispositivo = extraerCookie(req.headers.cookie, NOMBRE_COOKIE_DISPOSITIVO);
      const huellaDispositivo = tokenDispositivo
        ? crypto.createHash('sha256').update(tokenDispositivo, 'utf8').digest('hex')
        : null;

      const resultado = await this.casoUsoIniciarSesion.ejecutar({
        nombreUsuario,
        contrasena,
        direccionIp,
        huellaDispositivo,
      });

      if (resultado.requiere2FA) {
        res.status(200).json({
          requiere2FA: true,
          motivo2FA: resultado.motivo2FA,
          esRedLocal: resultado.esRedLocal,
          tokenTemporal2FA: resultado.tokenTemporal2FA,
          usuario: resultado.usuario,
        });
        return;
      }

      res.cookie(
        NOMBRE_COOKIE_REFRESH,
        resultado.tokenRefresh,
        opcionesCookieRefresh(this.obtenerOpcionesCookie(req), recordarSesionDias),
      );

      res.status(200).json({
        requiere2FA: false,
        usuario: resultado.usuario,
        tokenAcceso: resultado.tokenAcceso,
        expiraEn: resultado.expiraEn,
      });
    } catch (error) {
      next(error);
    }
  };

  public verificarSegundoFactor = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const datos = req.body as Verificar2FADTO;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const etiqueta =
        datos.etiquetaDispositivo || resumirUserAgent(req.headers['user-agent']);

      const resultado = await this.casoUsoValidar2FA.ejecutar({
        tokenTemporal2FA: datos.tokenTemporal2FA,
        codigo: datos.codigo,
        recordarDispositivo: datos.recordarDispositivo,
        etiquetaDispositivo: etiqueta,
        direccionIp,
      });

      res.cookie(NOMBRE_COOKIE_REFRESH, resultado.tokenRefresh, {
        ...this.obtenerOpcionesCookie(req),
        maxAge: SIETE_DIAS_MS,
      });

      if (resultado.tokenDispositivoConfiable) {
        res.cookie(NOMBRE_COOKIE_DISPOSITIVO, resultado.tokenDispositivoConfiable, {
          ...this.obtenerOpcionesCookie(req),
          maxAge: this.diasDispositivoConfiable * 24 * 60 * 60 * 1000,
        });
      }

      res.status(200).json({
        usuario: resultado.usuario,
        tokenAcceso: resultado.tokenAcceso,
        expiraEn: resultado.expiraEn,
        usoCodigoRecuperacion: resultado.usoCodigoRecuperacion,
      });
    } catch (error) {
      next(error);
    }
  };

  public obtenerEstado2FA = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuarioId = req.usuarioAutenticado?.sub;
      if (!usuarioId) throw new ErrorTokenInvalido();
      const estado = await this.casoUsoGestionar2FA.obtenerEstado(usuarioId);
      res.status(200).json(estado);
    } catch (error) {
      next(error);
    }
  };

  public iniciarConfiguracion2FA = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuarioId = req.usuarioAutenticado?.sub;
      if (!usuarioId) throw new ErrorTokenInvalido();
      const resultado = await this.casoUsoGestionar2FA.iniciarConfiguracion(usuarioId);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public confirmarActivacion2FA = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuarioId = req.usuarioAutenticado?.sub;
      if (!usuarioId) throw new ErrorTokenInvalido();
      const { codigo } = req.body as Confirmar2FADTO;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';

      const resultado = await this.casoUsoGestionar2FA.confirmarActivacion(
        usuarioId,
        codigo,
        direccionIp,
      );
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public desactivar2FA = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuarioId = req.usuarioAutenticado?.sub;
      if (!usuarioId) throw new ErrorTokenInvalido();
      const cuerpo = req.body as Desactivar2FADTO;
      const credencial = cuerpo.codigoRecuperacion?.trim() || cuerpo.contrasena?.trim() || '';
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';

      await this.casoUsoGestionar2FA.desactivar(usuarioId, credencial, direccionIp);
      res.clearCookie(NOMBRE_COOKIE_DISPOSITIVO, this.obtenerOpcionesCookie());
      res.status(200).json({ mensaje: 'Autenticación 2FA desactivada correctamente' });
    } catch (error) {
      next(error);
    }
  };

  public revocarDispositivo2FA = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuarioId = req.usuarioAutenticado?.sub;
      if (!usuarioId) throw new ErrorTokenInvalido();

      const validacion = esquemaParametroUuid.safeParse(req.params);
      if (!validacion.success) {
        res.status(400).json({
          error: {
            codigo: 'VALIDACION_FALLIDA',
            mensaje: validacion.error.issues[0]?.message || 'ID de dispositivo inválido',
          },
        });
        return;
      }

      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      await this.casoUsoGestionar2FA.revocarDispositivo(
        usuarioId,
        validacion.data.id,
        direccionIp,
      );
      res.status(200).json({ mensaje: 'Dispositivo confiable revocado' });
    } catch (error) {
      next(error);
    }
  };

  public renovarSesion = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tokenRefresh = extraerCookie(req.headers.cookie, NOMBRE_COOKIE_REFRESH);
      if (!tokenRefresh) {
        throw new ErrorTokenInvalido('No existe una sesión renovable activa');
      }

      const resultado = await this.casoUsoRenovarSesion.ejecutar(tokenRefresh);

      res.cookie(NOMBRE_COOKIE_REFRESH, resultado.tokenRefresh, {
        ...this.obtenerOpcionesCookie(req),
        maxAge: SIETE_DIAS_MS,
      });

      res.status(200).json({
        usuario: resultado.usuario,
        tokenAcceso: resultado.tokenAcceso,
        expiraEn: resultado.expiraEn,
      });
    } catch (error) {
      next(error);
    }
  };

  public cerrarSesion = (_req: Request, res: Response): void => {
    res.clearCookie(NOMBRE_COOKIE_REFRESH, this.obtenerOpcionesCookie());
    res.status(200).json({
      mensaje: 'Sesión cerrada correctamente',
    });
  };

  public obtenerPerfil = (req: Request, res: Response): void => {
    res.status(200).json({
      usuario: req.usuarioAutenticado,
    });
  };
}
