import { PerfilUsuarioPublico } from '../../dominio/entidades/Usuario';
import {
  ErrorCredencialesInvalidas,
  ErrorUsuarioSuspendido,
} from '../../dominio/errores/ErroresAutenticacion';
import { RepositorioSeguridad2FA } from '../../dominio/interfaces/RepositorioSeguridad2FA';
import { RepositorioUsuarios } from '../../dominio/interfaces/RepositorioUsuarios';
import { ServicioHashContrasena } from '../../dominio/interfaces/ServicioHashContrasena';
import { ServicioTokens } from '../../dominio/interfaces/ServicioTokens';
import {
  evaluarRequerimiento2FA,
  MotivoSegundoFactor,
} from '../../dominio/reglas/EvaluadorConfianzaOrigen';

export interface EntradaIniciarSesion {
  nombreUsuario: string;
  contrasena: string;
  direccionIp: string;
  huellaDispositivo?: string | null;
}

export interface ResultadoSesionCompleta {
  requiere2FA: false;
  usuario: PerfilUsuarioPublico;
  tokenAcceso: string;
  tokenRefresh: string;
  expiraEn: string;
}

export interface ResultadoPendiente2FA {
  requiere2FA: true;
  motivo2FA: MotivoSegundoFactor;
  esRedLocal: boolean;
  tokenTemporal2FA: string;
  usuario: PerfilUsuarioPublico;
}

export type ResultadoIniciarSesion = ResultadoSesionCompleta | ResultadoPendiente2FA;

/**
 * Caso de uso HU-01 + Fase 0.5 (RF-04a..d): valida credenciales, verifica estado activo,
 * registra intento en intentos_inicio_sesion y evalúa si corresponde exigir 2FA condicional
 * según origen de red (local vs externa) y confianza del dispositivo.
 */
export class IniciarSesion {
  constructor(
    private readonly repositorioUsuarios: RepositorioUsuarios,
    private readonly servicioHash: ServicioHashContrasena,
    private readonly servicioTokens: ServicioTokens,
    private readonly repositorioSeguridad2FA?: RepositorioSeguridad2FA,
    private readonly rangosConfiablesCidr: string[] = [
      '127.0.0.0/8',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
    ],
  ) {}

  public async ejecutar(entrada: EntradaIniciarSesion): Promise<ResultadoIniciarSesion> {
    const nombreNormalizado = entrada.nombreUsuario.trim();
    const usuario = await this.repositorioUsuarios.buscarPorNombreUsuario(nombreNormalizado);

    if (!usuario) {
      await this.repositorioUsuarios.registrarIntentoInicioSesion({
        nombreUsuario: nombreNormalizado,
        direccionIp: entrada.direccionIp,
        exitoso: false,
      });
      throw new ErrorCredencialesInvalidas();
    }

    if (!usuario.activo) {
      await this.repositorioUsuarios.registrarIntentoInicioSesion({
        nombreUsuario: usuario.nombreUsuario,
        direccionIp: entrada.direccionIp,
        exitoso: false,
      });
      throw new ErrorUsuarioSuspendido();
    }

    const contrasenaValida = await this.servicioHash.verificar(
      entrada.contrasena,
      usuario.hashContrasena,
    );

    if (!contrasenaValida) {
      await this.repositorioUsuarios.registrarIntentoInicioSesion({
        nombreUsuario: usuario.nombreUsuario,
        direccionIp: entrada.direccionIp,
        exitoso: false,
      });
      throw new ErrorCredencialesInvalidas();
    }

    let dispositivoConfiableVigente = false;
    if (
      usuario.totpHabilitado &&
      this.repositorioSeguridad2FA &&
      entrada.huellaDispositivo
    ) {
      const dispositivo = await this.repositorioSeguridad2FA.buscarDispositivoConfiableVigente(
        usuario.id,
        entrada.huellaDispositivo,
      );
      dispositivoConfiableVigente = Boolean(dispositivo);
    }

    const evaluacion = evaluarRequerimiento2FA({
      totpHabilitado: usuario.totpHabilitado,
      direccionIp: entrada.direccionIp,
      rangosConfiablesCidr: this.rangosConfiablesCidr,
      dispositivoConfiableVigente,
    });

    if (evaluacion.requerido) {
      const tokenTemporal2FA = this.servicioTokens.generarTokenPendiente2FA({
        id: usuario.id,
        nombreUsuario: usuario.nombreUsuario,
        rol: usuario.rol,
        esRedLocal: evaluacion.esRedLocal,
        motivo: evaluacion.motivo,
      });

      return {
        requiere2FA: true,
        motivo2FA: evaluacion.motivo,
        esRedLocal: evaluacion.esRedLocal,
        tokenTemporal2FA,
        usuario: usuario.aPerfilPublico(),
      };
    }

    await this.repositorioUsuarios.registrarIntentoInicioSesion({
      nombreUsuario: usuario.nombreUsuario,
      direccionIp: entrada.direccionIp,
      exitoso: true,
    });
    if (this.repositorioUsuarios.actualizarAcceso) {
      await this.repositorioUsuarios.actualizarAcceso(usuario.id, entrada.direccionIp);
    }

    const tokens = this.servicioTokens.generarParTokens({
      id: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      rol: usuario.rol,
      permisosModulos: usuario.permisosModulos,
      versionSesion: usuario.versionSesion,
    });

    return {
      requiere2FA: false,
      usuario: usuario.aPerfilPublico(),
      tokenAcceso: tokens.tokenAcceso,
      tokenRefresh: tokens.tokenRefresh,
      expiraEn: tokens.expiraEn,
    };
  }
}
