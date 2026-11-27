import { NextFunction, Request, Response } from 'express';

export interface VerificadoresSalud {
  verificarPostgres: () => Promise<boolean>;
  verificarDocker: () => Promise<boolean>;
}

export class HealthController {
  constructor(private readonly verificadores: VerificadoresSalud) {}

  public verificarSalud = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const [postgresOk, dockerOk] = await Promise.all([
        this.verificadores.verificarPostgres(),
        this.verificadores.verificarDocker(),
      ]);

      const estado = !postgresOk ? 'error' : dockerOk ? 'ok' : 'degradado';
      const codigoHttp = postgresOk ? 200 : 503;

      res.status(codigoHttp).json({
        estado,
        dependencias: {
          postgresql: postgresOk ? 'conectado' : 'desconectado',
          docker: dockerOk ? 'conectado' : 'no_disponible',
        },
        marcaTiempo: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
