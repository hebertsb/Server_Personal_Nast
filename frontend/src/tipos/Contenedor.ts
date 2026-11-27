export type EstadoContenedor = 'running' | 'stopped' | 'unhealthy' | 'restarting' | 'paused';

export type AccionContenedor = 'iniciar' | 'detener' | 'reiniciar';

export interface PuertoContenedor {
  privado: number;
  publico: number | null;
  tipo: string;
}

export interface Contenedor {
  id: string;
  idCorto: string;
  nombre: string;
  imagen: string;
  estado: EstadoContenedor;
  estadoDetalle: string;
  creadoEn: string;
  puertos: PuertoContenedor[];
  porcentajeCpu: number;
  ramUsadaMb: number;
  ramLimiteMb: number;
  redRxMb: number;
  redTxMb: number;
}

export interface ResumenContenedores {
  total: number;
  activos: number;
  detenidos: number;
  conProblemas: number;
}

export interface RespuestaListaContenedores {
  contenedores: Contenedor[];
  resumen: ResumenContenedores;
  actualizadoEn: string;
}

export interface RespuestaAccionContenedor {
  contenedorId: string;
  nombre: string;
  accion: AccionContenedor;
  mensaje: string;
}

export interface RespuestaLogsContenedor {
  contenedorId: string;
  nombre: string;
  lineas: string[];
}
