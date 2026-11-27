import crypto from 'node:crypto';
import {
  PermisoMcp,
  TokenMcpPersistido,
  TokenMcpVista,
} from '../../dominio/entidades/IaYMcp';
import { RolUsuario } from '../../dominio/entidades/Usuario';
import { ErrorPermisosInsuficientes } from '../../dominio/errores/ErroresContenedores';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';
import { RepositorioTokensMcp } from '../../dominio/interfaces/RepositorioTokensMcp';

export interface ContextoAdminMcp {
  usuarioId: string;
  rol: RolUsuario;
  direccionIp: string;
}

function hashTokenMcp(tokenPlano: string): string {
  return crypto.createHash('sha256').update(tokenPlano).digest('hex');
}

function aVista(t: TokenMcpPersistido): TokenMcpVista {
  return {
    id: t.id,
    nombre: t.nombre,
    prefijo: t.prefijo,
    permiso: t.permiso,
    ultimoUsoEn: t.ultimoUsoEn,
    revocado: t.revocado,
    creadoEn: t.creadoEn,
  };
}

/** Gestión de tokens de API del servidor MCP (RF-64): solo almacena hash SHA-256. */
export class GestionarTokensMcp {
  constructor(
    private readonly repo: RepositorioTokensMcp,
    private readonly auditoria: RepositorioAuditoria,
  ) {}

  public async crearToken(
    nombre: string,
    permiso: PermisoMcp,
    ctx: ContextoAdminMcp,
  ): Promise<{ tokenPlano: string; token: TokenMcpVista }> {
    if (ctx.rol !== 'administrador') {
      throw new ErrorPermisosInsuficientes();
    }
    const tokenPlano = `hs_mcp_${crypto.randomBytes(24).toString('hex')}`;
    const prefijo = tokenPlano.slice(0, 14);
    const creado = await this.repo.crear({
      usuarioId: ctx.usuarioId,
      nombre: nombre.trim(),
      prefijo,
      tokenHash: hashTokenMcp(tokenPlano),
      permiso,
    });

    await this.auditoria.registrar({
      usuarioId: ctx.usuarioId,
      accion: 'mcp_token_crear',
      recurso: creado.nombre,
      origen: 'web',
      direccionIp: ctx.direccionIp,
      detalles: { permiso, prefijo },
    });

    return { tokenPlano, token: aVista(creado) };
  }

  public async listarTokens(): Promise<TokenMcpVista[]> {
    const todos = await this.repo.listar();
    return todos.map(aVista);
  }

  public async revocarToken(id: string, ctx: ContextoAdminMcp): Promise<boolean> {
    if (ctx.rol !== 'administrador') {
      throw new ErrorPermisosInsuficientes();
    }
    const revocado = await this.repo.revocar(id);
    if (revocado) {
      await this.auditoria.registrar({
        usuarioId: ctx.usuarioId,
        accion: 'mcp_token_revocar',
        recurso: id,
        origen: 'web',
        direccionIp: ctx.direccionIp,
      });
    }
    return revocado;
  }

  public async validarToken(tokenPlano: string): Promise<TokenMcpPersistido | null> {
    if (!tokenPlano.startsWith('hs_mcp_')) return null;
    const encontrado = await this.repo.buscarActivoPorHash(hashTokenMcp(tokenPlano));
    if (!encontrado) return null;
    await this.repo.registrarUso(encontrado.id);
    return encontrado;
  }
}
