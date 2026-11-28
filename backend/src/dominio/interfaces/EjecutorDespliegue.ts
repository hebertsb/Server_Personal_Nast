import { TipoProyectoDespliegue } from '../entidades/Despliegue';
import { PruebaSaludDespliegue } from '../reglas/ReporteSaludDespliegue';

export interface EntradaEjecucionDespliegue {
  nombreProyecto: string;
  nombreCompleto: string;
  rama: string;
  commitSha: string;
  puerto: number;
  carpetaRaiz?: string;
  subdominio?: string;
  tipoProyecto: TipoProyectoDespliegue;
  plantillaDockerfile: string | null;
  tokenGithub: string;
  variablesEntorno: Record<string, string>;
}

export interface ResultadoEjecucionDespliegue {
  exitoso: boolean;
  healthCheckOk: boolean;
  logConstruccion: string;
  logHealthCheck: string;
  nombreContenedor: string;
  pruebasAntes?: PruebaSaludDespliegue[];
  pruebasDespues?: PruebaSaludDespliegue[];
}

export interface EjecutorDespliegue {
  readonly modo: 'simulacion' | 'real';
  ejecutar(entrada: EntradaEjecucionDespliegue): Promise<ResultadoEjecucionDespliegue>;
}
