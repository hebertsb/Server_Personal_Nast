import { Pool } from 'pg';
import {
  CodigoRecuperacionRegistro,
  DispositivoConfiable,
  NuevoEventoSeguridad,
  RepositorioSeguridad2FA,
} from '../../dominio/interfaces/RepositorioSeguridad2FA';

interface FilaDispositivo {
  id: string;
  usuario_id: string;
  etiqueta_dispositivo: string;
  ultima_ip: string;
  confiable_hasta: Date;
  creado_en: Date;
}

interface FilaCodigo {
  id: string;
  hash_codigo: string;
}

function mapearDispositivo(fila: FilaDispositivo): DispositivoConfiable {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    etiquetaDispositivo: fila.etiqueta_dispositivo,
    ultimaIp: fila.ultima_ip,
    confiableHasta: new Date(fila.confiable_hasta).toISOString(),
    creadoEn: new Date(fila.creado_en).toISOString(),
  };
}

/** Implementación PostgreSQL de 2FA, dispositivos confiables y eventos de seguridad con queries parametrizadas. */
export class RepositorioSeguridad2FAPostgres implements RepositorioSeguridad2FA {
  constructor(private readonly pool: Pool) {}

  public async guardarSecretoTotp(
    usuarioId: string,
    secretoCifrado: string,
    habilitado: boolean,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE usuarios
       SET secreto_totp = $2, totp_habilitado = $3
       WHERE id = $1`,
      [usuarioId, secretoCifrado, habilitado],
    );
  }

  public async desactivarTotp(usuarioId: string): Promise<void> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(
        `UPDATE usuarios
         SET secreto_totp = NULL, totp_habilitado = FALSE
         WHERE id = $1`,
        [usuarioId],
      );
      await cliente.query(`DELETE FROM codigos_recuperacion WHERE usuario_id = $1`, [usuarioId]);
      await cliente.query(`DELETE FROM dispositivos_confiables WHERE usuario_id = $1`, [usuarioId]);
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  public async reemplazarCodigosRecuperacion(
    usuarioId: string,
    hashes: string[],
  ): Promise<void> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(`DELETE FROM codigos_recuperacion WHERE usuario_id = $1`, [usuarioId]);
      if (hashes.length > 0) {
        await cliente.query(
          `INSERT INTO codigos_recuperacion (usuario_id, hash_codigo)
           SELECT $1::uuid, hash_item FROM UNNEST($2::text[]) AS hash_item`,
          [usuarioId, hashes],
        );
      }
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  public async listarCodigosRecuperacionDisponibles(
    usuarioId: string,
  ): Promise<CodigoRecuperacionRegistro[]> {
    const res = await this.pool.query<FilaCodigo>(
      `SELECT id, hash_codigo
       FROM codigos_recuperacion
       WHERE usuario_id = $1 AND usado = FALSE`,
      [usuarioId],
    );
    return res.rows.map((fila) => ({
      id: fila.id,
      hashCodigo: fila.hash_codigo,
    }));
  }

  public async marcarCodigoRecuperacionUsado(codigoId: string): Promise<void> {
    await this.pool.query(
      `UPDATE codigos_recuperacion SET usado = TRUE WHERE id = $1`,
      [codigoId],
    );
  }

  public async buscarDispositivoConfiableVigente(
    usuarioId: string,
    huellaDispositivo: string,
  ): Promise<DispositivoConfiable | null> {
    const res = await this.pool.query<FilaDispositivo>(
      `SELECT id, usuario_id, etiqueta_dispositivo, ultima_ip, confiable_hasta, creado_en
       FROM dispositivos_confiables
       WHERE usuario_id = $1
         AND huella_dispositivo = $2
         AND confiable_hasta > NOW()
       LIMIT 1`,
      [usuarioId, huellaDispositivo],
    );
    return res.rows.length > 0 ? mapearDispositivo(res.rows[0]) : null;
  }

  public async guardarDispositivoConfiable(datos: {
    usuarioId: string;
    huellaDispositivo: string;
    etiquetaDispositivo: string;
    ultimaIp: string;
    confiableHasta: Date;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO dispositivos_confiables (
         usuario_id, huella_dispositivo, etiqueta_dispositivo, ultima_ip, confiable_hasta
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (usuario_id, huella_dispositivo)
       DO UPDATE SET
         etiqueta_dispositivo = EXCLUDED.etiqueta_dispositivo,
         ultima_ip = EXCLUDED.ultima_ip,
         confiable_hasta = EXCLUDED.confiable_hasta`,
      [
        datos.usuarioId,
        datos.huellaDispositivo,
        datos.etiquetaDispositivo,
        datos.ultimaIp,
        datos.confiableHasta,
      ],
    );
  }

  public async listarDispositivosConfiables(usuarioId: string): Promise<DispositivoConfiable[]> {
    const res = await this.pool.query<FilaDispositivo>(
      `SELECT id, usuario_id, etiqueta_dispositivo, ultima_ip, confiable_hasta, creado_en
       FROM dispositivos_confiables
       WHERE usuario_id = $1 AND confiable_hasta > NOW()
       ORDER BY creado_en DESC`,
      [usuarioId],
    );
    return res.rows.map(mapearDispositivo);
  }

  public async revocarDispositivoConfiable(
    usuarioId: string,
    dispositivoId: string,
  ): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM dispositivos_confiables
       WHERE id = $1 AND usuario_id = $2`,
      [dispositivoId, usuarioId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  public async registrarEventoSeguridad(evento: NuevoEventoSeguridad): Promise<void> {
    await this.pool.query(
      `INSERT INTO eventos_seguridad (tipo_evento, ip_origen, severidad, detalles)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        evento.tipoEvento,
        evento.ipOrigen,
        evento.severidad,
        JSON.stringify(evento.detalles ?? {}),
      ],
    );
  }
}
