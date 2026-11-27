import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  ContextoDespliegue,
  GestionarProyectosDespliegue,
} from '../../aplicacion/despliegues/GestionarProyectosDespliegue';
import { RepositorioSeguridad2FA } from '../../dominio/interfaces/RepositorioSeguridad2FA';
import { validarFirmaWebhookGithub } from '../../dominio/reglas/ValidadorWebhookGithub';

export const esquemaSimularPush = z.object({
  escenario: z.enum(['normal', 'gate_critico', 'fallo_healthcheck']).default('normal'),
  commitSha: z.string().trim().min(4).max(40).optional(),
});

export const esquemaDetectarProyecto = z.object({
  nombreCompleto: z
    .string({ error: 'El nombre completo del repositorio es obligatorio' })
    .trim()
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Formato esperado: propietario/repositorio'),
  rama: z.string().trim().min(1).max(100).default('main'),
  puerto: z.coerce.number().int().min(1024).max(65535).default(3000),
});

export const esquemaCrearProyecto = z.object({
  repoGithubId: z.coerce.number().int().positive(),
  nombreProyecto: z
    .string({ error: 'El nombre del proyecto es obligatorio' })
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, números, guiones y puntos'),
  nombreCompleto: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Formato esperado: propietario/repositorio'),
  rama: z.string().trim().min(1).max(100).default('main'),
  puerto: z.coerce.number().int().min(1024).max(65535),
  tipoProyecto: z.enum(['dockerfile', 'nodejs', 'html_estatico']).optional(),
  modoActualizacion: z.enum(['webhook', 'polling']).default('polling'),
  requiereAprobacion: z.boolean().default(false),
  ultimoCommitSha: z.string().trim().max(40).nullable().optional(),
  desplegarAhora: z.boolean().default(true),
});

export const esquemaActualizarProyecto = z.object({
  rama: z.string().trim().min(1).max(100).optional(),
  puerto: z.coerce.number().int().min(1024).max(65535).optional(),
  modoActualizacion: z.enum(['webhook', 'polling']).optional(),
  requiereAprobacion: z.boolean().optional(),
});

export const esquemaGuardarVariable = z.object({
  clave: z
    .string({ error: 'La clave de la variable es obligatoria' })
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Usa formato de variable de entorno (ej. DATABASE_URL)'),
  valor: z
    .string({ error: 'El valor de la variable es obligatorio' })
    .min(1, 'El valor no puede estar vacío')
    .max(4096),
});

const esquemaUuid = z.string().uuid('Identificador inválido');

export class DesplieguesController {
  constructor(
    private readonly casoUso: GestionarProyectosDespliegue,
    private readonly repositorioSeguridad: RepositorioSeguridad2FA,
    private readonly webhookSecret: string,
    private readonly esDesarrollo: boolean,
  ) {}

  private contexto(req: Request): ContextoDespliegue | null {
    const u = req.usuarioAutenticado;
    if (!u) return null;
    return {
      usuarioId: u.sub,
      nombreUsuario: u.nombreUsuario,
      rol: u.rol,
      direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
    };
  }

  private sinSesion(res: Response): void {
    res.status(401).json({
      error: { codigo: 'NO_AUTORIZADO', mensaje: 'Se requiere autenticación' },
    });
  }

  public detectar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const { nombreCompleto, rama, puerto } = req.body as z.infer<typeof esquemaDetectarProyecto>;
      const deteccion = await this.casoUso.detectarProyecto(nombreCompleto, rama, puerto, ctx);
      res.status(200).json({ deteccion });
    } catch (error) {
      next(error);
    }
  };

  public listarProyectos = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const proyectos = await this.casoUso.listarProyectos();
      res.status(200).json({ proyectos });
    } catch (error) {
      next(error);
    }
  };

  public crearProyecto = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const datos = req.body as z.infer<typeof esquemaCrearProyecto>;
      const resultado = await this.casoUso.conectarProyecto(datos, ctx);
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public actualizarProyecto = async (
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
      const cambios = req.body as z.infer<typeof esquemaActualizarProyecto>;
      const proyecto = await this.casoUso.actualizarConfiguracion(id.data, cambios, ctx);
      res.status(200).json({ proyecto });
    } catch (error) {
      next(error);
    }
  };

  public eliminarProyecto = async (
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
      await this.casoUso.eliminarProyecto(id.data, ctx);
      res.status(200).json({ mensaje: 'Proyecto desconectado correctamente' });
    } catch (error) {
      next(error);
    }
  };

  public redeploy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const id = esquemaUuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const despliegue = await this.casoUso.ejecutarDespliegue(id.data, ctx, 'manual');
      res.status(201).json({ despliegue });
    } catch (error) {
      next(error);
    }
  };

  public listarHistorial = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = esquemaUuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const despliegues = await this.casoUso.listarHistorial(id.data);
      res.status(200).json({ despliegues });
    } catch (error) {
      next(error);
    }
  };

  public listarVariables = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = esquemaUuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const variables = await this.casoUso.listarVariables(id.data);
      res.status(200).json({ variables });
    } catch (error) {
      next(error);
    }
  };

  public guardarVariable = async (
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
      const { clave, valor } = req.body as z.infer<typeof esquemaGuardarVariable>;
      const variable = await this.casoUso.guardarVariable(id.data, clave, valor, ctx);
      res.status(201).json({ variable });
    } catch (error) {
      next(error);
    }
  };

  public eliminarVariable = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const id = esquemaUuid.safeParse(req.params.id);
      const varId = esquemaUuid.safeParse(req.params.varId);
      if (!id.success || !varId.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      await this.casoUso.eliminarVariable(id.data, varId.data, ctx);
      res.status(200).json({ mensaje: 'Variable eliminada correctamente' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Endpoint público de webhook de GitHub (/api/v1/webhooks/github — RF-32, RF-33).
   * Valida firma HMAC-SHA256; sin firma válida descarta y registra evento de seguridad.
   */
  public recibirWebhookGithub = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const firma = req.header('x-hub-signature-256');
      const evento = req.header('x-github-event') || 'push';
      const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
      const cuerpoCrudo =
        (req as Request & { cuerpoCrudo?: Buffer }).cuerpoCrudo ??
        Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');

      if (!validarFirmaWebhookGithub(cuerpoCrudo, firma, this.webhookSecret)) {
        await this.repositorioSeguridad.registrarEventoSeguridad({
          tipoEvento: 'webhook_github_firma_invalida',
          ipOrigen: direccionIp,
          severidad: 'alta',
          detalles: { evento, firmaPresente: Boolean(firma) },
        });
        res.status(401).json({
          error: {
            codigo: 'FIRMA_WEBHOOK_INVALIDA',
            mensaje: 'Firma HMAC de GitHub inválida o ausente',
          },
        });
        return;
      }

      if (evento === 'ping') {
        res.status(200).json({ mensaje: 'Webhook verificado correctamente' });
        return;
      }

      if (evento !== 'push') {
        res.status(202).json({ mensaje: `Evento "${evento}" ignorado` });
        return;
      }

      const cuerpo = req.body as {
        ref?: string;
        after?: string;
        repository?: { full_name?: string };
        head_commit?: { message?: string };
      };
      const nombreCompleto = cuerpo.repository?.full_name;
      const rama = cuerpo.ref?.replace(/^refs\/heads\//, '') ?? '';
      const commitSha = cuerpo.after ?? '';

      if (!nombreCompleto || !rama || !commitSha) {
        res.status(400).json({
          error: { codigo: 'PAYLOAD_INCOMPLETO', mensaje: 'Payload de push incompleto' },
        });
        return;
      }

      const resultado = await this.casoUso.procesarWebhookPush({
        nombreCompleto,
        rama,
        commitSha,
        mensajeCommit: cuerpo.head_commit?.message,
        direccionIp,
      });

      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public aprobarDespliegue = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const id = esquemaUuid.safeParse(req.params.id);
      const despId = esquemaUuid.safeParse(req.params.despliegueId);
      if (!id.success || !despId.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const despliegue = await this.casoUso.aprobarDesplieguePendiente(id.data, despId.data, ctx);
      res.status(201).json({ despliegue });
    } catch (error) {
      next(error);
    }
  };

  public revertirDespliegue = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const id = esquemaUuid.safeParse(req.params.id);
      const despId = esquemaUuid.safeParse(req.params.despliegueId);
      if (!id.success || !despId.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const despliegue = await this.casoUso.revertirADespliegue(id.data, despId.data, ctx);
      res.status(201).json({ despliegue });
    } catch (error) {
      next(error);
    }
  };

  public ejecutarPolling = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const resultado = await this.casoUso.ejecutarCicloPolling(ctx);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public simularPush = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.esDesarrollo) {
        res.status(403).json({
          error: {
            codigo: 'OPERACION_NO_PERMITIDA',
            mensaje: 'Simulación disponible solo en entorno de desarrollo',
          },
        });
        return;
      }
      const ctx = this.contexto(req);
      if (!ctx) return this.sinSesion(res);
      const id = esquemaUuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      const { escenario, commitSha } = req.body as z.infer<typeof esquemaSimularPush>;
      const sha = commitSha || `sim${Date.now().toString(16).slice(-4)}`;
      const despliegue = await this.casoUso.ejecutarDespliegue(id.data, ctx, 'webhook', {
        commitSha: sha,
        simularHallazgoCritico: escenario === 'gate_critico',
        simularFalloHealthCheck: escenario === 'fallo_healthcheck',
      });
      res.status(201).json({ despliegue });
    } catch (error) {
      next(error);
    }
  };
}
