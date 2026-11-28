import { apiCliente } from './apiCliente';

export type ModoGithub = 'real' | 'simulacion';
export type TipoProyectoDespliegue = 'dockerfile' | 'nodejs' | 'html_estatico';
export type ModoActualizacionRepo = 'webhook' | 'polling';

export interface ConexionGithubItem {
  usuarioGithub: string;
  alcances: string;
  modo: ModoGithub;
  conectadoEn: string;
  actualizadoEn: string;
}

export interface RepositorioGithubItem {
  id: number;
  nombre: string;
  nombreCompleto: string;
  privado: boolean;
  descripcion: string | null;
  ramaPrincipal: string;
  lenguaje: string | null;
  ultimoCommit: {
    sha: string;
    mensaje: string;
    fecha: string;
  } | null;
  urlHtml: string;
}

export interface ProyectoConectadoItem {
  id: string;
  repoGithubId: number;
  nombreProyecto: string;
  nombreCompleto: string;
  rama: string;
  puerto: number;
  tipoProyecto: TipoProyectoDespliegue;
  modoActualizacion: ModoActualizacionRepo;
  requiereAprobacion: boolean;
  ultimoCommitSha: string | null;
  estadoActual: 'configurado' | 'desplegando' | 'activo' | 'fallido' | 'pendiente_aprobacion';
  totalVariables: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface VariableEntornoItem {
  id: string;
  repositorioId: string;
  clave: string;
  valorEnmascarado: string;
  actualizadoEn: string;
}

export interface EscaneoSeguridadItem {
  id: string;
  despliegueId: string;
  tipoEscaneo: 'secretos' | 'dependencias' | 'imagen';
  herramienta: string;
  estado: 'aprobado' | 'advertencia' | 'critico';
  hallazgosCriticos: number;
  resumen: string;
  creadoEn: string;
}

export interface DespliegueRegistroItem {
  id: string;
  repositorioId: string;
  commitSha: string;
  origen: 'manual' | 'webhook' | 'polling' | 'rollback' | 'mcp';
  estado: 'exitoso' | 'fallido' | 'pendiente_aprobacion' | 'revertido';
  logConstruccion: string;
  duracionMs: number;
  ejecutadoPor: string;
  healthCheckOk: boolean | null;
  logHealthCheck: string;
  rollbackAutomatico: boolean;
  despliegueOrigenId: string | null;
  escaneos: EscaneoSeguridadItem[];
  creadoEn: string;
}

export interface PasoVerificacionDespliegueItem {
  id: string;
  nombre: string;
  estado: 'aprobado' | 'advertencia' | 'rechazado';
  detalle: string;
  recomendacion?: string;
}

export interface ResultadoCadenaVerificacionItem {
  aptoParaDesplegar: boolean;
  resumen: string;
  pasos: PasoVerificacionDespliegueItem[];
}

export interface ResultadoDeteccionItem {
  tipoDetectado: TipoProyectoDespliegue | null;
  archivosEncontrados: string[];
  motivo: string;
  plantillaSugerida: string | null;
  variablesSugeridas?: string[];
  carpetaRaiz?: string;
  verificacion?: ResultadoCadenaVerificacionItem;
}

export const githubServicio = {
  obtenerEstado: (
    tokenAcceso: string,
  ): Promise<{ conexion: ConexionGithubItem | null; oauthHabilitado?: boolean }> =>
    apiCliente.get<{ conexion: ConexionGithubItem | null; oauthHabilitado?: boolean }>(
      '/github/conexion',
      tokenAcceso,
    ),

  iniciarOAuth: (tokenAcceso: string): Promise<{ urlAutorizacion: string }> =>
    apiCliente.post<{ urlAutorizacion: string }>('/github/oauth/iniciar', {}, tokenAcceso),

  conectar: (token: string, tokenAcceso: string): Promise<{ conexion: ConexionGithubItem }> =>
    apiCliente.post<{ conexion: ConexionGithubItem }>('/github/conexion', { token }, tokenAcceso),

  desconectar: (tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>('/github/conexion', tokenAcceso),

  listarRepositorios: (
    tokenAcceso: string,
  ): Promise<{ repositorios: RepositorioGithubItem[] }> =>
    apiCliente.get<{ repositorios: RepositorioGithubItem[] }>('/github/repositorios', tokenAcceso),

  // Fase 3b — Proyectos desplegados, auto-detección y variables cifradas
  sugerirPuerto: (
    tokenAcceso: string,
  ): Promise<{ puertoSugerido: number; puertosOcupados: number[] }> =>
    apiCliente.get<{ puertoSugerido: number; puertosOcupados: number[] }>(
      '/despliegues/puerto-sugerido',
      tokenAcceso,
    ),

  listarProyectos: (tokenAcceso: string): Promise<{ proyectos: ProyectoConectadoItem[] }> =>
    apiCliente.get<{ proyectos: ProyectoConectadoItem[] }>('/despliegues/proyectos', tokenAcceso),

  detectarProyecto: (
    datos: { nombreCompleto: string; rama: string; puerto: number; carpetaRaiz?: string },
    tokenAcceso: string,
  ): Promise<{ deteccion: ResultadoDeteccionItem }> =>
    apiCliente.post<{ deteccion: ResultadoDeteccionItem }>(
      '/despliegues/proyectos/detectar',
      datos,
      tokenAcceso,
    ),

  crearProyecto: (
    datos: {
      repoGithubId: number;
      nombreProyecto: string;
      nombreCompleto: string;
      rama: string;
      puerto: number;
      carpetaRaiz?: string;
      subdominio?: string;
      gpuRemotaUrl?: string;
      tipoProyecto?: TipoProyectoDespliegue;
      modoActualizacion: ModoActualizacionRepo;
      requiereAprobacion: boolean;
      ultimoCommitSha?: string | null;
      desplegarAhora?: boolean;
      variablesIniciales?: Array<{ clave: string; valor: string }>;
    },
    tokenAcceso: string,
  ): Promise<{
    proyecto: ProyectoConectadoItem;
    despliegueInicial: DespliegueRegistroItem | null;
  }> => apiCliente.post('/despliegues/proyectos', datos, tokenAcceso),

  actualizarProyecto: (
    proyectoId: string,
    cambios: {
      rama?: string;
      puerto?: number;
      modoActualizacion?: ModoActualizacionRepo;
      requiereAprobacion?: boolean;
    },
    tokenAcceso: string,
  ): Promise<{ proyecto: ProyectoConectadoItem }> =>
    apiCliente.patch<{ proyecto: ProyectoConectadoItem }>(
      `/despliegues/proyectos/${encodeURIComponent(proyectoId)}`,
      cambios,
      tokenAcceso,
    ),

  eliminarProyecto: (proyectoId: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(
      `/despliegues/proyectos/${encodeURIComponent(proyectoId)}`,
      tokenAcceso,
    ),

  redeployProyecto: (
    proyectoId: string,
    tokenAcceso: string,
  ): Promise<{ despliegue: DespliegueRegistroItem }> =>
    apiCliente.post<{ despliegue: DespliegueRegistroItem }>(
      `/despliegues/proyectos/${encodeURIComponent(proyectoId)}/redeploy`,
      undefined,
      tokenAcceso,
    ),

  listarHistorial: (
    proyectoId: string,
    tokenAcceso: string,
  ): Promise<{ despliegues: DespliegueRegistroItem[] }> =>
    apiCliente.get<{ despliegues: DespliegueRegistroItem[] }>(
      `/despliegues/proyectos/${encodeURIComponent(proyectoId)}/historial`,
      tokenAcceso,
    ),

  listarVariables: (
    proyectoId: string,
    tokenAcceso: string,
  ): Promise<{ variables: VariableEntornoItem[] }> =>
    apiCliente.get<{ variables: VariableEntornoItem[] }>(
      `/despliegues/proyectos/${encodeURIComponent(proyectoId)}/variables`,
      tokenAcceso,
    ),

  guardarVariable: (
    proyectoId: string,
    datos: { clave: string; valor: string },
    tokenAcceso: string,
  ): Promise<{ variable: VariableEntornoItem }> =>
    apiCliente.post<{ variable: VariableEntornoItem }>(
      `/despliegues/proyectos/${encodeURIComponent(proyectoId)}/variables`,
      datos,
      tokenAcceso,
    ),

  eliminarVariable: (
    proyectoId: string,
    variableId: string,
    tokenAcceso: string,
  ): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(
      `/despliegues/proyectos/${encodeURIComponent(proyectoId)}/variables/${encodeURIComponent(
        variableId,
      )}`,
      tokenAcceso,
    ),

  // Fase 3c — Polling, Aprobación manual, Reversión (RF-50) y simulador local de push
  ejecutarPolling: (tokenAcceso: string): Promise<{ revisados: number; disparados: number }> =>
    apiCliente.post<{ revisados: number; disparados: number }>(
      '/despliegues/polling/ejecutar',
      undefined,
      tokenAcceso,
    ),

  aprobarDespliegue: (
    proyectoId: string,
    despliegueId: string,
    tokenAcceso: string,
  ): Promise<{ despliegue: DespliegueRegistroItem }> =>
    apiCliente.post<{ despliegue: DespliegueRegistroItem }>(
      `/despliegues/proyectos/${encodeURIComponent(proyectoId)}/despliegues/${encodeURIComponent(
        despliegueId,
      )}/aprobar`,
      undefined,
      tokenAcceso,
    ),

  revertirDespliegue: (
    proyectoId: string,
    despliegueId: string,
    tokenAcceso: string,
  ): Promise<{ despliegue: DespliegueRegistroItem }> =>
    apiCliente.post<{ despliegue: DespliegueRegistroItem }>(
      `/despliegues/proyectos/${encodeURIComponent(proyectoId)}/despliegues/${encodeURIComponent(
        despliegueId,
      )}/revertir`,
      undefined,
      tokenAcceso,
    ),

  simularPush: (
    proyectoId: string,
    escenario: 'normal' | 'gate_critico' | 'fallo_healthcheck',
    tokenAcceso: string,
  ): Promise<{ despliegue: DespliegueRegistroItem }> =>
    apiCliente.post<{ despliegue: DespliegueRegistroItem }>(
      `/despliegues/proyectos/${encodeURIComponent(proyectoId)}/simular-push`,
      { escenario },
      tokenAcceso,
    ),
};
