import {
  ExplicacionFalloDespliegue,
  RespuestaConsultaIa,
  ResumenSeguridadIa,
} from '../../dominio/entidades/IaYMcp';
import { RecursosHost } from '../../dominio/entidades/RecursosHost';
import { ErrorProyectoNoEncontrado } from '../../dominio/errores/ErroresDespliegues';
import { Colector } from '../../dominio/interfaces/Colector';
import { ControladorDocker } from '../../dominio/interfaces/ControladorDocker';
import { ProveedorIA } from '../../dominio/interfaces/ProveedorIA';
import { RepositorioDespliegues } from '../../dominio/interfaces/RepositorioDespliegues';
import { RepositorioEventos } from '../../dominio/interfaces/RepositorioEventos';
import { RepositorioSeguridadRed } from '../../dominio/interfaces/RepositorioSeguridadRed';

/**
 * Casos de uso RF-54 a RF-58: explicación de fallos de despliegue, resumen diario
 * de seguridad y consultas conversacionales/de voz usando únicamente datos no sensibles.
 */
export class AsistenteIA {
  constructor(
    private readonly proveedorIA: ProveedorIA,
    private readonly repoDespliegues: RepositorioDespliegues,
    private readonly repoEventos: RepositorioEventos,
    private readonly repoSeguridadRed: RepositorioSeguridadRed,
    private readonly colectorRecursos: Colector<RecursosHost>,
    private readonly controladorDocker: ControladorDocker,
  ) {}

  public async explicarFalloDespliegue(
    proyectoId: string,
    despliegueId: string,
  ): Promise<ExplicacionFalloDespliegue> {
    const proyecto = await this.repoDespliegues.obtenerProyectoPorId(proyectoId);
    if (!proyecto) throw new ErrorProyectoNoEncontrado(proyectoId);

    const despliegue = await this.repoDespliegues.obtenerDesplieguePorId(proyectoId, despliegueId);
    if (!despliegue) throw new ErrorProyectoNoEncontrado(despliegueId);

    return this.proveedorIA.explicarFalloDespliegue({
      nombreProyecto: proyecto.nombreProyecto,
      commitSha: despliegue.commitSha,
      estado: despliegue.estado,
      logConstruccion: despliegue.logConstruccion,
      logHealthCheck: despliegue.logHealthCheck,
    });
  }

  public async generarResumenDiarioSeguridad(): Promise<ResumenSeguridadIa> {
    const [eventos, ips] = await Promise.all([
      this.repoEventos.listarEventosSeguridad(100),
      this.repoSeguridadRed.listarIpsBloqueadas(),
    ]);

    const hace24h = Date.now() - 24 * 3_600_000;
    const recientes = eventos.filter((e) => new Date(e.fechaHora).getTime() >= hace24h);
    const criticosOAltos = recientes.filter(
      (e) => e.severidad === 'alta' || e.severidad === 'critica',
    ).length;
    const sshFallidos = recientes.filter((e) => e.tipoEvento.includes('ssh')).length;
    const conteoTipos = new Map<string, number>();
    for (const ev of recientes) {
      conteoTipos.set(ev.tipoEvento, (conteoTipos.get(ev.tipoEvento) ?? 0) + 1);
    }
    const tiposFrecuentes = [...conteoTipos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([tipo]) => tipo);

    return this.proveedorIA.generarResumenSeguridad({
      totalEventos24h: recientes.length,
      eventosCriticosOAltos: criticosOAltos,
      ipsBloqueadas: ips.length,
      intentosSshFallidos: sshFallidos,
      tiposFrecuentes,
    });
  }

  public async consultarAsistente(pregunta: string): Promise<RespuestaConsultaIa> {
    const [recursos, contenedores, eventos, proyectos] = await Promise.all([
      this.colectorRecursos.recolectar(),
      this.controladorDocker.recolectar().catch(() => []),
      this.repoEventos.listarEventosSeguridad(30),
      this.repoDespliegues.listarProyectos(),
    ]);

    const alertasAltas = eventos.filter(
      (e) => e.severidad === 'alta' || e.severidad === 'critica',
    ).length;

    return this.proveedorIA.responderConsulta(pregunta, {
      cpuPorcentaje: Math.round(recursos.porcentajeCpu * 10) / 10,
      ramPorcentaje: Math.round(recursos.porcentajeRam * 10) / 10,
      discoPorcentaje: Math.round((recursos.discos[0]?.porcentajeUso ?? 0) * 10) / 10,
      contenedoresActivos: contenedores.filter((c) => c.estado === 'running').length,
      contenedoresTotales: contenedores.length,
      alertasAltasRecientes: alertasAltas,
      proyectosDesplegados: proyectos.length,
    });
  }
}
