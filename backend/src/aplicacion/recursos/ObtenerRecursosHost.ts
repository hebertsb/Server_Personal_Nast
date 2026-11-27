import { RecursosHost } from '../../dominio/entidades/RecursosHost';
import { Colector } from '../../dominio/interfaces/Colector';
import { RepositorioRecursosHost } from '../../dominio/interfaces/RepositorioRecursosHost';

export interface OpcionesObtenerRecursos {
  persistir?: boolean;
}

/**
 * Caso de uso RF-24 / RF-27: recolecta las métricas actuales del host (CPU, RAM,
 * discos y temperatura) mediante Strategy y guarda un snapshot en PostgreSQL.
 */
export class ObtenerRecursosHost {
  constructor(
    private readonly colectorRecursosHost: Colector<RecursosHost>,
    private readonly repositorioRecursos: RepositorioRecursosHost,
  ) {}

  public async ejecutar(opciones: OpcionesObtenerRecursos = {}): Promise<RecursosHost> {
    const recursos = await this.colectorRecursosHost.recolectar();

    if (opciones.persistir !== false) {
      await this.repositorioRecursos.guardarSnapshot(recursos);
    }

    return recursos;
  }
}
