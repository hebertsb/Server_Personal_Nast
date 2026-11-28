import {
  DespliegueRegistro,
  EscaneoSeguridadDespliegue,
  EscaneoSeguridadEntrada,
  EstadoEjecucionDespliegue,
  EstadoProyectoDespliegue,
  ModoActualizacionRepo,
  OrigenDespliegue,
  ProyectoConectado,
  TipoProyectoDespliegue,
  VariableEntornoPersistida,
} from '../entidades/Despliegue';

export interface DatosCrearProyecto {
  usuarioId: string;
  repoGithubId: number;
  nombreProyecto: string;
  nombreCompleto: string;
  rama: string;
  puerto: number;
  carpetaRaiz?: string;
  subdominio?: string;
  tipoProyecto: TipoProyectoDespliegue;
  modoActualizacion: ModoActualizacionRepo;
  requiereAprobacion: boolean;
  ultimoCommitSha: string | null;
}

export interface DatosActualizarProyecto {
  rama?: string;
  puerto?: number;
  modoActualizacion?: ModoActualizacionRepo;
  requiereAprobacion?: boolean;
}

export interface RepositorioDespliegues {
  crearProyecto(datos: DatosCrearProyecto): Promise<ProyectoConectado>;
  listarProyectos(): Promise<ProyectoConectado[]>;
  obtenerProyectoPorId(id: string): Promise<ProyectoConectado | null>;
  obtenerProyectoPorNombreCompleto(nombreCompleto: string): Promise<ProyectoConectado | null>;
  actualizarProyecto(
    id: string,
    cambios: DatosActualizarProyecto,
  ): Promise<ProyectoConectado | null>;
  actualizarEstadoProyecto(
    id: string,
    estado: EstadoProyectoDespliegue,
    ultimoCommitSha?: string | null,
  ): Promise<void>;
  eliminarProyecto(id: string): Promise<boolean>;

  listarVariables(repositorioId: string): Promise<VariableEntornoPersistida[]>;
  guardarVariable(
    repositorioId: string,
    clave: string,
    valorCifrado: string,
  ): Promise<VariableEntornoPersistida>;
  eliminarVariable(repositorioId: string, variableId: string): Promise<string | null>;

  registrarDespliegue(datos: {
    repositorioId: string;
    commitSha: string;
    origen: OrigenDespliegue;
    estado: EstadoEjecucionDespliegue;
    logConstruccion: string;
    duracionMs: number;
    ejecutadoPor: string;
    healthCheckOk?: boolean | null;
    logHealthCheck?: string;
    rollbackAutomatico?: boolean;
    despliegueOrigenId?: string | null;
    escaneos?: EscaneoSeguridadEntrada[];
  }): Promise<DespliegueRegistro>;
  obtenerDesplieguePorId(
    repositorioId: string,
    despliegueId: string,
  ): Promise<DespliegueRegistro | null>;
  listarDespliegues(repositorioId: string, limite?: number): Promise<DespliegueRegistro[]>;
  listarEscaneosPorDespliegue(despliegueId: string): Promise<EscaneoSeguridadDespliegue[]>;
}
