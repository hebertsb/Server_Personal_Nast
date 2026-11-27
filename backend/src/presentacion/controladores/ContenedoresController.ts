import { NextFunction, Request, Response } from 'express';
import { ControlarContenedor } from '../../aplicacion/contenedores/ControlarContenedor';
import { ListarContenedores } from '../../aplicacion/contenedores/ListarContenedores';
import { ObtenerLogsContenedor } from '../../aplicacion/contenedores/ObtenerLogsContenedor';
import { AccionContenedor } from '../../dominio/entidades/Contenedor';
import {
  esquemaConsultaLogs,
  esquemaParametroContenedor,
} from '../dto/ContenedorDTO';

export class ContenedoresController {
  constructor(
    private readonly casoUsoListar: ListarContenedores,
    private readonly casoUsoControlar: ControlarContenedor,
    private readonly casoUsoLogs: ObtenerLogsContenedor,
  ) {}

  public listar = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await this.casoUsoListar.ejecutar();
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public crearManejadorAccion(accion: AccionContenedor) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const validacionParam = esquemaParametroContenedor.safeParse(req.params);
        if (!validacionParam.success) {
          res.status(400).json({
            error: {
              codigo: 'VALIDACION_FALLIDA',
              mensaje: validacionParam.error.issues[0]?.message || 'Parámetro inválido',
            },
          });
          return;
        }

        const usuario = req.usuarioAutenticado;
        if (!usuario) {
          res.status(401).json({
            error: {
              codigo: 'NO_AUTORIZADO',
              mensaje: 'Se requiere autenticación',
            },
          });
          return;
        }

        const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
        const resultado = await this.casoUsoControlar.ejecutar({
          contenedorId: validacionParam.data.id,
          accion,
          usuarioId: usuario.sub,
          rolUsuario: usuario.rol,
          direccionIp,
        });

        res.status(200).json(resultado);
      } catch (error) {
        next(error);
      }
    };
  }

  public obtenerLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validacionParam = esquemaParametroContenedor.safeParse(req.params);
      if (!validacionParam.success) {
        res.status(400).json({
          error: {
            codigo: 'VALIDACION_FALLIDA',
            mensaje: validacionParam.error.issues[0]?.message || 'Identificador inválido',
          },
        });
        return;
      }

      const validacionQuery = esquemaConsultaLogs.safeParse(req.query);
      if (!validacionQuery.success) {
        res.status(400).json({
          error: {
            codigo: 'VALIDACION_FALLIDA',
            mensaje: validacionQuery.error.issues[0]?.message || 'Parámetro lineas inválido',
          },
        });
        return;
      }

      const resultado = await this.casoUsoLogs.ejecutar({
        contenedorId: validacionParam.data.id,
        lineas: validacionQuery.data.lineas,
      });

      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };
}
