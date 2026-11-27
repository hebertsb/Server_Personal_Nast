import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  ContextoUsuarioGithub,
  GestionarConexionGithub,
} from '../../aplicacion/despliegues/GestionarConexionGithub';

/** Formato de Personal Access Token classic (ghp_...) o fine-grained/otros prefijos oficiales. */
export const esquemaConectarGithub = z.object({
  token: z
    .string({ error: 'El token de GitHub es obligatorio' })
    .trim()
    .min(20, 'Token demasiado corto')
    .max(255, 'Token demasiado largo')
    .regex(/^(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]+$/, 'Formato de token inválido'),
});

interface ConfigOAuthGithub {
  clientId: string;
  clientSecret: string;
}

interface EstadoOAuthPendiente {
  contexto: ContextoUsuarioGithub;
  originFrontend: string;
  redirectUri: string;
  expiraEn: number;
}

const TTL_ESTADO_OAUTH_MS = 10 * 60 * 1000;

export class GithubController {
  private readonly estadosOAuth = new Map<string, EstadoOAuthPendiente>();

  constructor(
    private readonly casoUso: GestionarConexionGithub,
    private readonly oauthConfig: ConfigOAuthGithub = { clientId: '', clientSecret: '' },
  ) {}

  private oauthHabilitado(): boolean {
    return Boolean(this.oauthConfig.clientId && this.oauthConfig.clientSecret);
  }

  private contexto(req: Request): ContextoUsuarioGithub | null {
    const usuario = req.usuarioAutenticado;
    if (!usuario) return null;
    return {
      usuarioId: usuario.sub,
      rol: usuario.rol,
      direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
    };
  }

  private sinSesion(res: Response): void {
    res.status(401).json({
      error: { codigo: 'NO_AUTORIZADO', mensaje: 'Se requiere autenticación' },
    });
  }

  public obtenerEstado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const conexion = await this.casoUso.obtenerEstado(ctx);
      res.status(200).json({
        conexion,
        oauthHabilitado: this.oauthHabilitado(),
      });
    } catch (error) {
      next(error);
    }
  };

  public iniciarOAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      if (!this.oauthHabilitado()) {
        res.status(400).json({
          error: {
            codigo: 'OAUTH_NO_CONFIGURADO',
            mensaje:
              'GitHub OAuth aún no está configurado en el servidor (faltan GITHUB_OAUTH_CLIENT_ID y GITHUB_OAUTH_CLIENT_SECRET).',
          },
        });
        return;
      }

      const originHeader = req.headers.origin;
      const proto =
        (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
      const originFrontend = originHeader || `${proto}://${host}`;
      const redirectUri = `${originFrontend.replace(/\/+$/, '')}/api/v1/github/oauth/callback`;

      const ahora = Date.now();
      for (const [k, v] of this.estadosOAuth.entries()) {
        if (v.expiraEn < ahora) this.estadosOAuth.delete(k);
      }

      const state = crypto.randomBytes(24).toString('base64url');
      this.estadosOAuth.set(state, {
        contexto: ctx,
        originFrontend: originFrontend.replace(/\/+$/, ''),
        redirectUri,
        expiraEn: ahora + TTL_ESTADO_OAUTH_MS,
      });

      const params = new URLSearchParams({
        client_id: this.oauthConfig.clientId,
        redirect_uri: redirectUri,
        scope: 'repo read:user',
        state,
      });

      res.status(200).json({
        urlAutorizacion: `https://github.com/login/oauth/authorize?${params.toString()}`,
      });
    } catch (error) {
      next(error);
    }
  };

  public callbackOAuth = async (req: Request, res: Response): Promise<void> => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const errorGh = typeof req.query.error === 'string' ? req.query.error : '';

    const pendiente = state ? this.estadosOAuth.get(state) : undefined;
    if (state) this.estadosOAuth.delete(state);

    const destinoBase = pendiente?.originFrontend || '';

    if (!pendiente || pendiente.expiraEn < Date.now()) {
      res.redirect(`${destinoBase}/servicios?oauth=error&motivo=estado_invalido`);
      return;
    }

    if (errorGh || !code) {
      res.redirect(
        `${destinoBase}/servicios?oauth=error&motivo=${encodeURIComponent(errorGh || 'cancelado')}`,
      );
      return;
    }

    try {
      const resp = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'HomeSOC/1.0',
        },
        body: JSON.stringify({
          client_id: this.oauthConfig.clientId,
          client_secret: this.oauthConfig.clientSecret,
          code,
          redirect_uri: pendiente.redirectUri,
        }),
      });

      const datos = (await resp.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!resp.ok || !datos.access_token) {
        res.redirect(
          `${destinoBase}/servicios?oauth=error&motivo=${encodeURIComponent(
            datos.error || 'token_no_recibido',
          )}`,
        );
        return;
      }

      await this.casoUso.conectar(datos.access_token, pendiente.contexto);
      res.redirect(`${destinoBase}/servicios?oauth=ok`);
    } catch {
      res.redirect(`${destinoBase}/servicios?oauth=error&motivo=error_interno`);
    }
  };

  public conectar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const { token } = req.body as z.infer<typeof esquemaConectarGithub>;
      const conexion = await this.casoUso.conectar(token, ctx);
      res.status(201).json({ conexion });
    } catch (error) {
      next(error);
    }
  };

  public desconectar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      await this.casoUso.desconectar(ctx);
      res.status(200).json({ mensaje: 'Cuenta de GitHub desconectada' });
    } catch (error) {
      next(error);
    }
  };

  public listarRepositorios = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const repositorios = await this.casoUso.listarRepositorios(ctx);
      res.status(200).json({ repositorios });
    } catch (error) {
      next(error);
    }
  };
}
