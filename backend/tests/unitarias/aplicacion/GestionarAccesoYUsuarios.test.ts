import { describe, expect, it, vi } from 'vitest';
import { GestionarAccesoYUsuarios } from '../../../src/aplicacion/autenticacion/GestionarAccesoYUsuarios';
import { InvitacionUsuario } from '../../../src/dominio/entidades/InvitacionUsuario';
import { Usuario } from '../../../src/dominio/entidades/Usuario';
import {
  ErrorCodigo2FAInvalido,
  ErrorInvitacionInvalida,
  ErrorPermisoDenegado,
  ErrorSetupNoDisponible,
} from '../../../src/dominio/errores/ErroresAutenticacion';
import { RepositorioAuditoria } from '../../../src/dominio/interfaces/RepositorioAuditoria';
import { RepositorioSeguridad2FA } from '../../../src/dominio/interfaces/RepositorioSeguridad2FA';
import { RepositorioUsuarios } from '../../../src/dominio/interfaces/RepositorioUsuarios';
import { ServicioCifrado } from '../../../src/dominio/interfaces/ServicioCifrado';
import { ServicioHashContrasena } from '../../../src/dominio/interfaces/ServicioHashContrasena';
import { ServicioTokens } from '../../../src/dominio/interfaces/ServicioTokens';
import { ServicioTotp } from '../../../src/dominio/interfaces/ServicioTotp';

function crearMocks() {
  const usuarios: Usuario[] = [];
  const invitaciones: Array<InvitacionUsuario & { tokenHash: string }> = [];

  const repoUsuarios: RepositorioUsuarios = {
    buscarPorNombreUsuario: vi.fn(
      async (n) => usuarios.find((u) => u.nombreUsuario.toLowerCase() === n.toLowerCase()) ?? null,
    ),
    buscarPorId: vi.fn(async (id) => usuarios.find((u) => u.id === id) ?? null),
    crear: vi.fn(async (datos) => {
      const nuevo = new Usuario({
        id: `usr-${usuarios.length + 1}`,
        nombreUsuario: datos.nombreUsuario,
        hashContrasena: datos.hashContrasena,
        rol: datos.rol,
        permisosModulos: datos.permisosModulos,
        secretoTotp: null,
        totpHabilitado: false,
        creadoEn: new Date(),
      });
      usuarios.push(nuevo);
      return nuevo;
    }),
    registrarIntentoInicioSesion: vi.fn(async () => {}),
    contarUsuarios: vi.fn(async () => usuarios.length),
    listarTodos: vi.fn(async () => usuarios),
    actualizarAcceso: vi.fn(async () => {}),
    actualizarContrasenaYRevocarSesiones: vi.fn(async () => {}),
    incrementarVersionSesion: vi.fn(async () => {}),
    crearInvitacion: vi.fn(async (datos) => {
      const inv = {
        id: `inv-${invitaciones.length + 1}`,
        tokenHash: datos.tokenHash,
        prefijoToken: datos.prefijoToken,
        rol: datos.rol,
        permisosModulos: datos.permisosModulos,
        nota: datos.nota,
        creadoPorId: datos.creadoPorId,
        expiraEn: datos.expiraEn,
        usadoEn: null,
        usadoPorId: null,
        revocada: false,
        creadoEn: new Date(),
      };
      invitaciones.push(inv);
      return inv;
    }),
    listarInvitaciones: vi.fn(async () => invitaciones),
    buscarInvitacionPorHash: vi.fn(
      async (hash) => invitaciones.find((i) => i.tokenHash === hash) ?? null,
    ),
    marcarInvitacionUsada: vi.fn(async (id, usadoPorId) => {
      const inv = invitaciones.find((i) => i.id === id);
      if (inv) {
        inv.usadoEn = new Date();
        inv.usadoPorId = usadoPorId;
      }
    }),
    revocarInvitacion: vi.fn(async () => true),
  };

  const repo2FA = {
    registrarEventoSeguridad: vi.fn(async () => {}),
    listarCodigosRecuperacionDisponibles: vi.fn(async () => []),
    marcarCodigoRecuperacionUsado: vi.fn(async () => {}),
  } as unknown as RepositorioSeguridad2FA;

  const repoAuditoria: RepositorioAuditoria = {
    registrar: vi.fn(async () => {}),
  };

  const servicioHash: ServicioHashContrasena = {
    generarHash: vi.fn(async (clave) => `hash:${clave}`),
    verificar: vi.fn(async (clave, hash) => hash === `hash:${clave}`),
  };

  const servicioCifrado: ServicioCifrado = {
    cifrar: vi.fn((t) => `enc:${t}`),
    descifrar: vi.fn((t) => t.replace('enc:', '')),
  };

  const servicioTotp: ServicioTotp = {
    generarSecretoBase32: vi.fn(() => 'SECRETBASE32'),
    construirUriOtpAuth: vi.fn(() => 'otpauth://totp/HomeSOC:admin?secret=SECRETBASE32'),
    generarQrDataUrl: vi.fn(async () => 'data:image/png;base64,'),
    verificarCodigo: vi.fn((_secreto, codigo) => codigo === '123456'),
    generarCodigosRecuperacion: vi.fn(() => ['AAAA-BBBB']),
  };

  const servicioTokens: ServicioTokens = {
    generarParTokens: vi.fn(() => ({
      tokenAcceso: 'jwt-acceso',
      tokenRefresh: 'jwt-refresh',
      expiraEn: '15m',
    })),
    verificarTokenAcceso: vi.fn(),
    verificarTokenRefresh: vi.fn(),
    generarTokenPendiente2FA: vi.fn(),
    verificarTokenPendiente2FA: vi.fn(),
  };

  const casoUso = new GestionarAccesoYUsuarios(
    repoUsuarios,
    repo2FA,
    repoAuditoria,
    servicioHash,
    servicioCifrado,
    servicioTotp,
    servicioTokens,
  );

  return { casoUso, usuarios, repoUsuarios };
}

describe('GestionarAccesoYUsuarios', () => {
  it('permite ejecutar setup inicial de Superadmin una sola vez cuando no hay usuarios', async () => {
    const { casoUso } = crearMocks();

    expect(await casoUso.obtenerEstadoInicial()).toEqual({ requiereSetup: true });

    const res = await casoUso.ejecutarSetupInicial({
      nombreUsuario: 'hebert',
      contrasena: 'ClaveSuperSegura123',
      direccionIp: '192.168.1.7',
    });

    expect(res.usuario.rol).toBe('superadmin');
    expect(await casoUso.obtenerEstadoInicial()).toEqual({ requiereSetup: false });

    await expect(
      casoUso.ejecutarSetupInicial({
        nombreUsuario: 'intruso',
        contrasena: 'ClaveIntruso123',
        direccionIp: '192.168.1.99',
      }),
    ).rejects.toBeInstanceOf(ErrorSetupNoDisponible);
  });

  it('crea token de invitación temporal, registra colaborador y bloquea su reutilización', async () => {
    const { casoUso } = crearMocks();
    const superadmin = await casoUso.ejecutarSetupInicial({
      nombreUsuario: 'hebert',
      contrasena: 'ClaveSuperSegura123',
      direccionIp: '127.0.0.1',
    });

    const { tokenPlano } = await casoUso.crearInvitacion({
      rol: 'colaborador',
      permisosModulos: ['recursos', 'servicios'],
      expiraEnHoras: 24,
      nota: 'Colaborador proyecto web',
      creadoPorId: superadmin.usuario.id,
      direccionIp: '127.0.0.1',
    });

    expect(tokenPlano.startsWith('hs_inv_')).toBe(true);

    const registro = await casoUso.registrarConInvitacion({
      tokenInvitacion: tokenPlano,
      nombreUsuario: 'carlos',
      contrasena: 'ClaveColab1234',
      direccionIp: '192.168.1.50',
    });

    expect(registro.usuario.rol).toBe('colaborador');
    expect(registro.usuario.permisosModulos).toEqual(['recursos', 'servicios']);

    await expect(
      casoUso.registrarConInvitacion({
        tokenInvitacion: tokenPlano,
        nombreUsuario: 'otro',
        contrasena: 'ClaveOtra1234',
        direccionIp: '192.168.1.51',
      }),
    ).rejects.toBeInstanceOf(ErrorInvitacionInvalida);
  });

  it('restablece contraseña mediante código TOTP 2FA válido y revoca sesiones', async () => {
    const { casoUso, usuarios, repoUsuarios } = crearMocks();
    usuarios.push(
      new Usuario({
        id: 'u-2fa',
        nombreUsuario: 'hebert',
        hashContrasena: 'hash:anterior',
        rol: 'superadmin',
        secretoTotp: 'enc:SECRETBASE32',
        totpHabilitado: true,
        creadoEn: new Date(),
      }),
    );

    await expect(
      casoUso.recuperarContrasenaConTotp({
        nombreUsuario: 'hebert',
        codigo: '999999',
        nuevaContrasena: 'NuevaClave1234',
        direccionIp: '192.168.1.7',
      }),
    ).rejects.toBeInstanceOf(ErrorCodigo2FAInvalido);

    const ok = await casoUso.recuperarContrasenaConTotp({
      nombreUsuario: 'hebert',
      codigo: '123456',
      nuevaContrasena: 'NuevaClave1234',
      direccionIp: '192.168.1.7',
    });

    expect(ok.mensaje).toContain('restablecida');
    expect(repoUsuarios.actualizarContrasenaYRevocarSesiones).toHaveBeenCalledWith(
      'u-2fa',
      'hash:NuevaClave1234',
    );
  });

  it('impide que el Superadmin se suspenda a sí mismo', async () => {
    const { casoUso } = crearMocks();
    await expect(
      casoUso.cambiarEstadoUsuario({
        usuarioId: 'usr-1',
        activo: false,
        actorId: 'usr-1',
        direccionIp: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(ErrorPermisoDenegado);
  });

  it('permite auto-registro público de estudiante con WhatsApp y Telegram', async () => {
    const { casoUso, repoUsuarios } = crearMocks();
    repoUsuarios.actualizarContacto = vi.fn(async () => undefined);

    const res = await casoUso.registrarCuentaPublica({
      nombreUsuario: 'estudiante.uagrm',
      contrasena: 'ClaveSegura@2026',
      whatsappNumero: '+591 73655782',
      telegramChatId: '1463499995',
      direccionIp: '192.168.1.50',
    });

    expect(res.usuario.nombreUsuario).toBe('estudiante.uagrm');
    expect(res.usuario.rol).toBe('colaborador');
    expect(res.usuario.permisosModulos).toEqual(['servicios', 'recursos']);
    expect(repoUsuarios.actualizarContacto).toHaveBeenCalledWith(res.usuario.id, {
      whatsappNumero: '59173655782',
      telegramChatId: '1463499995',
    });
  });
});
