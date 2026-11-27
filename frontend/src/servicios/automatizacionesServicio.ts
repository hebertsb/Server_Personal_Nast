import { apiCliente } from './apiCliente';

export type TipoAutomatizacion =
  | 'horario'
  | 'condicion'
  | 'auto_healing'
  | 'limpieza_docker'
  | 'heartbeat'
  | 'actualizaciones'
  | 'energia';

export type CanalNotificacionRegla = 'panel' | 'telegram' | 'email' | 'webhook';

export type MetricaCondicion =
  | 'cpu_porcentaje'
  | 'ram_porcentaje'
  | 'disco_porcentaje'
  | 'temperatura_c';

export type OperadorCondicion = '>' | '>=' | '<' | '<=';

export interface ConfiguracionHorario {
  contenedorNombre: string;
  accion: 'iniciar' | 'detener' | 'reiniciar';
  hora: string;
  diasSemana: number[];
}

export interface ConfiguracionCondicion {
  metrica: MetricaCondicion;
  operador: OperadorCondicion;
  umbral: number;
  duracionMinutos: number;
  cooldownMinutos: number;
  accion: 'notificar' | 'reiniciar_contenedor' | 'pausar_no_criticos';
  contenedorNombre?: string;
  contenedoresNoCriticos?: string[];
}

export interface ConfiguracionAutoHealing {
  contenedorNombre: string;
  maxReintentos: number;
  ventanaMinutos: number;
  cooldownMinutos: number;
}

export interface ConfiguracionLimpiezaDocker {
  umbralDiscoPorcentaje?: number;
  hora?: string;
  diasSemana?: number[];
  cooldownMinutos: number;
}

export interface ConfiguracionHeartbeat {
  urlServicioLocal?: string;
  urlHeartbeatExterno?: string;
  intervaloMinutos: number;
}

export interface ConfiguracionActualizaciones {
  verificarImagenesDocker: boolean;
  verificarSistemaOperativo: boolean;
  hora: string;
  diasSemana: number[];
}

export interface ConfiguracionEnergia {
  umbralBateriaCritica: number;
  detenerContenedoresEnCritico: boolean;
  contenedoresNoCriticos?: string[];
  cooldownMinutos: number;
}

export type ConfiguracionAutomatizacion =
  | ConfiguracionHorario
  | ConfiguracionCondicion
  | ConfiguracionAutoHealing
  | ConfiguracionLimpiezaDocker
  | ConfiguracionHeartbeat
  | ConfiguracionActualizaciones
  | ConfiguracionEnergia;

export interface AutomatizacionItem {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: TipoAutomatizacion;
  configuracion: ConfiguracionAutomatizacion;
  canalNotificacion: CanalNotificacionRegla;
  habilitado: boolean;
  ultimaEjecucionEn: string | null;
  ultimoResultado: 'exitoso' | 'error' | null;
  proximaEjecucionEn: string | null;
  enfriamientoHasta: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface EntradaReglaPayload {
  nombre: string;
  descripcion: string;
  tipo: TipoAutomatizacion;
  configuracion: ConfiguracionAutomatizacion;
  canalNotificacion: CanalNotificacionRegla;
  habilitado: boolean;
}

export interface LogAutomatizacionItem {
  id: number;
  automatizacionId: string;
  nombreAutomatizacion: string;
  tipoAutomatizacion: TipoAutomatizacion;
  resultado: 'exitoso' | 'error';
  detalle: string;
  fechaHora: string;
}

export interface EstadoEnergiaItem {
  modo: 'simulacion' | 'real';
  disponible: boolean;
  enBateria: boolean;
  estadoTexto: string;
  porcentajeBateria: number | null;
  actualizadoEn: string;
}

export const automatizacionesServicio = {
  listar: (tokenAcceso: string): Promise<{ automatizaciones: AutomatizacionItem[] }> =>
    apiCliente.get<{ automatizaciones: AutomatizacionItem[] }>('/automatizaciones', tokenAcceso),

  crear: (
    datos: EntradaReglaPayload,
    tokenAcceso: string,
  ): Promise<{ automatizacion: AutomatizacionItem }> =>
    apiCliente.post<{ automatizacion: AutomatizacionItem }>('/automatizaciones', datos, tokenAcceso),

  actualizar: (
    id: string,
    datos: EntradaReglaPayload,
    tokenAcceso: string,
  ): Promise<{ automatizacion: AutomatizacionItem }> =>
    apiCliente.put<{ automatizacion: AutomatizacionItem }>(
      `/automatizaciones/${encodeURIComponent(id)}`,
      datos,
      tokenAcceso,
    ),

  alternarEstado: (
    id: string,
    habilitado: boolean,
    tokenAcceso: string,
  ): Promise<{ automatizacion: AutomatizacionItem }> =>
    apiCliente.patch<{ automatizacion: AutomatizacionItem }>(
      `/automatizaciones/${encodeURIComponent(id)}/estado`,
      { habilitado },
      tokenAcceso,
    ),

  eliminar: (id: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(
      `/automatizaciones/${encodeURIComponent(id)}`,
      tokenAcceso,
    ),

  ejecutarManual: (id: string, tokenAcceso: string): Promise<{ log: LogAutomatizacionItem }> =>
    apiCliente.post<{ log: LogAutomatizacionItem }>(
      `/automatizaciones/${encodeURIComponent(id)}/ejecutar`,
      undefined,
      tokenAcceso,
    ),

  evaluarActivas: (
    tokenAcceso: string,
  ): Promise<{ evaluadas: number; ejecutadas: number; logs: LogAutomatizacionItem[] }> =>
    apiCliente.post<{ evaluadas: number; ejecutadas: number; logs: LogAutomatizacionItem[] }>(
      '/automatizaciones/evaluar',
      undefined,
      tokenAcceso,
    ),

  listarLogs: (tokenAcceso: string, limite = 50): Promise<{ logs: LogAutomatizacionItem[] }> =>
    apiCliente.get<{ logs: LogAutomatizacionItem[] }>(
      `/automatizaciones/logs?limite=${limite}`,
      tokenAcceso,
    ),

  obtenerEnergia: (tokenAcceso: string): Promise<{ energia: EstadoEnergiaItem }> =>
    apiCliente.get<{ energia: EstadoEnergiaItem }>('/automatizaciones/energia', tokenAcceso),

  simularEnergia: (
    datos: { enBateria: boolean; porcentajeBateria: number },
    tokenAcceso: string,
  ): Promise<{ energia: EstadoEnergiaItem }> =>
    apiCliente.post<{ energia: EstadoEnergiaItem }>(
      '/automatizaciones/energia/simular',
      datos,
      tokenAcceso,
    ),
};
