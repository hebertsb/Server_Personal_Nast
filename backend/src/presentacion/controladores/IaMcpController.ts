import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AsistenteIA } from '../../aplicacion/ia/AsistenteIA';
import { EjecutorHerramientasMcp } from '../../aplicacion/mcp/EjecutorHerramientasMcp';
import { GestionarTokensMcp } from '../../aplicacion/mcp/GestionarTokensMcp';

export const esquemaExplicarDespliegue = z.object({
  proyectoId: z.string().uuid('proyectoId inválido'),
  despliegueId: z.string().uuid('despliegueId inválido'),
});

export const esquemaConsultaIa = z.object({
  pregunta: z.string({ error: 'La pregunta es obligatoria' }).trim().min(2).max(500),
});

export const esquemaCrearTokenMcp = z.object({
  nombre: z.string({ error: 'El nombre del token es obligatorio' }).trim().min(2).max(120),
  permiso: z.enum(['lectura', 'escritura']).default('lectura'),
});

const esquemaUuid = z.string().uuid('Identificador inválido');

export class IaMcpController {
  constructor(
    private readonly asistenteIA: AsistenteIA,
    private readonly gestionarTokens: GestionarTokensMcp,
    private readonly ejecutorMcp: EjecutorHerramientasMcp,
  ) {}

  public explicarDespliegue = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { proyectoId, despliegueId } = req.body as z.infer<typeof esquemaExplicarDespliegue>;
      const explicacion = await this.asistenteIA.explicarFalloDespliegue(proyectoId, despliegueId);
      res.status(200).json({ explicacion });
    } catch (error) {
      next(error);
    }
  };

  public resumenSeguridad = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const resumen = await this.asistenteIA.generarResumenDiarioSeguridad();
      res.status(200).json({ resumen });
    } catch (error) {
      next(error);
    }
  };

  public consultar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { pregunta } = req.body as z.infer<typeof esquemaConsultaIa>;
      const resultado = await this.asistenteIA.consultarAsistente(pregunta);
      res.status(200).json({ resultado });
    } catch (error) {
      next(error);
    }
  };

  public listarTokensMcp = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tokens = await this.gestionarTokens.listarTokens();
      res.status(200).json({ tokens });
    } catch (error) {
      next(error);
    }
  };

  public crearTokenMcp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) {
        res.status(401).json({ error: { codigo: 'NO_AUTORIZADO', mensaje: 'Sin sesión' } });
        return;
      }
      const { nombre, permiso } = req.body as z.infer<typeof esquemaCrearTokenMcp>;
      const resultado = await this.gestionarTokens.crearToken(nombre, permiso, {
        usuarioId: u.sub,
        rol: u.rol,
        direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
      });
      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  };

  public revocarTokenMcp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const u = req.usuarioAutenticado;
      if (!u) {
        res.status(401).json({ error: { codigo: 'NO_AUTORIZADO', mensaje: 'Sin sesión' } });
        return;
      }
      const id = esquemaUuid.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: { codigo: 'VALIDACION_FALLIDA', mensaje: 'ID inválido' } });
        return;
      }
      await this.gestionarTokens.revocarToken(id.data, {
        usuarioId: u.sub,
        rol: u.rol,
        direccionIp: req.ip || req.socket.remoteAddress || 'desconocida',
      });
      res.status(200).json({ mensaje: 'Token MCP revocado' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Endpoint MCP sobre HTTP JSON-RPC 2.0 (/api/v1/mcp — RF-63 a RF-65).
   * Autenticado con Authorization: Bearer hs_mcp_...
   */
  public manejarJsonRpcMcp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const auth = req.header('authorization') ?? '';
      const tokenPlano = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      const token = await this.gestionarTokens.validarToken(tokenPlano);
      if (!token) {
        res.status(401).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32001, message: 'Token MCP inválido o revocado' },
        });
        return;
      }

      const body = (req.body ?? {}) as {
        id?: string | number | null;
        method?: string;
        params?: Record<string, unknown>;
      };
      const rpcId = body.id ?? null;

      // Notificaciones JSON-RPC 2.0 (ej. notifications/initialized) no llevan respuesta de cuerpo
      if (typeof body.method === 'string' && body.method.startsWith('notifications/')) {
        res.status(202).end();
        return;
      }

      if (body.method === 'ping') {
        res.status(200).json({ jsonrpc: '2.0', id: rpcId, result: {} });
        return;
      }

      if (body.method === 'initialize') {
        const versionCliente =
          typeof body.params?.protocolVersion === 'string'
            ? body.params.protocolVersion
            : '2025-03-26';
        res.status(200).json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            protocolVersion: versionCliente,
            serverInfo: { name: 'homesoc-mcp', version: '1.0.0' },
            capabilities: { tools: {} },
          },
        });
        return;
      }

      if (body.method === 'tools/list') {
        const herramientas = this.ejecutorMcp.listarHerramientas(token).map((h) => ({
          name: h.name,
          description: h.description,
          inputSchema: h.inputSchema,
        }));
        res.status(200).json({
          jsonrpc: '2.0',
          id: rpcId,
          result: { tools: herramientas },
        });
        return;
      }

      if (body.method === 'tools/call') {
        const nombre = String(body.params?.name ?? '');
        const args = (body.params?.arguments as Record<string, unknown>) ?? {};
        const direccionIp = req.ip || req.socket.remoteAddress || 'desconocida';
        const resultado = await this.ejecutorMcp.ejecutar(nombre, args, token, direccionIp);
        res.status(200).json({
          jsonrpc: '2.0',
          id: rpcId,
          result: {
            content: [{ type: 'text', text: JSON.stringify(resultado) }],
          },
        });
        return;
      }

      res.status(400).json({
        jsonrpc: '2.0',
        id: rpcId,
        error: { code: -32601, message: `Método MCP no soportado: ${String(body.method)}` },
      });
    } catch (error) {
      next(error);
    }
  };
}
