import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { GestionarAccesosProyecto } from '../../aplicacion/accesos/GestionarAccesosProyecto';

const esquemaConsultaAccesos = z.object({
  proyecto: z.string().trim().max(120).optional(),
  ventana: z.enum(['24h', '7d', '30d']).default('24h'),
  limite: z.coerce.number().int().min(1).max(200).default(40),
});

export const esquemaRegistrarAcceso = z.object({
  nombreProyecto: z
    .string({ error: 'El nombre del proyecto es obligatorio' })
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Nombre de proyecto inválido'),
  ipOrigen: z
    .string({ error: 'La IP de origen es obligatoria' })
    .trim()
    .min(3)
    .max(45)
    .regex(/^[0-9a-fA-F.:]+$/, 'IP de origen inválida'),
  ruta: z.string({ error: 'La ruta es obligatoria' }).trim().min(1).max(500),
  metodo: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  codigoEstado: z.coerce.number().int().min(100).max(599),
  userAgent: z.string().trim().max(500).default(''),
  pais: z.string().trim().max(40).optional(),
});

export class AccesosProyectoController {
  constructor(
    private readonly casoUsoAccesos: GestionarAccesosProyecto,
    private readonly esDesarrollo: boolean,
  ) {}

  public consultarAnalitica = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validacion = esquemaConsultaAccesos.safeParse(req.query);
      if (!validacion.success) {
        res.status(400).json({
          error: {
            codigo: 'VALIDACION_FALLIDA',
            mensaje: 'Parámetros de filtro inválidos',
          },
        });
        return;
      }

      const resultado = await this.casoUsoAccesos.consultarAnalitica(validacion.data);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public registrar = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const datos = req.body as z.infer<typeof esquemaRegistrarAcceso>;
      const solicitud = await this.casoUsoAccesos.registrar(datos);
      res.status(201).json({ solicitud });
    } catch (error) {
      next(error);
    }
  };

  public simular = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.esDesarrollo) {
        res.status(403).json({
          error: {
            codigo: 'OPERACION_NO_PERMITIDA',
            mensaje: 'Simulación disponible solo en desarrollo',
          },
        });
        return;
      }

      const insertados = await this.casoUsoAccesos.simularTraficoLocal();
      res.status(200).json({ insertados });
    } catch (error) {
      next(error);
    }
  };
}
