export type OrigenAuditoria = 'web' | 'mcp' | 'sistema';

export interface RegistroAuditoriaDatos {
  usuarioId: string;
  accion: string;
  recurso: string;
  origen: OrigenAuditoria;
  direccionIp: string;
  detalles?: Record<string, unknown>;
}

export interface RepositorioAuditoria {
  registrar(registro: RegistroAuditoriaDatos): Promise<void>;
}
