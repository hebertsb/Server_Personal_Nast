import {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { CredencialBiometricaPublica } from '../../dominio/entidades/CredencialBiometrica';
import { PerfilUsuarioPublico } from '../../dominio/entidades/Usuario';
import {
  ErrorDominio,
  ErrorTokenInvalido,
  ErrorUsuarioSuspendido,
} from '../../dominio/errores/ErroresAutenticacion';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';
import { RepositorioBiometria } from '../../dominio/interfaces/RepositorioBiometria';
import { RepositorioSeguridad2FA } from '../../dominio/interfaces/RepositorioSeguridad2FA';
import { RepositorioUsuarios } from '../../dominio/interfaces/RepositorioUsuarios';
import { ServicioTokens } from '../../dominio/interfaces/ServicioTokens';

interface DesafioGuardado {
  challenge: string;
  rpID: string;
  origin: string;
  expiraEn: number;
  usuarioId?: string;
}

const TTL_DESAFIO_MS = 5 * 60 * 1000;

export interface ResultadoSesionBiometrica {
  usuario: PerfilUsuarioPublico;
  tokenAcceso: string;
  tokenRefresh: string;
  expiraEn: string;
}

/**
 * Caso de uso WebAuthn / Passkeys: permite registrar sensores biométricos del dispositivo
 * (Huella Digital Android, Face ID / Touch ID iOS, Windows Hello) e iniciar sesión o
 * completar 2FA de forma criptográfica sin exponer nunca datos biométricos.
 */
export class GestionarBiometriaWebAuthn {
  private readonly desafios = new Map<string, DesafioGuardado>();

  constructor(
    private readonly repositorioBiometria: RepositorioBiometria,
    private readonly repositorioUsuarios: RepositorioUsuarios,
    private readonly repositorioAuditoria: RepositorioAuditoria,
    private readonly repositorioSeguridad2FA: RepositorioSeguridad2FA,
    private readonly servicioTokens: ServicioTokens,
  ) {}

  private limpiarExpirados(): void {
    const ahora = Date.now();
    for (const [clave, valor] of this.desafios.entries()) {
      if (valor.expiraEn < ahora) {
        this.desafios.delete(clave);
      }
    }
  }

  private guardarDesafio(clave: string, datos: Omit<DesafioGuardado, 'expiraEn'>): void {
    this.limpiarExpirados();
    this.desafios.set(clave, { ...datos, expiraEn: Date.now() + TTL_DESAFIO_MS });
  }

  private consumirDesafio(clave: string): DesafioGuardado {
    this.limpiarExpirados();
    const guardado = this.desafios.get(clave);
    this.desafios.delete(clave);
    if (!guardado || guardado.expiraEn < Date.now()) {
      throw new ErrorDominio(
        'DESAFIO_BIOMETRICO_EXPIRADO',
        'El desafío biométrico expiró. Inténtalo de nuevo.',
        400,
      );
    }
    return guardado;
  }

  public async listarCredenciales(usuarioId: string): Promise<CredencialBiometricaPublica[]> {
    const lista = await this.repositorioBiometria.listarPorUsuario(usuarioId);
    return lista.map((c) => ({
      id: c.id,
      etiquetaDispositivo: c.etiquetaDispositivo,
      transports: c.transports,
      ultimoUsoEn: c.ultimoUsoEn,
      creadoEn: c.creadoEn,
    }));
  }

  public async generarOpcionesRegistro(entrada: {
    usuarioId: string;
    rpID: string;
    origin: string;
  }) {
    const usuario = await this.repositorioUsuarios.buscarPorId(entrada.usuarioId);
    if (!usuario || !usuario.activo) {
      throw new ErrorTokenInvalido('Usuario inválido');
    }

    const existentes = await this.repositorioBiometria.listarPorUsuario(usuario.id);
    const opciones = await generateRegistrationOptions({
      rpName: 'HomeSOC',
      rpID: entrada.rpID,
      userName: usuario.nombreUsuario,
      userDisplayName: usuario.nombreUsuario,
      userID: new TextEncoder().encode(usuario.id),
      attestationType: 'none',
      excludeCredentials: existentes.map((c) => ({
        id: c.credencialId,
        transports: c.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
    });

    this.guardarDesafio(`reg:${usuario.id}`, {
      challenge: opciones.challenge,
      rpID: entrada.rpID,
      origin: entrada.origin,
      usuarioId: usuario.id,
    });

    return opciones;
  }

  public async verificarRegistro(entrada: {
    usuarioId: string;
    respuesta: RegistrationResponseJSON;
    etiquetaDispositivo: string;
    direccionIp: string;
  }): Promise<CredencialBiometricaPublica> {
    const desafio = this.consumirDesafio(`reg:${entrada.usuarioId}`);

    const verificacion = await verifyRegistrationResponse({
      response: entrada.respuesta,
      expectedChallenge: desafio.challenge,
      expectedOrigin: desafio.origin,
      expectedRPID: desafio.rpID,
      requireUserVerification: true,
    });

    if (!verificacion.verified || !verificacion.registrationInfo) {
      throw new ErrorDominio(
        'REGISTRO_BIOMETRICO_FALLIDO',
        'No se pudo verificar la credencial biométrica',
        400,
      );
    }

    const { credential } = verificacion.registrationInfo;
    const guardada = await this.repositorioBiometria.guardar({
      usuarioId: entrada.usuarioId,
      credencialId: credential.id,
      clavePublica: Buffer.from(credential.publicKey).toString('base64url'),
      contador: credential.counter,
      transports: credential.transports ?? [],
      etiquetaDispositivo: entrada.etiquetaDispositivo.trim() || 'Dispositivo biométrico',
    });

    await this.repositorioAuditoria.registrar({
      usuarioId: entrada.usuarioId,
      accion: 'registrar_biometria_webauthn',
      recurso: `biometria:${guardada.etiquetaDispositivo}`,
      origen: 'web',
      direccionIp: entrada.direccionIp,
      detalles: { credencialId: guardada.id },
    });

    return {
      id: guardada.id,
      etiquetaDispositivo: guardada.etiquetaDispositivo,
      transports: guardada.transports,
      ultimoUsoEn: guardada.ultimoUsoEn,
      creadoEn: guardada.creadoEn,
    };
  }

  public async revocarCredencial(entrada: {
    credencialId: string;
    usuarioId: string;
    direccionIp: string;
  }): Promise<boolean> {
    const eliminada = await this.repositorioBiometria.eliminar(
      entrada.credencialId,
      entrada.usuarioId,
    );
    if (eliminada) {
      await this.repositorioAuditoria.registrar({
        usuarioId: entrada.usuarioId,
        accion: 'revocar_biometria_webauthn',
        recurso: `biometria:${entrada.credencialId}`,
        origen: 'web',
        direccionIp: entrada.direccionIp,
        detalles: {},
      });
    }
    return eliminada;
  }

  public async generarOpcionesLogin(entrada: {
    nombreUsuario?: string;
    tokenTemporal2FA?: string;
    rpID: string;
    origin: string;
  }) {
    let usuarioIdObjetivo: string | undefined;

    if (entrada.tokenTemporal2FA) {
      const payload = this.servicioTokens.verificarTokenPendiente2FA(entrada.tokenTemporal2FA);
      usuarioIdObjetivo = payload.sub;
    } else if (entrada.nombreUsuario?.trim()) {
      const usuario = await this.repositorioUsuarios.buscarPorNombreUsuario(
        entrada.nombreUsuario.trim(),
      );
      if (usuario && usuario.activo) {
        usuarioIdObjetivo = usuario.id;
      }
    }

    const credenciales = usuarioIdObjetivo
      ? await this.repositorioBiometria.listarPorUsuario(usuarioIdObjetivo)
      : [];

    if (usuarioIdObjetivo && credenciales.length === 0) {
      throw new ErrorDominio(
        'SIN_BIOMETRIA_REGISTRADA',
        'Esta cuenta todavía no tiene huella digital o Face ID registrados. Actívalo primero en Seguridad.',
        400,
      );
    }

    const opciones = await generateAuthenticationOptions({
      rpID: entrada.rpID,
      userVerification: 'required',
      allowCredentials: credenciales.map((c) => ({
        id: c.credencialId,
        transports: c.transports as AuthenticatorTransport[],
      })),
    });

    const claveDesafio = `auth:${opciones.challenge}`;
    this.guardarDesafio(claveDesafio, {
      challenge: opciones.challenge,
      rpID: entrada.rpID,
      origin: entrada.origin,
      usuarioId: usuarioIdObjetivo,
    });

    return {
      opciones,
      challengeId: opciones.challenge,
    };
  }

  public async verificarLogin(entrada: {
    challengeId: string;
    respuesta: AuthenticationResponseJSON;
    direccionIp: string;
  }): Promise<ResultadoSesionBiometrica> {
    const desafio = this.consumirDesafio(`auth:${entrada.challengeId}`);
    const credencial = await this.repositorioBiometria.buscarPorCredencialId(entrada.respuesta.id);

    if (!credencial) {
      await this.repositorioSeguridad2FA.registrarEventoSeguridad({
        tipoEvento: 'biometria_desconocida',
        ipOrigen: entrada.direccionIp,
        severidad: 'media',
        detalles: {},
      });
      throw new ErrorDominio(
        'CREDENCIAL_BIOMETRICA_INVALIDA',
        'Dispositivo biométrico no reconocido en HomeSOC',
        401,
      );
    }

    if (desafio.usuarioId && credencial.usuarioId !== desafio.usuarioId) {
      throw new ErrorDominio(
        'CREDENCIAL_BIOMETRICA_INVALIDA',
        'La huella o Face ID no corresponde a esta cuenta',
        401,
      );
    }

    const usuario = await this.repositorioUsuarios.buscarPorId(credencial.usuarioId);
    if (!usuario) {
      throw new ErrorTokenInvalido('Cuenta no encontrada');
    }
    if (!usuario.activo) {
      throw new ErrorUsuarioSuspendido();
    }

    const verificacion = await verifyAuthenticationResponse({
      response: entrada.respuesta,
      expectedChallenge: desafio.challenge,
      expectedOrigin: desafio.origin,
      expectedRPID: desafio.rpID,
      credential: {
        id: credencial.credencialId,
        publicKey: new Uint8Array(Buffer.from(credencial.clavePublica, 'base64url')),
        counter: credencial.contador,
        transports: credencial.transports as AuthenticatorTransport[],
      },
      requireUserVerification: true,
    });

    if (!verificacion.verified) {
      await this.repositorioSeguridad2FA.registrarEventoSeguridad({
        tipoEvento: 'biometria_fallida',
        ipOrigen: entrada.direccionIp,
        severidad: 'alta',
        detalles: { usuario: usuario.nombreUsuario },
      });
      throw new ErrorDominio(
        'VERIFICACION_BIOMETRICA_FALLIDA',
        'La verificación biométrica falló',
        401,
      );
    }

    await this.repositorioBiometria.actualizarContadorYUso(
      credencial.id,
      verificacion.authenticationInfo.newCounter,
    );
    await this.repositorioUsuarios.registrarIntentoInicioSesion({
      nombreUsuario: usuario.nombreUsuario,
      direccionIp: entrada.direccionIp,
      exitoso: true,
    });
    if (this.repositorioUsuarios.actualizarAcceso) {
      await this.repositorioUsuarios.actualizarAcceso(usuario.id, entrada.direccionIp);
    }

    await this.repositorioAuditoria.registrar({
      usuarioId: usuario.id,
      accion: 'acceso_biometrico_webauthn',
      recurso: `biometria:${credencial.etiquetaDispositivo}`,
      origen: 'web',
      direccionIp: entrada.direccionIp,
      detalles: { credencialId: credencial.id },
    });

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
    };
  }
}
