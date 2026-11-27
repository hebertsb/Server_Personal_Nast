import crypto from 'node:crypto';
import { InvitacionUsuario, RolInvitacion } from '../../dominio/entidades/InvitacionUsuario';
import {
  MODULOS_SISTEMA,
  ModuloSistema,
  PerfilUsuarioPublico,
  RolUsuario,
} from '../../dominio/entidades/Usuario';
import {
  Error2FANoConfigurado,
  ErrorCodigo2FAInvalido,
  ErrorDominio,
  ErrorInvitacionInvalida,
  ErrorPermisoDenegado,
  ErrorSetupNoDisponible,
  ErrorUsuarioSuspendido,
  ErrorUsuarioYaExiste,
} from '../../dominio/errores/ErroresAutenticacion';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';
import { RepositorioSeguridad2FA } from '../../dominio/interfaces/RepositorioSeguridad2FA';
import { RepositorioUsuarios } from '../../dominio/interfaces/RepositorioUsuarios';
import { ServicioCifrado } from '../../dominio/interfaces/ServicioCifrado';
import { ServicioHashContrasena } from '../../dominio/interfaces/ServicioHashContrasena';
import { ServicioTokens } from '../../dominio/interfaces/ServicioTokens';
import { ServicioTotp } from '../../dominio/interfaces/ServicioTotp';

function hashTokenSha256(tokenCrudo: string): string {
  return crypto.createHash('sha256').update(tokenCrudo.trim(), 'utf8').digest('hex');
}

export interface ResultadoSesionGenerada {
  usuario: PerfilUsuarioPublico;
  tokenAcceso: string;
  tokenRefresh: string;
  expiraEn: string;
}

export interface ResultadoCrearInvitacion {
  invitacion: InvitacionUsuario;
  tokenPlano: string;
}

/**
 * Caso de uso para el ciclo de vida de cuentas, setup inicial de Superadmin,
 * registro por invitación temporal con token firmado/hasheado, recuperación
 * de contraseña mediante 2FA (TOTP) y control granular de permisos por módulo.
 */
export class GestionarAccesoYUsuarios {
  constructor(
    private readonly repositorioUsuarios: RepositorioUsuarios,
    private readonly repositorioSeguridad2FA: RepositorioSeguridad2FA,
    private readonly repositorioAuditoria: RepositorioAuditoria,
    private readonly servicioHash: ServicioHashContrasena,
    private readonly servicioCifrado: ServicioCifrado,
    private readonly servicioTotp: ServicioTotp,
    private readonly servicioTokens: ServicioTokens,
  ) {}

  /** Indica si el sistema aún no tiene usuarios y requiere configuración inicial de Superadmin. */
  public async obtenerEstadoInicial(): Promise<{ requiereSetup: boolean }> {
    const total = this.repositorioUsuarios.contarUsuarios
      ? await this.repositorioUsuarios.contarUsuarios()
      : 1;
    return { requiereSetup: total === 0 };
  }

  /** Crea la primera y única cuenta Superadmin inicial cuando la base de datos está vacía. */
  public async ejecutarSetupInicial(entrada: {
    nombreUsuario: string;
    contrasena: string;
    direccionIp: string;
  }): Promise<ResultadoSesionGenerada> {
    const { requiereSetup } = await this.obtenerEstadoInicial();
    if (!requiereSetup) {
      throw new ErrorSetupNoDisponible();
    }

    const nombreNormalizado = entrada.nombreUsuario.trim();
    const hashContrasena = await this.servicioHash.generarHash(entrada.contrasena);
    const usuario = await this.repositorioUsuarios.crear({
      nombreUsuario: nombreNormalizado,
      hashContrasena,
      rol: 'superadmin',
      permisosModulos: [...MODULOS_SISTEMA],
    });

    if (this.repositorioUsuarios.actualizarAcceso) {
      await this.repositorioUsuarios.actualizarAcceso(usuario.id, entrada.direccionIp);
    }

    await this.repositorioAuditoria.registrar({
      usuarioId: usuario.id,
      accion: 'setup_superadmin_inicial',
      recurso: `usuario:${usuario.nombreUsuario}`,
      origen: 'web',
      direccionIp: entrada.direccionIp,
      detalles: { rol: 'superadmin' },
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

  /** Registra un nuevo usuario validando un token de invitación temporal de un solo uso. */
  public async registrarConInvitacion(entrada: {
    tokenInvitacion: string;
    nombreUsuario: string;
    contrasena: string;
    direccionIp: string;
  }): Promise<ResultadoSesionGenerada> {
    if (
      !this.repositorioUsuarios.buscarInvitacionPorHash ||
      !this.repositorioUsuarios.marcarInvitacionUsada
    ) {
      throw new ErrorInvitacionInvalida('El módulo de invitaciones no está disponible');
    }

    const hash = hashTokenSha256(entrada.tokenInvitacion);
    const invitacion = await this.repositorioUsuarios.buscarInvitacionPorHash(hash);

    if (
      !invitacion ||
      invitacion.revocada ||
      invitacion.usadoEn !== null ||
      invitacion.expiraEn.getTime() < Date.now()
    ) {
      await this.repositorioSeguridad2FA.registrarEventoSeguridad({
        tipoEvento: 'registro_token_invalido',
        ipOrigen: entrada.direccionIp,
        severidad: 'media',
        detalles: {
          nombreUsuarioIntentado: entrada.nombreUsuario.trim(),
          motivo: !invitacion
            ? 'no_encontrado'
            : invitacion.revocada
              ? 'revocado'
              : invitacion.usadoEn
                ? 'ya_usado'
                : 'expirado',
        },
      });
      throw new ErrorInvitacionInvalida();
    }

    const nombreNormalizado = entrada.nombreUsuario.trim();
    const existente = await this.repositorioUsuarios.buscarPorNombreUsuario(nombreNormalizado);
    if (existente) {
      throw new ErrorUsuarioYaExiste();
    }

    const hashContrasena = await this.servicioHash.generarHash(entrada.contrasena);
    const usuario = await this.repositorioUsuarios.crear({
      nombreUsuario: nombreNormalizado,
      hashContrasena,
      rol: invitacion.rol,
      permisosModulos: invitacion.permisosModulos,
    });

    await this.repositorioUsuarios.marcarInvitacionUsada(invitacion.id, usuario.id);
    if (this.repositorioUsuarios.actualizarAcceso) {
      await this.repositorioUsuarios.actualizarAcceso(usuario.id, entrada.direccionIp);
    }

    await this.repositorioAuditoria.registrar({
      usuarioId: usuario.id,
      accion: 'usuario_registrado_invitacion',
      recurso: `usuario:${usuario.nombreUsuario}`,
      origen: 'web',
      direccionIp: entrada.direccionIp,
      detalles: {
        rol: invitacion.rol,
        permisosModulos: invitacion.permisosModulos,
        invitacionId: invitacion.id,
      },
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

  /**
   * Permite restablecer la contraseña validando un código TOTP de 6 dígitos
   * (o código de recuperación 2FA) y revoca inmediatamente todas las sesiones previas.
   */
  public async recuperarContrasenaConTotp(entrada: {
    nombreUsuario: string;
    codigo: string;
    nuevaContrasena: string;
    direccionIp: string;
  }): Promise<{ mensaje: string }> {
    const usuario = await this.repositorioUsuarios.buscarPorNombreUsuario(
      entrada.nombreUsuario.trim(),
    );

    if (!usuario) {
      throw new ErrorCodigo2FAInvalido(
        'No se pudo verificar la identidad. Revisa el usuario y el código 2FA.',
      );
    }

    if (!usuario.activo) {
      throw new ErrorUsuarioSuspendido();
    }

    if (!usuario.totpHabilitado || !usuario.secretoTotp) {
      throw new Error2FANoConfigurado(
        'Esta cuenta no tiene 2FA configurado. Solicita al Superadmin el restablecimiento.',
      );
    }

    const codigoLimpio = entrada.codigo.trim().toUpperCase();
    const secretoPlano = this.servicioCifrado.descifrar(usuario.secretoTotp);
    let valido = false;

    if (/^\d{6}$/.test(codigoLimpio)) {
      valido = this.servicioTotp.verificarCodigo(secretoPlano, codigoLimpio);
    }

    if (!valido) {
      const codigosDisponibles =
        await this.repositorioSeguridad2FA.listarCodigosRecuperacionDisponibles(usuario.id);
      for (const registro of codigosDisponibles) {
        if (await this.servicioHash.verificar(codigoLimpio, registro.hashCodigo)) {
          valido = true;
          await this.repositorioSeguridad2FA.marcarCodigoRecuperacionUsado(registro.id);
          break;
        }
      }
    }

    if (!valido) {
      await this.repositorioSeguridad2FA.registrarEventoSeguridad({
        tipoEvento: 'recuperacion_2fa_fallida',
        ipOrigen: entrada.direccionIp,
        severidad: 'alta',
        detalles: { usuario: usuario.nombreUsuario },
      });
      throw new ErrorCodigo2FAInvalido('Código 2FA inválido para restablecer contraseña');
    }

    const nuevoHash = await this.servicioHash.generarHash(entrada.nuevaContrasena);
    if (this.repositorioUsuarios.actualizarContrasenaYRevocarSesiones) {
      await this.repositorioUsuarios.actualizarContrasenaYRevocarSesiones(usuario.id, nuevoHash);
    }

    await this.repositorioSeguridad2FA.registrarEventoSeguridad({
      tipoEvento: 'contrasena_restablecida_totp',
      ipOrigen: entrada.direccionIp,
      severidad: 'media',
      detalles: { usuario: usuario.nombreUsuario },
    });

    await this.repositorioAuditoria.registrar({
      usuarioId: usuario.id,
      accion: 'contrasena_restablecida_totp',
      recurso: `usuario:${usuario.nombreUsuario}`,
      origen: 'web',
      direccionIp: entrada.direccionIp,
      detalles: { sesionesRevocadas: true },
    });

    return {
      mensaje:
        'Contraseña restablecida correctamente mediante 2FA. Todas las sesiones anteriores fueron cerradas.',
    };
  }

  /** Lista todos los usuarios registrados con sus permisos y último acceso (solo Superadmin). */
  public async listarUsuarios(): Promise<PerfilUsuarioPublico[]> {
    if (!this.repositorioUsuarios.listarTodos) return [];
    const usuarios = await this.repositorioUsuarios.listarTodos();
    return usuarios.map((u) => u.aPerfilPublico());
  }

  /** Genera un token de invitación temporal de un solo uso y guarda solo su hash SHA-256. */
  public async crearInvitacion(entrada: {
    rol: RolInvitacion;
    permisosModulos: ModuloSistema[];
    expiraEnHoras: number;
    nota?: string | null;
    creadoPorId: string;
    direccionIp: string;
  }): Promise<ResultadoCrearInvitacion> {
    if (!this.repositorioUsuarios.crearInvitacion) {
      throw new ErrorDominio('NO_SOPORTADO', 'Repositorio sin soporte de invitaciones', 500);
    }

    const tokenPlano = `hs_inv_${crypto.randomBytes(20).toString('base64url')}`;
    const tokenHash = hashTokenSha256(tokenPlano);
    const prefijoToken = tokenPlano.slice(0, 14);
    const expiraEn = new Date(Date.now() + entrada.expiraEnHoras * 60 * 60 * 1000);
    const permisosLimpios = entrada.permisosModulos.filter((m) => m !== 'usuarios');

    const invitacion = await this.repositorioUsuarios.crearInvitacion({
      tokenHash,
      prefijoToken,
      rol: entrada.rol,
      permisosModulos: permisosLimpios.length > 0 ? permisosLimpios : ['recursos'],
      nota: entrada.nota?.trim() || null,
      creadoPorId: entrada.creadoPorId,
      expiraEn,
    });

    await this.repositorioAuditoria.registrar({
      usuarioId: entrada.creadoPorId,
      accion: 'crear_invitacion_usuario',
      recurso: `invitacion:${invitacion.prefijoToken}`,
      origen: 'web',
      direccionIp: entrada.direccionIp,
      detalles: {
        rol: entrada.rol,
        permisosModulos: invitacion.permisosModulos,
        expiraEnHoras: entrada.expiraEnHoras,
      },
    });

    return { invitacion, tokenPlano };
  }

  public async listarInvitaciones(): Promise<InvitacionUsuario[]> {
    if (!this.repositorioUsuarios.listarInvitaciones) return [];
    return this.repositorioUsuarios.listarInvitaciones();
  }

  public async revocarInvitacion(
    invitacionId: string,
    actorId: string,
    direccionIp: string,
  ): Promise<boolean> {
    if (!this.repositorioUsuarios.revocarInvitacion) return false;
    const revocada = await this.repositorioUsuarios.revocarInvitacion(invitacionId);
    if (revocada) {
      await this.repositorioAuditoria.registrar({
        usuarioId: actorId,
        accion: 'revocar_invitacion_usuario',
        recurso: `invitacion:${invitacionId}`,
        origen: 'web',
        direccionIp,
        detalles: {},
      });
    }
    return revocada;
  }

  public async actualizarPermisosUsuario(entrada: {
    usuarioId: string;
    rol: RolUsuario;
    permisosModulos: ModuloSistema[];
    actorId: string;
    direccionIp: string;
  }): Promise<PerfilUsuarioPublico> {
    if (entrada.usuarioId === entrada.actorId && entrada.rol !== 'superadmin') {
      throw new ErrorPermisoDenegado('No puedes quitarte a ti mismo el rol de Superadmin');
    }

    const permisosFinales =
      entrada.rol === 'superadmin'
        ? [...MODULOS_SISTEMA]
        : entrada.permisosModulos.filter((m) => m !== 'usuarios');

    if (!this.repositorioUsuarios.actualizarPermisosYRol) {
      throw new ErrorDominio('NO_SOPORTADO', 'No se pudo actualizar permisos', 500);
    }

    const actualizado = await this.repositorioUsuarios.actualizarPermisosYRol(
      entrada.usuarioId,
      entrada.rol,
      permisosFinales.length > 0 ? permisosFinales : ['recursos'],
    );
    if (!actualizado) {
      throw new ErrorDominio('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado', 404);
    }

    await this.repositorioAuditoria.registrar({
      usuarioId: entrada.actorId,
      accion: 'actualizar_permisos_usuario',
      recurso: `usuario:${actualizado.nombreUsuario}`,
      origen: 'web',
      direccionIp: entrada.direccionIp,
      detalles: { rol: actualizado.rol, permisosModulos: actualizado.permisosModulos },
    });

    return actualizado.aPerfilPublico();
  }

  public async cambiarEstadoUsuario(entrada: {
    usuarioId: string;
    activo: boolean;
    actorId: string;
    direccionIp: string;
  }): Promise<PerfilUsuarioPublico> {
    if (entrada.usuarioId === entrada.actorId && !entrada.activo) {
      throw new ErrorPermisoDenegado('No puedes suspender tu propia cuenta de Superadmin');
    }
    if (!this.repositorioUsuarios.actualizarEstadoActivo) {
      throw new ErrorDominio('NO_SOPORTADO', 'No se pudo actualizar estado del usuario', 500);
    }

    const actualizado = await this.repositorioUsuarios.actualizarEstadoActivo(
      entrada.usuarioId,
      entrada.activo,
    );
    if (!actualizado) {
      throw new ErrorDominio('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado', 404);
    }

    await this.repositorioAuditoria.registrar({
      usuarioId: entrada.actorId,
      accion: entrada.activo ? 'activar_usuario' : 'suspender_usuario',
      recurso: `usuario:${actualizado.nombreUsuario}`,
      origen: 'web',
      direccionIp: entrada.direccionIp,
      detalles: { activo: entrada.activo },
    });

    return actualizado.aPerfilPublico();
  }

  public async revocarSesionesUsuario(entrada: {
    usuarioId: string;
    actorId: string;
    direccionIp: string;
  }): Promise<{ mensaje: string }> {
    const usuario = await this.repositorioUsuarios.buscarPorId(entrada.usuarioId);
    if (!usuario) {
      throw new ErrorDominio('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado', 404);
    }
    if (this.repositorioUsuarios.incrementarVersionSesion) {
      await this.repositorioUsuarios.incrementarVersionSesion(usuario.id);
    }
    await this.repositorioAuditoria.registrar({
      usuarioId: entrada.actorId,
      accion: 'revocar_sesiones_usuario',
      recurso: `usuario:${usuario.nombreUsuario}`,
      origen: 'web',
      direccionIp: entrada.direccionIp,
      detalles: {},
    });
    return { mensaje: `Sesiones de ${usuario.nombreUsuario} revocadas correctamente` };
  }
}
