import { z } from 'zod';
import {
  HerramientaMcpDef,
  TokenMcpPersistido,
} from '../../dominio/entidades/IaYMcp';
import { ErrorPermisosInsuficientes } from '../../dominio/errores/ErroresContenedores';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';
import { ListarContenedores } from '../contenedores/ListarContenedores';
import { GestionarProyectosDespliegue } from '../despliegues/GestionarProyectosDespliegue';
import { AsistenteIA } from '../ia/AsistenteIA';
import { ObtenerRecursosHost } from '../recursos/ObtenerRecursosHost';
import { ConsultarSeguridad } from '../seguridad/ConsultarSeguridad';

const esquemaGuardarVarMcp = z.object({
  proyectoId: z.string().uuid('proyectoId inválido'),
  clave: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Clave de variable inválida'),
  valor: z.string().min(1).max(4096),
});

const esquemaConectarProyectoMcp = z.object({
  repoGithubId: z.coerce.number().int().positive(),
  nombreProyecto: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-zA-Z0-9_.-]+$/),
  nombreCompleto: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  rama: z.string().trim().min(1).max(100).default('main'),
  puerto: z.coerce.number().int().min(1024).max(65535),
  tipoProyecto: z.enum(['dockerfile', 'nodejs', 'html_estatico']).optional(),
  modoActualizacion: z.enum(['webhook', 'polling']).default('polling'),
  requiereAprobacion: z.boolean().default(false),
  desplegarAhora: z.boolean().default(false),
});

export const HERRAMIENTAS_MCP: HerramientaMcpDef[] = [
  {
    name: 'obtener_estado_servidor',
    description: 'Devuelve CPU, RAM, discos y resumen de contenedores del servidor HomeSOC.',
    permisoRequerido: 'lectura',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listar_contenedores',
    description: 'Lista los contenedores Docker actuales con estado, CPU y RAM (sin secretos).',
    permisoRequerido: 'lectura',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listar_eventos_seguridad',
    description: 'Devuelve los últimos eventos de seguridad del servidor.',
    permisoRequerido: 'lectura',
    inputSchema: {
      type: 'object',
      properties: { limite: { type: 'number', description: 'Máximo de eventos (default 15)' } },
    },
  },
  {
    name: 'listar_proyectos_despliegue',
    description: 'Lista los proyectos conectados desde GitHub (sin tokens ni variables de entorno).',
    permisoRequerido: 'lectura',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'obtener_historial_despliegues',
    description:
      'Devuelve el historial de despliegues de un proyecto con su estado, resultados del Gate de Seguridad y logs de construcción/health check para diagnosticar fallos.',
    permisoRequerido: 'lectura',
    inputSchema: {
      type: 'object',
      required: ['proyectoId'],
      properties: { proyectoId: { type: 'string' } },
    },
  },
  {
    name: 'resumen_seguridad_ia',
    description: 'Genera el resumen diario de seguridad en lenguaje natural (apto para voz).',
    permisoRequerido: 'lectura',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'consultar_asistente_voz',
    description: 'Responde una pregunta en lenguaje natural sobre HomeSOC con texto optimizado para voz.',
    permisoRequerido: 'lectura',
    inputSchema: {
      type: 'object',
      required: ['pregunta'],
      properties: { pregunta: { type: 'string' } },
    },
  },
  {
    name: 'listar_variables_proyecto',
    description:
      'Lista únicamente los nombres de claves (enmascaradas) de las variables de entorno de un proyecto. Nunca expone valores.',
    permisoRequerido: 'lectura',
    inputSchema: {
      type: 'object',
      required: ['proyectoId'],
      properties: { proyectoId: { type: 'string' } },
    },
  },
  {
    name: 'guardar_variable_proyecto',
    description:
      'Carga o actualiza una variable de entorno cifrada (AES-256-GCM) en modo solo escritura (write-only). Nunca devuelve el valor en texto plano.',
    permisoRequerido: 'escritura',
    inputSchema: {
      type: 'object',
      required: ['proyectoId', 'clave', 'valor'],
      properties: {
        proyectoId: { type: 'string' },
        clave: { type: 'string' },
        valor: { type: 'string' },
      },
    },
  },
  {
    name: 'conectar_proyecto_despliegue',
    description:
      'Registra un repositorio de GitHub en HomeSOC con auto-detección de stack y puerto asignado (requiere token escritura).',
    permisoRequerido: 'escritura',
    inputSchema: {
      type: 'object',
      required: ['repoGithubId', 'nombreProyecto', 'nombreCompleto', 'puerto'],
      properties: {
        repoGithubId: { type: 'number' },
        nombreProyecto: { type: 'string' },
        nombreCompleto: { type: 'string' },
        rama: { type: 'string' },
        puerto: { type: 'number' },
        tipoProyecto: { type: 'string', enum: ['dockerfile', 'nodejs', 'html_estatico'] },
        modoActualizacion: { type: 'string', enum: ['webhook', 'polling'] },
        requiereAprobacion: { type: 'boolean' },
        desplegarAhora: { type: 'boolean' },
      },
    },
  },
  {
    name: 'redeploy_proyecto',
    description:
      'Ejecuta un redeploy de un proyecto conectado respetando el Gate de Seguridad y aprobación manual (requiere token escritura).',
    permisoRequerido: 'escritura',
    inputSchema: {
      type: 'object',
      required: ['proyectoId'],
      properties: { proyectoId: { type: 'string' } },
    },
  },
];

/**
 * Ejecutor MCP (RF-63 a RF-65): invoca exclusivamente casos de uso de la capa de Aplicación,
 * separa permisos lectura/escritura, jamás expone secretos y audita con origen='mcp'.
 */
export class EjecutorHerramientasMcp {
  constructor(
    private readonly casoUsoRecursos: ObtenerRecursosHost,
    private readonly casoUsoContenedores: ListarContenedores,
    private readonly casoUsoSeguridad: ConsultarSeguridad,
    private readonly casoUsoProyectos: GestionarProyectosDespliegue,
    private readonly asistenteIA: AsistenteIA,
    private readonly auditoria: RepositorioAuditoria,
  ) {}

  public listarHerramientas(token: TokenMcpPersistido): HerramientaMcpDef[] {
    if (token.permiso === 'escritura') return HERRAMIENTAS_MCP;
    return HERRAMIENTAS_MCP.filter((h) => h.permisoRequerido === 'lectura');
  }

  public async ejecutar(
    nombreHerramienta: string,
    argumentos: Record<string, unknown>,
    token: TokenMcpPersistido,
    direccionIp: string,
  ): Promise<unknown> {
    const def = HERRAMIENTAS_MCP.find((h) => h.name === nombreHerramienta);
    if (!def) {
      throw new Error(`Herramienta MCP desconocida: ${nombreHerramienta}`);
    }

    if (def.permisoRequerido === 'escritura' && token.permiso !== 'escritura') {
      throw new ErrorPermisosInsuficientes();
    }

    let resultado: unknown;
    switch (nombreHerramienta) {
      case 'obtener_estado_servidor': {
        const recursos = await this.casoUsoRecursos.ejecutar({ persistir: false });
        const conts = await this.casoUsoContenedores.ejecutar();
        resultado = {
          cpuPorcentaje: recursos.porcentajeCpu,
          ramPorcentaje: recursos.porcentajeRam,
          ramUsadaMb: recursos.ramUsadaMb,
          ramTotalMb: recursos.ramTotalMb,
          discos: recursos.discos,
          contenedores: conts.resumen,
        };
        break;
      }
      case 'listar_contenedores': {
        const conts = await this.casoUsoContenedores.ejecutar();
        resultado = conts.contenedores.map((c) => ({
          idCorto: c.idCorto,
          nombre: c.nombre,
          imagen: c.imagen,
          estado: c.estado,
          porcentajeCpu: c.porcentajeCpu,
          ramUsadaMb: c.ramUsadaMb,
        }));
        break;
      }
      case 'listar_eventos_seguridad': {
        const limite = Math.min(50, Math.max(1, Number(argumentos.limite) || 15));
        resultado = await this.casoUsoSeguridad.obtenerEventos(limite);
        break;
      }
      case 'listar_proyectos_despliegue': {
        const proyectos = await this.casoUsoProyectos.listarProyectos();
        resultado = proyectos.map((p) => ({
          id: p.id,
          nombreProyecto: p.nombreProyecto,
          rama: p.rama,
          puerto: p.puerto,
          tipoProyecto: p.tipoProyecto,
          estadoActual: p.estadoActual,
          ultimoCommitSha: p.ultimoCommitSha,
        }));
        break;
      }
      case 'obtener_historial_despliegues': {
        const proyectoId = String(argumentos.proyectoId ?? '');
        resultado = await this.casoUsoProyectos.listarHistorial(proyectoId);
        break;
      }
      case 'resumen_seguridad_ia': {
        resultado = await this.asistenteIA.generarResumenDiarioSeguridad();
        break;
      }
      case 'consultar_asistente_voz': {
        const pregunta = String(argumentos.pregunta ?? '¿Cómo está el servidor?');
        resultado = await this.asistenteIA.consultarAsistente(pregunta);
        break;
      }
      case 'listar_variables_proyecto': {
        const proyectoId = String(argumentos.proyectoId ?? '');
        resultado = await this.casoUsoProyectos.listarVariables(proyectoId);
        break;
      }
      case 'guardar_variable_proyecto': {
        const validado = esquemaGuardarVarMcp.parse(argumentos);
        resultado = await this.casoUsoProyectos.guardarVariable(
          validado.proyectoId,
          validado.clave,
          validado.valor,
          {
            usuarioId: token.usuarioId,
            nombreUsuario: `mcp:${token.nombre}`,
            rol: 'administrador',
            direccionIp,
          },
        );
        break;
      }
      case 'conectar_proyecto_despliegue': {
        const validado = esquemaConectarProyectoMcp.parse(argumentos);
        resultado = await this.casoUsoProyectos.conectarProyecto(validado, {
          usuarioId: token.usuarioId,
          nombreUsuario: `mcp:${token.nombre}`,
          rol: 'administrador',
          direccionIp,
        });
        break;
      }
      case 'redeploy_proyecto': {
        const proyectoId = String(argumentos.proyectoId ?? '');
        resultado = await this.casoUsoProyectos.ejecutarDespliegue(
          proyectoId,
          {
            usuarioId: token.usuarioId,
            nombreUsuario: `mcp:${token.nombre}`,
            rol: 'administrador',
            direccionIp,
          },
          'mcp',
        );
        break;
      }
    }

    await this.auditoria.registrar({
      usuarioId: token.usuarioId,
      accion: `mcp_${nombreHerramienta}`,
      recurso: token.nombre,
      origen: 'mcp',
      direccionIp,
      detalles: { permiso: token.permiso },
    });

    return resultado;
  }
}
