import { EventoSeguridad, RegistroAuditoria } from '../../dominio/entidades/EventoSeguridad';
import { RepositorioEventos } from '../../dominio/interfaces/RepositorioEventos';

/** Caso de uso: consulta eventos de seguridad recientes y el registro inmutable de auditoría. */
export class ConsultarSeguridad {
  constructor(private readonly repositorioEventos: RepositorioEventos) {}

  public async obtenerEventos(limite: number): Promise<EventoSeguridad[]> {
    return this.repositorioEventos.listarEventosSeguridad(limite);
  }

  public async obtenerAuditoria(limite: number): Promise<RegistroAuditoria[]> {
    return this.repositorioEventos.listarAuditoriaAcciones(limite);
  }
}
