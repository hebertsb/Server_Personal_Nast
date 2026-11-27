import { Pool } from 'pg';
import {
  AlertaEnviada,
  CanalNotificacion,
  ConfiguracionNotificacion,
  IpBloqueada,
  RepositorioSeguridadRed,
} from '../../dominio/interfaces/RepositorioSeguridadRed';

interface FilaIpBloqueada {
  id: string;
  direccion_ip: string;
  motivo: string;
  bloqueado_por: string;
  creado_en: Date;
}

interface FilaConfigNotif {
  id: string;
  tipo_evento: string;
  canal: CanalNotificacion;
  destino: string;
  habilitado: boolean;
}

interface FilaAlerta {
  id: string;
  tipo_evento: string;
  mensaje: string;
  canal: CanalNotificacion;
  enviado_en: Date;
}

function mapearIp(fila: FilaIpBloqueada): IpBloqueada {
  return {
    id: fila.id,
    direccionIp: fila.direccion_ip,
    motivo: fila.motivo,
    bloqueadoPor: fila.bloqueado_por,
    creadoEn: new Date(fila.creado_en).toISOString(),
  };
}

function mapearConfig(fila: FilaConfigNotif): ConfiguracionNotificacion {
  return {
    id: fila.id,
    tipoEvento: fila.tipo_evento,
    canal: fila.canal,
    destino: fila.destino,
    habilitado: fila.habilitado,
  };
}

function mapearAlerta(fila: FilaAlerta): AlertaEnviada {
  return {
    id: Number(fila.id),
    tipoEvento: fila.tipo_evento,
    mensaje: fila.mensaje,
    canal: fila.canal,
    enviadoEn: new Date(fila.enviado_en).toISOString(),
  };
}

/** Implementación PostgreSQL de IPs bloqueadas y notificaciones con queries 100% parametrizadas. */
export class RepositorioSeguridadRedPostgres implements RepositorioSeguridadRed {
  constructor(private readonly pool: Pool) {}

  public async listarIpsBloqueadas(): Promise<IpBloqueada[]> {
    const res = await this.pool.query<FilaIpBloqueada>(
      `SELECT id, direccion_ip, motivo, bloqueado_por, creado_en
       FROM ips_bloqueadas
       ORDER BY creado_en DESC`,
    );
    return res.rows.map(mapearIp);
  }

  public async bloquearIp(datos: {
    direccionIp: string;
    motivo: string;
    bloqueadoPor: string;
  }): Promise<IpBloqueada> {
    const res = await this.pool.query<FilaIpBloqueada>(
      `INSERT INTO ips_bloqueadas (direccion_ip, motivo, bloqueado_por)
       VALUES ($1, $2, $3)
       ON CONFLICT (direccion_ip)
       DO UPDATE SET
         motivo = EXCLUDED.motivo,
         bloqueado_por = EXCLUDED.bloqueado_por,
         creado_en = NOW()
       RETURNING id, direccion_ip, motivo, bloqueado_por, creado_en`,
      [datos.direccionIp, datos.motivo, datos.bloqueadoPor],
    );
    return mapearIp(res.rows[0]);
  }

  public async desbloquearIp(id: string): Promise<IpBloqueada | null> {
    const res = await this.pool.query<FilaIpBloqueada>(
      `DELETE FROM ips_bloqueadas
       WHERE id = $1
       RETURNING id, direccion_ip, motivo, bloqueado_por, creado_en`,
      [id],
    );
    return res.rows.length > 0 ? mapearIp(res.rows[0]) : null;
  }

  public async listarConfiguracionNotificaciones(): Promise<ConfiguracionNotificacion[]> {
    const res = await this.pool.query<FilaConfigNotif>(
      `SELECT id, tipo_evento, canal, destino, habilitado
       FROM configuracion_notificaciones
       ORDER BY tipo_evento ASC, canal ASC`,
    );
    return res.rows.map(mapearConfig);
  }

  public async actualizarConfiguracionNotificacion(datos: {
    tipoEvento: string;
    canal: CanalNotificacion;
    destino: string;
    habilitado: boolean;
  }): Promise<ConfiguracionNotificacion> {
    const res = await this.pool.query<FilaConfigNotif>(
      `INSERT INTO configuracion_notificaciones (tipo_evento, canal, destino, habilitado)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tipo_evento, canal)
       DO UPDATE SET
         destino = EXCLUDED.destino,
         habilitado = EXCLUDED.habilitado
       RETURNING id, tipo_evento, canal, destino, habilitado`,
      [datos.tipoEvento, datos.canal, datos.destino, datos.habilitado],
    );
    return mapearConfig(res.rows[0]);
  }

  public async registrarAlertaEnviada(datos: {
    tipoEvento: string;
    mensaje: string;
    canal: CanalNotificacion;
  }): Promise<AlertaEnviada> {
    const res = await this.pool.query<FilaAlerta>(
      `INSERT INTO alertas_enviadas (tipo_evento, mensaje, canal)
       VALUES ($1, $2, $3)
       RETURNING id, tipo_evento, mensaje, canal, enviado_en`,
      [datos.tipoEvento, datos.mensaje, datos.canal],
    );
    return mapearAlerta(res.rows[0]);
  }

  public async listarAlertasEnviadas(limite: number): Promise<AlertaEnviada[]> {
    const res = await this.pool.query<FilaAlerta>(
      `SELECT id, tipo_evento, mensaje, canal, enviado_en
       FROM alertas_enviadas
       ORDER BY enviado_en DESC
       LIMIT $1`,
      [limite],
    );
    return res.rows.map(mapearAlerta);
  }
}
