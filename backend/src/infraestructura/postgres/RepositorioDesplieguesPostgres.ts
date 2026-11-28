import { Pool } from 'pg';
import {
  DespliegueRegistro,
  EscaneoSeguridadDespliegue,
  EscaneoSeguridadEntrada,
  EstadoEscaneoSeguridad,
  EstadoEjecucionDespliegue,
  EstadoProyectoDespliegue,
  ModoActualizacionRepo,
  OrigenDespliegue,
  ProyectoConectado,
  TipoEscaneoSeguridad,
  TipoProyectoDespliegue,
  VariableEntornoPersistida,
} from '../../dominio/entidades/Despliegue';
import { ErrorProyectoDuplicado } from '../../dominio/errores/ErroresDespliegues';
import {
  DatosActualizarProyecto,
  DatosCrearProyecto,
  RepositorioDespliegues,
} from '../../dominio/interfaces/RepositorioDespliegues';

interface FilaProyecto {
  id: string;
  usuario_id: string;
  repo_github_id: string;
  nombre_proyecto: string;
  nombre_completo: string;
  rama: string;
  puerto: number;
  carpeta_raiz?: string | null;
  subdominio?: string | null;
  gpu_remota_url?: string | null;
  tipo_proyecto: TipoProyectoDespliegue;
  modo_actualizacion: ModoActualizacionRepo;
  requiere_aprobacion: boolean;
  ultimo_commit_sha: string | null;
  estado_actual: EstadoProyectoDespliegue;
  total_variables: string;
  creado_en: Date;
  actualizado_en: Date;
}

interface FilaVariable {
  id: string;
  repositorio_id: string;
  clave: string;
  valor_cifrado: string;
  actualizado_en: Date;
}

interface FilaDespliegue {
  id: string;
  repositorio_id: string;
  commit_sha: string;
  origen: OrigenDespliegue;
  estado: EstadoEjecucionDespliegue;
  log_construccion: string;
  duracion_ms: number;
  ejecutado_por: string;
  health_check_ok: boolean | null;
  log_health_check: string;
  rollback_automatico: boolean;
  despliegue_origen_id: string | null;
  creado_en: Date;
}

interface FilaEscaneo {
  id: string;
  despliegue_id: string;
  tipo_escaneo: TipoEscaneoSeguridad;
  herramienta: string;
  estado: EstadoEscaneoSeguridad;
  hallazgos_criticos: number;
  resumen: string;
  creado_en: Date;
}

const COLS_DESPLIEGUE = `id, repositorio_id, commit_sha, origen, estado, log_construccion,
  duracion_ms, ejecutado_por, health_check_ok, log_health_check,
  rollback_automatico, despliegue_origen_id, creado_en`;

function mapearProyecto(fila: FilaProyecto): ProyectoConectado {
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    repoGithubId: Number(fila.repo_github_id),
    nombreProyecto: fila.nombre_proyecto,
    nombreCompleto: fila.nombre_completo,
    rama: fila.rama,
    puerto: Number(fila.puerto),
    carpetaRaiz: fila.carpeta_raiz || '/',
    subdominio: fila.subdominio || '',
    gpuRemotaUrl: fila.gpu_remota_url || '',
    tipoProyecto: fila.tipo_proyecto,
    modoActualizacion: fila.modo_actualizacion,
    requiereAprobacion: Boolean(fila.requiere_aprobacion),
    ultimoCommitSha: fila.ultimo_commit_sha,
    estadoActual: fila.estado_actual,
    totalVariables: Number(fila.total_variables ?? 0),
    creadoEn: new Date(fila.creado_en).toISOString(),
    actualizadoEn: new Date(fila.actualizado_en).toISOString(),
  };
}

function mapearVariable(fila: FilaVariable): VariableEntornoPersistida {
  return {
    id: fila.id,
    repositorioId: fila.repositorio_id,
    clave: fila.clave,
    valorCifrado: fila.valor_cifrado,
    actualizadoEn: new Date(fila.actualizado_en).toISOString(),
  };
}

function mapearEscaneo(fila: FilaEscaneo): EscaneoSeguridadDespliegue {
  return {
    id: fila.id,
    despliegueId: fila.despliegue_id,
    tipoEscaneo: fila.tipo_escaneo,
    herramienta: fila.herramienta,
    estado: fila.estado,
    hallazgosCriticos: Number(fila.hallazgos_criticos),
    resumen: fila.resumen,
    creadoEn: new Date(fila.creado_en).toISOString(),
  };
}

function mapearDespliegue(
  fila: FilaDespliegue,
  escaneos: EscaneoSeguridadDespliegue[] = [],
): DespliegueRegistro {
  return {
    id: fila.id,
    repositorioId: fila.repositorio_id,
    commitSha: fila.commit_sha,
    origen: fila.origen,
    estado: fila.estado,
    logConstruccion: fila.log_construccion,
    duracionMs: Number(fila.duracion_ms),
    ejecutadoPor: fila.ejecutado_por,
    healthCheckOk: fila.health_check_ok,
    logHealthCheck: fila.log_health_check ?? '',
    rollbackAutomatico: Boolean(fila.rollback_automatico),
    despliegueOrigenId: fila.despliegue_origen_id ?? null,
    escaneos,
    creadoEn: new Date(fila.creado_en).toISOString(),
  };
}

/** Implementación PostgreSQL de proyectos desplegados, variables cifradas, gate e historial. */
export class RepositorioDesplieguesPostgres implements RepositorioDespliegues {
  constructor(private readonly pool: Pool) {}

  public async crearProyecto(datos: DatosCrearProyecto): Promise<ProyectoConectado> {
    try {
      const res = await this.pool.query<FilaProyecto>(
        `INSERT INTO repositorios_conectados (
           usuario_id, repo_github_id, nombre_proyecto, nombre_completo,
           rama, puerto, carpeta_raiz, subdominio, gpu_remota_url, tipo_proyecto, modo_actualizacion,
           requiere_aprobacion, ultimo_commit_sha
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *, '0'::text AS total_variables`,
        [
          datos.usuarioId,
          datos.repoGithubId,
          datos.nombreProyecto,
          datos.nombreCompleto,
          datos.rama,
          datos.puerto,
          datos.carpetaRaiz || '/',
          datos.subdominio || '',
          datos.gpuRemotaUrl || '',
          datos.tipoProyecto,
          datos.modoActualizacion,
          datos.requiereAprobacion,
          datos.ultimoCommitSha,
        ],
      );
      return mapearProyecto(res.rows[0]);
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ErrorProyectoDuplicado(datos.nombreProyecto);
      }
      throw error;
    }
  }

  public async listarProyectos(): Promise<ProyectoConectado[]> {
    const res = await this.pool.query<FilaProyecto>(
      `SELECT r.*, COUNT(v.id)::text AS total_variables
       FROM repositorios_conectados r
       LEFT JOIN variables_entorno v ON v.repositorio_id = r.id
       GROUP BY r.id
       ORDER BY r.actualizado_en DESC`,
    );
    return res.rows.map(mapearProyecto);
  }

  public async obtenerProyectoPorId(id: string): Promise<ProyectoConectado | null> {
    const res = await this.pool.query<FilaProyecto>(
      `SELECT r.*, COUNT(v.id)::text AS total_variables
       FROM repositorios_conectados r
       LEFT JOIN variables_entorno v ON v.repositorio_id = r.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [id],
    );
    return res.rows[0] ? mapearProyecto(res.rows[0]) : null;
  }

  public async obtenerProyectoPorNombreCompleto(
    nombreCompleto: string,
  ): Promise<ProyectoConectado | null> {
    const res = await this.pool.query<FilaProyecto>(
      `SELECT r.*, COUNT(v.id)::text AS total_variables
       FROM repositorios_conectados r
       LEFT JOIN variables_entorno v ON v.repositorio_id = r.id
       WHERE LOWER(r.nombre_completo) = LOWER($1)
       GROUP BY r.id`,
      [nombreCompleto],
    );
    return res.rows[0] ? mapearProyecto(res.rows[0]) : null;
  }

  public async actualizarProyecto(
    id: string,
    cambios: DatosActualizarProyecto,
  ): Promise<ProyectoConectado | null> {
    const res = await this.pool.query<FilaProyecto>(
      `UPDATE repositorios_conectados
       SET rama = COALESCE($2, rama),
           puerto = COALESCE($3, puerto),
           modo_actualizacion = COALESCE($4, modo_actualizacion),
           requiere_aprobacion = COALESCE($5, requiere_aprobacion),
           actualizado_en = NOW()
       WHERE id = $1
       RETURNING *,
         (SELECT COUNT(*)::text FROM variables_entorno WHERE repositorio_id = $1) AS total_variables`,
      [
        id,
        cambios.rama ?? null,
        cambios.puerto ?? null,
        cambios.modoActualizacion ?? null,
        cambios.requiereAprobacion ?? null,
      ],
    );
    return res.rows[0] ? mapearProyecto(res.rows[0]) : null;
  }

  public async actualizarEstadoProyecto(
    id: string,
    estado: EstadoProyectoDespliegue,
    ultimoCommitSha?: string | null,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE repositorios_conectados
       SET estado_actual = $2,
           ultimo_commit_sha = COALESCE($3, ultimo_commit_sha),
           actualizado_en = NOW()
       WHERE id = $1`,
      [id, estado, ultimoCommitSha ?? null],
    );
  }

  public async eliminarProyecto(id: string): Promise<boolean> {
    const res = await this.pool.query('DELETE FROM repositorios_conectados WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  public async listarVariables(repositorioId: string): Promise<VariableEntornoPersistida[]> {
    const res = await this.pool.query<FilaVariable>(
      `SELECT id, repositorio_id, clave, valor_cifrado, actualizado_en
       FROM variables_entorno
       WHERE repositorio_id = $1
       ORDER BY clave ASC`,
      [repositorioId],
    );
    return res.rows.map(mapearVariable);
  }

  public async guardarVariable(
    repositorioId: string,
    clave: string,
    valorCifrado: string,
  ): Promise<VariableEntornoPersistida> {
    const res = await this.pool.query<FilaVariable>(
      `INSERT INTO variables_entorno (repositorio_id, clave, valor_cifrado)
       VALUES ($1, $2, $3)
       ON CONFLICT (repositorio_id, clave) DO UPDATE SET
         valor_cifrado = EXCLUDED.valor_cifrado,
         actualizado_en = NOW()
       RETURNING id, repositorio_id, clave, valor_cifrado, actualizado_en`,
      [repositorioId, clave, valorCifrado],
    );
    return mapearVariable(res.rows[0]);
  }

  public async eliminarVariable(repositorioId: string, variableId: string): Promise<string | null> {
    const res = await this.pool.query<{ clave: string }>(
      `DELETE FROM variables_entorno
       WHERE id = $1 AND repositorio_id = $2
       RETURNING clave`,
      [variableId, repositorioId],
    );
    return res.rows[0]?.clave ?? null;
  }

  public async registrarDespliegue(datos: {
    repositorioId: string;
    commitSha: string;
    origen: OrigenDespliegue;
    estado: EstadoEjecucionDespliegue;
    logConstruccion: string;
    duracionMs: number;
    ejecutadoPor: string;
    healthCheckOk?: boolean | null;
    logHealthCheck?: string;
    rollbackAutomatico?: boolean;
    despliegueOrigenId?: string | null;
    escaneos?: EscaneoSeguridadEntrada[];
  }): Promise<DespliegueRegistro> {
    const res = await this.pool.query<FilaDespliegue>(
      `INSERT INTO despliegues (
         repositorio_id, commit_sha, origen, estado, log_construccion, duracion_ms,
         ejecutado_por, health_check_ok, log_health_check, rollback_automatico, despliegue_origen_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${COLS_DESPLIEGUE}`,
      [
        datos.repositorioId,
        datos.commitSha,
        datos.origen,
        datos.estado,
        datos.logConstruccion,
        datos.duracionMs,
        datos.ejecutadoPor,
        datos.healthCheckOk ?? null,
        datos.logHealthCheck ?? '',
        datos.rollbackAutomatico ?? false,
        datos.despliegueOrigenId ?? null,
      ],
    );

    const filaDesp = res.rows[0];
    const escaneosGuardados: EscaneoSeguridadDespliegue[] = [];

    for (const esc of datos.escaneos ?? []) {
      const resEsc = await this.pool.query<FilaEscaneo>(
        `INSERT INTO escaneos_seguridad_despliegue (
           despliegue_id, tipo_escaneo, herramienta, estado, hallazgos_criticos, resumen
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, despliegue_id, tipo_escaneo, herramienta, estado, hallazgos_criticos, resumen, creado_en`,
        [
          filaDesp.id,
          esc.tipoEscaneo,
          esc.herramienta,
          esc.estado,
          esc.hallazgosCriticos,
          esc.resumen,
        ],
      );
      escaneosGuardados.push(mapearEscaneo(resEsc.rows[0]));
    }

    return mapearDespliegue(filaDesp, escaneosGuardados);
  }

  public async obtenerDesplieguePorId(
    repositorioId: string,
    despliegueId: string,
  ): Promise<DespliegueRegistro | null> {
    const res = await this.pool.query<FilaDespliegue>(
      `SELECT ${COLS_DESPLIEGUE}
       FROM despliegues
       WHERE id = $1 AND repositorio_id = $2`,
      [despliegueId, repositorioId],
    );
    if (!res.rows[0]) return null;
    const escaneos = await this.listarEscaneosPorDespliegue(res.rows[0].id);
    return mapearDespliegue(res.rows[0], escaneos);
  }

  public async listarEscaneosPorDespliegue(
    despliegueId: string,
  ): Promise<EscaneoSeguridadDespliegue[]> {
    const res = await this.pool.query<FilaEscaneo>(
      `SELECT id, despliegue_id, tipo_escaneo, herramienta, estado, hallazgos_criticos, resumen, creado_en
       FROM escaneos_seguridad_despliegue
       WHERE despliegue_id = $1
       ORDER BY creado_en ASC`,
      [despliegueId],
    );
    return res.rows.map(mapearEscaneo);
  }

  public async listarDespliegues(
    repositorioId: string,
    limite = 20,
  ): Promise<DespliegueRegistro[]> {
    const res = await this.pool.query<FilaDespliegue>(
      `SELECT ${COLS_DESPLIEGUE}
       FROM despliegues
       WHERE repositorio_id = $1
       ORDER BY creado_en DESC
       LIMIT $2`,
      [repositorioId, limite],
    );
    return Promise.all(
      res.rows.map(async (fila) => {
        const escaneos = await this.listarEscaneosPorDespliegue(fila.id);
        return mapearDespliegue(fila, escaneos);
      }),
    );
  }
}
