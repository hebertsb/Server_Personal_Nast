import crypto from 'node:crypto';
import { PerfilUsuarioPublico } from '../../dominio/entidades/Usuario';
import {
  ErrorCodigo2FAInvalido,
  ErrorTokenInvalido,
  ErrorUsuarioSuspendido,
} from '../../dominio/errores/ErroresAutenticacion';
import { RepositorioSeguridad2FA } from '../../dominio/interfaces/RepositorioSeguridad2FA';
import { RepositorioUsuarios } from '../../dominio/interfaces/RepositorioUsuarios';
import { ServicioCifrado } from '../../dominio/interfaces/ServicioCifrado';
import { ServicioHashContrasena } from '../../dominio/interfaces/ServicioHashContrasena';
import { ServicioTokens } from '../../dominio/interfaces/ServicioTokens';
import { ServicioTotp } from '../../dominio/interfaces/ServicioTotp';

export interface EntradaValidarSegundoFactor {
  tokenTemporal2FA: string;
  codigo: string;
  recordarDispositivo: boolean;
  etiquetaDispositivo: string;
  direccionIp: string;
}

export interface ResultadoValidarSegundoFactor {
  usuario: PerfilUsuarioPublico;
  tokenAcceso: string;
  tokenRefresh: string;
  expiraEn: string;
  tokenDispositivoConfiable?: string;
  usoCodigoRecuperacion: boolean;
}

function calcularHuella(tokenCrudo: string): string {
  return crypto.createHash('sha256').update(tokenCrudo, 'utf8').digest('hex');
}

/**
 * Caso de uso RF-04a..g: valida el segundo factor (código TOTP de 6 dígitos o
 * código de recuperación de un solo uso), registra eventos de seguridad en caso
 * de fallo (especialmente desde red externa) y emite sesión completa + dispositivo confiable opcional.
 */
export class ValidarSegundoFactor {
  constructor(
    private readonly repositorioUsuarios: RepositorioUsuarios,
    private readonly repositorioSeguridad2FA: RepositorioSeguridad2FA,
    private readonly servicioCifrado: ServicioCifrado,
    private readonly servicioTotp: ServicioTotp,
    private readonly servicioHash: ServicioHashContrasena,
    private readonly servicioTokens: ServicioTokens,
    private readonly diasDispositivoConfiable = 30,
  ) {}

  public async ejecutar(
    entrada: EntradaValidarSegundoFactor,
  ): Promise<ResultadoValidarSegundoFactor> {
    const payload = this.servicioTokens.verificarTokenPendiente2FA(entrada.tokenTemporal2FA);
    const usuario = await this.repositorioUsuarios.buscarPorId(payload.sub);

    if (!usuario || !usuario.totpHabilitado || !usuario.secretoTotp) {
      throw new ErrorTokenInvalido('Sesión 2FA inválida');
    }

    if (!usuario.activo) {
      throw new ErrorUsuarioSuspendido();
    }

    const codigoLimpio = entrada.codigo.trim().toUpperCase();
    const secretoPlano = this.servicioCifrado.descifrar(usuario.secretoTotp);

    let valido = false;
    let usoCodigoRecuperacion = false;

    if (/^\d{6}$/.test(codigoLimpio)) {
      valido = this.servicioTotp.verificarCodigo(secretoPlano, codigoLimpio);
    }

    if (!valido) {
      const codigosDisponibles =
        await this.repositorioSeguridad2FA.listarCodigosRecuperacionDisponibles(usuario.id);

      for (const registro of codigosDisponibles) {
        const coincide = await this.servicioHash.verificar(codigoLimpio, registro.hashCodigo);
        if (coincide) {
          valido = true;
          usoCodigoRecuperacion = true;
          await this.repositorioSeguridad2FA.marcarCodigoRecuperacionUsado(registro.id);
          await this.repositorioSeguridad2FA.registrarEventoSeguridad({
            tipoEvento: 'codigo_recuperacion_usado',
            ipOrigen: entrada.direccionIp,
            severidad: 'media',
            detalles: {
              usuario: usuario.nombreUsuario,
              esRedLocal: payload.esRedLocal,
            },
          });
          break;
        }
      }
    }

    if (!valido) {
      await this.repositorioUsuarios.registrarIntentoInicioSesion({
        nombreUsuario: usuario.nombreUsuario,
        direccionIp: entrada.direccionIp,
        exitoso: false,
      });

      await this.repositorioSeguridad2FA.registrarEventoSeguridad({
        tipoEvento: payload.esRedLocal ? '2fa_fallido_local' : '2fa_fallido_externo',
        ipOrigen: entrada.direccionIp,
        severidad: payload.esRedLocal ? 'media' : 'alta',
        detalles: {
          usuario: usuario.nombreUsuario,
          motivo2FA: payload.motivo,
          esRedLocal: payload.esRedLocal,
        },
      });

      throw new ErrorCodigo2FAInvalido();
    }

    await this.repositorioUsuarios.registrarIntentoInicioSesion({
      nombreUsuario: usuario.nombreUsuario,
      direccionIp: entrada.direccionIp,
      exitoso: true,
    });
    if (this.repositorioUsuarios.actualizarAcceso) {
      await this.repositorioUsuarios.actualizarAcceso(usuario.id, entrada.direccionIp);
    }

    let tokenDispositivoConfiable: string | undefined;
    if (entrada.recordarDispositivo) {
      tokenDispositivoConfiable = crypto.randomBytes(32).toString('hex');
      const confiableHasta = new Date(
        Date.now() + this.diasDispositivoConfiable * 24 * 60 * 60 * 1000,
      );

      await this.repositorioSeguridad2FA.guardarDispositivoConfiable({
        usuarioId: usuario.id,
        huellaDispositivo: calcularHuella(tokenDispositivoConfiable),
        etiquetaDispositivo: entrada.etiquetaDispositivo.slice(0, 150) || 'Navegador web',
        ultimaIp: entrada.direccionIp,
        confiableHasta,
      });
    }

    const tokens = this.servicioTokens.generarParTokens({
      id: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      rol: usuario.rol,
      permisosModulos: usuario.permisosModulos,
      versionSesion: usuario.versionSesion,
    });

    return {
      usuario: usuario.aPerfilPublico(),
      tokenAcceso: tokens.tokenAcceso,
      tokenRefresh: tokens.tokenRefresh,
      expiraEn: tokens.expiraEn,
      tokenDispositivoConfiable,
      usoCodigoRecuperacion,
    };
  }
}
