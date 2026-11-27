import {
  Error2FANoConfigurado,
  ErrorCodigo2FAInvalido,
  ErrorCredencialesInvalidas,
  ErrorTokenInvalido,
} from '../../dominio/errores/ErroresAutenticacion';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';
import {
  DispositivoConfiable,
  RepositorioSeguridad2FA,
} from '../../dominio/interfaces/RepositorioSeguridad2FA';
import { RepositorioUsuarios } from '../../dominio/interfaces/RepositorioUsuarios';
import { ServicioCifrado } from '../../dominio/interfaces/ServicioCifrado';
import { ServicioHashContrasena } from '../../dominio/interfaces/ServicioHashContrasena';
import { ServicioTotp } from '../../dominio/interfaces/ServicioTotp';

export interface Estado2FAUsuario {
  totpHabilitado: boolean;
  codigosRecuperacionRestantes: number;
  dispositivosConfiables: DispositivoConfiable[];
}

export interface ResultadoIniciarConfiguracion2FA {
  secretoManual: string;
  qrDataUrl: string;
  uriOtpAuth: string;
}

export interface ResultadoConfirmar2FA {
  activado: true;
  codigosRecuperacion: string[];
}

/**
 * Casos de uso de configuración de 2FA (RF-04e, RF-04f, RNF-SEC-15 y RNF-SEC-16):
 * generar QR, confirmar activación emitiendo 8 códigos de recuperación de un solo uso,
 * consultar estado/dispositivos y desactivar previa confirmación de contraseña.
 */
export class Gestionar2FA {
  constructor(
    private readonly repositorioUsuarios: RepositorioUsuarios,
    private readonly repositorioSeguridad2FA: RepositorioSeguridad2FA,
    private readonly repositorioAuditoria: RepositorioAuditoria,
    private readonly servicioCifrado: ServicioCifrado,
    private readonly servicioTotp: ServicioTotp,
    private readonly servicioHash: ServicioHashContrasena,
  ) {}

  public async obtenerEstado(usuarioId: string): Promise<Estado2FAUsuario> {
    const usuario = await this.repositorioUsuarios.buscarPorId(usuarioId);
    if (!usuario) {
      throw new ErrorTokenInvalido();
    }

    const [codigos, dispositivos] = await Promise.all([
      this.repositorioSeguridad2FA.listarCodigosRecuperacionDisponibles(usuario.id),
      this.repositorioSeguridad2FA.listarDispositivosConfiables(usuario.id),
    ]);

    return {
      totpHabilitado: usuario.totpHabilitado,
      codigosRecuperacionRestantes: codigos.length,
      dispositivosConfiables: dispositivos,
    };
  }

  public async iniciarConfiguracion(
    usuarioId: string,
  ): Promise<ResultadoIniciarConfiguracion2FA> {
    const usuario = await this.repositorioUsuarios.buscarPorId(usuarioId);
    if (!usuario) {
      throw new ErrorTokenInvalido();
    }

    const secretoManual = this.servicioTotp.generarSecretoBase32();
    const secretoCifrado = this.servicioCifrado.cifrar(secretoManual);
    const uriOtpAuth = this.servicioTotp.construirUriOtpAuth(
      usuario.nombreUsuario,
      secretoManual,
    );
    const qrDataUrl = await this.servicioTotp.generarQrDataUrl(uriOtpAuth);

    await this.repositorioSeguridad2FA.guardarSecretoTotp(usuario.id, secretoCifrado, false);

    return {
      secretoManual,
      qrDataUrl,
      uriOtpAuth,
    };
  }

  public async confirmarActivacion(
    usuarioId: string,
    codigo: string,
    direccionIp: string,
  ): Promise<ResultadoConfirmar2FA> {
    const usuario = await this.repositorioUsuarios.buscarPorId(usuarioId);
    if (!usuario) {
      throw new ErrorTokenInvalido();
    }

    if (!usuario.secretoTotp) {
      throw new Error2FANoConfigurado();
    }

    const secretoPlano = this.servicioCifrado.descifrar(usuario.secretoTotp);
    const valido = this.servicioTotp.verificarCodigo(secretoPlano, codigo);

    if (!valido) {
      throw new ErrorCodigo2FAInvalido(
        'El código de 6 dígitos no coincide. Verifica la hora de tu dispositivo e intenta de nuevo.',
      );
    }

    const codigosRecuperacion = this.servicioTotp.generarCodigosRecuperacion(8);
    const hashes = await Promise.all(
      codigosRecuperacion.map((item) => this.servicioHash.generarHash(item)),
    );

    await this.repositorioSeguridad2FA.guardarSecretoTotp(
      usuario.id,
      usuario.secretoTotp,
      true,
    );
    await this.repositorioSeguridad2FA.reemplazarCodigosRecuperacion(usuario.id, hashes);

    await Promise.all([
      this.repositorioSeguridad2FA.registrarEventoSeguridad({
        tipoEvento: '2fa_activado',
        ipOrigen: direccionIp,
        severidad: 'baja',
        detalles: { usuario: usuario.nombreUsuario },
      }),
      this.repositorioAuditoria.registrar({
        usuarioId: usuario.id,
        accion: '2fa_activar',
        recurso: usuario.nombreUsuario,
        origen: 'web',
        direccionIp,
      }),
    ]);

    return {
      activado: true,
      codigosRecuperacion,
    };
  }

  public async desactivar(
    usuarioId: string,
    credencial: string,
    direccionIp: string,
  ): Promise<void> {
    const usuario = await this.repositorioUsuarios.buscarPorId(usuarioId);
    if (!usuario) {
      throw new ErrorTokenInvalido();
    }

    const entrada = credencial.trim();
    let autorizada = await this.servicioHash.verificar(entrada, usuario.hashContrasena);
    let metodoConfirmacion: 'contrasena' | 'codigo_recuperacion' = 'contrasena';

    if (!autorizada) {
      const codigoNormalizado = entrada.toUpperCase();
      const codigosDisponibles =
        await this.repositorioSeguridad2FA.listarCodigosRecuperacionDisponibles(usuario.id);

      for (const registro of codigosDisponibles) {
        const coincide = await this.servicioHash.verificar(
          codigoNormalizado,
          registro.hashCodigo,
        );
        if (coincide) {
          autorizada = true;
          metodoConfirmacion = 'codigo_recuperacion';
          break;
        }
      }
    }

    if (!autorizada) {
      throw new ErrorCodigo2FAInvalido(
        'La contraseña o el código de recuperación ingresado no es válido',
      );
    }

    await this.repositorioSeguridad2FA.desactivarTotp(usuario.id);

    await Promise.all([
      this.repositorioSeguridad2FA.registrarEventoSeguridad({
        tipoEvento: '2fa_desactivado',
        ipOrigen: direccionIp,
        severidad: 'alta',
        detalles: { usuario: usuario.nombreUsuario, metodoConfirmacion },
      }),
      this.repositorioAuditoria.registrar({
        usuarioId: usuario.id,
        accion: '2fa_desactivar',
        recurso: usuario.nombreUsuario,
        origen: 'web',
        direccionIp,
        detalles: { metodoConfirmacion },
      }),
    ]);
  }

  public async revocarDispositivo(
    usuarioId: string,
    dispositivoId: string,
    direccionIp: string,
  ): Promise<void> {
    await this.repositorioSeguridad2FA.revocarDispositivoConfiable(usuarioId, dispositivoId);
    await this.repositorioAuditoria.registrar({
      usuarioId,
      accion: 'dispositivo_confiable_revocar',
      recurso: dispositivoId,
      origen: 'web',
      direccionIp,
    });
  }
}
