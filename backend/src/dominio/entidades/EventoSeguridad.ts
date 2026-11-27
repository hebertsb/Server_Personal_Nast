import { SeveridadEvento } from '../interfaces/RepositorioSeguridad2FA';

export interface EventoSeguridad {
  id: number;
  tipoEvento: string;
  ipOrigen: string;
  severidad: SeveridadEvento;
  detalles: Record<string, unknown>;
  fechaHora: string;
}

export interface RegistroAuditoria {
  id: number;
  usuarioId: string | null;
  nombreUsuario: string | null;
  accion: string;
  recurso: string;
  origen: string;
  direccionIp: string | null;
  detalles: Record<string, unknown>;
  fechaHora: string;
}
