import {
  ComponentePortafolio,
  EstadoComponentePortafolio,
  EstadoProyectoPortafolio,
  EstadoTareaPortafolio,
  PrioridadTareaPortafolio,
  ProyectoPortafolio,
  TareaPortafolio,
  TipoComponentePortafolio,
} from '../entidades/Portafolio';

export interface RepositorioPortafolio {
  listarProyectos(): Promise<ProyectoPortafolio[]>;
  obtenerProyectoPorId(id: string): Promise<ProyectoPortafolio | null>;
  crearProyecto(datos: {
    nombre: string;
    descripcion: string;
    prefijoContenedor: string;
    estado: EstadoProyectoPortafolio;
    repositorioUrl: string;
    creadoPor: string;
  }): Promise<ProyectoPortafolio>;
  actualizarProyecto(
    id: string,
    datos: {
      nombre?: string;
      descripcion?: string;
      prefijoContenedor?: string;
      estado?: EstadoProyectoPortafolio;
      repositorioUrl?: string;
    },
  ): Promise<ProyectoPortafolio | null>;
  eliminarProyecto(id: string): Promise<boolean>;

  listarComponentes(): Promise<ComponentePortafolio[]>;
  crearComponente(datos: {
    proyectoId: string;
    tipo: TipoComponentePortafolio;
    nombre: string;
    url: string;
    contenedorNombre: string;
    estadoManual: EstadoComponentePortafolio;
    responsable: string;
  }): Promise<ComponentePortafolio>;
  actualizarComponente(
    id: string,
    datos: {
      nombre?: string;
      url?: string;
      contenedorNombre?: string;
      estadoManual?: EstadoComponentePortafolio;
      responsable?: string;
    },
  ): Promise<ComponentePortafolio | null>;
  eliminarComponente(id: string): Promise<boolean>;

  listarTareas(): Promise<TareaPortafolio[]>;
  crearTarea(datos: {
    proyectoId: string;
    titulo: string;
    prioridad: PrioridadTareaPortafolio;
    asignadoA: string;
    actualizadoPor: string;
  }): Promise<TareaPortafolio>;
  actualizarTarea(
    id: string,
    datos: {
      titulo?: string;
      estado?: EstadoTareaPortafolio;
      prioridad?: PrioridadTareaPortafolio;
      asignadoA?: string;
      actualizadoPor: string;
    },
  ): Promise<TareaPortafolio | null>;
  eliminarTarea(id: string): Promise<boolean>;
}
