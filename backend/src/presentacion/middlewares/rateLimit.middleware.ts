import { Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Logger } from 'pino';
import { NuevoEventoSeguridad } from '../../dominio/interfaces/RepositorioSeguridad2FA';

export type RegistradorEventoRateLimit = (evento: NuevoEventoSeguridad) => Promise<void>;

interface OpcionesLimitadorLogin {
  maxIntentos: number;
  ventanaMinutos: number;
  registrarEvento: RegistradorEventoRateLimit;
  logger: Logger;
}

interface OpcionesLimitadorApi {
  maxPorMinuto: number;
  registrarEvento: RegistradorEventoRateLimit;
  logger: Logger;
}

/**
 * Rate limiting para login y 2FA (RNF-SEC-07 y RNF-SEC-09).
 * Bloquea con HTTP 429 tras superar el umbral de intentos fallidos por IP
 * y registra el bloqueo como evento de seguridad de severidad alta.
 */
export function crearLimitadorLogin(opciones: OpcionesLimitadorLogin): RequestHandler {
  return rateLimit({
    windowMs: opciones.ventanaMinutos * 60 * 1000,
    limit: opciones.maxIntentos,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const ipOrigen = req.ip || req.socket.remoteAddress || 'desconocida';
      void opciones
        .registrarEvento({
          tipoEvento: 'rate_limit_login',
          ipOrigen,
          severidad: 'alta',
          detalles: {
            ruta: req.originalUrl,
            metodo: req.method,
            limite: opciones.maxIntentos,
            ventanaMinutos: opciones.ventanaMinutos,
          },
        })
        .catch((err) => {
          opciones.logger.warn({ err }, 'No se pudo registrar evento rate_limit_login');
        });

      res.status(429).json({
        error: {
          codigo: 'DEMASIADOS_INTENTOS',
          mensaje: `Demasiados intentos fallidos. Intenta nuevamente en ${opciones.ventanaMinutos} minutos.`,
        },
      });
    },
  });
}

/**
 * Rate limiting general de la API (RNF-SEC-08 y RNF-SEC-09).
 * Protege todos los endpoints /api/v1 contra abuso o scraping.
 */
export function crearLimitadorApiGeneral(opciones: OpcionesLimitadorApi): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: opciones.maxPorMinuto,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const ipOrigen = req.ip || req.socket.remoteAddress || 'desconocida';
      void opciones
        .registrarEvento({
          tipoEvento: 'rate_limit_api',
          ipOrigen,
          severidad: 'media',
          detalles: {
            ruta: req.originalUrl,
            metodo: req.method,
            limitePorMinuto: opciones.maxPorMinuto,
          },
        })
        .catch((err) => {
          opciones.logger.warn({ err }, 'No se pudo registrar evento rate_limit_api');
        });

      res.status(429).json({
        error: {
          codigo: 'LIMITE_SOLICITUDES_EXCEDIDO',
          mensaje: 'Has excedido el límite de solicitudes permitidas por minuto.',
        },
      });
    },
  });
}
