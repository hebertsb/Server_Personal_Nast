import { PermisoMcp, TokenMcpPersistido } from '../entidades/IaYMcp';

export interface RepositorioTokensMcp {
  crear(datos: {
    usuarioId: string;
    nombre: string;
    prefijo: string;
    tokenHash: string;
    permiso: PermisoMcp;
  }): Promise<TokenMcpPersistido>;
  listar(): Promise<TokenMcpPersistido[]>;
  buscarActivoPorHash(tokenHash: string): Promise<TokenMcpPersistido | null>;
  registrarUso(id: string): Promise<void>;
  revocar(id: string): Promise<boolean>;
}
