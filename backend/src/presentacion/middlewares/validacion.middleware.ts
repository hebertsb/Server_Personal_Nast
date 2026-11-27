import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

/**
 * Middleware genérico de validación del cuerpo HTTP mediante esquemas Zod.
 * Rechaza datos inválidos con HTTP 400 antes de llegar al controlador.
 */
export function validarCuerpo(esquema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const resultado = esquema.safeParse(req.body);

    if (!resultado.success) {
      res.status(400).json({
        error: {
          codigo: 'VALIDACION_FALLIDA',
          mensaje: 'Los datos enviados no cumplen con el formato esperado',
          detalles: resultado.error.issues.map((issue) => ({
            campo: issue.path.join('.'),
            mensaje: issue.message,
          })),
        },
      });
      return;
    }

    req.body = resultado.data;
    next();
  };
}
