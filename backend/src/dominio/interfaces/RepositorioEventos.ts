import { EventoSeguridad, RegistroAuditoria } from '../entidades/EventoSeguridad';

export interface RepositorioEventos {
  listarEventosSeguridad(limite: number): Promise<EventoSeguridad[]>;
  listarAuditoriaAcciones(limite: number): Promise<RegistroAuditoria[]>;
}
