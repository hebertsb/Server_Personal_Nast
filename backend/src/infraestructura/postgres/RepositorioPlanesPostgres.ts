import { Pool } from 'pg';
import {
  EstadoSolicitudSuscripcion,
  MetodoPagoSuscripcion,
  PlanHosting,
  SolicitudSuscripcion,
} from '../../dominio/entidades/PlanHosting';
import {
  DatosCrearPlan,
  RepositorioPlanes,
} from '../../dominio/interfaces/RepositorioPlanes';

interface FilaPlan {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precio_bs: string | number;
  periodo: string;
  cuota_ram_mb: number;
  cuota_cpu: string | number;
  max_proyectos: number;
  ia_basica_habilitada: boolean;
  beneficios: unknown;
  destacado: boolean;
  activo: boolean;
  orden: number;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

interface FilaSolicitud {
  id: string;
  usuario_id: string;
  nombre_usuario: string;
  plan_id: string;
  plan_nombre: string;
  monto_bs: string | number;
  metodo_pago: MetodoPagoSuscripcion;
  referencia_pago: string;
  nota_cliente: string;
  estado: EstadoSolicitudSuscripcion;
  revisado_por: string;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

function aIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function mapPlan(f: FilaPlan): PlanHosting {
  return {
    id: f.id,
    codigo: f.codigo,
    nombre: f.nombre,
    descripcion: f.descripcion,
    precioBs: Number(f.precio_bs ?? 0),
    periodo: f.periodo || 'mes',
    cuotaRamMb: Number(f.cuota_ram_mb),
    cuotaCpu: Number(f.cuota_cpu),
    maxProyectos: Number(f.max_proyectos),
    iaBasicaHabilitada: Boolean(f.ia_basica_habilitada),
    beneficios: Array.isArray(f.beneficios)
      ? f.beneficios.filter((b): b is string => typeof b === 'string')
      : [],
    destacado: Boolean(f.destacado),
    activo: Boolean(f.activo),
    orden: Number(f.orden ?? 10),
    creadoEn: aIso(f.creado_en),
    actualizadoEn: aIso(f.actualizado_en),
  };
}

function mapSolicitud(f: FilaSolicitud): SolicitudSuscripcion {
  return {
    id: f.id,
    usuarioId: f.usuario_id,
    nombreUsuario: f.nombre_usuario,
    planId: f.plan_id,
    planNombre: f.plan_nombre,
    montoBs: Number(f.monto_bs ?? 0),
    metodoPago: f.metodo_pago,
    referenciaPago: f.referencia_pago,
    notaCliente: f.nota_cliente,
    estado: f.estado,
    revisadoPor: f.revisado_por,
    creadoEn: aIso(f.creado_en),
    actualizadoEn: aIso(f.actualizado_en),
  };
}

export class RepositorioPlanesPostgres implements RepositorioPlanes {
  constructor(private readonly pool: Pool) {}

  public async listarPlanes(soloActivos = false): Promise<PlanHosting[]> {
    const res = await this.pool.query<FilaPlan>(
      soloActivos
        ? `SELECT * FROM planes_hosting WHERE activo = TRUE ORDER BY orden ASC, precio_bs ASC`
        : `SELECT * FROM planes_hosting ORDER BY orden ASC, precio_bs ASC`,
    );
    return res.rows.map(mapPlan);
  }

  public async obtenerPlanPorId(id: string): Promise<PlanHosting | null> {
    const res = await this.pool.query<FilaPlan>(
      `SELECT * FROM planes_hosting WHERE id = $1 LIMIT 1`,
      [id],
    );
    return res.rows[0] ? mapPlan(res.rows[0]) : null;
  }

  public async crearPlan(datos: DatosCrearPlan): Promise<PlanHosting> {
    const res = await this.pool.query<FilaPlan>(
      `INSERT INTO planes_hosting (
         codigo, nombre, descripcion, precio_bs, periodo, cuota_ram_mb, cuota_cpu,
         max_proyectos, ia_basica_habilitada, beneficios, destacado, activo, orden
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
       RETURNING *`,
      [
        datos.codigo,
        datos.nombre,
        datos.descripcion,
        datos.precioBs,
        datos.periodo,
        datos.cuotaRamMb,
        datos.cuotaCpu,
        datos.maxProyectos,
        datos.iaBasicaHabilitada,
        JSON.stringify(datos.beneficios),
        datos.destacado,
        datos.activo,
        datos.orden,
      ],
    );
    return mapPlan(res.rows[0]);
  }

  public async actualizarPlan(
    id: string,
    datos: Partial<DatosCrearPlan>,
  ): Promise<PlanHosting | null> {
    const actual = await this.obtenerPlanPorId(id);
    if (!actual) return null;
    const res = await this.pool.query<FilaPlan>(
      `UPDATE planes_hosting
       SET codigo = $2,
           nombre = $3,
           descripcion = $4,
           precio_bs = $5,
           periodo = $6,
           cuota_ram_mb = $7,
           cuota_cpu = $8,
           max_proyectos = $9,
           ia_basica_habilitada = $10,
           beneficios = $11::jsonb,
           destacado = $12,
           activo = $13,
           orden = $14,
           actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        datos.codigo ?? actual.codigo,
        datos.nombre ?? actual.nombre,
        datos.descripcion ?? actual.descripcion,
        datos.precioBs ?? actual.precioBs,
        datos.periodo ?? actual.periodo,
        datos.cuotaRamMb ?? actual.cuotaRamMb,
        datos.cuotaCpu ?? actual.cuotaCpu,
        datos.maxProyectos ?? actual.maxProyectos,
        datos.iaBasicaHabilitada ?? actual.iaBasicaHabilitada,
        JSON.stringify(datos.beneficios ?? actual.beneficios),
        datos.destacado ?? actual.destacado,
        datos.activo ?? actual.activo,
        datos.orden ?? actual.orden,
      ],
    );
    return res.rows[0] ? mapPlan(res.rows[0]) : null;
  }

  public async eliminarPlan(id: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM planes_hosting WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  public async listarSolicitudes(usuarioId?: string): Promise<SolicitudSuscripcion[]> {
    const res = usuarioId
      ? await this.pool.query<FilaSolicitud>(
          `SELECT * FROM solicitudes_suscripcion WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 50`,
          [usuarioId],
        )
      : await this.pool.query<FilaSolicitud>(
          `SELECT * FROM solicitudes_suscripcion ORDER BY creado_en DESC LIMIT 100`,
        );
    return res.rows.map(mapSolicitud);
  }

  public async obtenerSolicitudPorId(id: string): Promise<SolicitudSuscripcion | null> {
    const res = await this.pool.query<FilaSolicitud>(
      `SELECT * FROM solicitudes_suscripcion WHERE id = $1 LIMIT 1`,
      [id],
    );
    return res.rows[0] ? mapSolicitud(res.rows[0]) : null;
  }

  public async crearSolicitud(datos: {
    usuarioId: string;
    nombreUsuario: string;
    planId: string;
    planNombre: string;
    montoBs: number;
    metodoPago: MetodoPagoSuscripcion;
    referenciaPago: string;
    notaCliente: string;
  }): Promise<SolicitudSuscripcion> {
    const res = await this.pool.query<FilaSolicitud>(
      `INSERT INTO solicitudes_suscripcion (
         usuario_id, nombre_usuario, plan_id, plan_nombre, monto_bs,
         metodo_pago, referencia_pago, nota_cliente
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        datos.usuarioId,
        datos.nombreUsuario,
        datos.planId,
        datos.planNombre,
        datos.montoBs,
        datos.metodoPago,
        datos.referenciaPago,
        datos.notaCliente,
      ],
    );
    return mapSolicitud(res.rows[0]);
  }

  public async actualizarEstadoSolicitud(
    id: string,
    estado: EstadoSolicitudSuscripcion,
    revisadoPor: string,
  ): Promise<SolicitudSuscripcion | null> {
    const res = await this.pool.query<FilaSolicitud>(
      `UPDATE solicitudes_suscripcion
       SET estado = $2,
           revisado_por = $3,
           actualizado_en = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, estado, revisadoPor],
    );
    return res.rows[0] ? mapSolicitud(res.rows[0]) : null;
  }
}
