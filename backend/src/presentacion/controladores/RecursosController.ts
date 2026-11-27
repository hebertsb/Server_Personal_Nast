import { NextFunction, Request, Response } from 'express';
import { ObtenerHistoricoRecursos } from '../../aplicacion/recursos/ObtenerHistoricoRecursos';
import { ObtenerRecursosHost } from '../../aplicacion/recursos/ObtenerRecursosHost';
import { esquemaConsultaHistorico } from '../dto/RecursosDTO';

export class RecursosController {
  constructor(
    private readonly casoUsoObtenerActual: ObtenerRecursosHost,
    private readonly casoUsoObtenerHistorico: ObtenerHistoricoRecursos,
  ) {}

  public obtenerActual = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const recursos = await this.casoUsoObtenerActual.ejecutar({ persistir: false });
      res.status(200).json(recursos);
    } catch (error) {
      next(error);
    }
  };

  public obtenerHistorico = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validacion = esquemaConsultaHistorico.safeParse(req.query);
      if (!validacion.success) {
        res.status(400).json({
          error: {
            codigo: 'VALIDACION_FALLIDA',
            mensaje: 'El parámetro rango debe ser 1h, 24h o 7d',
          },
        });
        return;
      }

      const resultado = await this.casoUsoObtenerHistorico.ejecutar(validacion.data.rango);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };
}
