import { Pool } from 'pg';
import { EventoSeguridad, RegistroAuditoria } from '../../dominio/entidades/EventoSeguridad';
import { RepositorioEventos } from '../../dominio/interfaces/RepositorioEventos';
import { SeveridadEvento } from '../../dominio/interfaces/RepositorioSeguridad2FA';

interface FilaEvento {
  id: string;
  tipo_evento: string;
  ip_origen: string;
  severidad: SeveridadEvento;
  detalles: Record<string, unknown> | null;
  fecha_hora: Date;
}

interface FilaAuditoria {
  id: string;
  usuario_id: string | null;
  nombre_usuario: string | null;
  accion: string;
  recurso: string;
  origen: string;
  direccion_ip: string | null;
  detalles: Record<string, unknown> | null;
  fecha_hora: Date;
}

/** Repositorio PostgreSQL de lectura para eventos de seguridad y auditoría (queries parametrizadas). */
export class RepositorioEventosPostgres implements RepositorioEventos {
  constructor(private readonly pool: Pool) {}

  public async listarEventosSeguridad(limite: number): Promise<EventoSeguridad[]> {
    const res = await this.pool.query<FilaEvento>(
      `SELECT id, tipo_evento, ip_origen, severidad, detalles, fecha_hora
       FROM eventos_seguridad
       ORDER BY fecha_hora DESC
       LIMIT $1`,
      [limite],
    );

    return res.rows.map((fila) => ({
      id: Number(fila.id),
      tipoEvento: fila.tipo_evento,
      ipOrigen: fila.ip_origen,
      severidad: fila.severidad,
      detalles: fila.detalles ?? {},
      fechaHora: new Date(fila.fecha_hora).toISOString(),
    }));
  }

  public async listarAuditoriaAcciones(limite: number): Promise<RegistroAuditoria[]> {
    const res = await this.pool.query<FilaAuditoria>(
      `SELECT a.id, a.usuario_id, u.nombre_usuario, a.accion, a.recurso,
              a.origen, a.direccion_ip, a.detalles, a.fecha_hora
       FROM auditoria_acciones a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       ORDER BY a.fecha_hora DESC
       LIMIT $1`,
      [limite],
    );

    return res.rows.map((fila) => ({
      id: Number(fila.id),
      usuarioId: fila.usuario_id,
      nombreUsuario: fila.nombre_usuario,
      accion: fila.accion,
      recurso: fila.recurso,
      origen: fila.origen,
      direccionIp: fila.direccion_ip,
      detalles: fila.detalles ?? {},
      fechaHora: new Date(fila.fecha_hora).toISOString(),
    }));
  }
}
