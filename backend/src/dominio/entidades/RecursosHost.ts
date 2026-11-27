export type RangoHistorico = '1h' | '24h' | '7d';

export interface NucleoCpu {
  indice: number;
  porcentajeUso: number;
}

export interface DiscoHost {
  etiqueta: string;
  puntoMontaje: string;
  totalGb: number;
  usadoGb: number;
  libreGb: number;
  porcentajeUso: number;
}

export interface RecursosHost {
  hostname: string;
  plataforma: string;
  arquitectura: string;
  modeloCpu: string;
  cantidadNucleos: number;
  tiempoActividadSeg: number;
  cargaPromedio: [number, number, number];
  porcentajeCpu: number;
  nucleos: NucleoCpu[];
  ramUsadaMb: number;
  ramTotalMb: number;
  ramLibreMb: number;
  porcentajeRam: number;
  temperaturaC: number | null;
  discos: DiscoHost[];
  marcaTiempo: string;
}

export interface PuntoHistoricoRecursos {
  porcentajeCpu: number;
  ramUsadaMb: number;
  ramTotalMb: number;
  temperaturaC: number | null;
  fechaHora: string;
}
