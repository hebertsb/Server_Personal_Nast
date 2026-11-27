import Docker from 'dockerode';
import {
  AccionContenedor,
  Contenedor,
  EstadoContenedor,
  PuertoContenedor,
} from '../../dominio/entidades/Contenedor';
import {
  ErrorAccionContenedorInvalida,
  ErrorContenedorNoEncontrado,
  ErrorDockerNoDisponible,
} from '../../dominio/errores/ErroresContenedores';
import { ControladorDocker } from '../../dominio/interfaces/ControladorDocker';

function redondearDosDecimales(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function mapearEstado(state: string, status: string): EstadoContenedor {
  if (status.toLowerCase().includes('(unhealthy)')) {
    return 'unhealthy';
  }
  switch (state.toLowerCase()) {
    case 'running':
      return 'running';
    case 'restarting':
      return 'restarting';
    case 'paused':
      return 'paused';
    default:
      return 'stopped';
  }
}

function limpiarNombre(nombres: string[] | undefined, idCorto: string): string {
  const primero = nombres?.[0];
  if (!primero) return idCorto;
  return primero.startsWith('/') ? primero.slice(1) : primero;
}

function mapearPuertos(
  puertos: Array<{ PrivatePort: number; PublicPort?: number; Type: string }> | undefined,
): PuertoContenedor[] {
  if (!puertos || puertos.length === 0) return [];
  const vistos = new Set<string>();
  const resultado: PuertoContenedor[] = [];

  for (const puerto of puertos) {
    const clave = `${puerto.PrivatePort}:${puerto.PublicPort ?? ''}:${puerto.Type}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push({
      privado: puerto.PrivatePort,
      publico: puerto.PublicPort ?? null,
      tipo: puerto.Type,
    });
  }

  return resultado;
}

/**
 * Decodifica el formato multiplexado de Docker (encabezados de 8 bytes) para devolver
 * líneas de texto limpias sin caracteres de control binarios.
 */
function demultiplexarLogsDocker(contenido: Buffer | string): string[] {
  const buffer = typeof contenido === 'string' ? Buffer.from(contenido, 'utf8') : contenido;
  if (buffer.length === 0) return [];

  const esMultiplexado =
    buffer.length >= 8 &&
    (buffer[0] === 0 || buffer[0] === 1 || buffer[0] === 2) &&
    buffer[1] === 0 &&
    buffer[2] === 0 &&
    buffer[3] === 0;

  let textoLimpio = '';

  if (esMultiplexado) {
    let desplazamiento = 0;
    const fragmentos: string[] = [];
    while (desplazamiento + 8 <= buffer.length) {
      const tamano = buffer.readUInt32BE(desplazamiento + 4);
      const inicio = desplazamiento + 8;
      const fin = Math.min(inicio + tamano, buffer.length);
      fragmentos.push(buffer.subarray(inicio, fin).toString('utf8'));
      desplazamiento = fin;
    }
    textoLimpio = fragmentos.join('');
  } else {
    textoLimpio = buffer.toString('utf8');
  }

  return textoLimpio
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((linea) => linea.length > 0);
}

interface EstadisticasCalculadas {
  porcentajeCpu: number;
  ramUsadaMb: number;
  ramLimiteMb: number;
  redRxMb: number;
  redTxMb: number;
}

/**
 * Implementación concreta del patrón Strategy (Colector) y ControladorDocker
 * usando dockerode contra el socket local de Docker.
 */
export class ColectorDocker implements ControladorDocker {
  public readonly nombre = 'docker';
  private readonly docker: Docker;

  constructor(socketPath = '/var/run/docker.sock') {
    this.docker = new Docker({ socketPath });
  }

  public async verificarConexion(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  public async recolectar(): Promise<Contenedor[]> {
    try {
      const lista = await this.docker.listContainers({ all: true });

      const contenedores = await Promise.all(
        lista.map(async (info) => {
          const estado = mapearEstado(info.State, info.Status);
          const idCorto = info.Id.slice(0, 12);
          const stats =
            estado === 'running' || estado === 'unhealthy'
              ? await this.obtenerEstadisticasSeguras(info.Id)
              : {
                  porcentajeCpu: 0,
                  ramUsadaMb: 0,
                  ramLimiteMb: 0,
                  redRxMb: 0,
                  redTxMb: 0,
                };

          return {
            id: info.Id,
            idCorto,
            nombre: limpiarNombre(info.Names, idCorto),
            imagen: info.Image,
            estado,
            estadoDetalle: info.Status,
            creadoEn: new Date(info.Created * 1000).toISOString(),
            puertos: mapearPuertos(info.Ports),
            ...stats,
          };
        }),
      );

      return contenedores;
    } catch {
      throw new ErrorDockerNoDisponible();
    }
  }

  public async obtenerPorId(id: string): Promise<Contenedor | null> {
    const todos = await this.recolectar();
    const encontrado = todos.find(
      (c) => c.id === id || c.idCorto === id || c.nombre === id,
    );
    return encontrado ?? null;
  }

  public async ejecutarAccion(id: string, accion: AccionContenedor): Promise<void> {
    const contenedor = this.docker.getContainer(id);
    try {
      if (accion === 'iniciar') {
        await contenedor.start();
      } else if (accion === 'detener') {
        await contenedor.stop({ t: 10 });
      } else {
        await contenedor.restart({ t: 10 });
      }
    } catch (error) {
      const codigoEstado =
        typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : undefined;

      if (codigoEstado === 304) {
        const mensaje =
          accion === 'iniciar'
            ? 'El contenedor ya se encuentra en ejecución'
            : 'El contenedor ya se encuentra detenido';
        throw new ErrorAccionContenedorInvalida(mensaje);
      }

      if (codigoEstado === 404) {
        throw new ErrorContenedorNoEncontrado(id);
      }

      throw new ErrorDockerNoDisponible();
    }
  }

  public async obtenerLogs(id: string, lineas: number): Promise<string[]> {
    const contenedor = this.docker.getContainer(id);
    try {
      const resultado = await contenedor.logs({
        stdout: true,
        stderr: true,
        tail: lineas,
        timestamps: true,
      });
      return demultiplexarLogsDocker(resultado as unknown as Buffer | string);
    } catch (error) {
      const codigoEstado =
        typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : undefined;

      if (codigoEstado === 404) {
        throw new ErrorContenedorNoEncontrado(id);
      }
      throw new ErrorDockerNoDisponible();
    }
  }

  /** Elimina de forma segura únicamente imágenes Docker huérfanas (dangling). */
  public async limpiarImagenesHuerfanas(): Promise<{
    imagenesEliminadas: number;
    espacioRecuperadoMb: number;
  }> {
    try {
      const res = (await this.docker.pruneImages({
        filters: { dangling: { true: true } },
      })) as {
        ImagesDeleted?: Array<{ Deleted?: string; Untagged?: string }> | null;
        SpaceReclaimed?: number;
      };
      const imagenesEliminadas = Array.isArray(res.ImagesDeleted) ? res.ImagesDeleted.length : 0;
      const espacioRecuperadoMb = Math.round(((res.SpaceReclaimed ?? 0) / (1024 * 1024)) * 10) / 10;
      return { imagenesEliminadas, espacioRecuperadoMb };
    } catch {
      throw new ErrorDockerNoDisponible();
    }
  }

  private async obtenerEstadisticasSeguras(id: string): Promise<EstadisticasCalculadas> {
    try {
      const contenedor = this.docker.getContainer(id);
      const stats = (await contenedor.stats({ stream: false })) as unknown as {
        cpu_stats?: {
          cpu_usage?: { total_usage?: number; percpu_usage?: number[] };
          system_cpu_usage?: number;
          online_cpus?: number;
        };
        precpu_stats?: {
          cpu_usage?: { total_usage?: number };
          system_cpu_usage?: number;
        };
        memory_stats?: {
          usage?: number;
          limit?: number;
          stats?: { cache?: number; inactive_file?: number };
        };
        networks?: Record<string, { rx_bytes?: number; tx_bytes?: number }>;
      };

      const totalActual = stats.cpu_stats?.cpu_usage?.total_usage ?? 0;
      const totalPrevio = stats.precpu_stats?.cpu_usage?.total_usage ?? 0;
      const sistemaActual = stats.cpu_stats?.system_cpu_usage ?? 0;
      const sistemaPrevio = stats.precpu_stats?.system_cpu_usage ?? 0;
      const nucleos =
        stats.cpu_stats?.online_cpus ??
        stats.cpu_stats?.cpu_usage?.percpu_usage?.length ??
        1;

      const deltaCpu = totalActual - totalPrevio;
      const deltaSistema = sistemaActual - sistemaPrevio;
      const porcentajeCpu =
        deltaSistema > 0 && deltaCpu > 0
          ? redondearDosDecimales((deltaCpu / deltaSistema) * nucleos * 100)
          : 0;

      const cacheBytes =
        stats.memory_stats?.stats?.cache ?? stats.memory_stats?.stats?.inactive_file ?? 0;
      const ramUsadaBytes = Math.max(0, (stats.memory_stats?.usage ?? 0) - cacheBytes);
      const ramLimiteBytes = stats.memory_stats?.limit ?? 0;

      let rxBytes = 0;
      let txBytes = 0;
      if (stats.networks) {
        for (const interfaz of Object.values(stats.networks)) {
          rxBytes += interfaz.rx_bytes ?? 0;
          txBytes += interfaz.tx_bytes ?? 0;
        }
      }

      const mb = 1024 * 1024;
      return {
        porcentajeCpu,
        ramUsadaMb: redondearDosDecimales(ramUsadaBytes / mb),
        ramLimiteMb: redondearDosDecimales(ramLimiteBytes / mb),
        redRxMb: redondearDosDecimales(rxBytes / mb),
        redTxMb: redondearDosDecimales(txBytes / mb),
      };
    } catch {
      return {
        porcentajeCpu: 0,
        ramUsadaMb: 0,
        ramLimiteMb: 0,
        redRxMb: 0,
        redTxMb: 0,
      };
    }
  }
}
