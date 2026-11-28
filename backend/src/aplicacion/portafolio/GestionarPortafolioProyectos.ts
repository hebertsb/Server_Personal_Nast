import { Contenedor } from '../../dominio/entidades/Contenedor';
import {
  ComponentePortafolio,
  ComponentePortafolioEnVivo,
  EstadoComponentePortafolio,
  EstadoProyectoPortafolio,
  EstadoTareaPortafolio,
  PrioridadTareaPortafolio,
  ProyectoPortafolio,
  ProyectoPortafolioCompleto,
  ResumenPortafolioGlobal,
  TareaPortafolio,
  TipoComponentePortafolio,
} from '../../dominio/entidades/Portafolio';
import { ControladorDocker } from '../../dominio/interfaces/ControladorDocker';
import { RepositorioPortafolio } from '../../dominio/interfaces/RepositorioPortafolio';
import { NotificarEvento } from '../notificaciones/NotificarEvento';

function inferirTipoComponente(nombreContenedor: string): TipoComponentePortafolio {
  const n = nombreContenedor.toLowerCase();
  if (n.includes('landing')) return 'landing';
  if (n.includes('demo')) return 'demo';
  if (n.includes('postgres') || n.includes('mysql') || n.includes('mongo') || n.includes('redis') || n.endsWith('_db') || n.endsWith('-db')) {
    return 'bd';
  }
  if (n.includes('api') || n.includes('backend') || n.includes('ms-')) return 'api';
  if (n.includes('web') || n.includes('frontend')) return 'sistema';
  return 'otro';
}

function extraerPrefijoProyecto(nombreContenedor: string): string {
  const limpio = nombreContenedor.toLowerCase().replace(/^homesoc-app-/, '');
  const partes = limpio.split(/[-_]/).filter(Boolean);
  return partes[0] || limpio;
}

function capitalizar(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Casos de uso del Portafolio de Proyectos:
 * agrupa servicios Docker por proyecto, suma consumo real de RAM/CPU,
 * rastrea sub-componentes (Sistema, Landing, Demo, API, BD) y pendientes,
 * y despacha avisos por Observer (Telegram / n8n) cuando alguien avanza o despliega.
 */
export class GestionarPortafolioProyectos {
  constructor(
    private readonly repo: RepositorioPortafolio,
    private readonly docker: ControladorDocker,
    private readonly notificarEvento?: NotificarEvento,
  ) {}

  public async obtenerResumenCompleto(): Promise<ResumenPortafolioGlobal> {
    const [proyectos, componentes, tareas, contenedores] = await Promise.all([
      this.repo.listarProyectos(),
      this.repo.listarComponentes(),
      this.repo.listarTareas(),
      this.docker.recolectar().catch(() => [] as Contenedor[]),
    ]);

    const mapaContenedor = new Map<string, Contenedor>();
    for (const c of contenedores) {
      mapaContenedor.set(c.nombre.toLowerCase(), c);
    }

    const proyectosCompletos: ProyectoPortafolioCompleto[] = proyectos.map((proy) => {
      const compsProy = componentes.filter((c) => c.proyectoId === proy.id);
      const tareasProy = tareas.filter((t) => t.proyectoId === proy.id);

      const contenedoresVinculados = new Set<string>();
      const compsEnVivo: ComponentePortafolioEnVivo[] = compsProy.map((comp) => {
        const cont = comp.contenedorNombre
          ? mapaContenedor.get(comp.contenedorNombre.toLowerCase())
          : undefined;
        if (cont) contenedoresVinculados.add(cont.nombre.toLowerCase());

        let estadoVivo: EstadoComponentePortafolio = comp.estadoManual;
        let ramMb = 0;
        let cpuPorcentaje = 0;

        if (cont) {
          estadoVivo = cont.estado === 'running' ? 'activo' : 'caido';
          ramMb = Math.round(cont.ramUsadaMb * 10) / 10;
          cpuPorcentaje = Math.round(cont.porcentajeCpu * 100) / 100;
        }

        return {
          ...comp,
          estadoVivo,
          ramMb,
          cpuPorcentaje,
        };
      });

      // Además sumar contenedores que coincidan con el prefijo del proyecto (aunque no estén mapeados manualmente)
      const prefijo = proy.prefijoContenedor.trim().toLowerCase();
      let ramExtra = 0;
      let cpuExtra = 0;
      let activosExtra = 0;
      let caidosExtra = 0;

      if (prefijo.length >= 2) {
        for (const c of contenedores) {
          const nl = c.nombre.toLowerCase();
          if (contenedoresVinculados.has(nl)) continue;
          if (nl === prefijo || nl.startsWith(`${prefijo}-`) || nl.startsWith(`${prefijo}_`) || nl.startsWith(`homesoc-app-${prefijo}`)) {
            contenedoresVinculados.add(nl);
            ramExtra += c.ramUsadaMb;
            cpuExtra += c.porcentajeCpu;
            if (c.estado === 'running') activosExtra += 1;
            else caidosExtra += 1;
          }
        }
      }

      const ramTotalMb =
        Math.round(
          (compsEnVivo.reduce((acc, c) => acc + c.ramMb, 0) + ramExtra) * 10,
        ) / 10;
      const cpuTotalPorcentaje =
        Math.round(
          (compsEnVivo.reduce((acc, c) => acc + c.cpuPorcentaje, 0) + cpuExtra) * 100,
        ) / 100;

      const contenedoresActivos =
        compsEnVivo.filter((c) => c.estadoVivo === 'activo').length + activosExtra;
      const contenedoresCaidos =
        compsEnVivo.filter((c) => c.estadoVivo === 'caido').length + caidosExtra;

      const tieneLanding = compsEnVivo.some(
        (c) => c.tipo === 'landing' && c.estadoVivo === 'activo',
      );
      const tieneDemo = compsEnVivo.some(
        (c) => c.tipo === 'demo' && c.estadoVivo === 'activo',
      );
      const pendientesAbiertos = tareasProy.filter((t) => t.estado !== 'completado').length;
      const totalItems = compsEnVivo.length + tareasProy.length;
      const itemsCompletos =
        compsEnVivo.filter((c) => c.estadoVivo === 'activo').length +
        tareasProy.filter((t) => t.estado === 'completado').length;
      const completitudPorcentaje =
        totalItems > 0 ? Math.round((itemsCompletos / totalItems) * 100) : 0;

      const avisos: string[] = [];
      if (contenedoresCaidos > 0) {
        avisos.push(`${contenedoresCaidos} componente(s) caído(s)`);
      }
      if (!tieneLanding) {
        avisos.push('Sin Landing Page activa');
      }
      if (pendientesAbiertos > 0) {
        avisos.push(`${pendientesAbiertos} pendiente(s) por completar`);
      }

      return {
        ...proy,
        componentes: compsEnVivo,
        tareas: tareasProy,
        ramTotalMb,
        cpuTotalPorcentaje,
        contenedoresActivos,
        contenedoresCaidos,
        tieneLanding,
        tieneDemo,
        pendientesAbiertos,
        completitudPorcentaje,
        avisos,
      };
    });

    const proyectosAMedias = proyectosCompletos.filter(
      (p) =>
        p.estado === 'en_desarrollo' ||
        p.pendientesAbiertos > 0 ||
        p.contenedoresCaidos > 0 ||
        !p.tieneLanding,
    ).length;

    return {
      totalProyectos: proyectosCompletos.length,
      proyectosAMedias,
      componentesCaidos: proyectosCompletos.reduce((a, p) => a + p.contenedoresCaidos, 0),
      tareasPendientes: proyectosCompletos.reduce((a, p) => a + p.pendientesAbiertos, 0),
      ramTotalProyectosMb:
        Math.round(proyectosCompletos.reduce((a, p) => a + p.ramTotalMb, 0) * 10) / 10,
      proyectos: proyectosCompletos,
    };
  }

  /**
   * Detecta grupos de contenedores Docker existentes (ej. synexoria, adorbit, ajedrez, homesoc)
   * y crea automáticamente sus proyectos y componentes base si todavía no existen.
   */
  public async autodetectarDesdeDocker(nombreUsuario: string): Promise<{ creados: number }> {
    const [existentes, contenedores] = await Promise.all([
      this.repo.listarProyectos(),
      this.docker.recolectar().catch(() => [] as Contenedor[]),
    ]);

    const nombresExistentes = new Set(existentes.map((p) => p.prefijoContenedor.toLowerCase()));
    const ignorarInfra = new Set(['pihole', 'portainer', 'uptime', 'code', 'cloudflared']);

    const grupos = new Map<string, Contenedor[]>();
    for (const c of contenedores) {
      const prefijo = extraerPrefijoProyecto(c.nombre);
      if (!prefijo || ignorarInfra.has(prefijo)) continue;
      const lista = grupos.get(prefijo) ?? [];
      lista.push(c);
      grupos.set(prefijo, lista);
    }

    let creados = 0;
    for (const [prefijo, lista] of grupos.entries()) {
      if (nombresExistentes.has(prefijo)) continue;
      const todosActivos = lista.every((c) => c.estado === 'running');
      const proyecto = await this.repo.crearProyecto({
        nombre: capitalizar(prefijo),
        descripcion: `Proyecto detectado automáticamente desde ${lista.length} contenedor(es) Docker.`,
        prefijoContenedor: prefijo,
        estado: todosActivos ? 'en_produccion' : 'en_desarrollo',
        repositorioUrl: '',
        creadoPor: nombreUsuario,
      });

      for (const c of lista) {
        await this.repo.crearComponente({
          proyectoId: proyecto.id,
          tipo: inferirTipoComponente(c.nombre),
          nombre: c.nombre,
          url: '',
          contenedorNombre: c.nombre,
          estadoManual: c.estado === 'running' ? 'activo' : 'caido',
          responsable: nombreUsuario,
        });
      }
      creados += 1;
    }

    return { creados };
  }

  public async crearProyecto(datos: {
    nombre: string;
    descripcion?: string;
    prefijoContenedor?: string;
    estado?: EstadoProyectoPortafolio;
    repositorioUrl?: string;
    creadoPor: string;
  }): Promise<ProyectoPortafolio> {
    return this.repo.crearProyecto({
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? '',
      prefijoContenedor: datos.prefijoContenedor ?? '',
      estado: datos.estado ?? 'en_desarrollo',
      repositorioUrl: datos.repositorioUrl ?? '',
      creadoPor: datos.creadoPor,
    });
  }

  public async eliminarProyecto(id: string): Promise<boolean> {
    return this.repo.eliminarProyecto(id);
  }

  public async crearComponente(
    datos: {
      proyectoId: string;
      tipo: TipoComponentePortafolio;
      nombre: string;
      url?: string;
      contenedorNombre?: string;
      estadoManual?: EstadoComponentePortafolio;
      responsable?: string;
    },
    actor: string,
  ): Promise<ComponentePortafolio> {
    const comp = await this.repo.crearComponente({
      proyectoId: datos.proyectoId,
      tipo: datos.tipo,
      nombre: datos.nombre,
      url: datos.url ?? '',
      contenedorNombre: datos.contenedorNombre ?? '',
      estadoManual: datos.estadoManual ?? 'activo',
      responsable: datos.responsable || actor,
    });

    const proy = await this.repo.obtenerProyectoPorId(datos.proyectoId);
    await this.notificarEvento?.emitir({
      tipoEvento: 'portafolio_actualizacion',
      mensaje: `🧩 ${actor} agregó el componente "${comp.nombre}" (${comp.tipo}) al proyecto "${proy?.nombre ?? datos.proyectoId}" (${comp.estadoManual}${comp.url ? ` · ${comp.url}` : ''}).`,
    });

    return comp;
  }

  public async actualizarComponente(
    id: string,
    datos: {
      nombre?: string;
      url?: string;
      contenedorNombre?: string;
      estadoManual?: EstadoComponentePortafolio;
      responsable?: string;
    },
    actor: string,
  ): Promise<ComponentePortafolio | null> {
    const actualizado = await this.repo.actualizarComponente(id, datos);
    if (actualizado) {
      const proy = await this.repo.obtenerProyectoPorId(actualizado.proyectoId);
      await this.notificarEvento?.emitir({
        tipoEvento: 'portafolio_actualizacion',
        mensaje: `🔄 ${actor} actualizó "${actualizado.nombre}" (${actualizado.tipo}) en "${proy?.nombre ?? actualizado.proyectoId}" → estado: ${actualizado.estadoManual}.`,
      });
    }
    return actualizado;
  }

  public async eliminarComponente(id: string): Promise<boolean> {
    return this.repo.eliminarComponente(id);
  }

  public async crearTarea(
    datos: {
      proyectoId: string;
      titulo: string;
      prioridad?: PrioridadTareaPortafolio;
      asignadoA?: string;
    },
    actor: string,
  ): Promise<TareaPortafolio> {
    return this.repo.crearTarea({
      proyectoId: datos.proyectoId,
      titulo: datos.titulo,
      prioridad: datos.prioridad ?? 'media',
      asignadoA: datos.asignadoA ?? '',
      actualizadoPor: actor,
    });
  }

  public async actualizarTarea(
    id: string,
    datos: {
      titulo?: string;
      estado?: EstadoTareaPortafolio;
      prioridad?: PrioridadTareaPortafolio;
      asignadoA?: string;
    },
    actor: string,
  ): Promise<TareaPortafolio | null> {
    const actualizada = await this.repo.actualizarTarea(id, {
      ...datos,
      actualizadoPor: actor,
    });
    if (actualizada && datos.estado === 'completado') {
      const proy = await this.repo.obtenerProyectoPorId(actualizada.proyectoId);
      await this.notificarEvento?.emitir({
        tipoEvento: 'portafolio_actualizacion',
        mensaje: `✅ ${actor} completó el pendiente "${actualizada.titulo}" en el proyecto "${proy?.nombre ?? actualizada.proyectoId}".`,
      });
    }
    return actualizada;
  }

  public async eliminarTarea(id: string): Promise<boolean> {
    return this.repo.eliminarTarea(id);
  }
}
