export type VentanaAccesos = '24h' | '7d' | '30d';

export interface SolicitudProyecto {
  id: number;
  nombreProyecto: string;
  ipOrigen: string;
  ruta: string;
  metodo: string;
  codigoEstado: number;
  userAgent: string;
  pais: string | null;
  fechaHora: string;
}

export interface NuevaSolicitudProyecto {
  nombreProyecto: string;
  ipOrigen: string;
  ruta: string;
  metodo: string;
  codigoEstado: number;
  userAgent: string;
  pais?: string | null;
  fechaHora?: string;
}

export interface FiltroAccesosProyecto {
  proyecto?: string;
  ventana: VentanaAccesos;
  limite: number;
}

export interface AnaliticaAccesosProyecto {
  proyectosDisponibles: string[];
  resumen: {
    totalVisitas: number;
    visitantesUnicos: number;
    erroresHttp: number;
    proyectoMasActivo: string | null;
  };
  visitasPorProyecto: Array<{
    nombreProyecto: string;
    totalVisitas: number;
    visitantesUnicos: number;
  }>;
  rutasMasSolicitadas: Array<{
    ruta: string;
    metodo: string;
    solicitudes: number;
  }>;
  horariosPico: Array<{
    hora: string;
    solicitudes: number;
    exitosas: number;
    errores: number;
  }>;
  distribucionPaises: Array<{
    pais: string;
    solicitudes: number;
  }>;
  solicitudesRecientes: SolicitudProyecto[];
}
