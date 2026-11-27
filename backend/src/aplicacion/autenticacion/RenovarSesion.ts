import { PerfilUsuarioPublico } from '../../dominio/entidades/Usuario';
import { ErrorTokenInvalido } from '../../dominio/errores/ErroresAutenticacion';
import { RepositorioUsuarios } from '../../dominio/interfaces/RepositorioUsuarios';
import { ServicioTokens } from '../../dominio/interfaces/ServicioTokens';

export interface ResultadoRenovarSesion {
  usuario: PerfilUsuarioPublico;
  tokenAcceso: string;
  tokenRefresh: string;
  expiraEn: string;
}

/**
 * Caso de uso: valida el refresh token, verifica que el usuario siga existiendo
 * y rota el par de tokens (acceso + refresh).
 */
export class RenovarSesion {
  constructor(
    private readonly repositorioUsuarios: RepositorioUsuarios,
    private readonly servicioTokens: ServicioTokens,
  ) {}

  public async ejecutar(tokenRefresh: string): Promise<ResultadoRenovarSesion> {
    const payload = this.servicioTokens.verificarTokenRefresh(tokenRefresh);
    const usuario = await this.repositorioUsuarios.buscarPorId(payload.sub);

    if (!usuario) {
      throw new ErrorTokenInvalido('La sesión ya no es válida');
    }

    const tokens = this.servicioTokens.generarParTokens({
      id: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      rol: usuario.rol,
    });

    return {
      usuario: usuario.aPerfilPublico(),
      tokenAcceso: tokens.tokenAcceso,
      tokenRefresh: tokens.tokenRefresh,
      expiraEn: tokens.expiraEn,
    };
  }
}
