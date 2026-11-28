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
import { GestionarPortafolioProyectos } from '../portafolio/GestionarPortafolioProyectos';

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
    private readonly portafolio?: GestionarPortafolioProyectos,
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
    const [recursos, contenedores, eventos, proyectos, resumenPortafolio] = await Promise.all([
      this.colectorRecursos.recolectar(),
      this.controladorDocker.recolectar().catch(() => []),
      this.repoEventos.listarEventosSeguridad(30),
      this.repoDespliegues.listarProyectos(),
      this.portafolio ? this.portafolio.obtenerResumenCompleto().catch(() => null) : Promise.resolve(null),
    ]);

    const alertasAltas = eventos.filter(
      (e) => e.severidad === 'alta' || e.severidad === 'critica',
    ).length;

    const pNorm = pregunta.toLowerCase();
    const consultaPortafolio =
      /(pendient|a medias|falta|mejorar|landing|colaborador|demo|portafolio|memoria.*proyect|ram.*proyect)/i.test(
        pNorm,
      );

    if (consultaPortafolio && resumenPortafolio) {
      if (resumenPortafolio.totalProyectos === 0) {
        const msg =
          'Todavía no hay proyectos cargados en tu Portafolio. Entra a Servicios y Despliegues → Proyectos y Pendientes y haz clic en Auto-detectar desde Docker.';
        return {
          proveedor: 'homesoc-portafolio',
          respuesta: msg,
          textoParaVoz: msg,
          generadoEn: new Date().toISOString(),
        };
      }

      const partes: string[] = [];
      if (/ram|memoria/i.test(pNorm)) {
        const top = [...resumenPortafolio.proyectos]
          .sort((a, b) => b.ramTotalMb - a.ramTotalMb)
          .map((p) => `${p.nombre}: ${p.ramTotalMb} MB (${p.contenedoresActivos} activos)`);
        partes.push(`Consumo de RAM por proyecto: ${top.join('; ')}.`);
      } else if (/landing/i.test(pNorm)) {
        const conLanding = resumenPortafolio.proyectos.filter((p) => p.tieneLanding);
        const sinLanding = resumenPortafolio.proyectos.filter((p) => !p.tieneLanding);
        if (conLanding.length > 0) {
          partes.push(
            `Con Landing Page activa: ${conLanding
              .map((p) => {
                const l = p.componentes.find((c) => c.tipo === 'landing');
                return `${p.nombre}${l?.responsable ? ` (por ${l.responsable})` : ''}`;
              })
              .join(', ')}.`,
          );
        }
        if (sinLanding.length > 0) {
          partes.push(`Sin Landing Page aún: ${sinLanding.map((p) => p.nombre).join(', ')}.`);
        }
      } else {
        const aMedias = resumenPortafolio.proyectos.filter((p) => p.avisos.length > 0);
        if (aMedias.length === 0) {
          partes.push(
            `Todos tus ${resumenPortafolio.totalProyectos} proyectos están al día, sin pendientes ni componentes caídos.`,
          );
        } else {
          partes.push(
            `Tienes ${aMedias.length} proyecto(s) con pendientes o mejoras: ${aMedias
              .slice(0, 5)
              .map((p) => {
                const tareasAbiertas = p.tareas
                  .filter((t) => t.estado !== 'completado')
                  .slice(0, 2)
                  .map((t) => `"${t.titulo}"${t.asignadoA ? ` (${t.asignadoA})` : ''}`);
                const detalle =
                  tareasAbiertas.length > 0
                    ? tareasAbiertas.join(', ')
                    : p.avisos.join(', ');
                return `${p.nombre} [${detalle}]`;
              })
              .join(' | ')}.`,
          );
        }
      }

      const texto = partes.join(' ');
      return {
        proveedor: 'homesoc-portafolio',
        respuesta: texto,
        textoParaVoz: texto.replace(/[*_`#[\]]/g, ''),
        generadoEn: new Date().toISOString(),
      };
    }

    return this.proveedorIA.responderConsulta(pregunta, {
      cpuPorcentaje: Math.round(recursos.porcentajeCpu * 10) / 10,
      ramPorcentaje: Math.round(recursos.porcentajeRam * 10) / 10,
      discoPorcentaje: Math.round((recursos.discos[0]?.porcentajeUso ?? 0) * 10) / 10,
      contenedoresActivos: contenedores.filter((c) => c.estado === 'running').length,
      contenedoresTotales: contenedores.length,
      alertasAltasRecientes: alertasAltas,
      proyectosDesplegados: proyectos.length,
      portafolio: resumenPortafolio
        ? {
            totalProyectos: resumenPortafolio.totalProyectos,
            proyectosAMedias: resumenPortafolio.proyectosAMedias,
            tareasPendientes: resumenPortafolio.tareasPendientes,
            componentesCaidos: resumenPortafolio.componentesCaidos,
            proyectos: resumenPortafolio.proyectos.slice(0, 8).map((p) => ({
              nombre: p.nombre,
              estado: p.estado,
              ramTotalMb: p.ramTotalMb,
              tieneLanding: p.tieneLanding,
              tieneDemo: p.tieneDemo,
              componentesCaidos: p.contenedoresCaidos,
              pendientes: p.tareas
                .filter((t) => t.estado !== 'completado')
                .slice(0, 4)
                .map((t) => ({ titulo: t.titulo, estado: t.estado, asignadoA: t.asignadoA })),
              componentes: p.componentes.map((c) => ({
                tipo: c.tipo,
                nombre: c.nombre,
                estado: c.estadoVivo,
                responsable: c.responsable,
              })),
            })),
          }
        : undefined,
    });
  }
}
