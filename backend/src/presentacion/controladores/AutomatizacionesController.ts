import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  ContextoAutomatizacion,
  GestionarAutomatizaciones,
} from '../../aplicacion/automatizaciones/GestionarAutomatizaciones';

const esquemaNombreContenedor = z
  .string({ error: 'El nombre del contenedor es obligatorio' })
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Nombre de contenedor inválido');

const esquemaHora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:MM)');

const esquemaDias = z
  .array(z.coerce.number().int().min(0).max(6))
  .min(1, 'Selecciona al menos un día');

const esquemaCanal = z.enum(['panel', 'telegram', 'email', 'webhook']).default('panel');

const baseRegla = {
  nombre: z.string({ error: 'El nombre es obligatorio' }).trim().min(3).max(140),
  descripcion: z.string().trim().max(400).default(''),
  canalNotificacion: esquemaCanal,
  habilitado: z.boolean().default(true),
};

export const esquemaReglaAutomatizacion = z.discriminatedUnion('tipo', [
  z.object({
    ...baseRegla,
    tipo: z.literal('horario'),
    configuracion: z.object({
      contenedorNombre: esquemaNombreContenedor,
      accion: z.enum(['iniciar', 'detener', 'reiniciar']),
      hora: esquemaHora,
      diasSemana: esquemaDias,
    }),
  }),
  z.object({
    ...baseRegla,
    tipo: z.literal('condicion'),
    configuracion: z.object({
      metrica: z.enum(['cpu_porcentaje', 'ram_porcentaje', 'disco_porcentaje', 'temperatura_c']),
      operador: z.enum(['>', '>=', '<', '<=']),
      umbral: z.coerce.number().min(1).max(120),
      duracionMinutos: z.coerce.number().int().min(1).max(120).default(5),
      cooldownMinutos: z.coerce.number().int().min(1).max(1440).default(15),
      accion: z.enum(['notificar', 'reiniciar_contenedor', 'pausar_no_criticos']),
      contenedorNombre: esquemaNombreContenedor.optional(),
      contenedoresNoCriticos: z.array(esquemaNombreContenedor).optional(),
    }),
  }),
  z.object({
    ...baseRegla,
    tipo: z.literal('auto_healing'),
    configuracion: z.object({
      contenedorNombre: esquemaNombreContenedor,
      maxReintentos: z.coerce.number().int().min(1).max(10).default(3),
      ventanaMinutos: z.coerce.number().int().min(1).max(120).default(15),
      cooldownMinutos: z.coerce.number().int().min(1).max(120).default(5),
    }),
  }),
  z.object({
    ...baseRegla,
    tipo: z.literal('limpieza_docker'),
    configuracion: z.object({
      umbralDiscoPorcentaje: z.coerce.number().min(50).max(99).optional(),
      hora: esquemaHora.optional(),
      diasSemana: z.array(z.coerce.number().int().min(0).max(6)).optional(),
      cooldownMinutos: z.coerce.number().int().min(5).max(10080).default(60),
    }),
  }),
  z.object({
    ...baseRegla,
    tipo: z.literal('heartbeat'),
    configuracion: z.object({
      urlServicioLocal: z.string().trim().url('URL local inválida').optional().or(z.literal('')),
      urlHeartbeatExterno: z
        .string()
        .trim()
        .url('URL de heartbeat externa inválida')
        .optional()
        .or(z.literal('')),
      intervaloMinutos: z.coerce.number().int().min(1).max(1440).default(5),
    }),
  }),
  z.object({
    ...baseRegla,
    tipo: z.literal('actualizaciones'),
    configuracion: z.object({
      verificarImagenesDocker: z.boolean().default(true),
      verificarSistemaOperativo: z.boolean().default(true),
      hora: esquemaHora.default('08:00'),
      diasSemana: esquemaDias.default([1]),
    }),
  }),
  z.object({
    ...baseRegla,
    tipo: z.literal('energia'),
    configuracion: z.object({
      umbralBateriaCritica: z.coerce.number().int().min(5).max(50).default(15),
      detenerContenedoresEnCritico: z.boolean().default(true),
      contenedoresNoCriticos: z.array(esquemaNombreContenedor).optional(),
      cooldownMinutos: z.coerce.number().int().min(1).max(120).default(5),
    }),
  }),
]);

export const esquemaToggleAutomatizacion = z.object({
  habilitado: z.boolean(),
});

export const esquemaSimularEnergia = z.object({
  enBateria: z.boolean(),
  porcentajeBateria: z.coerce.number().int().min(0).max(100),
});

const esquemaUuid = z.string().uuid('Identificador inválido');

export class AutomatizacionesController {
  constructor(
    private readonly casoUso: GestionarAutomatizaciones,
    private readonly esDesarrollo: boolean,
  ) {}

  private contexto(req: Request): ContextoAutomatizacion | null {
    const u = req.usuarioAutenticado;
    if (!u) return null;
    return {
      usuarioId: u.sub,
      rol: u.rol,
      direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
    };
  }

  private sinSesion(res: Response): void {
    res.status(401).json({
      error: { codigo: 'NO_AUTORIZADO', mensaje: 'Se requiere autenticación' },
    });
  }

  public listar = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const automatizaciones = await this.casoUso.listar();
      res.status(200).json({ automatizaciones });
    } catch (error) {
      next(error);
    }
  };

  public crear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const datos = req.body as z.infer<typeof esquemaReglaAutomatizacion>;
      const automatizacion = await this.casoUso.crear(datos, ctx);
      res.status(201).json({ automatizacion });
    } catch (error) {
      next(error);
    }
  };

  public actualizar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const id = esquemaUuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const datos = req.body as z.infer<typeof esquemaReglaAutomatizacion>;
      const automatizacion = await this.casoUso.actualizar(id.data, datos, ctx);
      res.status(200).json({ automatizacion });
    } catch (error) {
      next(error);
    }
  };

  public alternarEstado = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const id = esquemaUuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const { habilitado } = req.body as z.infer<typeof esquemaToggleAutomatizacion>;
      const automatizacion = await this.casoUso.alternarEstado(id.data, habilitado, ctx);
      res.status(200).json({ automatizacion });
    } catch (error) {
      next(error);
    }
  };

  public eliminar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const id = esquemaUuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      await this.casoUso.eliminar(id.data, ctx);
      res.status(200).json({ mensaje: 'Automatización eliminada correctamente' });
    } catch (error) {
      next(error);
    }
  };

  public ejecutarManual = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const id = esquemaUuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const log = await this.casoUso.ejecutarManualmente(id.data, ctx);
      res.status(200).json({ log });
    } catch (error) {
      next(error);
    }
  };

  public evaluarActivas = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const resultado = await this.casoUso.evaluarReglasActivas();
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public listarLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limite = Math.min(200, Math.max(1, Number(req.query.limite) || 50));
      const logs = await this.casoUso.listarLogs(limite);
      res.status(200).json({ logs });
    } catch (error) {
      next(error);
    }
  };

  public obtenerEnergia = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const energia = await this.casoUso.obtenerEstadoEnergia();
      res.status(200).json({ energia });
    } catch (error) {
      next(error);
    }
  };

  public simularEnergia = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.esDesarrollo) {
        res.status(403).json({
          error: {
            codigo: 'OPERACION_NO_PERMITIDA',
            mensaje: 'Simulación de energía disponible solo en entorno local de desarrollo',
          },
        });
        return;
      }
      const datos = req.body as z.infer<typeof esquemaSimularEnergia>;
      const energia = this.casoUso.simularEstadoEnergia(datos);
      res.status(200).json({ energia });
    } catch (error) {
      next(error);
    }
  };
}
