import { Pool } from 'pg';
import {
  RegistroAuditoriaDatos,
  RepositorioAuditoria,
} from '../../dominio/interfaces/RepositorioAuditoria';

/** Registra acciones de control de forma inmutable (solo inserción) en PostgreSQL. */
export class RepositorioAuditoriaPostgres implements RepositorioAuditoria {
  constructor(private readonly pool: Pool) {}

  public async registrar(registro: RegistroAuditoriaDatos): Promise<void> {
    await this.pool.query(
      `INSERT INTO auditoria_acciones (usuario_id, accion, recurso, origen, direccion_ip, detalles)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        registro.usuarioId,
        registro.accion,
        registro.recurso,
        registro.origen,
        registro.direccionIp,
        JSON.stringify(registro.detalles ?? {}),
      ],
    );
  }
}
