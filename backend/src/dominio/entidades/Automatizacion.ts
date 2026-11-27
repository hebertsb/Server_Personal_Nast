import { AccionContenedor } from './Contenedor';

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

export type AccionCondicion = 'notificar' | 'reiniciar_contenedor' | 'pausar_no_criticos';

export type ResultadoEjecucionAutomatizacion = 'exitoso' | 'error';

export interface ConfiguracionHorario {
  contenedorNombre: string;
  accion: AccionContenedor;
  /** Formato HH:MM en 24h (ej. "23:30"). */
  hora: string;
  /** Días de la semana: 0=Dom .. 6=Sáb. */
  diasSemana: number[];
}

export interface ConfiguracionCondicion {
  metrica: MetricaCondicion;
  operador: OperadorCondicion;
  umbral: number;
  /** Minutos sostenidos por encima/debajo del umbral antes de disparar (evita falsas alarmas). */
  duracionMinutos: number;
  /** Minutos de enfriamiento (cooldown) antes de volver a disparar la regla. */
  cooldownMinutos: number;
  accion: AccionCondicion;
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

export interface Automatizacion {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: TipoAutomatizacion;
  configuracion: ConfiguracionAutomatizacion;
  canalNotificacion: CanalNotificacionRegla;
  habilitado: boolean;
  ultimaEjecucionEn: string | null;
  ultimoResultado: ResultadoEjecucionAutomatizacion | null;
  proximaEjecucionEn: string | null;
  enfriamientoHasta: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface LogAutomatizacion {
  id: number;
  automatizacionId: string;
  nombreAutomatizacion: string;
  tipoAutomatizacion: TipoAutomatizacion;
  resultado: ResultadoEjecucionAutomatizacion;
  detalle: string;
  fechaHora: string;
}

export interface EstadoEnergiaHost {
  modo: 'simulacion' | 'real';
  disponible: boolean;
  enBateria: boolean;
  estadoTexto: string;
  porcentajeBateria: number | null;
  actualizadoEn: string;
}
