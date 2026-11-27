import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ModuloSistema, PERMISOS_POR_DEFECTO_ROL } from '../../dominio/entidades/Usuario';
import { RepositorioUsuarios } from '../../dominio/interfaces/RepositorioUsuarios';
import { PayloadTokenAcceso, ServicioTokens } from '../../dominio/interfaces/ServicioTokens';

declare global {
  namespace Express {
    interface Request {
      usuarioAutenticado?: PayloadTokenAcceso;
    }
  }
}

/**
 * Middleware que valida el JWT Bearer en la cabecera Authorization,
 * verifica en vivo si el usuario sigue activo y con sesión vigente (cuando hay repositorio)
 * y adjunta la identidad + permisos actualizados del usuario a la solicitud.
 */
export function crearMiddlewareAutenticacion(
  servicioTokens: ServicioTokens,
  repositorioUsuarios?: RepositorioUsuarios,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const cabeceraAutorizacion = req.headers.authorization;

    if (!cabeceraAutorizacion || !cabeceraAutorizacion.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          codigo: 'NO_AUTORIZADO',
          mensaje: 'Se requiere un token de acceso válido',
        },
      });
      return;
    }

    const token = cabeceraAutorizacion.slice('Bearer '.length).trim();

    if (!token) {
      res.status(401).json({
        error: {
          codigo: 'NO_AUTORIZADO',
          mensaje: 'Se requiere un token de acceso válido',
        },
      });
      return;
    }

    try {
      const payload = servicioTokens.verificarTokenAcceso(token);

      if (repositorioUsuarios) {
        const usuario = await repositorioUsuarios.buscarPorId(payload.sub);
        if (!usuario || !usuario.activo) {
          res.status(401).json({
            error: {
              codigo: 'CUENTA_INACTIVA',
              mensaje: 'Tu cuenta está suspendida o ya no existe',
            },
          });
          return;
        }
        if (
          payload.versionSesion !== undefined &&
          payload.versionSesion !== usuario.versionSesion
        ) {
          res.status(401).json({
            error: {
              codigo: 'SESION_REVOCADA',
              mensaje: 'Tu sesión fue revocada. Vuelve a iniciar sesión.',
            },
          });
          return;
        }
        req.usuarioAutenticado = {
          ...payload,
          rol: usuario.rol,
          permisosModulos: usuario.permisosModulos,
          versionSesion: usuario.versionSesion,
        };
      } else {
        req.usuarioAutenticado = payload;
      }

      next();
    } catch {
      res.status(401).json({
        error: {
          codigo: 'TOKEN_INVALIDO',
          mensaje: 'Token de acceso inválido o expirado',
        },
      });
    }
  };
}

/** Middleware que exige acceso al módulo indicado (Superadmin siempre autorizado). */
export function requerirModulo(modulo: ModuloSistema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const usuario = req.usuarioAutenticado;
    if (!usuario) {
      res.status(401).json({
        error: { codigo: 'NO_AUTORIZADO', mensaje: 'Se requiere autenticación' },
      });
      return;
    }
    if (usuario.rol === 'superadmin') {
      next();
      return;
    }
    const permisos = usuario.permisosModulos ?? PERMISOS_POR_DEFECTO_ROL[usuario.rol] ?? [];
    if (!permisos.includes(modulo)) {
      res.status(403).json({
        error: {
          codigo: 'PERMISO_DENEGADO',
          mensaje: `No tienes permiso para acceder al módulo "${modulo}"`,
        },
      });
      return;
    }
    next();
  };
}

/** Middleware que restringe un endpoint exclusivamente al rol Superadmin. */
export const requerirSuperadmin: RequestHandler = (req, res, next) => {
  const usuario = req.usuarioAutenticado;
  if (!usuario || usuario.rol !== 'superadmin') {
    res.status(403).json({
      error: {
        codigo: 'SOLO_SUPERADMIN',
        mensaje: 'Esta acción está reservada únicamente para el Superadmin',
      },
    });
    return;
  }
  next();
};
