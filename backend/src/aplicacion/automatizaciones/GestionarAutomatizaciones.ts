import fs from 'node:fs/promises';
import {
  Automatizacion,
  CanalNotificacionRegla,
  ConfiguracionActualizaciones,
  ConfiguracionAutoHealing,
  ConfiguracionAutomatizacion,
  ConfiguracionCondicion,
  ConfiguracionEnergia,
  ConfiguracionHeartbeat,
  ConfiguracionHorario,
  ConfiguracionLimpiezaDocker,
  EstadoEnergiaHost,
  LogAutomatizacion,
  TipoAutomatizacion,
} from '../../dominio/entidades/Automatizacion';
import { RecursosHost } from '../../dominio/entidades/RecursosHost';
import { RolUsuario } from '../../dominio/entidades/Usuario';
import { ErrorAutomatizacionNoEncontrada } from '../../dominio/errores/ErroresAutomatizaciones';
import { ErrorPermisosInsuficientes } from '../../dominio/errores/ErroresContenedores';
import { Colector } from '../../dominio/interfaces/Colector';
import { ColectorEnergia } from '../../dominio/interfaces/ColectorEnergia';
import { ControladorDocker } from '../../dominio/interfaces/ControladorDocker';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';
import { RepositorioAutomatizaciones } from '../../dominio/interfaces/RepositorioAutomatizaciones';
import { RepositorioSeguridad2FA } from '../../dominio/interfaces/RepositorioSeguridad2FA';
import {
  calcularProximaEjecucion,
  coincideHorario,
  estaEnCooldown,
  evaluarCondicionMetrica,
  evaluarEstadoEnergia,
  evaluarLimiteReintentosAutoHealing,
} from '../../dominio/reglas/EvaluadorAutomatizaciones';
import { NotificarEvento } from '../notificaciones/NotificarEvento';

export interface ContextoAutomatizacion {
  usuarioId: string;
  rol: RolUsuario;
  direccionIp: string;
}

export interface EntradaReglaAutomatizacion {
  nombre: string;
  descripcion?: string;
  tipo: TipoAutomatizacion;
  configuracion: ConfiguracionAutomatizacion;
  canalNotificacion?: CanalNotificacionRegla;
  habilitado?: boolean;
}

export const CONTENEDORES_PROTEGIDOS = new Set([
  'homesoc-db-dev',
  'homesoc-backend-dev',
  'homesoc-frontend-dev',
  'postgres-homesoc',
  'homesoc-backend',
  'homesoc-frontend',
]);

/**
 * Casos de uso Fase 4 ampliada (RF-51 a RF-53):
 * horarios, condiciones con tiempo sostenido/cooldown, auto-healing con límite de reintentos,
 * limpieza Docker, heartbeat externo (Dead Man's Switch), aviso de actualizaciones,
 * resiliencia ante cortes de luz/batería baja y notificación de arranque del servidor.
 */
export class GestionarAutomatizaciones {
  constructor(
    private readonly repo: RepositorioAutomatizaciones,
    private readonly controladorDocker: ControladorDocker,
    private readonly colectorRecursos: Colector<RecursosHost>,
    private readonly colectorEnergia: ColectorEnergia,
    private readonly auditoria: RepositorioAuditoria,
    private readonly notificarEvento: NotificarEvento,
    private readonly repositorioSeguridad?: RepositorioSeguridad2FA,
    private readonly rutaActualizacionesSo = './fixtures/actualizaciones_so.txt',
    private readonly notificarArranqueHabilitado = true,
  ) {}

  private exigirAdministrador(ctx: ContextoAutomatizacion): void {
    if (ctx.rol !== 'administrador') {
      throw new ErrorPermisosInsuficientes();
    }
  }

  public async listar(): Promise<Automatizacion[]> {
    const reglas = await this.repo.listar();
    const ahora = new Date();
    return reglas.map((r) => ({
      ...r,
      proximaEjecucionEn:
        r.proximaEjecucionEn ?? calcularProximaEjecucion(r.tipo, r.configuracion, ahora),
    }));
  }

  public async listarLogs(limite = 50): Promise<LogAutomatizacion[]> {
    return this.repo.listarLogs(limite);
  }

  public async obtenerEstadoEnergia(): Promise<EstadoEnergiaHost> {
    return this.colectorEnergia.leerEstado();
  }

  public simularEstadoEnergia(parcial: {
    enBateria: boolean;
    porcentajeBateria: number;
  }): EstadoEnergiaHost {
    return this.colectorEnergia.simularEstado(parcial);
  }

  /** Registra evento y despacha notificación automática al arrancar el backend de HomeSOC. */
  public async notificarArranqueServidor(): Promise<void> {
    if (!this.notificarArranqueHabilitado) return;

    let activos = 0;
    try {
      const contenedores = await this.controladorDocker.recolectar();
      activos = contenedores.filter((c) => c.estado === 'running').length;
    } catch {
      activos = 0;
    }

    const mensaje = `Servidor en línea nuevamente — ${activos} contenedor(es) activo(s).`;

    await this.repositorioSeguridad?.registrarEventoSeguridad({
      tipoEvento: 'servidor_arranque',
      ipOrigen: '127.0.0.1',
      severidad: 'baja',
      detalles: { contenedoresActivos: activos, mensaje },
    });

    await this.notificarEvento.emitir({
      tipoEvento: 'servidor_arranque',
      mensaje,
    });
  }

  public async crear(
    datos: EntradaReglaAutomatizacion,
    ctx: ContextoAutomatizacion,
  ): Promise<Automatizacion> {
    this.exigirAdministrador(ctx);
    const proxima = calcularProximaEjecucion(datos.tipo, datos.configuracion);
    const creada = await this.repo.crear({
      nombre: datos.nombre.trim(),
      descripcion: (datos.descripcion ?? '').trim(),
      tipo: datos.tipo,
      configuracion: datos.configuracion,
      canalNotificacion: datos.canalNotificacion ?? 'panel',
      habilitado: datos.habilitado ?? true,
      proximaEjecucionEn: proxima,
    });

    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: 'automatizacion_crear',
      recurso: creada.nombre,
      origen: 'web',
      direccionIp: ctx.direccionIp,
      detalles: { tipo: creada.tipo, canal: creada.canalNotificacion },
    });

    return creada;
  }

  public async actualizar(
    id: string,
    datos: EntradaReglaAutomatizacion,
    ctx: ContextoAutomatizacion,
  ): Promise<Automatizacion> {
    this.exigirAdministrador(ctx);
    const proxima = calcularProximaEjecucion(datos.tipo, datos.configuracion);
    const actualizada = await this.repo.actualizar(id, {
      nombre: datos.nombre.trim(),
      descripcion: (datos.descripcion ?? '').trim(),
      tipo: datos.tipo,
      configuracion: datos.configuracion,
      canalNotificacion: datos.canalNotificacion ?? 'panel',
      habilitado: datos.habilitado ?? true,
      proximaEjecucionEn: proxima,
    });
    if (!actualizada) {
      throw new ErrorAutomatizacionNoEncontrada(id);
    }

    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: 'automatizacion_editar',
      recurso: actualizada.nombre,
      origen: 'web',
      direccionIp: ctx.direccionIp,
      detalles: { tipo: actualizada.tipo, canal: actualizada.canalNotificacion },
    });

    return actualizada;
  }

  public async alternarEstado(
    id: string,
    habilitado: boolean,
    ctx: ContextoAutomatizacion,
  ): Promise<Automatizacion> {
    this.exigirAdministrador(ctx);
    const actualizada = await this.repo.actualizarHabilitado(id, habilitado);
    if (!actualizada) {
      throw new ErrorAutomatizacionNoEncontrada(id);
    }

    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: habilitado ? 'automatizacion_activar' : 'automatizacion_pausar',
      recurso: actualizada.nombre,
      origen: 'web',
      direccionIp: ctx.direccionIp,
    });

    return actualizada;
  }

  public async eliminar(id: string, ctx: ContextoAutomatizacion): Promise<void> {
    this.exigirAdministrador(ctx);
    const existente = await this.repo.obtenerPorId(id);
    if (!existente) {
      throw new ErrorAutomatizacionNoEncontrada(id);
    }
    await this.repo.eliminar(id);
    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: 'automatizacion_eliminar',
      recurso: existente.nombre,
      origen: 'web',
      direccionIp: ctx.direccionIp,
    });
  }

  /** Ejecuta una automatización manualmente para prueba o acción inmediata (RF-53). */
  public async ejecutarManualmente(
    id: string,
    ctx: ContextoAutomatizacion,
  ): Promise<LogAutomatizacion> {
    this.exigirAdministrador(ctx);
    const regla = await this.repo.obtenerPorId(id);
    if (!regla) {
      throw new ErrorAutomatizacionNoEncontrada(id);
    }

    const log = await this.ejecutarRegla(regla, true, new Date());

    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: 'automatizacion_ejecutar',
      recurso: regla.nombre,
      origen: 'web',
      direccionIp: ctx.direccionIp,
      detalles: { resultado: log.resultado },
    });

    return log;
  }

  /** Evalúa todas las reglas habilitadas respetando horarios, condiciones y cooldown. */
  public async evaluarReglasActivas(
    fecha: Date = new Date(),
  ): Promise<{ evaluadas: number; ejecutadas: number; logs: LogAutomatizacion[] }> {
    const activas = (await this.repo.listar()).filter((r) => r.habilitado);
    const logs: LogAutomatizacion[] = [];

    for (const regla of activas) {
      if (estaEnCooldown(regla.enfriamientoHasta, fecha)) {
        continue;
      }

      if (regla.tipo === 'horario') {
        const cfg = regla.configuracion as ConfiguracionHorario;
        if (coincideHorario(cfg, fecha)) {
          logs.push(await this.ejecutarRegla(regla, false, fecha));
        }
      } else if (regla.tipo === 'condicion') {
        const cfg = regla.configuracion as ConfiguracionCondicion;
        const recursos = await this.colectorRecursos.recolectar();
        if (evaluarCondicionMetrica(cfg, recursos).cumplida) {
          logs.push(await this.ejecutarRegla(regla, false, fecha, recursos));
        }
      } else if (regla.tipo === 'auto_healing') {
        const cfg = regla.configuracion as ConfiguracionAutoHealing;
        const c = await this.controladorDocker.obtenerPorId(cfg.contenedorNombre);
        if (c && (c.estado === 'unhealthy' || c.estado === 'stopped')) {
          logs.push(await this.ejecutarRegla(regla, false, fecha));
        }
      } else if (regla.tipo === 'energia') {
        const cfg = regla.configuracion as ConfiguracionEnergia;
        const energia = await this.colectorEnergia.leerEstado();
        if (evaluarEstadoEnergia(cfg, energia).nivel !== 'normal') {
          logs.push(await this.ejecutarRegla(regla, false, fecha));
        }
      } else if (regla.tipo === 'limpieza_docker') {
        const cfg = regla.configuracion as ConfiguracionLimpiezaDocker;
        const recursos = await this.colectorRecursos.recolectar();
        const discoActual = recursos.discos[0]?.porcentajeUso ?? 0;
        const superaUmbral =
          typeof cfg.umbralDiscoPorcentaje === 'number' &&
          discoActual >= cfg.umbralDiscoPorcentaje;
        if (superaUmbral || coincideHorario(cfg, fecha)) {
          logs.push(await this.ejecutarRegla(regla, false, fecha, recursos));
        }
      } else if (regla.tipo === 'actualizaciones') {
        const cfg = regla.configuracion as ConfiguracionActualizaciones;
        if (coincideHorario(cfg, fecha)) {
          logs.push(await this.ejecutarRegla(regla, false, fecha));
        }
      } else if (regla.tipo === 'heartbeat') {
        logs.push(await this.ejecutarRegla(regla, false, fecha));
      }
    }

    return { evaluadas: activas.length, ejecutadas: logs.length, logs };
  }

  private async finalizarRegistro(
    regla: Automatizacion,
    resultado: 'exitoso' | 'error',
    detalle: string,
    ahora: Date,
    cooldownMinutos = 0,
  ): Promise<LogAutomatizacion> {
    const log = await this.repo.registrarLog({
      automatizacionId: regla.id,
      resultado,
      detalle,
    });
    const enfriamientoHasta =
      cooldownMinutos > 0 ? new Date(ahora.getTime() + cooldownMinutos * 60_000).toISOString() : null;
    const proximaEjecucionEn = calcularProximaEjecucion(regla.tipo, regla.configuracion, ahora);
    await this.repo.actualizarEstadoEjecucion(regla.id, {
      ultimoResultado: resultado,
      enfriamientoHasta,
      proximaEjecucionEn,
    });
    return log;
  }

  private async despacharAviso(regla: Automatizacion, tipoEvento: string, mensaje: string) {
    if (regla.canalNotificacion === 'panel') return;
    await this.notificarEvento.emitir({
      tipoEvento,
      mensaje: `[Canal: ${regla.canalNotificacion}] ${mensaje}`,
    });
  }

  private async detenerNoCriticos(listaConfigurada?: string[]): Promise<string[]> {
    const todos = await this.controladorDocker.recolectar();
    const candidatos = todos.filter((c) => {
      if (CONTENEDORES_PROTEGIDOS.has(c.nombre)) return false;
      if (c.estado !== 'running') return false;
      if (listaConfigurada && listaConfigurada.length > 0) {
        return listaConfigurada.includes(c.nombre);
      }
      return true;
    });

    const detenidos: string[] = [];
    for (const c of candidatos) {
      await this.controladorDocker.ejecutarAccion(c.id, 'detener');
      detenidos.push(c.nombre);
    }
    return detenidos;
  }

  private async ejecutarRegla(
    regla: Automatizacion,
    esManual: boolean,
    ahora: Date,
    recursosPrevios?: RecursosHost,
  ): Promise<LogAutomatizacion> {
    try {
      switch (regla.tipo) {
        case 'horario': {
          const cfg = regla.configuracion as ConfiguracionHorario;
          if (CONTENEDORES_PROTEGIDOS.has(cfg.contenedorNombre)) {
            return this.finalizarRegistro(
              regla,
              'error',
              `Acción bloqueada por seguridad: "${cfg.contenedorNombre}" es un contenedor núcleo protegido.`,
              ahora,
            );
          }
          const contenedor = await this.controladorDocker.obtenerPorId(cfg.contenedorNombre);
          if (!contenedor) {
            return this.finalizarRegistro(
              regla,
              'error',
              `Contenedor "${cfg.contenedorNombre}" no encontrado en Docker.`,
              ahora,
            );
          }
          await this.controladorDocker.ejecutarAccion(contenedor.id, cfg.accion);
          const detalle = `Acción "${cfg.accion}" ejecutada sobre "${contenedor.nombre}" (${
            esManual ? 'disparo manual' : `horario ${cfg.hora}`
          }).`;
          await this.despacharAviso(regla, 'automatizacion_horario', detalle);
          return this.finalizarRegistro(regla, 'exitoso', detalle, ahora);
        }

        case 'condicion': {
          const cfg = regla.configuracion as ConfiguracionCondicion;
          const recursos = recursosPrevios ?? (await this.colectorRecursos.recolectar());
          const { cumplida, valorActual } = evaluarCondicionMetrica(cfg, recursos);
          const cooldown = cfg.cooldownMinutos ?? 15;

          if (cfg.accion === 'pausar_no_criticos') {
            const detenidos = await this.detenerNoCriticos(cfg.contenedoresNoCriticos);
            const detalle = `Protección de recursos (${cfg.metrica}=${valorActual ?? 'N/D'}, sostenido ${
              cfg.duracionMinutos ?? 5
            } min): ${
              detenidos.length > 0
                ? `detenidos no críticos [${detenidos.join(', ')}]`
                : 'sin contenedores no críticos en ejecución'
            }.`;
            await this.despacharAviso(regla, 'alerta_recurso', detalle);
            return this.finalizarRegistro(regla, 'exitoso', detalle, ahora, cooldown);
          }

          if (cfg.accion === 'reiniciar_contenedor' && cfg.contenedorNombre) {
            if (CONTENEDORES_PROTEGIDOS.has(cfg.contenedorNombre)) {
              return this.finalizarRegistro(
                regla,
                'error',
                `No se permite reiniciar automáticamente el contenedor núcleo "${cfg.contenedorNombre}".`,
                ahora,
              );
            }
            const contenedor = await this.controladorDocker.obtenerPorId(cfg.contenedorNombre);
            if (!contenedor) {
              return this.finalizarRegistro(
                regla,
                'error',
                `Contenedor objetivo "${cfg.contenedorNombre}" no encontrado.`,
                ahora,
              );
            }
            await this.controladorDocker.ejecutarAccion(contenedor.id, 'reiniciar');
            const detalle = `Condición ${cfg.metrica}=${valorActual ?? 'N/D'} (umbral ${cfg.operador} ${
              cfg.umbral
            }, ${cfg.duracionMinutos ?? 5} min): contenedor "${contenedor.nombre}" reiniciado.`;
            await this.despacharAviso(regla, 'alerta_recurso', detalle);
            return this.finalizarRegistro(regla, 'exitoso', detalle, ahora, cooldown);
          }

          const detalle = `Alerta de recurso (${cfg.metrica}=${valorActual ?? 'N/D'}, umbral ${
            cfg.operador
          } ${cfg.umbral} durante ${cfg.duracionMinutos ?? 5} min, ${
            cumplida ? 'umbral superado' : 'prueba manual'
          }).`;
          await this.despacharAviso(regla, 'alerta_recurso', detalle);
          return this.finalizarRegistro(regla, 'exitoso', detalle, ahora, cooldown);
        }

        case 'auto_healing': {
          const cfg = regla.configuracion as ConfiguracionAutoHealing;
          if (CONTENEDORES_PROTEGIDOS.has(cfg.contenedorNombre)) {
            return this.finalizarRegistro(
              regla,
              'error',
              `Auto-healing bloqueado: "${cfg.contenedorNombre}" es un contenedor núcleo protegido.`,
              ahora,
            );
          }
          const contenedor = await this.controladorDocker.obtenerPorId(cfg.contenedorNombre);
          if (!contenedor) {
            return this.finalizarRegistro(
              regla,
              'error',
              `Auto-healing: contenedor "${cfg.contenedorNombre}" no encontrado.`,
              ahora,
            );
          }
          const intentos = await this.repo.contarEjecucionesRecientes(regla.id, cfg.ventanaMinutos);
          const { puedeReintentar } = evaluarLimiteReintentosAutoHealing(
            intentos,
            cfg.maxReintentos,
          );
          if (!puedeReintentar) {
            const detalle = `Auto-healing escalado a ALERTA CRÍTICA: "${contenedor.nombre}" alcanzó ${intentos}/${cfg.maxReintentos} reinicios en ${cfg.ventanaMinutos} min.`;
            await this.despacharAviso(regla, 'auto_healing_critico', detalle);
            return this.finalizarRegistro(regla, 'error', detalle, ahora, cfg.cooldownMinutos);
          }

          await this.controladorDocker.ejecutarAccion(contenedor.id, 'reiniciar');
          const detalle = `Auto-healing ejecutado en "${contenedor.nombre}" (intento ${
            intentos + 1
          }/${cfg.maxReintentos} en ${cfg.ventanaMinutos} min).`;
          await this.despacharAviso(regla, 'auto_healing', detalle);
          return this.finalizarRegistro(regla, 'exitoso', detalle, ahora, cfg.cooldownMinutos);
        }

        case 'limpieza_docker': {
          const cfg = regla.configuracion as ConfiguracionLimpiezaDocker;
          if (!this.controladorDocker.limpiarImagenesHuerfanas) {
            return this.finalizarRegistro(
              regla,
              'error',
              'El controlador Docker no soporta limpieza de imágenes huérfanas.',
              ahora,
            );
          }
          const res = await this.controladorDocker.limpiarImagenesHuerfanas();
          const detalle = `Limpieza Docker completada: ${res.imagenesEliminadas} imagen(es) huérfana(s) eliminada(s), ${res.espacioRecuperadoMb} MB recuperados.`;
          await this.despacharAviso(regla, 'limpieza_docker', detalle);
          return this.finalizarRegistro(regla, 'exitoso', detalle, ahora, cfg.cooldownMinutos);
        }

        case 'heartbeat': {
          const cfg = regla.configuracion as ConfiguracionHeartbeat;
          const partes: string[] = [];
          let huboError = false;

          if (cfg.urlServicioLocal) {
            try {
              const r = await fetch(cfg.urlServicioLocal, { signal: AbortSignal.timeout(4000) });
              partes.push(`Servicio local (${cfg.urlServicioLocal}): HTTP ${r.status}`);
              if (!r.ok) huboError = true;
            } catch {
              partes.push(`Servicio local (${cfg.urlServicioLocal}): sin respuesta`);
              huboError = true;
            }
          }

          if (cfg.urlHeartbeatExterno) {
            try {
              const r = await fetch(cfg.urlHeartbeatExterno, { signal: AbortSignal.timeout(4000) });
              partes.push(`Heartbeat externo: HTTP ${r.status}`);
              if (!r.ok) huboError = true;
            } catch {
              partes.push(`Heartbeat externo: fallo de conexión`);
              huboError = true;
            }
          }

          const detalle =
            partes.length > 0
              ? partes.join(' | ')
              : 'Heartbeat verificado (sin URL externa configurada todavía).';
          if (huboError) {
            await this.despacharAviso(regla, 'heartbeat_fallido', detalle);
          }
          return this.finalizarRegistro(regla, huboError ? 'error' : 'exitoso', detalle, ahora);
        }

        case 'actualizaciones': {
          const cfg = regla.configuracion as ConfiguracionActualizaciones;
          const notas: string[] = [];

          if (cfg.verificarImagenesDocker) {
            const contenedores = await this.controladorDocker.recolectar();
            const imagenesUnicas = new Set(contenedores.map((c) => c.imagen));
            notas.push(`${imagenesUnicas.size} imagen(es) Docker inspeccionadas (solo aviso)`);
          }

          if (cfg.verificarSistemaOperativo) {
            try {
              const contenido = await fs.readFile(this.rutaActualizacionesSo, 'utf8');
              const paquetes = contenido
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter((l) => l.length > 0 && !l.startsWith('#'));
              notas.push(`${paquetes.length} paquete(s) del SO con actualización pendiente`);
            } catch {
              notas.push('Archivo :ro de actualizaciones del SO no encontrado');
            }
          }

          const detalle = `Aviso de actualizaciones (sin auto-actualizar): ${notas.join(' • ')}.`;
          await this.despacharAviso(regla, 'aviso_actualizaciones', detalle);
          return this.finalizarRegistro(regla, 'exitoso', detalle, ahora);
        }

        case 'energia': {
          const cfg = regla.configuracion as ConfiguracionEnergia;
          const estado = await this.colectorEnergia.leerEstado();
          const { nivel } = evaluarEstadoEnergia(cfg, estado);

          if (nivel === 'normal') {
            return this.finalizarRegistro(
              regla,
              'exitoso',
              `Energía normal (${estado.estadoTexto}, batería ${estado.porcentajeBateria ?? 'N/D'}%).`,
              ahora,
            );
          }

          if (nivel === 'bateria_critica' && cfg.detenerContenedoresEnCritico) {
            const detenidos = await this.detenerNoCriticos(cfg.contenedoresNoCriticos);
            const detalle = `BATERÍA CRÍTICA (${estado.porcentajeBateria}% <= ${cfg.umbralBateriaCritica}%): apagado ordenado ejecutado en [${
              detenidos.join(', ') || 'ninguno'
            }].`;
            await this.despacharAviso(regla, 'energia_bateria_critica', detalle);
            return this.finalizarRegistro(regla, 'exitoso', detalle, ahora, cfg.cooldownMinutos);
          }

          const detalle = `CORTE DE LUZ detectado: servidor operando en batería (${
            estado.porcentajeBateria ?? 'N/D'
          }%).`;
          await this.despacharAviso(regla, 'energia_corte_luz', detalle);
          return this.finalizarRegistro(regla, 'exitoso', detalle, ahora, cfg.cooldownMinutos);
        }
      }
    } catch (error) {
      return this.finalizarRegistro(
        regla,
        'error',
        error instanceof Error ? error.message : 'Error inesperado al ejecutar automatización',
        ahora,
      );
    }
  }
}
