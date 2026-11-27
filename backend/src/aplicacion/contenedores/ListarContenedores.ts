import { Contenedor } from '../../dominio/entidades/Contenedor';
import { Colector } from '../../dominio/interfaces/Colector';
import { RepositorioContenedores } from '../../dominio/interfaces/RepositorioContenedores';

export interface ResumenContenedores {
  total: number;
  activos: number;
  detenidos: number;
  conProblemas: number;
}

export interface ResultadoListarContenedores {
  contenedores: Contenedor[];
  resumen: ResumenContenedores;
  actualizadoEn: string;
}

const PRIORIDAD_ESTADO: Record<Contenedor['estado'], number> = {
  unhealthy: 0,
  running: 1,
  restarting: 2,
  paused: 3,
  stopped: 4,
};

/**
 * Caso de uso RF-05 / RF-06: recolecta todos los contenedores del host,
 * persiste un snapshot en PostgreSQL y devuelve la lista ordenada con resumen.
 */
export class ListarContenedores {
  constructor(
    private readonly colectorDocker: Colector<Contenedor[]>,
    private readonly repositorioContenedores: RepositorioContenedores,
  ) {}

  public async ejecutar(): Promise<ResultadoListarContenedores> {
    const recolectados = await this.colectorDocker.recolectar();

    const contenedores = [...recolectados].sort((a, b) => {
      const diferenciaEstado = PRIORIDAD_ESTADO[a.estado] - PRIORIDAD_ESTADO[b.estado];
      if (diferenciaEstado !== 0) return diferenciaEstado;
      return a.nombre.localeCompare(b.nombre);
    });

    if (contenedores.length > 0) {
      await this.repositorioContenedores.guardarSnapshots(contenedores);
    }

    const resumen: ResumenContenedores = {
      total: contenedores.length,
      activos: contenedores.filter((c) => c.estado === 'running').length,
      detenidos: contenedores.filter((c) => c.estado === 'stopped' || c.estado === 'paused').length,
      conProblemas: contenedores.filter(
        (c) => c.estado === 'unhealthy' || c.estado === 'restarting',
      ).length,
    };

    return {
      contenedores,
      resumen,
      actualizadoEn: new Date().toISOString(),
    };
  }
}
