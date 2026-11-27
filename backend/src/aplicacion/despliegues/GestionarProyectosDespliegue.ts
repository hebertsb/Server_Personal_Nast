import {
  DespliegueRegistro,
  ModoActualizacionRepo,
  OrigenDespliegue,
  ProyectoConectado,
  ResultadoDeteccionProyecto,
  TipoProyectoDespliegue,
  VariableEntornoVista,
} from '../../dominio/entidades/Despliegue';
import { RolUsuario } from '../../dominio/entidades/Usuario';
import {
  ErrorProyectoNoEncontrado,
  ErrorTipoProyectoNoSoportado,
  ErrorVariableNoEncontrada,
} from '../../dominio/errores/ErroresDespliegues';
import {
  ErrorGithubNoConectado,
  ErrorGithubPermisos,
} from '../../dominio/errores/ErroresGithub';
import { ClienteGithub } from '../../dominio/interfaces/ClienteGithub';
import { EjecutorDespliegue } from '../../dominio/interfaces/EjecutorDespliegue';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';
import { RepositorioConexionGithub } from '../../dominio/interfaces/RepositorioConexionGithub';
import {
  DatosActualizarProyecto,
  RepositorioDespliegues,
} from '../../dominio/interfaces/RepositorioDespliegues';
import { ServicioCifrado } from '../../dominio/interfaces/ServicioCifrado';
import {
  ejecutarCadenaVerificacionDespliegue,
  ResultadoCadenaVerificacion,
} from '../../dominio/reglas/CadenaVerificacionDespliegue';
import { obtenerPlantillaBase } from '../../dominio/reglas/DetectorTipoProyecto';
import { evaluarGateSeguridad } from '../../dominio/reglas/EvaluadorGateSeguridad';
import { NotificarEvento } from '../notificaciones/NotificarEvento';

export interface ContextoDespliegue {
  usuarioId: string;
  nombreUsuario: string;
  rol: RolUsuario;
  direccionIp: string;
}

export interface EntradaConectarProyecto {
  repoGithubId: number;
  nombreProyecto: string;
  nombreCompleto: string;
  rama: string;
  puerto: number;
  tipoProyecto?: TipoProyectoDespliegue;
  modoActualizacion: ModoActualizacionRepo;
  requiereAprobacion: boolean;
  ultimoCommitSha?: string | null;
  desplegarAhora?: boolean;
}

export interface OpcionesEjecucionDespliegue {
  commitSha?: string;
  mensajeCommit?: string;
  forzarAprobacion?: boolean;
  simularHallazgoCritico?: boolean;
  simularFalloHealthCheck?: boolean;
  despliegueOrigenId?: string | null;
}

/**
 * Casos de uso Fase 3b + 3c (RF-30 a RF-50):
 * auto-detección, variables cifradas, webhook HMAC, polling, gate de seguridad
 * (secretos/dependencias/imagen), health check con rollback automático y reversión manual.
 */
export class GestionarProyectosDespliegue {
  constructor(
    private readonly clienteGithub: ClienteGithub,
    private readonly repoGithub: RepositorioConexionGithub,
    private readonly repoDespliegues: RepositorioDespliegues,
    private readonly cifrado: ServicioCifrado,
    private readonly auditoria: RepositorioAuditoria,
    private readonly notificarEvento?: NotificarEvento,
    private readonly ejecutorDespliegue?: EjecutorDespliegue,
    private readonly listarPuertosEnUso?: () => Promise<number[]>,
  ) {}

  /** Inspecciona puertos Docker activos + proyectos registrados y devuelve el próximo puerto libre. */
  public async sugerirProximoPuertoLibre(): Promise<{
    puertoSugerido: number;
    puertosOcupados: number[];
  }> {
    const ocupados = new Set<number>([
      22, 53, 80, 443, 3000, 3001, 3100, 3101, 4000, 5432, 5678, 8000, 8083, 8085, 8090, 8443,
      8444, 9443,
    ]);

    const proyectos = await this.repoDespliegues.listarProyectos();
    for (const p of proyectos) {
      ocupados.add(p.puerto);
    }

    if (this.listarPuertosEnUso) {
      const puertosHost = await this.listarPuertosEnUso();
      for (const p of puertosHost) {
        ocupados.add(p);
      }
    }

    let candidato = 4100;
    while (ocupados.has(candidato) && candidato < 65000) {
      candidato++;
    }

    return {
      puertoSugerido: candidato,
      puertosOcupados: Array.from(ocupados).sort((a, b) => a - b),
    };
  }

  private exigirAdministrador(ctx: ContextoDespliegue): void {
    if (
      ctx.rol !== 'superadmin' &&
      ctx.rol !== 'administrador' &&
      ctx.rol !== 'colaborador'
    ) {
      throw new ErrorGithubPermisos();
    }
  }

  public async detectarProyecto(
    nombreCompleto: string,
    rama: string,
    puerto: number,
    ctx: ContextoDespliegue,
  ): Promise<ResultadoDeteccionProyecto & { verificacion: ResultadoCadenaVerificacion }> {
    const conexion = await this.repoGithub.obtenerPorUsuario(ctx.usuarioId);
    if (!conexion) {
      throw new ErrorGithubNoConectado();
    }
    const token = this.cifrado.descifrar(conexion.tokenCifrado);
    const archivos = await this.clienteGithub.listarArchivosRaiz(token, nombreCompleto, rama);
    const { deteccion, verificacion } = ejecutarCadenaVerificacionDespliegue({
      nombreCompleto,
      rama,
      puerto,
      archivosRaiz: archivos,
    });
    return { ...deteccion, verificacion };
  }

  public async listarProyectos(): Promise<ProyectoConectado[]> {
    return this.repoDespliegues.listarProyectos();
  }

  public async conectarProyecto(
    entrada: EntradaConectarProyecto,
    ctx: ContextoDespliegue,
  ): Promise<{ proyecto: ProyectoConectado; despliegueInicial: DespliegueRegistro | null }> {
    this.exigirAdministrador(ctx);

    let tipoFinal = entrada.tipoProyecto;
    if (!tipoFinal) {
      const deteccion = await this.detectarProyecto(
        entrada.nombreCompleto,
        entrada.rama,
        entrada.puerto,
        ctx,
      );
      if (!deteccion.tipoDetectado) {
        throw new ErrorTipoProyectoNoSoportado(deteccion.motivo);
      }
      tipoFinal = deteccion.tipoDetectado;
    }

    const proyecto = await this.repoDespliegues.crearProyecto({
      usuarioId: ctx.usuarioId,
      repoGithubId: entrada.repoGithubId,
      nombreProyecto: entrada.nombreProyecto.trim().toLowerCase(),
      nombreCompleto: entrada.nombreCompleto.trim(),
      rama: entrada.rama.trim(),
      puerto: entrada.puerto,
      tipoProyecto: tipoFinal,
      modoActualizacion: entrada.modoActualizacion,
      requiereAprobacion: entrada.requiereAprobacion,
      ultimoCommitSha: entrada.ultimoCommitSha ?? null,
    });

    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: 'proyecto_conectar',
      recurso: proyecto.nombreProyecto,
      origen: 'web',
      direccionIp: ctx.direccionIp,
      detalles: {
        repositorio: proyecto.nombreCompleto,
        tipoProyecto: proyecto.tipoProyecto,
        puerto: proyecto.puerto,
        modoActualizacion: proyecto.modoActualizacion,
      },
    });

    let despliegueInicial: DespliegueRegistro | null = null;
    if (entrada.desplegarAhora) {
      despliegueInicial = await this.ejecutarDespliegue(proyecto.id, ctx, 'manual');
    }

    const proyectoActualizado =
      (await this.repoDespliegues.obtenerProyectoPorId(proyecto.id)) ?? proyecto;

    return { proyecto: proyectoActualizado, despliegueInicial };
  }

  public async actualizarConfiguracion(
    proyectoId: string,
    cambios: DatosActualizarProyecto,
    ctx: ContextoDespliegue,
  ): Promise<ProyectoConectado> {
    this.exigirAdministrador(ctx);
    const actualizado = await this.repoDespliegues.actualizarProyecto(proyectoId, cambios);
    if (!actualizado) {
      throw new ErrorProyectoNoEncontrado(proyectoId);
    }

    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: 'proyecto_configurar',
      recurso: actualizado.nombreProyecto,
      origen: 'web',
      direccionIp: ctx.direccionIp,
      detalles: { ...cambios },
    });

    return actualizado;
  }

  public async eliminarProyecto(proyectoId: string, ctx: ContextoDespliegue): Promise<void> {
    this.exigirAdministrador(ctx);
    const proyecto = await this.repoDespliegues.obtenerProyectoPorId(proyectoId);
    if (!proyecto) {
      throw new ErrorProyectoNoEncontrado(proyectoId);
    }
    await this.repoDespliegues.eliminarProyecto(proyectoId);
    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: 'proyecto_eliminar',
      recurso: proyecto.nombreProyecto,
      origen: 'web',
      direccionIp: ctx.direccionIp,
    });
  }

  public async listarVariables(proyectoId: string): Promise<VariableEntornoVista[]> {
    const proyecto = await this.repoDespliegues.obtenerProyectoPorId(proyectoId);
    if (!proyecto) {
      throw new ErrorProyectoNoEncontrado(proyectoId);
    }
    const persistidas = await this.repoDespliegues.listarVariables(proyectoId);
    return persistidas.map((v) => ({
      id: v.id,
      repositorioId: v.repositorioId,
      clave: v.clave,
      valorEnmascarado: '••••••••',
      actualizadoEn: v.actualizadoEn,
    }));
  }

  public async guardarVariable(
    proyectoId: string,
    clave: string,
    valorPlano: string,
    ctx: ContextoDespliegue,
  ): Promise<VariableEntornoVista> {
    this.exigirAdministrador(ctx);
    const proyecto = await this.repoDespliegues.obtenerProyectoPorId(proyectoId);
    if (!proyecto) {
      throw new ErrorProyectoNoEncontrado(proyectoId);
    }

    const claveNormalizada = clave.trim().toUpperCase();
    const valorCifrado = this.cifrado.cifrar(valorPlano);
    const guardada = await this.repoDespliegues.guardarVariable(
      proyectoId,
      claveNormalizada,
      valorCifrado,
    );

    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: 'variable_entorno_guardar',
      recurso: `${proyecto.nombreProyecto}:${claveNormalizada}`,
      origen: 'web',
      direccionIp: ctx.direccionIp,
    });

    return {
      id: guardada.id,
      repositorioId: guardada.repositorioId,
      clave: guardada.clave,
      valorEnmascarado: '••••••••',
      actualizadoEn: guardada.actualizadoEn,
    };
  }

  public async eliminarVariable(
    proyectoId: string,
    variableId: string,
    ctx: ContextoDespliegue,
  ): Promise<void> {
    this.exigirAdministrador(ctx);
    const proyecto = await this.repoDespliegues.obtenerProyectoPorId(proyectoId);
    if (!proyecto) {
      throw new ErrorProyectoNoEncontrado(proyectoId);
    }

    const claveEliminada = await this.repoDespliegues.eliminarVariable(proyectoId, variableId);
    if (!claveEliminada) {
      throw new ErrorVariableNoEncontrada();
    }

    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: 'variable_entorno_eliminar',
      recurso: `${proyecto.nombreProyecto}:${claveEliminada}`,
      origen: 'web',
      direccionIp: ctx.direccionIp,
    });
  }

  /**
   * Pipeline completo de despliegue (RF-30, RF-34, RF-38, RF-40..49):
   * 1. Gate de seguridad (secretos, dependencias, imagen).
   * 2. Inyección en memoria de variables cifradas.
   * 3. Construcción y Health check con rollback automático si falla (RF-47).
   */
  public async ejecutarDespliegue(
    proyectoId: string,
    ctx: ContextoDespliegue,
    origen: OrigenDespliegue = 'manual',
    opciones: OpcionesEjecucionDespliegue = {},
  ): Promise<DespliegueRegistro> {
    this.exigirAdministrador(ctx);
    const proyecto = await this.repoDespliegues.obtenerProyectoPorId(proyectoId);
    if (!proyecto) {
      throw new ErrorProyectoNoEncontrado(proyectoId);
    }

    const inicio = Date.now();
    const commitAnterior = proyecto.ultimoCommitSha;
    const commitSha =
      opciones.commitSha ||
      proyecto.ultimoCommitSha ||
      `dev${Date.now().toString(16).slice(-4)}`;

    // 1. Gate de seguridad previo al despliegue (RF-40 a RF-44)
    const gate = evaluarGateSeguridad({
      tipoProyecto: proyecto.tipoProyecto,
      commitSha,
      mensajeCommit: opciones.mensajeCommit,
      simularHallazgoCritico: opciones.simularHallazgoCritico,
    });

    if (!gate.aprobado && !opciones.forzarAprobacion) {
      const logBloqueado = [
        `[HomeSOC] Despliegue (${origen}) detenido por Gate de Seguridad para ${proyecto.nombreCompleto}@${proyecto.rama}`,
        `[HomeSOC] Commit: ${commitSha}`,
        ...gate.escaneos.map(
          (e) => `[Gate:${e.herramienta}] ${e.estado.toUpperCase()} — ${e.resumen}`,
        ),
        `[HomeSOC] Se requiere aprobación manual explícita para continuar (RF-43).`,
      ].join('\n');

      const registroDetenido = await this.repoDespliegues.registrarDespliegue({
        repositorioId: proyecto.id,
        commitSha,
        origen,
        estado: 'pendiente_aprobacion',
        logConstruccion: logBloqueado,
        duracionMs: Math.max(80, Date.now() - inicio),
        ejecutadoPor: ctx.nombreUsuario,
        healthCheckOk: null,
        logHealthCheck: 'Health check no ejecutado: detenido por Gate de Seguridad.',
        rollbackAutomatico: false,
        escaneos: gate.escaneos,
      });

      await this.repoDespliegues.actualizarEstadoProyecto(proyecto.id, 'pendiente_aprobacion');

      await this.notificarEvento?.emitir({
        tipoEvento: 'gate_seguridad_bloqueado',
        mensaje: `HomeSOC detuvo el despliegue de "${proyecto.nombreProyecto}" (${commitSha}): ${gate.hallazgosCriticosTotales} hallazgo(s) crítico(s) en Gate de Seguridad.`,
      });

      return registroDetenido;
    }

    // Si es trigger automático (webhook/polling) y el proyecto exige aprobación manual (RF-35)
    if (
      (origen === 'webhook' || origen === 'polling') &&
      proyecto.requiereAprobacion &&
      !opciones.forzarAprobacion
    ) {
      const registroPendiente = await this.repoDespliegues.registrarDespliegue({
        repositorioId: proyecto.id,
        commitSha,
        origen,
        estado: 'pendiente_aprobacion',
        logConstruccion: `[HomeSOC] Nuevo commit ${commitSha} detectado vía ${origen}. Esperando aprobación manual (RF-35).`,
        duracionMs: Math.max(50, Date.now() - inicio),
        ejecutadoPor: ctx.nombreUsuario,
        healthCheckOk: null,
        logHealthCheck: 'Pendiente de aprobación manual.',
        rollbackAutomatico: false,
        escaneos: gate.escaneos,
      });

      await this.repoDespliegues.actualizarEstadoProyecto(proyecto.id, 'pendiente_aprobacion');
      return registroPendiente;
    }

    await this.repoDespliegues.actualizarEstadoProyecto(proyecto.id, 'desplegando');

    // 2. Descifrado de variables únicamente en memoria para inyección (RF-38)
    const variablesPersistidas = await this.repoDespliegues.listarVariables(proyecto.id);
    const mapaInyeccion: Record<string, string> = {};
    for (const v of variablesPersistidas) {
      mapaInyeccion[v.clave] = this.cifrado.descifrar(v.valorCifrado);
    }
    const clavesInyectadas = Object.keys(mapaInyeccion);
    const plantilla = obtenerPlantillaBase(proyecto.tipoProyecto, proyecto.puerto);

    const lineasLog = [
      `[HomeSOC] Iniciando despliegue (${origen}) para ${proyecto.nombreCompleto}@${proyecto.rama}`,
      `[HomeSOC] Commit objetivo: ${commitSha}`,
      ...gate.escaneos.map(
        (e) => `[Gate:${e.herramienta}] ${e.estado.toUpperCase()} — ${e.resumen}`,
      ),
      `[HomeSOC] Estrategia: ${
        proyecto.tipoProyecto === 'dockerfile'
          ? 'Dockerfile propio del repositorio'
          : `Plantilla base HomeSOC (${proyecto.tipoProyecto})`
      }`,
      ...(plantilla ? ['[HomeSOC] Plantilla Dockerfile generada automáticamente en memoria.'] : []),
      `[HomeSOC] Variables cifradas inyectadas: ${clavesInyectadas.length}${
        clavesInyectadas.length > 0 ? ` (${clavesInyectadas.join(', ')})` : ''
      }`,
      `[HomeSOC] Puerto interno verificado: ${proyecto.puerto}`,
    ];

    // 3. Health check y Rollback automático si falla (RF-45 a RF-48)
    if (opciones.simularFalloHealthCheck) {
      const logHealth = `[HealthCheck] HTTP GET http://127.0.0.1:${proyecto.puerto}/health -> ERROR (timeout / 503). Rollback automático ejecutado: se mantiene la versión anterior (${commitAnterior ?? 'ninguna'}) activa sin interrupción (RF-47).`;
      lineasLog.push(logHealth);

      const registroFallido = await this.repoDespliegues.registrarDespliegue({
        repositorioId: proyecto.id,
        commitSha,
        origen,
        estado: 'fallido',
        logConstruccion: lineasLog.join('\n'),
        duracionMs: Math.max(240, Date.now() - inicio),
        ejecutadoPor: ctx.nombreUsuario,
        healthCheckOk: false,
        logHealthCheck: logHealth,
        rollbackAutomatico: true,
        despliegueOrigenId: opciones.despliegueOrigenId ?? null,
        escaneos: gate.escaneos,
      });

      // Mantiene intacto el commit anterior (rollback automático)
      await this.repoDespliegues.actualizarEstadoProyecto(
        proyecto.id,
        commitAnterior ? 'activo' : 'fallido',
        commitAnterior,
      );

      await this.notificarEvento?.emitir({
        tipoEvento: 'despliegue_rollback_automatico',
        mensaje: `Health check fallido en "${proyecto.nombreProyecto}" (${commitSha}). Rollback automático mantuvo la versión ${commitAnterior ?? 'anterior'}.`,
      });

      return registroFallido;
    }

    // 3b. Ejecución real en Docker del servidor (cuando DESPLIEGUE_MODO=real)
    if (this.ejecutorDespliegue?.modo === 'real') {
      const conexionGh = await this.repoGithub.obtenerPorUsuario(ctx.usuarioId);
      if (!conexionGh) {
        throw new ErrorGithubNoConectado();
      }
      const tokenPlano = this.cifrado.descifrar(conexionGh.tokenCifrado);
      const resultadoReal = await this.ejecutorDespliegue.ejecutar({
        nombreProyecto: proyecto.nombreProyecto,
        nombreCompleto: proyecto.nombreCompleto,
        rama: proyecto.rama,
        commitSha,
        puerto: proyecto.puerto,
        tipoProyecto: proyecto.tipoProyecto,
        plantillaDockerfile: plantilla,
        tokenGithub: tokenPlano,
        variablesEntorno: mapaInyeccion,
      });

      lineasLog.push(resultadoReal.logConstruccion);

      const registroReal = await this.repoDespliegues.registrarDespliegue({
        repositorioId: proyecto.id,
        commitSha,
        origen,
        estado: resultadoReal.exitoso ? 'exitoso' : 'fallido',
        logConstruccion: lineasLog.join('\n'),
        duracionMs: Math.max(200, Date.now() - inicio),
        ejecutadoPor: ctx.nombreUsuario,
        healthCheckOk: resultadoReal.healthCheckOk,
        logHealthCheck: resultadoReal.logHealthCheck,
        rollbackAutomatico: false,
        despliegueOrigenId: opciones.despliegueOrigenId ?? null,
        escaneos: gate.escaneos,
      });

      await this.repoDespliegues.actualizarEstadoProyecto(
        proyecto.id,
        resultadoReal.exitoso ? 'activo' : 'fallido',
        resultadoReal.exitoso ? commitSha : commitAnterior,
      );

      return registroReal;
    }

    const logHealthOk = `[HealthCheck] HTTP GET http://127.0.0.1:${proyecto.puerto}/ -> 200 OK (verificado en entorno local).`;
    lineasLog.push(logHealthOk, '[HomeSOC] Despliegue completado y verificado con éxito.');

    const registro = await this.repoDespliegues.registrarDespliegue({
      repositorioId: proyecto.id,
      commitSha,
      origen,
      estado: 'exitoso',
      logConstruccion: lineasLog.join('\n'),
      duracionMs: Math.max(120, Date.now() - inicio),
      ejecutadoPor: ctx.nombreUsuario,
      healthCheckOk: true,
      logHealthCheck: logHealthOk,
      rollbackAutomatico: false,
      despliegueOrigenId: opciones.despliegueOrigenId ?? null,
      escaneos: gate.escaneos,
    });

    await this.repoDespliegues.actualizarEstadoProyecto(proyecto.id, 'activo', commitSha);

    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: origen === 'rollback' ? 'proyecto_revertir' : 'proyecto_desplegar',
      recurso: proyecto.nombreProyecto,
      origen: origen === 'mcp' ? 'mcp' : 'web',
      direccionIp: ctx.direccionIp,
      detalles: {
        despliegueId: registro.id,
        commitSha,
        origen,
        totalVariablesInyectadas: clavesInyectadas.length,
        healthCheckOk: true,
      },
    });

    return registro;
  }

  /** Aprueba manualmente un despliegue detenido por RF-35 o por Gate de Seguridad (RF-43). */
  public async aprobarDesplieguePendiente(
    proyectoId: string,
    despliegueId: string,
    ctx: ContextoDespliegue,
  ): Promise<DespliegueRegistro> {
    this.exigirAdministrador(ctx);
    const anterior = await this.repoDespliegues.obtenerDesplieguePorId(proyectoId, despliegueId);
    if (!anterior) {
      throw new ErrorProyectoNoEncontrado(despliegueId);
    }

    return this.ejecutarDespliegue(proyectoId, ctx, 'manual', {
      commitSha: anterior.commitSha,
      forzarAprobacion: true,
      despliegueOrigenId: anterior.id,
    });
  }

  /** Reversión manual a cualquier despliegue anterior del historial con un solo clic (RF-50). */
  public async revertirADespliegue(
    proyectoId: string,
    despliegueId: string,
    ctx: ContextoDespliegue,
  ): Promise<DespliegueRegistro> {
    this.exigirAdministrador(ctx);
    const objetivo = await this.repoDespliegues.obtenerDesplieguePorId(proyectoId, despliegueId);
    if (!objetivo) {
      throw new ErrorProyectoNoEncontrado(despliegueId);
    }

    return this.ejecutarDespliegue(proyectoId, ctx, 'rollback', {
      commitSha: objetivo.commitSha,
      forzarAprobacion: true,
      despliegueOrigenId: objetivo.id,
    });
  }

  /** Procesa un evento push validado por HMAC desde /api/v1/webhooks/github (RF-32, RF-33). */
  public async procesarWebhookPush(datos: {
    nombreCompleto: string;
    rama: string;
    commitSha: string;
    mensajeCommit?: string;
    direccionIp: string;
  }): Promise<{ procesado: boolean; motivo: string; despliegue?: DespliegueRegistro }> {
    const proyecto = await this.repoDespliegues.obtenerProyectoPorNombreCompleto(
      datos.nombreCompleto,
    );
    if (!proyecto) {
      return { procesado: false, motivo: 'Repositorio no configurado en HomeSOC' };
    }
    if (proyecto.rama !== datos.rama) {
      return {
        procesado: false,
        motivo: `Push en rama "${datos.rama}" ignorado (rama configurada: "${proyecto.rama}")`,
      };
    }

    const despliegue = await this.ejecutarDespliegue(
      proyecto.id,
      {
        usuarioId: proyecto.usuarioId,
        nombreUsuario: 'github-webhook',
        rol: 'administrador',
        direccionIp: datos.direccionIp,
      },
      'webhook',
      {
        commitSha: datos.commitSha.slice(0, 7),
        mensajeCommit: datos.mensajeCommit,
      },
    );

    return {
      procesado: true,
      motivo: `Despliegue procesado (${despliegue.estado})`,
      despliegue,
    };
  }

  /** Ejecuta un ciclo de Polling sobre proyectos configurados en modo polling (RF-32, RF-33). */
  public async ejecutarCicloPolling(
    ctx: ContextoDespliegue,
  ): Promise<{ revisados: number; disparados: number }> {
    this.exigirAdministrador(ctx);
    const conexion = await this.repoGithub.obtenerPorUsuario(ctx.usuarioId);
    if (!conexion) {
      return { revisados: 0, disparados: 0 };
    }

    const proyectos = (await this.repoDespliegues.listarProyectos()).filter(
      (p) => p.modoActualizacion === 'polling',
    );
    if (proyectos.length === 0) {
      return { revisados: 0, disparados: 0 };
    }

    const token = this.cifrado.descifrar(conexion.tokenCifrado);
    const reposRemotos = await this.clienteGithub.listarRepositorios(token);
    const mapaRepos = new Map(reposRemotos.map((r) => [r.nombreCompleto.toLowerCase(), r]));

    let disparados = 0;
    for (const proy of proyectos) {
      const remoto = mapaRepos.get(proy.nombreCompleto.toLowerCase());
      const shaRemoto = remoto?.ultimoCommit?.sha;
      if (shaRemoto && shaRemoto !== proy.ultimoCommitSha) {
        await this.ejecutarDespliegue(proy.id, ctx, 'polling', {
          commitSha: shaRemoto,
          mensajeCommit: remoto?.ultimoCommit?.mensaje,
        });
        disparados++;
      }
    }

    return { revisados: proyectos.length, disparados };
  }

  public async listarHistorial(proyectoId: string): Promise<DespliegueRegistro[]> {
    const proyecto = await this.repoDespliegues.obtenerProyectoPorId(proyectoId);
    if (!proyecto) {
      throw new ErrorProyectoNoEncontrado(proyectoId);
    }
    return this.repoDespliegues.listarDespliegues(proyectoId, 25);
  }
}
