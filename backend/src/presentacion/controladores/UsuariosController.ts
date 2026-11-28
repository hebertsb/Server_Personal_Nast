import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { GestionarAccesoYUsuarios } from '../../aplicacion/autenticacion/GestionarAccesoYUsuarios';
import { MODULOS_SISTEMA, ModuloSistema } from '../../dominio/entidades/Usuario';
import { ErrorTokenInvalido } from '../../dominio/errores/ErroresAutenticacion';
import { esquemaParametroUuid } from '../dto/LoginDTO';

const esquemaModulo = z.enum(MODULOS_SISTEMA as [ModuloSistema, ...ModuloSistema[]]);

export const esquemaCrearInvitacion = z.object({
  rol: z.enum(['administrador', 'colaborador', 'solo_lectura']),
  permisosModulos: z.array(esquemaModulo).min(1, 'Debes seleccionar al menos un módulo'),
  expiraEnHoras: z.number().int().min(1).max(720).default(24),
  nota: z.string().trim().max(200).optional(),
});

export const esquemaActualizarPermisos = z.object({
  rol: z.enum(['superadmin', 'administrador', 'colaborador', 'solo_lectura']),
  permisosModulos: z.array(esquemaModulo).min(1, 'Debes seleccionar al menos un módulo'),
});

export const esquemaCambiarEstadoUsuario = z.object({
  activo: z.boolean(),
});

export const esquemaConfigEditor = z.object({
  url: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === '' || /^https?:\/\//i.test(v), {
      message: 'La URL debe comenzar con http:// o https://',
    }),
  rutaBase: z.string().trim().min(1).max(200).default('/home/coder/project'),
});

export const esquemaContactoUsuario = z.object({
  telegramChatId: z
    .string()
    .trim()
    .max(64)
    .regex(/^[0-9-]*$/, 'El Chat ID de Telegram solo debe contener números (o guión para grupos)')
    .default(''),
  whatsappNumero: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9+ ]*$/, 'El número de WhatsApp solo debe contener dígitos y opcionalmente +')
    .default(''),
});

export const esquemaPlanUsuario = z.object({
  planNombre: z.string().trim().min(2).max(40).default('basico'),
  cuotaRamMb: z.coerce.number().int().min(128).max(8192).default(512),
  cuotaCpu: z.coerce.number().min(0.25).max(8).default(0.75),
  maxProyectos: z.coerce.number().int().min(1).max(100).default(2),
  iaBasicaHabilitada: z.boolean().default(false),
});

/** Controlador HTTP para la gestión de usuarios, roles, permisos e invitaciones (Superadmin). */
export class UsuariosController {
  constructor(private readonly casoUso: GestionarAccesoYUsuarios) {}

  public listarUsuarios = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuarios = await this.casoUso.listarUsuarios();
      res.status(200).json({ usuarios });
    } catch (error) {
      next(error);
    }
  };

  public listarInvitaciones = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const invitaciones = await this.casoUso.listarInvitaciones();
      res.status(200).json({ invitaciones });
    } catch (error) {
      next(error);
    }
  };

  public crearInvitacion = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.usuarioAutenticado?.sub;
      if (!actorId) throw new ErrorTokenInvalido();
      const datos = req.body as z.infer<typeof esquemaCrearInvitacion>;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';

      const resultado = await this.casoUso.crearInvitacion({
        rol: datos.rol,
        permisosModulos: datos.permisosModulos,
        expiraEnHoras: datos.expiraEnHoras,
        nota: datos.nota ?? null,
        creadoPorId: actorId,
        direccionIp,
      });

      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public revocarInvitacion = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.usuarioAutenticado?.sub;
      if (!actorId) throw new ErrorTokenInvalido();
      const validacion = esquemaParametroUuid.safeParse(req.params);
      if (!validacion.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      await this.casoUso.revocarInvitacion(validacion.data.id, actorId, direccionIp);
      res.status(200).json({ mensaje: 'Invitación revocada correctamente' });
    } catch (error) {
      next(error);
    }
  };

  public actualizarPermisos = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.usuarioAutenticado?.sub;
      if (!actorId) throw new ErrorTokenInvalido();
      const validacion = esquemaParametroUuid.safeParse(req.params);
      if (!validacion.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const datos = req.body as z.infer<typeof esquemaActualizarPermisos>;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';

      const usuario = await this.casoUso.actualizarPermisosUsuario({
        usuarioId: validacion.data.id,
        rol: datos.rol,
        permisosModulos: datos.permisosModulos,
        actorId,
        direccionIp,
      });
      res.status(200).json({ usuario });
    } catch (error) {
      next(error);
    }
  };

  public cambiarEstado = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.usuarioAutenticado?.sub;
      if (!actorId) throw new ErrorTokenInvalido();
      const validacion = esquemaParametroUuid.safeParse(req.params);
      if (!validacion.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const datos = req.body as z.infer<typeof esquemaCambiarEstadoUsuario>;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';

      const usuario = await this.casoUso.cambiarEstadoUsuario({
        usuarioId: validacion.data.id,
        activo: datos.activo,
        actorId,
        direccionIp,
      });
      res.status(200).json({ usuario });
    } catch (error) {
      next(error);
    }
  };

  public revocarSesiones = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.usuarioAutenticado?.sub;
      if (!actorId) throw new ErrorTokenInvalido();
      const validacion = esquemaParametroUuid.safeParse(req.params);
      if (!validacion.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const resultado = await this.casoUso.revocarSesionesUsuario({
        usuarioId: validacion.data.id,
        actorId,
        direccionIp,
      });
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public obtenerConfigEditor = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const editor = await this.casoUso.obtenerConfigEditor();
      res.status(200).json({ editor });
    } catch (error) {
      next(error);
    }
  };

  public guardarConfigEditor = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuario = req.usuarioAutenticado;
      if (!usuario) throw new ErrorTokenInvalido();
      const datos = req.body as z.infer<typeof esquemaConfigEditor>;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const editor = await this.casoUso.guardarConfigEditor({
        url: datos.url,
        rutaBase: datos.rutaBase,
        actorId: usuario.sub,
        rol: usuario.rol,
        direccionIp,
      });
      res.status(200).json({ editor });
    } catch (error) {
      next(error);
    }
  };

  public listarDirectorio = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const directorio = await this.casoUso.listarDirectorioContacto();
      res.status(200).json({ directorio });
    } catch (error) {
      next(error);
    }
  };

  public actualizarContacto = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = req.usuarioAutenticado;
      if (!actor) throw new ErrorTokenInvalido();
      const validacion = esquemaParametroUuid.safeParse(req.params);
      if (!validacion.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const datos = req.body as z.infer<typeof esquemaContactoUsuario>;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const usuario = await this.casoUso.actualizarContactoUsuario({
        usuarioId: validacion.data.id,
        telegramChatId: datos.telegramChatId,
        whatsappNumero: datos.whatsappNumero,
        actorId: actor.sub,
        actorRol: actor.rol,
        direccionIp,
      });
      res.status(200).json({ usuario });
    } catch (error) {
      next(error);
    }
  };

  public actualizarPlan = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = req.usuarioAutenticado;
      if (!actor) throw new ErrorTokenInvalido();
      const validacion = esquemaParametroUuid.safeParse(req.params);
      if (!validacion.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const datos = req.body as z.infer<typeof esquemaPlanUsuario>;
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const usuario = await this.casoUso.actualizarPlanUsuario({
        usuarioId: validacion.data.id,
        planNombre: datos.planNombre,
        cuotaRamMb: datos.cuotaRamMb,
        cuotaCpu: datos.cuotaCpu,
        maxProyectos: datos.maxProyectos,
        iaBasicaHabilitada: datos.iaBasicaHabilitada,
        actorId: actor.sub,
        actorRol: actor.rol,
        direccionIp,
      });
      res.status(200).json({ usuario });
    } catch (error) {
      next(error);
    }
  };
}
