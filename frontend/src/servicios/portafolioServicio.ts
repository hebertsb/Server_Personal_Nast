import { apiCliente } from './apiCliente';

export type EstadoProyectoPortafolio = 'en_desarrollo' | 'en_produccion' | 'pausado';
export type TipoComponentePortafolio = 'sistema' | 'landing' | 'demo' | 'api' | 'bd' | 'otro';
export type EstadoComponentePortafolio = 'activo' | 'pendiente' | 'caido' | 'en_progreso';
export type EstadoTareaPortafolio = 'pendiente' | 'en_progreso' | 'completado';
export type PrioridadTareaPortafolio = 'alta' | 'media' | 'baja';

export interface ComponentePortafolioItem {
  id: string;
  proyectoId: string;
  tipo: TipoComponentePortafolio;
  nombre: string;
  url: string;
  contenedorNombre: string;
  estadoManual: EstadoComponentePortafolio;
  estadoVivo: EstadoComponentePortafolio;
  ramMb: number;
  cpuPorcentaje: number;
  responsable: string;
  actualizadoEn: string;
}

export interface TareaPortafolioItem {
  id: string;
  proyectoId: string;
  titulo: string;
  estado: EstadoTareaPortafolio;
  prioridad: PrioridadTareaPortafolio;
  asignadoA: string;
  actualizadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ProyectoPortafolioItem {
  id: string;
  nombre: string;
  descripcion: string;
  prefijoContenedor: string;
  estado: EstadoProyectoPortafolio;
  repositorioUrl: string;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
  componentes: ComponentePortafolioItem[];
  tareas: TareaPortafolioItem[];
  ramTotalMb: number;
  cpuTotalPorcentaje: number;
  contenedoresActivos: number;
  contenedoresCaidos: number;
  serviciosCaidos: string[];
  tieneLanding: boolean;
  tieneDemo: boolean;
  pendientesAbiertos: number;
  completitudPorcentaje: number;
  avisos: string[];
}

export interface ResumenPortafolioRespuesta {
  totalProyectos: number;
  proyectosAMedias: number;
  componentesCaidos: number;
  tareasPendientes: number;
  ramTotalProyectosMb: number;
  proyectos: ProyectoPortafolioItem[];
}

export const portafolioServicio = {
  obtenerResumen: (tokenAcceso: string): Promise<ResumenPortafolioRespuesta> =>
    apiCliente.get<ResumenPortafolioRespuesta>('/portafolio', tokenAcceso),

  autodetectar: (tokenAcceso: string): Promise<{ creados: number }> =>
    apiCliente.post<{ creados: number }>('/portafolio/autodetectar', {}, tokenAcceso),

  crearProyecto: (
    datos: {
      nombre: string;
      descripcion?: string;
      prefijoContenedor?: string;
      estado?: EstadoProyectoPortafolio;
      repositorioUrl?: string;
    },
    tokenAcceso: string,
  ): Promise<{ proyecto: ProyectoPortafolioItem }> =>
    apiCliente.post<{ proyecto: ProyectoPortafolioItem }>('/portafolio/proyectos', datos, tokenAcceso),

  eliminarProyecto: (id: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(`/portafolio/proyectos/${encodeURIComponent(id)}`, tokenAcceso),

  crearComponente: (
    proyectoId: string,
    datos: {
      tipo: TipoComponentePortafolio;
      nombre: string;
      url?: string;
      contenedorNombre?: string;
      estadoManual?: EstadoComponentePortafolio;
      responsable?: string;
    },
    tokenAcceso: string,
  ): Promise<{ componente: ComponentePortafolioItem }> =>
    apiCliente.post<{ componente: ComponentePortafolioItem }>(
      `/portafolio/proyectos/${encodeURIComponent(proyectoId)}/componentes`,
      datos,
      tokenAcceso,
    ),

  actualizarComponente: (
    compId: string,
    datos: {
      estadoManual?: EstadoComponentePortafolio;
      url?: string;
      responsable?: string;
    },
    tokenAcceso: string,
  ): Promise<{ componente: ComponentePortafolioItem }> =>
    apiCliente.patch<{ componente: ComponentePortafolioItem }>(
      `/portafolio/componentes/${encodeURIComponent(compId)}`,
      datos,
      tokenAcceso,
    ),

  eliminarComponente: (compId: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(
      `/portafolio/componentes/${encodeURIComponent(compId)}`,
      tokenAcceso,
    ),

  crearTarea: (
    proyectoId: string,
    datos: {
      titulo: string;
      prioridad?: PrioridadTareaPortafolio;
      asignadoA?: string;
    },
    tokenAcceso: string,
  ): Promise<{ tarea: TareaPortafolioItem }> =>
    apiCliente.post<{ tarea: TareaPortafolioItem }>(
      `/portafolio/proyectos/${encodeURIComponent(proyectoId)}/tareas`,
      datos,
      tokenAcceso,
    ),

  actualizarTarea: (
    tareaId: string,
    datos: {
      estado?: EstadoTareaPortafolio;
      prioridad?: PrioridadTareaPortafolio;
      asignadoA?: string;
    },
    tokenAcceso: string,
  ): Promise<{ tarea: TareaPortafolioItem }> =>
    apiCliente.patch<{ tarea: TareaPortafolioItem }>(
      `/portafolio/tareas/${encodeURIComponent(tareaId)}`,
      datos,
      tokenAcceso,
    ),

  eliminarTarea: (tareaId: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(
      `/portafolio/tareas/${encodeURIComponent(tareaId)}`,
      tokenAcceso,
    ),

  crearTicketIncidente: (
    proyectoId: string,
    datos: { servicio: string; encargado: string; detalle?: string },
    tokenAcceso: string,
  ): Promise<{ ticket: TareaPortafolioItem }> =>
    apiCliente.post<{ ticket: TareaPortafolioItem }>(
      `/portafolio/proyectos/${encodeURIComponent(proyectoId)}/tickets`,
      datos,
      tokenAcceso,
    ),
};
