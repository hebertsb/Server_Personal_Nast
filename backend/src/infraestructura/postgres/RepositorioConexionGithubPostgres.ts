import { Pool } from 'pg';
import { ConexionGithubPersistida } from '../../dominio/entidades/Github';
import { RepositorioConexionGithub } from '../../dominio/interfaces/RepositorioConexionGithub';

interface FilaConexion {
  usuario_id: string;
  usuario_github: string;
  token_cifrado: string;
  alcances: string;
  modo: 'real' | 'simulacion';
  creado_en: Date;
  actualizado_en: Date;
}

const COLUMNAS =
  'usuario_id, usuario_github, token_cifrado, alcances, modo, creado_en, actualizado_en';

function mapear(fila: FilaConexion): ConexionGithubPersistida {
  return {
    usuarioId: fila.usuario_id,
    usuarioGithub: fila.usuario_github,
    tokenCifrado: fila.token_cifrado,
    alcances: fila.alcances,
    modo: fila.modo,
    conectadoEn: new Date(fila.creado_en).toISOString(),
    actualizadoEn: new Date(fila.actualizado_en).toISOString(),
  };
}

/** Persistencia PostgreSQL de la conexión GitHub (queries 100% parametrizadas). */
export class RepositorioConexionGithubPostgres implements RepositorioConexionGithub {
  constructor(private readonly pool: Pool) {}

  public async guardar(datos: {
    usuarioId: string;
    usuarioGithub: string;
    tokenCifrado: string;
    alcances: string;
    modo: 'real' | 'simulacion';
  }): Promise<ConexionGithubPersistida> {
    const res = await this.pool.query<FilaConexion>(
      `INSERT INTO conexion_github (usuario_id, usuario_github, token_cifrado, alcances, modo)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (usuario_id) DO UPDATE SET
         usuario_github = EXCLUDED.usuario_github,
         token_cifrado = EXCLUDED.token_cifrado,
         alcances = EXCLUDED.alcances,
         modo = EXCLUDED.modo,
         actualizado_en = NOW()
       RETURNING ${COLUMNAS}`,
      [datos.usuarioId, datos.usuarioGithub, datos.tokenCifrado, datos.alcances, datos.modo],
    );
    return mapear(res.rows[0]);
  }

  public async obtenerPorUsuario(usuarioId: string): Promise<ConexionGithubPersistida | null> {
    const res = await this.pool.query<FilaConexion>(
      `SELECT ${COLUMNAS} FROM conexion_github WHERE usuario_id = $1`,
      [usuarioId],
    );
    return res.rows[0] ? mapear(res.rows[0]) : null;
  }

  public async eliminar(usuarioId: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM conexion_github WHERE usuario_id = $1', [
      usuarioId,
    ]);
    return (res.rowCount ?? 0) > 0;
  }
}
