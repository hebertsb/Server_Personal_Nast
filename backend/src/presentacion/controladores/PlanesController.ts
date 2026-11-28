import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { GestionarPlanesYSuscripciones } from '../../aplicacion/planes/GestionarPlanesYSuscripciones';
import { ErrorTokenInvalido } from '../../dominio/errores/ErroresAutenticacion';
import { esquemaParametroUuid } from '../dto/LoginDTO';

export const esquemaPlanHosting = z.object({
  codigo: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, 'Usa minúsculas, números, guiones o guión bajo'),
  nombre: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().max(500).default(''),
  precioBs: z.coerce.number().min(0).max(100000).default(20),
  descuentoAnualPct: z.coerce.number().int().min(0).max(80).default(20),
  periodo: z.string().trim().min(1).max(30).default('mes'),
  cuotaRamMb: z.coerce.number().int().min(128).max(8192).default(512),
  cuotaCpu: z.coerce.number().min(0.25).max(8).default(0.5),
  maxProyectos: z.coerce.number().int().min(1).max(100).default(2),
  maxMiembros: z.coerce.number().int().min(1).max(50).default(5),
  iaBasicaHabilitada: z.boolean().default(false),
  beneficios: z.array(z.string().trim().min(1).max(180)).max(12).default([]),
  destacado: z.boolean().default(false),
  activo: z.boolean().default(true),
  orden: z.coerce.number().int().min(0).max(999).default(10),
});

export const esquemaConfigCobro = z.object({
  habilitarQr: z.coerce.boolean().default(true),
  habilitarTransferencia: z.coerce.boolean().default(true),
  habilitarEfectivo: z.coerce.boolean().default(true),
  banco: z.string().trim().max(200).optional().default(''),
  titular: z.string().trim().max(200).optional().default(''),
  numeroCuenta: z.string().trim().max(120).optional().default(''),
  qrImagenDataUrl: z
    .string()
    .max(1_200_000, 'La imagen QR es demasiado pesada (máx ~900 KB)')
    .refine(
      (v) => v === '' || /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(v),
      'La imagen QR debe ser PNG, JPG o WEBP',
    )
    .optional()
    .default(''),
  instrucciones: z.string().trim().max(1000).optional().default(''),
});

export const esquemaCrearSolicitud = z.object({
  planId: z.string().uuid('planId inválido'),
  cicloFacturacion: z.enum(['mensual', 'anual']).default('mensual'),
  metodoPago: z.enum(['qr', 'transferencia', 'efectivo']),
  referenciaPago: z.string().trim().max(200).default(''),
  notaCliente: z.string().trim().max(500).default(''),
});

export const esquemaRevisarSolicitud = z.object({
  decision: z.enum(['aprobada', 'rechazada']),
});

export const esquemaRecomendarPlanIa = z.object({
  nombre: z.string().trim().min(2).max(120).default('Plan Hosting'),
  cuotaRamMb: z.coerce.number().int().min(128).max(8192).default(512),
  cuotaCpu: z.coerce.number().min(0.25).max(8).default(0.5),
  maxProyectos: z.coerce.number().int().min(1).max(100).default(2),
  maxMiembros: z.coerce.number().int().min(1).max(50).default(5),
  iaBasicaHabilitada: z.boolean().default(false),
});

export const esquemaLeerQrOcr = z.object({
  imagenDataUrl: z
    .string()
    .min(30, 'Imagen inválida')
    .max(950_000, 'La imagen para OCR excede el tamaño máximo permitido')
    .refine(
      (v) => /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(v),
      'La imagen debe ser PNG, JPG o WEBP',
    ),
});

export const esquemaOfertaBanner = z.object({
  id: z.string().trim().min(1).max(80),
  etiqueta: z.string().trim().min(1).max(60),
  titulo: z.string().trim().min(2).max(140),
  subtitulo: z.string().trim().max(260).default(''),
  descuentoTexto: z.string().trim().max(40).default(''),
  temaVisual: z
    .enum(['azul_neon', 'fuego_naranja', 'esmeralda_soc', 'purpura_ia'])
    .default('azul_neon'),
  imagenFondoDataUrl: z
    .string()
    .max(950_000, 'La imagen de fondo del banner es demasiado pesada')
    .refine(
      (v) => v === '' || /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(v),
      'La imagen del banner debe ser PNG, JPG o WEBP',
    )
    .optional()
    .default(''),
  fechaFinIso: z.string().trim().max(60).optional().default(''),
  textoBoton: z.string().trim().max(50).default('Ver planes'),
  activa: z.coerce.boolean().default(true),
});

export const esquemaGuardarOfertas = z.object({
  ofertas: z.array(esquemaOfertaBanner).max(10),
});

export const esquemaSugerirOfertaIa = z.object({
  ocasion: z.string().trim().min(2).max(80).default('Black Friday'),
  descuentoPct: z.coerce.number().int().min(5).max(80).default(25),
});

export class PlanesController {
  constructor(private readonly casoUso: GestionarPlanesYSuscripciones) {}

  public listarPlanes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const esSuper = req.usuarioAutenticado?.rol === 'superadmin';
      const planes = await this.casoUso.listarPlanes(!esSuper);
      res.status(200).json({ planes });
    } catch (error) {
      next(error);
    }
  };

  /** Catálogo público de planes activos para mostrar en la pantalla de inicio/registro. */
  public listarPlanesPublicos = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const planes = await this.casoUso.listarPlanes(true);
      res.status(200).json({ planes });
    } catch (error) {
      next(error);
    }
  };

  public crearPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) throw new ErrorTokenInvalido();
      const body = req.body as z.infer<typeof esquemaPlanHosting>;
      const plan = await this.casoUso.crearPlan(body, {
        usuarioId: u.sub,
        rol: u.rol,
        direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
      });
      res.status(201).json({ plan });
    } catch (error) {
      next(error);
    }
  };

  public actualizarPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) throw new ErrorTokenInvalido();
      const valid = esquemaParametroUuid.safeParse(req.params);
      if (!valid.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const body = req.body as z.infer<typeof esquemaPlanHosting>;
      const plan = await this.casoUso.actualizarPlan(valid.data.id, body, {
        usuarioId: u.sub,
        rol: u.rol,
        direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
      });
      res.status(200).json({ plan });
    } catch (error) {
      next(error);
    }
  };

  public eliminarPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) throw new ErrorTokenInvalido();
      const valid = esquemaParametroUuid.safeParse(req.params);
      if (!valid.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      await this.casoUso.eliminarPlan(valid.data.id, {
        usuarioId: u.sub,
        rol: u.rol,
        direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
      });
      res.status(200).json({ mensaje: 'Plan eliminado' });
    } catch (error) {
      next(error);
    }
  };

  public obtenerConfigCobro = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const cobro = await this.casoUso.obtenerConfigCobro();
      res.status(200).json({ cobro });
    } catch (error) {
      next(error);
    }
  };

  public guardarConfigCobro = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) throw new ErrorTokenInvalido();
      const body = req.body as z.infer<typeof esquemaConfigCobro>;
      const cobro = await this.casoUso.guardarConfigCobro(body, {
        usuarioId: u.sub,
        rol: u.rol,
        direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
      });
      res.status(200).json({ cobro });
    } catch (error) {
      next(error);
    }
  };

  public listarSolicitudes = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) throw new ErrorTokenInvalido();
      const solicitudes = await this.casoUso.listarSolicitudes({ usuarioId: u.sub, rol: u.rol });
      res.status(200).json({ solicitudes });
    } catch (error) {
      next(error);
    }
  };

  public crearSolicitud = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) throw new ErrorTokenInvalido();
      const body = req.body as z.infer<typeof esquemaCrearSolicitud>;
      const solicitud = await this.casoUso.crearSolicitud(body, {
        usuarioId: u.sub,
        nombreUsuario: u.nombreUsuario,
        direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
      });
      res.status(201).json({ solicitud });
    } catch (error) {
      next(error);
    }
  };

  public revisarSolicitud = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) throw new ErrorTokenInvalido();
      const valid = esquemaParametroUuid.safeParse(req.params);
      if (!valid.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const { decision } = req.body as z.infer<typeof esquemaRevisarSolicitud>;
      const solicitud = await this.casoUso.revisarSolicitud(valid.data.id, decision, {
        usuarioId: u.sub,
        nombreUsuario: u.nombreUsuario,
        rol: u.rol,
        direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
      });
      res.status(200).json({ solicitud });
    } catch (error) {
      next(error);
    }
  };

  public cancelarSolicitud = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) throw new ErrorTokenInvalido();
      const valid = esquemaParametroUuid.safeParse(req.params);
      if (!valid.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const solicitud = await this.casoUso.cancelarMiSolicitud(valid.data.id, {
        usuarioId: u.sub,
        nombreUsuario: u.nombreUsuario,
      });
      res.status(200).json({ solicitud });
    } catch (error) {
      next(error);
    }
  };

  public recomendarPlanIa = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof esquemaRecomendarPlanIa>;
      const recomendacion = await this.casoUso.recomendarPlanConIA(body);
      res.status(200).json({ recomendacion });
    } catch (error) {
      next(error);
    }
  };

  public leerQrOcr = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { imagenDataUrl } = req.body as z.infer<typeof esquemaLeerQrOcr>;
      const datos = await this.casoUso.leerDatosQrConOcr(imagenDataUrl);
      res.status(200).json({ datos });
    } catch (error) {
      next(error);
    }
  };

  public listarOfertasPublicas = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ofertas = await this.casoUso.obtenerOfertasBanners(true);
      res.status(200).json({ ofertas });
    } catch (error) {
      next(error);
    }
  };

  public listarOfertasAdmin = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ofertas = await this.casoUso.obtenerOfertasBanners(false);
      res.status(200).json({ ofertas });
    } catch (error) {
      next(error);
    }
  };

  public guardarOfertas = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) throw new ErrorTokenInvalido();
      const { ofertas } = req.body as z.infer<typeof esquemaGuardarOfertas>;
      const guardadas = await this.casoUso.guardarOfertasBanners(ofertas, {
        usuarioId: u.sub,
        rol: u.rol,
        direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
      });
      res.status(200).json({ ofertas: guardadas });
    } catch (error) {
      next(error);
    }
  };

  public sugerirOfertaIa = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof esquemaSugerirOfertaIa>;
      const sugerencia = await this.casoUso.sugerirOfertaConIA(body);
      res.status(200).json({ sugerencia });
    } catch (error) {
      next(error);
    }
  };
}
