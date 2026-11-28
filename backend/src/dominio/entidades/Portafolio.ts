export type EstadoProyectoPortafolio = 'en_desarrollo' | 'en_produccion' | 'pausado';
export type TipoComponentePortafolio = 'sistema' | 'landing' | 'demo' | 'api' | 'bd' | 'otro';
export type EstadoComponentePortafolio = 'activo' | 'pendiente' | 'caido' | 'en_progreso';
export type EstadoTareaPortafolio = 'pendiente' | 'en_progreso' | 'completado';
export type PrioridadTareaPortafolio = 'alta' | 'media' | 'baja';

export interface ComponentePortafolio {
  id: string;
  proyectoId: string;
  tipo: TipoComponentePortafolio;
  nombre: string;
  url: string;
  contenedorNombre: string;
  estadoManual: EstadoComponentePortafolio;
  responsable: string;
  actualizadoEn: string;
}

export interface ComponentePortafolioEnVivo extends ComponentePortafolio {
  estadoVivo: EstadoComponentePortafolio;
  ramMb: number;
  cpuPorcentaje: number;
}

export interface TareaPortafolio {
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

export interface ProyectoPortafolio {
  id: string;
  nombre: string;
  descripcion: string;
  prefijoContenedor: string;
  estado: EstadoProyectoPortafolio;
  repositorioUrl: string;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ProyectoPortafolioCompleto extends ProyectoPortafolio {
  componentes: ComponentePortafolioEnVivo[];
  tareas: TareaPortafolio[];
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

export interface ResumenPortafolioGlobal {
  totalProyectos: number;
  proyectosAMedias: number;
  componentesCaidos: number;
  tareasPendientes: number;
  ramTotalProyectosMb: number;
  proyectos: ProyectoPortafolioCompleto[];
}
