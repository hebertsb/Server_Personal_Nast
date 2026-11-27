import { TipoProyectoDespliegue } from '../entidades/Despliegue';

export interface EntradaEjecucionDespliegue {
  nombreProyecto: string;
  nombreCompleto: string;
  rama: string;
  commitSha: string;
  puerto: number;
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
}

export interface EjecutorDespliegue {
  readonly modo: 'simulacion' | 'real';
  ejecutar(entrada: EntradaEjecucionDespliegue): Promise<ResultadoEjecucionDespliegue>;
}
