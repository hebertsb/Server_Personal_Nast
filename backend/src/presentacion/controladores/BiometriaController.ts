import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { GestionarBiometriaWebAuthn } from '../../aplicacion/autenticacion/GestionarBiometriaWebAuthn';
import { ErrorTokenInvalido } from '../../dominio/errores/ErroresAutenticacion';
import { esquemaParametroUuid } from '../dto/LoginDTO';

const NOMBRE_COOKIE_REFRESH = 'homesoc_refresh_token';
const UN_DIA_MS = 24 * 60 * 60 * 1000;

export const esquemaOpcionesLoginBiometrico = z.object({
  nombreUsuario: z.string().trim().max(100).optional(),
  tokenTemporal2FA: z.string().min(10).optional(),
});

export const esquemaVerificarRegistroBiometrico = z.object({
  respuesta: z.record(z.string(), z.unknown()),
  etiquetaDispositivo: z.string().trim().max(150).optional(),
});

export const esquemaVerificarLoginBiometrico = z.object({
  challengeId: z.string().min(10),
  respuesta: z.record(z.string(), z.unknown()),
  recordarSesionDias: z
    .number()
    .int()
    .refine((v) => v === 0 || v === 1 || v === 7 || v === 30)
    .optional()
    .default(7),
});

function extraerContextoWebAuthn(req: Request): { rpID: string; origin: string } {
  const originHeader = req.headers.origin;
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      return { rpID: parsed.hostname, origin: parsed.origin };
    } catch {
      // Fallback abajo
    }
  }
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
  const proto =
    (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
  const hostname = host.split(':')[0];
  return { rpID: hostname, origin: `${proto}://${host}` };
}

/** Controlador HTTP para registro y acceso biométrico WebAuthn (Huella / Face ID / Windows Hello). */
export class BiometriaController {
  constructor(
    private readonly casoUso: GestionarBiometriaWebAuthn,
    private readonly esProduccion: boolean,
  ) {}

  private obtenerOpcionesCookie(req: Request, dias?: number) {
    const esHttps = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
    const base = {
      httpOnly: true,
      secure: this.esProduccion && esHttps,
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
    };
    if (dias === 0) return base;
    return { ...base, maxAge: (dias && dias > 0 ? dias : 7) * UN_DIA_MS };
  }

  public listarCredenciales = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuarioId = req.usuarioAutenticado?.sub;
      if (!usuarioId) throw new ErrorTokenInvalido();
      const credenciales = await this.casoUso.listarCredenciales(usuarioId);
      res.status(200).json({ credenciales });
    } catch (error) {
      next(error);
    }
  };

  public opcionesRegistro = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuarioId = req.usuarioAutenticado?.sub;
      if (!usuarioId) throw new ErrorTokenInvalido();
      const { rpID, origin } = extraerContextoWebAuthn(req);
      const opciones = await this.casoUso.generarOpcionesRegistro({
        usuarioId,
        rpID,
        origin,
      });
      res.status(200).json({ opciones });
    } catch (error) {
      next(error);
    }
  };

  public verificarRegistro = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuarioId = req.usuarioAutenticado?.sub;
      if (!usuarioId) throw new ErrorTokenInvalido();
      const datos = req.body as z.infer<typeof esquemaVerificarRegistroBiometrico>;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';

      const credencial = await this.casoUso.verificarRegistro({
        usuarioId,
        respuesta: datos.respuesta as never,
        etiquetaDispositivo: datos.etiquetaDispositivo || 'Dispositivo biométrico',
        direccionIp,
      });
      res.status(201).json({ credencial });
    } catch (error) {
      next(error);
    }
  };

  public revocarCredencial = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuarioId = req.usuarioAutenticado?.sub;
      if (!usuarioId) throw new ErrorTokenInvalido();
      const validacion = esquemaParametroUuid.safeParse(req.params);
      if (!validacion.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      await this.casoUso.revocarCredencial({
        credencialId: validacion.data.id,
        usuarioId,
        direccionIp,
      });
      res.status(200).json({ mensaje: 'Dispositivo biométrico revocado' });
    } catch (error) {
      next(error);
    }
  };

  public opcionesLogin = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const datos = req.body as z.infer<typeof esquemaOpcionesLoginBiometrico>;
      const { rpID, origin } = extraerContextoWebAuthn(req);
      const resultado = await this.casoUso.generarOpcionesLogin({
        nombreUsuario: datos.nombreUsuario,
        tokenTemporal2FA: datos.tokenTemporal2FA,
        rpID,
        origin,
      });
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public verificarLogin = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const datos = req.body as z.infer<typeof esquemaVerificarLoginBiometrico>;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';

      const resultado = await this.casoUso.verificarLogin({
        challengeId: datos.challengeId,
        respuesta: datos.respuesta as never,
        direccionIp,
      });

      res.cookie(
        NOMBRE_COOKIE_REFRESH,
        resultado.tokenRefresh,
        this.obtenerOpcionesCookie(req, datos.recordarSesionDias),
      );

      res.status(200).json({
        usuario: resultado.usuario,
        tokenAcceso: resultado.tokenAcceso,
        expiraEn: resultado.expiraEn,
      });
    } catch (error) {
      next(error);
    }
  };
}
