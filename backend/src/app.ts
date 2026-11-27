import cors from 'cors';
import express, { Express, Request } from 'express';
import helmet from 'helmet';
import { Logger } from 'pino';
import { crearMiddlewareErrores } from './presentacion/middlewares/errores.middleware';
import { crearRutas, DependenciasRutas } from './presentacion/rutas';

export interface OpcionesApp {
  corsOrigin: string;
  esProduccion?: boolean;
  logger: Logger;
  rutas: DependenciasRutas;
}

export function crearAplicacion(opciones: OpcionesApp): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      xFrameOptions: { action: 'sameorigin' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: opciones.esProduccion
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
    }),
  );
  app.use(
    cors({
      origin: opciones.corsOrigin,
      credentials: true,
    }),
  );
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as Request & { cuerpoCrudo?: Buffer }).cuerpoCrudo = buf;
      },
    }),
  );

  app.use(crearRutas(opciones.rutas));

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        codigo: 'RUTA_NO_ENCONTRADA',
        mensaje: 'El recurso solicitado no existe',
      },
    });
  });

  app.use(crearMiddlewareErrores(opciones.logger));

  return app;
}
