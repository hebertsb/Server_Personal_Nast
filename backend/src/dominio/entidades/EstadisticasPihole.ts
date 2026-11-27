export interface DominioPihole {
  dominio: string;
  consultas: number;
}

export interface ClienteRedLocal {
  ip: string;
  hostname: string;
  consultas: number;
  ultimaActividad: string;
  estado: 'activo' | 'inactivo';
}

export interface PuntoActividadDns {
  hora: string;
  permitidas: number;
  bloqueadas: number;
}

export interface EstadisticasPihole {
  disponible: boolean;
  modo: 'simulacion_local' | 'real';
  estadoProteccion: 'activo' | 'pausado';
  consultasTotales24h: number;
  consultasBloqueadas24h: number;
  porcentajeBloqueado: number;
  dominiosEnListaNegra: number;
  topDominiosPermitidos: DominioPihole[];
  topDominiosBloqueados: DominioPihole[];
  clientesRedLocal: ClienteRedLocal[];
  actividadPorHora: PuntoActividadDns[];
  actualizadoEn: string;
}
