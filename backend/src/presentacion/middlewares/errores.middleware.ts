import { NextFunction, Request, Response } from 'express';
import { Logger } from 'pino';
import { ErrorDominio } from '../../dominio/errores/ErroresAutenticacion';

/**
 * Manejador global de errores HTTP.
 * Nunca expone errores internos de PostgreSQL ni stack traces al cliente (RNF-SEC-02).
 */
export function crearMiddlewareErrores(logger: Logger) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (error instanceof ErrorDominio) {
      res.status(error.estadoHttp).json({
        error: {
          codigo: error.codigo,
          mensaje: error.message,
        },
      });
      return;
    }

    if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
      res.status(400).json({
        error: {
          codigo: 'JSON_INVALIDO',
          mensaje: 'El cuerpo de la solicitud no contiene un JSON válido',
        },
      });
      return;
    }

    logger.error(
      {
        err: error,
        metodo: req.method,
        ruta: req.originalUrl,
      },
      'Error no controlado en solicitud HTTP',
    );

    res.status(500).json({
      error: {
        codigo: 'ERROR_INTERNO',
        mensaje: 'Error interno del servidor',
      },
    });
  };
}
