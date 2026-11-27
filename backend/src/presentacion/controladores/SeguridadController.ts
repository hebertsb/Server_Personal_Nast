import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { NotificarEvento } from '../../aplicacion/notificaciones/NotificarEvento';
import { ConsultarSeguridad } from '../../aplicacion/seguridad/ConsultarSeguridad';
import { DetectarFuerzaBruta } from '../../aplicacion/seguridad/DetectarFuerzaBruta';
import { GestionarBloqueoIps } from '../../aplicacion/seguridad/GestionarBloqueoIps';
import { EstadisticasPihole } from '../../dominio/entidades/EstadisticasPihole';
import { ErrorTokenInvalido } from '../../dominio/errores/ErroresAutenticacion';
import { Colector } from '../../dominio/interfaces/Colector';
import { RepositorioSeguridadRed } from '../../dominio/interfaces/RepositorioSeguridadRed';
import { ServicioTokens } from '../../dominio/interfaces/ServicioTokens';
import { ColectorAuthLog } from '../../infraestructura/sistema/ColectorAuthLog';

const esquemaLimite = z.object({
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

export const esquemaBloquearIp = z.object({
  direccionIp: z
    .string({ error: 'La dirección IP es obligatoria' })
    .trim()
    .min(3, 'Dirección IP inválida')
    .max(45, 'Dirección IP demasiado larga')
    .regex(/^[0-9a-fA-F.:]+$/, 'Formato de dirección IP inválido'),
  motivo: z
    .string({ error: 'El motivo de bloqueo es obligatorio' })
    .trim()
    .min(3, 'Especifica un motivo breve')
    .max(255, 'El motivo no puede superar 255 caracteres'),
});

export const esquemaActualizarNotificacion = z.object({
  tipoEvento: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Tipo de evento inválido'),
  canal: z.enum(['telegram', 'email', 'webhook']),
  destino: z.string().trim().max(255).default('chat_local_dev'),
  habilitado: z.boolean(),
});

const esquemaIdUuid = z.object({
  id: z.string().uuid('Identificador inválido'),
});

export class SeguridadController {
  constructor(
    private readonly casoUsoConsultar: ConsultarSeguridad,
    private readonly casoUsoFuerzaBruta: DetectarFuerzaBruta,
    private readonly casoUsoBloqueoIps: GestionarBloqueoIps,
    private readonly repositorioSeguridadRed: RepositorioSeguridadRed,
    private readonly notificarEvento: NotificarEvento,
    private readonly colectorAuthLog: ColectorAuthLog,
    private readonly colectorPihole: Colector<EstadisticasPihole>,
    private readonly esDesarrollo: boolean,
    private readonly servicioTokens: ServicioTokens,
  ) {}

  public listarEventos = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validacion = esquemaLimite.safeParse(req.query);
      if (!validacion.success) {
        res.status(400).json({
          error: {
            codigo: 'VALIDACION_FALLIDA',
            mensaje: 'El parámetro limite debe ser un entero entre 1 y 200',
          },
        });
        return;
      }

      const eventos = await this.casoUsoConsultar.obtenerEventos(validacion.data.limite);
      res.status(200).json({ eventos });
    } catch (error) {
      next(error);
    }
  };

  public listarAuditoria = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validacion = esquemaLimite.safeParse(req.query);
      if (!validacion.success) {
        res.status(400).json({
          error: {
            codigo: 'VALIDACION_FALLIDA',
            mensaje: 'El parámetro limite debe ser un entero entre 1 y 200',
          },
        });
        return;
      }

      const registros = await this.casoUsoConsultar.obtenerAuditoria(validacion.data.limite);
      res.status(200).json({ registros });
    } catch (error) {
      next(error);
    }
  };

  public obtenerEstadoSsh = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const resultado = await this.casoUsoFuerzaBruta.ejecutar({ registrarYNotificar: false });
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public analizarSsh = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const resultado = await this.casoUsoFuerzaBruta.ejecutar({ registrarYNotificar: true });
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public simularAtaqueSsh = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.esDesarrollo) {
        res.status(403).json({
          error: {
            codigo: 'OPERACION_NO_PERMITIDA',
            mensaje: 'La simulación solo está disponible en entorno de desarrollo',
          },
        });
        return;
      }

      const octeto = Math.floor(10 + Math.random() * 230);
      await this.colectorAuthLog.simularRafagaLocal(`198.51.100.${octeto}`);
      const resultado = await this.casoUsoFuerzaBruta.ejecutar({ registrarYNotificar: true });
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public listarIpsBloqueadas = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const ips = await this.casoUsoBloqueoIps.listar();
      res.status(200).json({ ips });
    } catch (error) {
      next(error);
    }
  };

  public bloquearIp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuario = req.usuarioAutenticado;
      if (!usuario) throw new ErrorTokenInvalido();

      const datos = req.body as z.infer<typeof esquemaBloquearIp>;
      const ipOrigenAdmin = req.ip || req.socket.remoteAddress || 'desconocida';

      const bloqueada = await this.casoUsoBloqueoIps.bloquear({
        direccionIp: datos.direccionIp,
        motivo: datos.motivo,
        usuarioId: usuario.sub,
        nombreUsuario: usuario.nombreUsuario,
        rolUsuario: usuario.rol,
        ipOrigenAdmin,
      });

      res.status(201).json({ ip: bloqueada });
    } catch (error) {
      next(error);
    }
  };

  public desbloquearIp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuario = req.usuarioAutenticado;
      if (!usuario) throw new ErrorTokenInvalido();

      const validacion = esquemaIdUuid.safeParse(req.params);
      if (!validacion.success) {
        res.status(400).json({
          error: {
            codigo: 'VALIDACION_FALLIDA',
            mensaje: 'Identificador inválido',
          },
        });
        return;
      }

      const ipOrigenAdmin = req.ip || req.socket.remoteAddress || 'desconocida';
      await this.casoUsoBloqueoIps.desbloquear({
        id: validacion.data.id,
        usuarioId: usuario.sub,
        rolUsuario: usuario.rol,
        ipOrigenAdmin,
      });

      res.status(200).json({ mensaje: 'Dirección IP desbloqueada' });
    } catch (error) {
      next(error);
    }
  };

  public listarAlertasEnviadas = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const [alertas, configuraciones] = await Promise.all([
        this.repositorioSeguridadRed.listarAlertasEnviadas(30),
        this.repositorioSeguridadRed.listarConfiguracionNotificaciones(),
      ]);
      res.status(200).json({ alertas, configuraciones });
    } catch (error) {
      next(error);
    }
  };

  public probarNotificacion = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const alerta = await this.notificarEvento.enviarPrueba('telegram');
      res.status(200).json({ alerta });
    } catch (error) {
      next(error);
    }
  };

  public actualizarConfiguracionNotificacion = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const usuario = req.usuarioAutenticado;
      if (!usuario) throw new ErrorTokenInvalido();
      if (usuario.rol !== 'superadmin' && usuario.rol !== 'administrador') {
        res.status(403).json({
          error: {
            codigo: 'PERMISOS_INSUFICIENTES',
            mensaje: 'Se requiere rol de administrador para modificar notificaciones',
          },
        });
        return;
      }
      const datos = req.body as z.infer<typeof esquemaActualizarNotificacion>;
      const configuracion =
        await this.repositorioSeguridadRed.actualizarConfiguracionNotificacion(datos);
      res.status(200).json({ configuracion });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Stream SSE en tiempo real (/api/v1/notificaciones/stream) para notificaciones en vivo en la PWA.
   * Valida el JWT desde Authorization Bearer o ?token= (EventSource nativo).
   */
  public streamNotificaciones = (req: Request, res: Response): void => {
    const authHeader = req.header('authorization');
    const tokenQuery = typeof req.query.token === 'string' ? req.query.token : '';
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : tokenQuery.trim();

    if (!token) {
      res.status(401).json({ error: { codigo: 'NO_AUTORIZADO', mensaje: 'Token requerido' } });
      return;
    }

    try {
      this.servicioTokens.verificarTokenAcceso(token);
    } catch {
      res.status(401).json({ error: { codigo: 'TOKEN_INVALIDO', mensaje: 'Token inválido' } });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: conectado\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const cancelarSuscripcion = this.notificarEvento.suscribirTiempoReal((alerta) => {
      res.write(`event: alerta\ndata: ${JSON.stringify(alerta)}\n\n`);
    });

    const keepAlive = setInterval(() => {
      res.write(': ping\n\n');
    }, 25_000);

    req.on('close', () => {
      clearInterval(keepAlive);
      cancelarSuscripcion();
    });
  };

  public obtenerEstadisticasPihole = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const estadisticas = await this.colectorPihole.recolectar();
      res.status(200).json(estadisticas);
    } catch (error) {
      next(error);
    }
  };
}
