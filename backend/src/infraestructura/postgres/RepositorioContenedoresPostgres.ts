import { Pool } from 'pg';
import { Contenedor } from '../../dominio/entidades/Contenedor';
import { RepositorioContenedores } from '../../dominio/interfaces/RepositorioContenedores';

/** Persiste snapshots de estado y consumo de contenedores usando queries parametrizadas. */
export class RepositorioContenedoresPostgres implements RepositorioContenedores {
  constructor(private readonly pool: Pool) {}

  public async guardarSnapshots(contenedores: Contenedor[]): Promise<void> {
    if (contenedores.length === 0) return;

    const nombres: string[] = [];
    const estados: string[] = [];
    const cpus: number[] = [];
    const rams: number[] = [];

    for (const c of contenedores) {
      nombres.push(c.nombre);
      estados.push(c.estado);
      cpus.push(c.porcentajeCpu);
      rams.push(c.ramUsadaMb);
    }

    await this.pool.query(
      `INSERT INTO contenedores_snapshot (nombre_contenedor, estado, porcentaje_cpu, ram_mb)
       SELECT * FROM UNNEST($1::varchar[], $2::varchar[], $3::numeric[], $4::numeric[])`,
      [nombres, estados, cpus, rams],
    );
  }
}
