import {
  ExplicacionFalloDespliegue,
  RespuestaConsultaIa,
  ResumenSeguridadIa,
} from '../entidades/IaYMcp';

export interface EntradaExplicarFallo {
  nombreProyecto: string;
  commitSha: string;
  estado: string;
  logConstruccion: string;
  logHealthCheck: string;
}

export interface EntradaResumenSeguridad {
  totalEventos24h: number;
  eventosCriticosOAltos: number;
  ipsBloqueadas: number;
  intentosSshFallidos: number;
  tiposFrecuentes: string[];
}

export interface ResumenProyectoParaIa {
  nombre: string;
  estado: string;
  ramTotalMb: number;
  tieneLanding: boolean;
  tieneDemo: boolean;
  componentesCaidos: number;
  pendientes: Array<{ titulo: string; estado: string; asignadoA: string }>;
  componentes: Array<{ tipo: string; nombre: string; estado: string; responsable: string }>;
}

export interface ContextoConsultaServidor {
  cpuPorcentaje: number;
  ramPorcentaje: number;
  discoPorcentaje: number;
  contenedoresActivos: number;
  contenedoresTotales: number;
  alertasAltasRecientes: number;
  proyectosDesplegados: number;
  portafolio?: {
    totalProyectos: number;
    proyectosAMedias: number;
    tareasPendientes: number;
    componentesCaidos: number;
    proyectos: ResumenProyectoParaIa[];
  };
}

/** Patrón Strategy intercambiable para el módulo de IA (RF-56, RF-57, RF-58). */
export interface ProveedorIA {
  readonly nombre: string;
  explicarFalloDespliegue(entrada: EntradaExplicarFallo): Promise<ExplicacionFalloDespliegue>;
  generarResumenSeguridad(entrada: EntradaResumenSeguridad): Promise<ResumenSeguridadIa>;
  responderConsulta(
    pregunta: string,
    contexto: ContextoConsultaServidor,
  ): Promise<RespuestaConsultaIa>;
}
