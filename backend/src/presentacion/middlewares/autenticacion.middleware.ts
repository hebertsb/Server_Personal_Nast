import { NextFunction, Request, Response } from 'express';
import { PayloadTokenAcceso, ServicioTokens } from '../../dominio/interfaces/ServicioTokens';

declare global {
  namespace Express {
    interface Request {
      usuarioAutenticado?: PayloadTokenAcceso;
    }
  }
}

/**
 * Middleware que valida el JWT Bearer en la cabecera Authorization
 * y adjunta la identidad del usuario a la solicitud.
 */
export function crearMiddlewareAutenticacion(servicioTokens: ServicioTokens) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
      req.usuarioAutenticado = servicioTokens.verificarTokenAcceso(token);
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
