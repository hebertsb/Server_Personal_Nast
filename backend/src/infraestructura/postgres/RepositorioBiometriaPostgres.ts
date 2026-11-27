import { Pool } from 'pg';
import { CredencialBiometrica } from '../../dominio/entidades/CredencialBiometrica';
import {
  GuardarCredencialBiometricaDatos,
  RepositorioBiometria,
} from '../../dominio/interfaces/RepositorioBiometria';

interface FilaCredencial {
  id: string;
  usuario_id: string;
  credencial_id: string;
  clave_publica: string;
  contador: string | number;
  transports: unknown;
  etiqueta_dispositivo: string;
  ultimo_uso_en: Date | null;
  creado_en: Date;
}

function mapearFila(fila: FilaCredencial): CredencialBiometrica {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    credencialId: fila.credencial_id,
    clavePublica: fila.clave_publica,
    contador: Number(fila.contador ?? 0),
    transports: Array.isArray(fila.transports)
      ? fila.transports.filter((t): t is string => typeof t === 'string')
      : [],
    etiquetaDispositivo: fila.etiqueta_dispositivo,
    ultimoUsoEn: fila.ultimo_uso_en ? new Date(fila.ultimo_uso_en) : null,
    creadoEn: new Date(fila.creado_en),
  };
}

/** Implementación PostgreSQL de RepositorioBiometria usando queries parametrizadas. */
export class RepositorioBiometriaPostgres implements RepositorioBiometria {
  constructor(private readonly pool: Pool) {}

  public async listarPorUsuario(usuarioId: string): Promise<CredencialBiometrica[]> {
    const res = await this.pool.query<FilaCredencial>(
      `SELECT id, usuario_id, credencial_id, clave_publica, contador, transports,
              etiqueta_dispositivo, ultimo_uso_en, creado_en
       FROM credenciales_biometricas
       WHERE usuario_id = $1
       ORDER BY creado_en DESC`,
      [usuarioId],
    );
    return res.rows.map(mapearFila);
  }

  public async buscarPorCredencialId(credencialId: string): Promise<CredencialBiometrica | null> {
    const res = await this.pool.query<FilaCredencial>(
      `SELECT id, usuario_id, credencial_id, clave_publica, contador, transports,
              etiqueta_dispositivo, ultimo_uso_en, creado_en
       FROM credenciales_biometricas
       WHERE credencial_id = $1
       LIMIT 1`,
      [credencialId],
    );
    if (res.rows.length === 0) return null;
    return mapearFila(res.rows[0]);
  }

  public async guardar(datos: GuardarCredencialBiometricaDatos): Promise<CredencialBiometrica> {
    const res = await this.pool.query<FilaCredencial>(
      `INSERT INTO credenciales_biometricas
         (usuario_id, credencial_id, clave_publica, contador, transports, etiqueta_dispositivo)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, usuario_id, credencial_id, clave_publica, contador, transports,
                 etiqueta_dispositivo, ultimo_uso_en, creado_en`,
      [
        datos.usuarioId,
        datos.credencialId,
        datos.clavePublica,
        datos.contador,
        JSON.stringify(datos.transports),
        datos.etiquetaDispositivo.slice(0, 150),
      ],
    );
    return mapearFila(res.rows[0]);
  }

  public async actualizarContadorYUso(id: string, nuevoContador: number): Promise<void> {
    await this.pool.query(
      `UPDATE credenciales_biometricas
       SET contador = $2, ultimo_uso_en = NOW()
       WHERE id = $1`,
      [id, nuevoContador],
    );
  }

  public async eliminar(id: string, usuarioId: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM credenciales_biometricas
       WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
