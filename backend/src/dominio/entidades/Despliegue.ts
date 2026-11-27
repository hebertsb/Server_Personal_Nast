export type TipoProyectoDespliegue = 'dockerfile' | 'nodejs' | 'html_estatico';
export type ModoActualizacionRepo = 'webhook' | 'polling';
export type EstadoProyectoDespliegue =
  | 'configurado'
  | 'desplegando'
  | 'activo'
  | 'fallido'
  | 'pendiente_aprobacion';
export type OrigenDespliegue = 'manual' | 'webhook' | 'polling' | 'rollback' | 'mcp';
export type EstadoEjecucionDespliegue =
  | 'exitoso'
  | 'fallido'
  | 'pendiente_aprobacion'
  | 'revertido';

export interface ProyectoConectado {
  id: string;
  usuarioId: string;
  repoGithubId: number;
  nombreProyecto: string;
  nombreCompleto: string;
  rama: string;
  puerto: number;
  tipoProyecto: TipoProyectoDespliegue;
  modoActualizacion: ModoActualizacionRepo;
  requiereAprobacion: boolean;
  ultimoCommitSha: string | null;
  estadoActual: EstadoProyectoDespliegue;
  totalVariables: number;
  creadoEn: string;
  actualizadoEn: string;
}

/** Vista segura de una variable de entorno: jamás expone el valor real en texto plano. */
export interface VariableEntornoVista {
  id: string;
  repositorioId: string;
  clave: string;
  valorEnmascarado: string;
  actualizadoEn: string;
}

export interface VariableEntornoPersistida {
  id: string;
  repositorioId: string;
  clave: string;
  valorCifrado: string;
  actualizadoEn: string;
}

export type TipoEscaneoSeguridad = 'secretos' | 'dependencias' | 'imagen';
export type EstadoEscaneoSeguridad = 'aprobado' | 'advertencia' | 'critico';

export interface EscaneoSeguridadEntrada {
  tipoEscaneo: TipoEscaneoSeguridad;
  herramienta: string;
  estado: EstadoEscaneoSeguridad;
  hallazgosCriticos: number;
  resumen: string;
}

export interface EscaneoSeguridadDespliegue extends EscaneoSeguridadEntrada {
  id: string;
  despliegueId: string;
  creadoEn: string;
}

export interface DespliegueRegistro {
  id: string;
  repositorioId: string;
  commitSha: string;
  origen: OrigenDespliegue;
  estado: EstadoEjecucionDespliegue;
  logConstruccion: string;
  duracionMs: number;
  ejecutadoPor: string;
  healthCheckOk: boolean | null;
  logHealthCheck: string;
  rollbackAutomatico: boolean;
  despliegueOrigenId: string | null;
  escaneos: EscaneoSeguridadDespliegue[];
  creadoEn: string;
}

export interface ResultadoDeteccionProyecto {
  tipoDetectado: TipoProyectoDespliegue | null;
  archivosEncontrados: string[];
  motivo: string;
  plantillaSugerida: string | null;
}
