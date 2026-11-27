import { Pool } from 'pg';
import {
  Automatizacion,
  CanalNotificacionRegla,
  ConfiguracionAutomatizacion,
  LogAutomatizacion,
  ResultadoEjecucionAutomatizacion,
  TipoAutomatizacion,
} from '../../dominio/entidades/Automatizacion';
import {
  DatosActualizarAutomatizacion,
  DatosCrearAutomatizacion,
  RepositorioAutomatizaciones,
} from '../../dominio/interfaces/RepositorioAutomatizaciones';

interface FilaAutomatizacion {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: TipoAutomatizacion;
  configuracion: ConfiguracionAutomatizacion;
  canal_notificacion: CanalNotificacionRegla;
  habilitado: boolean;
  ultima_ejecucion_en: Date | null;
  ultimo_resultado: ResultadoEjecucionAutomatizacion | null;
  proxima_ejecucion_en: Date | null;
  enfriamiento_hasta: Date | null;
  creado_en: Date;
  actualizado_en: Date;
}

interface FilaLog {
  id: string;
  automatizacion_id: string;
  nombre_automatizacion: string;
  tipo_automatizacion: TipoAutomatizacion;
  resultado: ResultadoEjecucionAutomatizacion;
  detalle: string;
  fecha_hora: Date;
}

const COLS_AUTO = `id, nombre, descripcion, tipo, configuracion, canal_notificacion,
  habilitado, ultima_ejecucion_en, ultimo_resultado, proxima_ejecucion_en,
  enfriamiento_hasta, creado_en, actualizado_en`;

function mapearAutomatizacion(fila: FilaAutomatizacion): Automatizacion {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion ?? '',
    tipo: fila.tipo,
    configuracion: fila.configuracion,
    canalNotificacion: fila.canal_notificacion ?? 'panel',
    habilitado: Boolean(fila.habilitado),
    ultimaEjecucionEn: fila.ultima_ejecucion_en
      ? new Date(fila.ultima_ejecucion_en).toISOString()
      : null,
    ultimoResultado: fila.ultimo_resultado ?? null,
    proximaEjecucionEn: fila.proxima_ejecucion_en
      ? new Date(fila.proxima_ejecucion_en).toISOString()
      : null,
    enfriamientoHasta: fila.enfriamiento_hasta
      ? new Date(fila.enfriamiento_hasta).toISOString()
      : null,
    creadoEn: new Date(fila.creado_en).toISOString(),
    actualizadoEn: new Date(fila.actualizado_en).toISOString(),
  };
}

function mapearLog(fila: FilaLog): LogAutomatizacion {
  return {
    id: Number(fila.id),
    automatizacionId: fila.automatizacion_id,
    nombreAutomatizacion: fila.nombre_automatizacion,
    tipoAutomatizacion: fila.tipo_automatizacion,
    resultado: fila.resultado,
    detalle: fila.detalle,
    fechaHora: new Date(fila.fecha_hora).toISOString(),
  };
}

/** Implementación PostgreSQL de automatizaciones y su historial (queries 100% parametrizadas). */
export class RepositorioAutomatizacionesPostgres implements RepositorioAutomatizaciones {
  constructor(private readonly pool: Pool) {}

  public async listar(): Promise<Automatizacion[]> {
    const res = await this.pool.query<FilaAutomatizacion>(
      `SELECT ${COLS_AUTO}
       FROM automatizaciones
       ORDER BY creado_en DESC`,
    );
    return res.rows.map(mapearAutomatizacion);
  }

  public async obtenerPorId(id: string): Promise<Automatizacion | null> {
    const res = await this.pool.query<FilaAutomatizacion>(
      `SELECT ${COLS_AUTO}
       FROM automatizaciones
       WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? mapearAutomatizacion(res.rows[0]) : null;
  }

  public async crear(datos: DatosCrearAutomatizacion): Promise<Automatizacion> {
    const res = await this.pool.query<FilaAutomatizacion>(
      `INSERT INTO automatizaciones (
         nombre, descripcion, tipo, configuracion, canal_notificacion, habilitado, proxima_ejecucion_en
       )
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::timestamptz)
       RETURNING ${COLS_AUTO}`,
      [
        datos.nombre,
        datos.descripcion,
        datos.tipo,
        JSON.stringify(datos.configuracion),
        datos.canalNotificacion,
        datos.habilitado,
        datos.proximaEjecucionEn,
      ],
    );
    return mapearAutomatizacion(res.rows[0]);
  }

  public async actualizar(
    id: string,
    datos: DatosActualizarAutomatizacion,
  ): Promise<Automatizacion | null> {
    const res = await this.pool.query<FilaAutomatizacion>(
      `UPDATE automatizaciones
       SET nombre = $2,
           descripcion = $3,
           tipo = $4,
           configuracion = $5::jsonb,
           canal_notificacion = $6,
           habilitado = $7,
           proxima_ejecucion_en = $8::timestamptz,
           actualizado_en = NOW()
       WHERE id = $1
       RETURNING ${COLS_AUTO}`,
      [
        id,
        datos.nombre,
        datos.descripcion,
        datos.tipo,
        JSON.stringify(datos.configuracion),
        datos.canalNotificacion,
        datos.habilitado,
        datos.proximaEjecucionEn,
      ],
    );
    return res.rows[0] ? mapearAutomatizacion(res.rows[0]) : null;
  }

  public async actualizarHabilitado(
    id: string,
    habilitado: boolean,
  ): Promise<Automatizacion | null> {
    const res = await this.pool.query<FilaAutomatizacion>(
      `UPDATE automatizaciones
       SET habilitado = $2, actualizado_en = NOW()
       WHERE id = $1
       RETURNING ${COLS_AUTO}`,
      [id, habilitado],
    );
    return res.rows[0] ? mapearAutomatizacion(res.rows[0]) : null;
  }

  public async actualizarEstadoEjecucion(
    id: string,
    datos: {
      ultimoResultado: ResultadoEjecucionAutomatizacion;
      enfriamientoHasta: string | null;
      proximaEjecucionEn: string | null;
    },
  ): Promise<void> {
    await this.pool.query(
      `UPDATE automatizaciones
       SET ultima_ejecucion_en = NOW(),
           ultimo_resultado = $2,
           enfriamiento_hasta = $3::timestamptz,
           proxima_ejecucion_en = COALESCE($4::timestamptz, proxima_ejecucion_en),
           actualizado_en = NOW()
       WHERE id = $1`,
      [id, datos.ultimoResultado, datos.enfriamientoHasta, datos.proximaEjecucionEn],
    );
  }

  public async eliminar(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM automatizaciones WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  public async registrarLog(datos: {
    automatizacionId: string;
    resultado: ResultadoEjecucionAutomatizacion;
    detalle: string;
  }): Promise<LogAutomatizacion> {
    const res = await this.pool.query<FilaLog>(
      `WITH ins AS (
         INSERT INTO automatizaciones_log (automatizacion_id, resultado, detalle)
         VALUES ($1, $2, $3)
         RETURNING id, automatizacion_id, resultado, detalle, fecha_hora
       )
       SELECT i.id, i.automatizacion_id, a.nombre AS nombre_automatizacion,
              a.tipo AS tipo_automatizacion, i.resultado, i.detalle, i.fecha_hora
       FROM ins i
       JOIN automatizaciones a ON a.id = i.automatizacion_id`,
      [datos.automatizacionId, datos.resultado, datos.detalle],
    );
    return mapearLog(res.rows[0]);
  }

  public async contarEjecucionesRecientes(
    automatizacionId: string,
    ventanaMinutos: number,
  ): Promise<number> {
    const res = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM automatizaciones_log
       WHERE automatizacion_id = $1
         AND fecha_hora >= NOW() - ($2::text || ' minutes')::interval`,
      [automatizacionId, String(ventanaMinutos)],
    );
    return Number(res.rows[0]?.total ?? 0);
  }

  public async listarLogs(limite = 50): Promise<LogAutomatizacion[]> {
    const res = await this.pool.query<FilaLog>(
      `SELECT l.id, l.automatizacion_id, a.nombre AS nombre_automatizacion,
              a.tipo AS tipo_automatizacion, l.resultado, l.detalle, l.fecha_hora
       FROM automatizaciones_log l
       JOIN automatizaciones a ON a.id = l.automatizacion_id
       ORDER BY l.fecha_hora DESC
       LIMIT $1`,
      [limite],
    );
    return res.rows.map(mapearLog);
  }
}
