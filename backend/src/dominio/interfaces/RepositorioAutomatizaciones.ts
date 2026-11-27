import {
  Automatizacion,
  CanalNotificacionRegla,
  ConfiguracionAutomatizacion,
  LogAutomatizacion,
  ResultadoEjecucionAutomatizacion,
  TipoAutomatizacion,
} from '../entidades/Automatizacion';

export interface DatosCrearAutomatizacion {
  nombre: string;
  descripcion: string;
  tipo: TipoAutomatizacion;
  configuracion: ConfiguracionAutomatizacion;
  canalNotificacion: CanalNotificacionRegla;
  habilitado: boolean;
  proximaEjecucionEn: string | null;
}

export interface DatosActualizarAutomatizacion {
  nombre: string;
  descripcion: string;
  tipo: TipoAutomatizacion;
  configuracion: ConfiguracionAutomatizacion;
  canalNotificacion: CanalNotificacionRegla;
  habilitado: boolean;
  proximaEjecucionEn: string | null;
}

export interface RepositorioAutomatizaciones {
  listar(): Promise<Automatizacion[]>;
  obtenerPorId(id: string): Promise<Automatizacion | null>;
  crear(datos: DatosCrearAutomatizacion): Promise<Automatizacion>;
  actualizar(id: string, datos: DatosActualizarAutomatizacion): Promise<Automatizacion | null>;
  actualizarHabilitado(id: string, habilitado: boolean): Promise<Automatizacion | null>;
  actualizarEstadoEjecucion(
    id: string,
    datos: {
      ultimoResultado: ResultadoEjecucionAutomatizacion;
      enfriamientoHasta: string | null;
      proximaEjecucionEn: string | null;
    },
  ): Promise<void>;
  eliminar(id: string): Promise<boolean>;
  registrarLog(datos: {
    automatizacionId: string;
    resultado: ResultadoEjecucionAutomatizacion;
    detalle: string;
  }): Promise<LogAutomatizacion>;
  contarEjecucionesRecientes(automatizacionId: string, ventanaMinutos: number): Promise<number>;
  listarLogs(limite?: number): Promise<LogAutomatizacion[]>;
}
