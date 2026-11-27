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

export class GithubController {
  constructor(private readonly casoUso: GestionarConexionGithub) {}

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
      res.status(200).json({ conexion });
    } catch (error) {
      next(error);
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
