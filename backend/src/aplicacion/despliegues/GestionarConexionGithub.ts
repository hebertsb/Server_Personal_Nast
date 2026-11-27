import {
  ConexionGithub,
  ConexionGithubPersistida,
  RepositorioGithub,
} from '../../dominio/entidades/Github';
import { RolUsuario } from '../../dominio/entidades/Usuario';
import {
  ErrorGithubNoConectado,
  ErrorGithubPermisos,
} from '../../dominio/errores/ErroresGithub';
import { ClienteGithub } from '../../dominio/interfaces/ClienteGithub';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';
import { RepositorioConexionGithub } from '../../dominio/interfaces/RepositorioConexionGithub';
import { ServicioCifrado } from '../../dominio/interfaces/ServicioCifrado';

export interface ContextoUsuarioGithub {
  usuarioId: string;
  rol: RolUsuario;
  direccionIp: string;
}

function aVista(conexion: ConexionGithubPersistida): ConexionGithub {
  return {
    usuarioGithub: conexion.usuarioGithub,
    alcances: conexion.alcances,
    modo: conexion.modo,
    conectadoEn: conexion.conectadoEn,
    actualizadoEn: conexion.actualizadoEn,
  };
}

/**
 * Casos de uso RF-28 y RF-29: conectar/desconectar GitHub con un PAT cifrado en reposo
 * y listar repositorios accesibles. El token nunca sale de esta capa en texto plano.
 */
export class GestionarConexionGithub {
  constructor(
    private readonly clienteGithub: ClienteGithub,
    private readonly repositorio: RepositorioConexionGithub,
    private readonly cifrado: ServicioCifrado,
    private readonly auditoria: RepositorioAuditoria,
  ) {}

  private exigirAdministrador(contexto: ContextoUsuarioGithub): void {
    if (contexto.rol !== 'superadmin' && contexto.rol !== 'administrador') {
      throw new ErrorGithubPermisos();
    }
  }

  public async conectar(token: string, contexto: ContextoUsuarioGithub): Promise<ConexionGithub> {
    this.exigirAdministrador(contexto);

    const perfil = await this.clienteGithub.validarToken(token);
    const guardada = await this.repositorio.guardar({
      usuarioId: contexto.usuarioId,
      usuarioGithub: perfil.usuario,
      tokenCifrado: this.cifrado.cifrar(token),
      alcances: perfil.alcances,
      modo: this.clienteGithub.modo,
    });

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      accion: 'github_conectar',
      recurso: perfil.usuario,
      origen: 'web',
      direccionIp: contexto.direccionIp,
      detalles: { alcances: perfil.alcances, modo: this.clienteGithub.modo },
    });

    return aVista(guardada);
  }

  public async obtenerEstado(contexto: ContextoUsuarioGithub): Promise<ConexionGithub | null> {
    const conexion = await this.repositorio.obtenerPorUsuario(contexto.usuarioId);
    return conexion ? aVista(conexion) : null;
  }

  public async desconectar(contexto: ContextoUsuarioGithub): Promise<void> {
    this.exigirAdministrador(contexto);

    const conexion = await this.repositorio.obtenerPorUsuario(contexto.usuarioId);
    if (!conexion) {
      throw new ErrorGithubNoConectado();
    }
    await this.repositorio.eliminar(contexto.usuarioId);

    await this.auditoria.registrar({
      usuarioId: contexto.usuarioId,
      accion: 'github_desconectar',
      recurso: conexion.usuarioGithub,
      origen: 'web',
      direccionIp: contexto.direccionIp,
    });
  }

  public async listarRepositorios(contexto: ContextoUsuarioGithub): Promise<RepositorioGithub[]> {
    const conexion = await this.repositorio.obtenerPorUsuario(contexto.usuarioId);
    if (!conexion) {
      throw new ErrorGithubNoConectado();
    }
    const token = this.cifrado.descifrar(conexion.tokenCifrado);
    return this.clienteGithub.listarRepositorios(token);
  }
}
