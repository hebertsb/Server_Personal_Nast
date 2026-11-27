import { Pool } from 'pg';
import { PermisoMcp, TokenMcpPersistido } from '../../dominio/entidades/IaYMcp';
import { RepositorioTokensMcp } from '../../dominio/interfaces/RepositorioTokensMcp';

interface FilaTokenMcp {
  id: string;
  usuario_id: string;
  nombre: string;
  prefijo: string;
  token_hash: string;
  permiso: PermisoMcp;
  ultimo_uso_en: Date | null;
  revocado: boolean;
  creado_en: Date;
}

function mapear(fila: FilaTokenMcp): TokenMcpPersistido {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    nombre: fila.nombre,
    prefijo: fila.prefijo,
    tokenHash: fila.token_hash,
    permiso: fila.permiso,
    ultimoUsoEn: fila.ultimo_uso_en ? new Date(fila.ultimo_uso_en).toISOString() : null,
    revocado: Boolean(fila.revocado),
    creadoEn: new Date(fila.creado_en).toISOString(),
  };
}

/** Persistencia PostgreSQL de tokens MCP (solo hash SHA-256, queries 100% parametrizadas). */
export class RepositorioTokensMcpPostgres implements RepositorioTokensMcp {
  constructor(private readonly pool: Pool) {}

  public async crear(datos: {
    usuarioId: string;
    nombre: string;
    prefijo: string;
    tokenHash: string;
    permiso: PermisoMcp;
  }): Promise<TokenMcpPersistido> {
    const res = await this.pool.query<FilaTokenMcp>(
      `INSERT INTO tokens_mcp (usuario_id, nombre, prefijo, token_hash, permiso)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, usuario_id, nombre, prefijo, token_hash, permiso, ultimo_uso_en, revocado, creado_en`,
      [datos.usuarioId, datos.nombre, datos.prefijo, datos.tokenHash, datos.permiso],
    );
    return mapear(res.rows[0]);
  }

  public async listar(): Promise<TokenMcpPersistido[]> {
    const res = await this.pool.query<FilaTokenMcp>(
      `SELECT id, usuario_id, nombre, prefijo, token_hash, permiso, ultimo_uso_en, revocado, creado_en
       FROM tokens_mcp
       ORDER BY creado_en DESC`,
    );
    return res.rows.map(mapear);
  }

  public async buscarActivoPorHash(tokenHash: string): Promise<TokenMcpPersistido | null> {
    const res = await this.pool.query<FilaTokenMcp>(
      `SELECT id, usuario_id, nombre, prefijo, token_hash, permiso, ultimo_uso_en, revocado, creado_en
       FROM tokens_mcp
       WHERE token_hash = $1 AND revocado = FALSE`,
      [tokenHash],
    );
    return res.rows[0] ? mapear(res.rows[0]) : null;
  }

  public async registrarUso(id: string): Promise<void> {
    await this.pool.query('UPDATE tokens_mcp SET ultimo_uso_en = NOW() WHERE id = $1', [id]);
  }

  public async revocar(id: string): Promise<boolean> {
    const res = await this.pool.query(
      'UPDATE tokens_mcp SET revocado = TRUE WHERE id = $1 AND revocado = FALSE',
      [id],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
