import { Pool } from 'pg';
import {
  AnaliticaAccesosProyecto,
  FiltroAccesosProyecto,
  NuevaSolicitudProyecto,
  SolicitudProyecto,
  VentanaAccesos,
} from '../../dominio/entidades/SolicitudProyecto';
import { RepositorioAccesosProyecto } from '../../dominio/interfaces/RepositorioAccesosProyecto';

interface FilaSolicitud {
  id: string;
  nombre_proyecto: string;
  ip_origen: string;
  ruta: string;
  metodo: string;
  codigo_estado: number;
  user_agent: string;
  pais: string | null;
  fecha_hora: Date;
}

const INTERVALO_VENTANA: Record<VentanaAccesos, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

function mapearSolicitud(fila: FilaSolicitud): SolicitudProyecto {
  return {
    id: Number(fila.id),
    nombreProyecto: fila.nombre_proyecto,
    ipOrigen: fila.ip_origen,
    ruta: fila.ruta,
    metodo: fila.metodo,
    codigoEstado: Number(fila.codigo_estado),
    userAgent: fila.user_agent,
    pais: fila.pais,
    fechaHora: new Date(fila.fecha_hora).toISOString(),
  };
}

/** Implementación PostgreSQL de analítica de accesos a proyectos con queries 100% parametrizadas. */
export class RepositorioAccesosProyectoPostgres implements RepositorioAccesosProyecto {
  constructor(private readonly pool: Pool) {}

  public async registrarSolicitud(datos: NuevaSolicitudProyecto): Promise<SolicitudProyecto> {
    const res = await this.pool.query<FilaSolicitud>(
      `INSERT INTO solicitudes_proyecto (
         nombre_proyecto, ip_origen, ruta, metodo, codigo_estado, user_agent, pais, fecha_hora
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
       RETURNING id, nombre_proyecto, ip_origen, ruta, metodo, codigo_estado, user_agent, pais, fecha_hora`,
      [
        datos.nombreProyecto,
        datos.ipOrigen,
        datos.ruta,
        datos.metodo,
        datos.codigoEstado,
        datos.userAgent,
        datos.pais ?? null,
        datos.fechaHora ?? null,
      ],
    );
    return mapearSolicitud(res.rows[0]);
  }

  public async registrarLote(lote: NuevaSolicitudProyecto[]): Promise<number> {
    let insertados = 0;
    for (const item of lote) {
      await this.registrarSolicitud(item);
      insertados++;
    }
    return insertados;
  }

  public async obtenerAnalitica(
    filtro: FiltroAccesosProyecto,
  ): Promise<AnaliticaAccesosProyecto> {
    const intervalo = INTERVALO_VENTANA[filtro.ventana];
    const proyecto = filtro.proyecto ?? null;

    const [
      proyectosRes,
      resumenRes,
      porProyectoRes,
      rutasRes,
      horariosRes,
      paisesRes,
      recientesRes,
    ] = await Promise.all([
      this.pool.query<{ nombre_proyecto: string }>(
        `SELECT DISTINCT nombre_proyecto
         FROM solicitudes_proyecto
         ORDER BY nombre_proyecto ASC`,
      ),
      this.pool.query<{
        total_visitas: string;
        visitantes_unicos: string;
        errores_http: string;
      }>(
        `SELECT
           COUNT(*)::text AS total_visitas,
           COUNT(DISTINCT ip_origen)::text AS visitantes_unicos,
           COUNT(*) FILTER (WHERE codigo_estado >= 400)::text AS errores_http
         FROM solicitudes_proyecto
         WHERE fecha_hora >= NOW() - $1::interval
           AND ($2::varchar IS NULL OR nombre_proyecto = $2)`,
        [intervalo, proyecto],
      ),
      this.pool.query<{
        nombre_proyecto: string;
        total_visitas: string;
        visitantes_unicos: string;
      }>(
        `SELECT
           nombre_proyecto,
           COUNT(*)::text AS total_visitas,
           COUNT(DISTINCT ip_origen)::text AS visitantes_unicos
         FROM solicitudes_proyecto
         WHERE fecha_hora >= NOW() - $1::interval
           AND ($2::varchar IS NULL OR nombre_proyecto = $2)
         GROUP BY nombre_proyecto
         ORDER BY COUNT(*) DESC`,
        [intervalo, proyecto],
      ),
      this.pool.query<{ ruta: string; metodo: string; solicitudes: string }>(
        `SELECT ruta, metodo, COUNT(*)::text AS solicitudes
         FROM solicitudes_proyecto
         WHERE fecha_hora >= NOW() - $1::interval
           AND ($2::varchar IS NULL OR nombre_proyecto = $2)
         GROUP BY ruta, metodo
         ORDER BY COUNT(*) DESC
         LIMIT 8`,
        [intervalo, proyecto],
      ),
      this.pool.query<{
        hora: string;
        solicitudes: string;
        exitosas: string;
        errores: string;
      }>(
        `WITH serie_horas AS (
           SELECT generate_series(
             date_trunc('hour', NOW()) - INTERVAL '23 hours',
             date_trunc('hour', NOW()),
             INTERVAL '1 hour'
           ) AS hora_bucket
         ),
         conteo AS (
           SELECT
             date_trunc('hour', fecha_hora) AS hora_bucket,
             COUNT(*) AS solicitudes,
             COUNT(*) FILTER (WHERE codigo_estado < 400) AS exitosas,
             COUNT(*) FILTER (WHERE codigo_estado >= 400) AS errores
           FROM solicitudes_proyecto
           WHERE fecha_hora >= NOW() - $1::interval
             AND ($2::varchar IS NULL OR nombre_proyecto = $2)
           GROUP BY date_trunc('hour', fecha_hora)
         )
         SELECT
           TO_CHAR(s.hora_bucket, 'HH24:00') AS hora,
           COALESCE(SUM(c.solicitudes), 0)::text AS solicitudes,
           COALESCE(SUM(c.exitosas), 0)::text AS exitosas,
           COALESCE(SUM(c.errores), 0)::text AS errores
         FROM serie_horas s
         LEFT JOIN conteo c ON TO_CHAR(c.hora_bucket, 'HH24:00') = TO_CHAR(s.hora_bucket, 'HH24:00')
         GROUP BY s.hora_bucket
         ORDER BY s.hora_bucket ASC`,
        [intervalo, proyecto],
      ),
      this.pool.query<{ pais: string; solicitudes: string }>(
        `SELECT COALESCE(pais, 'Desconocido') AS pais, COUNT(*)::text AS solicitudes
         FROM solicitudes_proyecto
         WHERE fecha_hora >= NOW() - $1::interval
           AND ($2::varchar IS NULL OR nombre_proyecto = $2)
         GROUP BY COALESCE(pais, 'Desconocido')
         ORDER BY COUNT(*) DESC`,
        [intervalo, proyecto],
      ),
      this.pool.query<FilaSolicitud>(
        `SELECT id, nombre_proyecto, ip_origen, ruta, metodo, codigo_estado, user_agent, pais, fecha_hora
         FROM solicitudes_proyecto
         WHERE fecha_hora >= NOW() - $1::interval
           AND ($2::varchar IS NULL OR nombre_proyecto = $2)
         ORDER BY fecha_hora DESC
         LIMIT $3`,
        [intervalo, proyecto, filtro.limite],
      ),
    ]);

    const visitasPorProyecto = porProyectoRes.rows.map((r) => ({
      nombreProyecto: r.nombre_proyecto,
      totalVisitas: Number(r.total_visitas),
      visitantesUnicos: Number(r.visitantes_unicos),
    }));

    const filaResumen = resumenRes.rows[0];

    return {
      proyectosDisponibles: proyectosRes.rows.map((r) => r.nombre_proyecto),
      resumen: {
        totalVisitas: Number(filaResumen?.total_visitas ?? 0),
        visitantesUnicos: Number(filaResumen?.visitantes_unicos ?? 0),
        erroresHttp: Number(filaResumen?.errores_http ?? 0),
        proyectoMasActivo: visitasPorProyecto[0]?.nombreProyecto ?? null,
      },
      visitasPorProyecto,
      rutasMasSolicitadas: rutasRes.rows.map((r) => ({
        ruta: r.ruta,
        metodo: r.metodo,
        solicitudes: Number(r.solicitudes),
      })),
      horariosPico: horariosRes.rows.map((r) => ({
        hora: r.hora,
        solicitudes: Number(r.solicitudes),
        exitosas: Number(r.exitosas),
        errores: Number(r.errores),
      })),
      distribucionPaises: paisesRes.rows.map((r) => ({
        pais: r.pais,
        solicitudes: Number(r.solicitudes),
      })),
      solicitudesRecientes: recientesRes.rows.map(mapearSolicitud),
    };
  }
}
