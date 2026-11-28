import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { GestionarPortafolioProyectos } from '../../aplicacion/portafolio/GestionarPortafolioProyectos';

export const esquemaCrearProyectoPortafolio = z.object({
  nombre: z.string().trim().min(2, 'Nombre obligatorio').max(120),
  descripcion: z.string().trim().max(500).optional().default(''),
  prefijoContenedor: z.string().trim().max(80).optional().default(''),
  estado: z.enum(['en_desarrollo', 'en_produccion', 'pausado']).optional().default('en_desarrollo'),
  repositorioUrl: z.string().trim().max(300).optional().default(''),
});

export const esquemaCrearComponentePortafolio = z.object({
  tipo: z.enum(['sistema', 'landing', 'demo', 'api', 'bd', 'otro']).default('sistema'),
  nombre: z.string().trim().min(2, 'Nombre obligatorio').max(120),
  url: z.string().trim().max(300).optional().default(''),
  contenedorNombre: z.string().trim().max(120).optional().default(''),
  estadoManual: z.enum(['activo', 'pendiente', 'caido', 'en_progreso']).optional().default('activo'),
  responsable: z.string().trim().max(80).optional().default(''),
});

export const esquemaActualizarComponentePortafolio = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  url: z.string().trim().max(300).optional(),
  contenedorNombre: z.string().trim().max(120).optional(),
  estadoManual: z.enum(['activo', 'pendiente', 'caido', 'en_progreso']).optional(),
  responsable: z.string().trim().max(80).optional(),
});

export const esquemaCrearTareaPortafolio = z.object({
  titulo: z.string().trim().min(2, 'Título obligatorio').max(240),
  prioridad: z.enum(['alta', 'media', 'baja']).optional().default('media'),
  asignadoA: z.string().trim().max(80).optional().default(''),
});

export const esquemaActualizarTareaPortafolio = z.object({
  titulo: z.string().trim().min(2).max(240).optional(),
  estado: z.enum(['pendiente', 'en_progreso', 'completado']).optional(),
  prioridad: z.enum(['alta', 'media', 'baja']).optional(),
  asignadoA: z.string().trim().max(80).optional(),
});

const esquemaUuid = z.string().uuid('Identificador inválido');

function puedeEditarPortafolio(rol?: string): boolean {
  return rol === 'superadmin' || rol === 'administrador' || rol === 'colaborador';
}

export class PortafolioController {
  constructor(private readonly casoUso: GestionarPortafolioProyectos) {}

  public obtenerResumen = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resumen = await this.casoUso.obtenerResumenCompleto();
      res.status(200).json(resumen);
    } catch (error) {
      next(error);
    }
  };

  public autodetectar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u || !puedeEditarPortafolio(u.rol)) {
        res.status(403).json({ error: { codigo: 'PERMISOS_INSUFICIENTES', mensaje: 'Sin permisos de edición' } });
        return;
      }
      const resultado = await this.casoUso.autodetectarDesdeDocker(u.nombreUsuario);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public crearProyecto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u || !puedeEditarPortafolio(u.rol)) {
        res.status(403).json({ error: { codigo: 'PERMISOS_INSUFICIENTES', mensaje: 'Sin permisos de edición' } });
        return;
      }
      const body = req.body as z.infer<typeof esquemaCrearProyectoPortafolio>;
      const proyecto = await this.casoUso.crearProyecto({
        ...body,
        creadoPor: u.nombreUsuario,
      });
      res.status(201).json({ proyecto });
    } catch (error) {
      next(error);
    }
  };

  public eliminarProyecto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u || (u.rol !== 'superadmin' && u.rol !== 'administrador')) {
        res.status(403).json({ error: { codigo: 'PERMISOS_INSUFICIENTES', mensaje: 'Requiere administrador' } });
        return;
      }
      const id = esquemaUuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      await this.casoUso.eliminarProyecto(id.data);
      res.status(200).json({ mensaje: 'Proyecto eliminado del portafolio' });
    } catch (error) {
      next(error);
    }
  };

  public crearComponente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u || !puedeEditarPortafolio(u.rol)) {
        res.status(403).json({ error: { codigo: 'PERMISOS_INSUFICIENTES', mensaje: 'Sin permisos de edición' } });
        return;
      }
      const proyectoId = esquemaUuid.safeParse(req.params.id);
      if (!proyectoId.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID de proyecto inválido' } });
        return;
      }
      const body = req.body as z.infer<typeof esquemaCrearComponentePortafolio>;
      const componente = await this.casoUso.crearComponente(
        { proyectoId: proyectoId.data, ...body },
        u.nombreUsuario,
      );
      res.status(201).json({ componente });
    } catch (error) {
      next(error);
    }
  };

  public actualizarComponente = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u || !puedeEditarPortafolio(u.rol)) {
        res.status(403).json({ error: { codigo: 'PERMISOS_INSUFICIENTES', mensaje: 'Sin permisos de edición' } });
        return;
      }
      const compId = esquemaUuid.safeParse(req.params.compId);
      if (!compId.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const body = req.body as z.infer<typeof esquemaActualizarComponentePortafolio>;
      const componente = await this.casoUso.actualizarComponente(
        compId.data,
        body,
        u.nombreUsuario,
      );
      res.status(200).json({ componente });
    } catch (error) {
      next(error);
    }
  };

  public eliminarComponente = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u || !puedeEditarPortafolio(u.rol)) {
        res.status(403).json({ error: { codigo: 'PERMISOS_INSUFICIENTES', mensaje: 'Sin permisos de edición' } });
        return;
      }
      const compId = esquemaUuid.safeParse(req.params.compId);
      if (!compId.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      await this.casoUso.eliminarComponente(compId.data);
      res.status(200).json({ mensaje: 'Componente eliminado' });
    } catch (error) {
      next(error);
    }
  };

  public crearTarea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u || !puedeEditarPortafolio(u.rol)) {
        res.status(403).json({ error: { codigo: 'PERMISOS_INSUFICIENTES', mensaje: 'Sin permisos de edición' } });
        return;
      }
      const proyectoId = esquemaUuid.safeParse(req.params.id);
      if (!proyectoId.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID de proyecto inválido' } });
        return;
      }
      const body = req.body as z.infer<typeof esquemaCrearTareaPortafolio>;
      const tarea = await this.casoUso.crearTarea(
        { proyectoId: proyectoId.data, ...body },
        u.nombreUsuario,
      );
      res.status(201).json({ tarea });
    } catch (error) {
      next(error);
    }
  };

  public actualizarTarea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u || !puedeEditarPortafolio(u.rol)) {
        res.status(403).json({ error: { codigo: 'PERMISOS_INSUFICIENTES', mensaje: 'Sin permisos de edición' } });
        return;
      }
      const tareaId = esquemaUuid.safeParse(req.params.tareaId);
      if (!tareaId.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const body = req.body as z.infer<typeof esquemaActualizarTareaPortafolio>;
      const tarea = await this.casoUso.actualizarTarea(tareaId.data, body, u.nombreUsuario);
      res.status(200).json({ tarea });
    } catch (error) {
      next(error);
    }
  };

  public eliminarTarea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u || !puedeEditarPortafolio(u.rol)) {
        res.status(403).json({ error: { codigo: 'PERMISOS_INSUFICIENTES', mensaje: 'Sin permisos de edición' } });
        return;
      }
      const tareaId = esquemaUuid.safeParse(req.params.tareaId);
      if (!tareaId.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      await this.casoUso.eliminarTarea(tareaId.data);
      res.status(200).json({ mensaje: 'Pendiente eliminado' });
    } catch (error) {
      next(error);
    }
  };
}
