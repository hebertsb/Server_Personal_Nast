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
