import { Pool } from 'pg';
import {
  PuntoHistoricoRecursos,
  RangoHistorico,
  RecursosHost,
} from '../../dominio/entidades/RecursosHost';
import { RepositorioRecursosHost } from '../../dominio/interfaces/RepositorioRecursosHost';

interface FilaSnapshotHost {
  porcentaje_cpu: string;
  ram_usada_mb: string;
  ram_total_mb: string;
  temperatura_c: string | null;
  fecha_hora: Date;
}

const INTERVALO_POR_RANGO: Record<RangoHistorico, string> = {
  '1h': '1 hour',
  '24h': '24 hours',
  '7d': '7 days',
};

/** Persiste y consulta snapshots históricos de recursos del host con queries parametrizadas. */
export class RepositorioRecursosHostPostgres implements RepositorioRecursosHost {
  constructor(private readonly pool: Pool) {}

  public async guardarSnapshot(recursos: RecursosHost): Promise<void> {
    await this.pool.query(
      `INSERT INTO recursos_host_snapshot (porcentaje_cpu, ram_usada_mb, ram_total_mb, temperatura_c)
       VALUES ($1, $2, $3, $4)`,
      [
        recursos.porcentajeCpu,
        recursos.ramUsadaMb,
        recursos.ramTotalMb,
        recursos.temperaturaC,
      ],
    );
  }

  public async obtenerHistorico(rango: RangoHistorico): Promise<PuntoHistoricoRecursos[]> {
    const intervalo = INTERVALO_POR_RANGO[rango];
    const resultado = await this.pool.query<FilaSnapshotHost>(
      `SELECT porcentaje_cpu, ram_usada_mb, ram_total_mb, temperatura_c, fecha_hora
       FROM (
         SELECT porcentaje_cpu, ram_usada_mb, ram_total_mb, temperatura_c, fecha_hora
         FROM recursos_host_snapshot
         WHERE fecha_hora >= NOW() - $1::interval
         ORDER BY fecha_hora DESC
         LIMIT 240
       ) recientes
       ORDER BY fecha_hora ASC`,
      [intervalo],
    );

    return resultado.rows.map((fila) => ({
      porcentajeCpu: Number(fila.porcentaje_cpu),
      ramUsadaMb: Number(fila.ram_usada_mb),
      ramTotalMb: Number(fila.ram_total_mb),
      temperaturaC: fila.temperatura_c !== null ? Number(fila.temperatura_c) : null,
      fechaHora: new Date(fila.fecha_hora).toISOString(),
    }));
  }
}
