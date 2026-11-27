import { describe, expect, it, vi } from 'vitest';
import { Gestionar2FA } from '../../../src/aplicacion/autenticacion/Gestionar2FA';
import { ValidarSegundoFactor } from '../../../src/aplicacion/autenticacion/ValidarSegundoFactor';
import { Usuario } from '../../../src/dominio/entidades/Usuario';
import { ErrorCodigo2FAInvalido } from '../../../src/dominio/errores/ErroresAutenticacion';
import { RepositorioSeguridad2FA } from '../../../src/dominio/interfaces/RepositorioSeguridad2FA';
import { RepositorioUsuarios } from '../../../src/dominio/interfaces/RepositorioUsuarios';
import { ServicioHashContrasena } from '../../../src/dominio/interfaces/ServicioHashContrasena';
import { ServicioTokens } from '../../../src/dominio/interfaces/ServicioTokens';
import {
  esIpEnRedLocal,
  evaluarRequerimiento2FA,
} from '../../../src/dominio/reglas/EvaluadorConfianzaOrigen';
import { ServicioCifradoAes } from '../../../src/infraestructura/seguridad/ServicioCifradoAes';
import {
  calcularTotpParaContador,
  ServicioTotpCrypto,
} from '../../../src/infraestructura/seguridad/ServicioTotpCrypto';

describe('Fase 0.5 — Reglas de confianza de origen (RF-04b/c/d)', () => {
  const rangos = ['192.168.1.0/24', '127.0.0.0/8'];

  it('reconoce IPs locales IPv4 e IPv6 mapeadas y rechaza IPs externas', () => {
    expect(esIpEnRedLocal('192.168.1.50', rangos)).toBe(true);
    expect(esIpEnRedLocal('::ffff:192.168.1.105', rangos)).toBe(true);
    expect(esIpEnRedLocal('::1', rangos)).toBe(true);
    expect(esIpEnRedLocal('100.99.124.109', rangos)).toBe(false);
    expect(esIpEnRedLocal('8.8.8.8', rangos)).toBe(false);
  });

  it('exige 2FA desde red externa incluso si el dispositivo era confiable', () => {
    const evalExt = evaluarRequerimiento2FA({
      totpHabilitado: true,
      direccionIp: '100.99.124.109',
      rangosConfiablesCidr: rangos,
      dispositivoConfiableVigente: true,
    });
    expect(evalExt).toEqual({
      requerido: true,
      esRedLocal: false,
      motivo: 'red_externa',
    });
  });

  it('omite 2FA en red local solo cuando el dispositivo es confiable vigente', () => {
    expect(
      evaluarRequerimiento2FA({
        totpHabilitado: true,
        direccionIp: '192.168.1.20',
        rangosConfiablesCidr: rangos,
        dispositivoConfiableVigente: true,
      }),
    ).toEqual({ requerido: false, esRedLocal: true, motivo: 'confiable' });

    expect(
      evaluarRequerimiento2FA({
        totpHabilitado: true,
        direccionIp: '192.168.1.20',
        rangosConfiablesCidr: rangos,
        dispositivoConfiableVigente: false,
      }),
    ).toEqual({ requerido: true, esRedLocal: true, motivo: 'dispositivo_nuevo' });
  });
});

describe('Fase 0.5 — Cifrado AES-256-GCM, TOTP RFC 6238 y ValidarSegundoFactor', () => {
  const cifrado = new ServicioCifradoAes('clave_secreta_de_pruebas_unitarias_2026');
  const totp = new ServicioTotpCrypto('HomeSOC');

  it('cifra y descifra el secreto TOTP y valida el código actual', () => {
    const secreto = totp.generarSecretoBase32();
    const secretoCifrado = cifrado.cifrar(secreto);
    expect(secretoCifrado).not.toContain(secreto);
    expect(cifrado.descifrar(secretoCifrado)).toBe(secreto);

    const contadorActual = Math.floor(Date.now() / 1000 / 30);
    const codigoValido = calcularTotpParaContador(secreto, contadorActual);
    expect(totp.verificarCodigo(secreto, codigoValido)).toBe(true);
    expect(totp.verificarCodigo(secreto, '000000')).toBe(false);
  });

  it('registra evento de seguridad de severidad alta al fallar 2FA desde red externa (RF-04g)', async () => {
    const secreto = totp.generarSecretoBase32();
    const usuario = new Usuario({
      id: 'u-1',
      nombreUsuario: 'admin',
      hashContrasena: 'hash',
      rol: 'administrador',
      secretoTotp: cifrado.cifrar(secreto),
      totpHabilitado: true,
      creadoEn: new Date(),
    });

    const repoUsuarios: RepositorioUsuarios = {
      buscarPorNombreUsuario: vi.fn(),
      buscarPorId: vi.fn().mockResolvedValue(usuario),
      crear: vi.fn(),
      registrarIntentoInicioSesion: vi.fn().mockResolvedValue(undefined),
    };
    const repo2FA: RepositorioSeguridad2FA = {
      guardarSecretoTotp: vi.fn(),
      desactivarTotp: vi.fn(),
      reemplazarCodigosRecuperacion: vi.fn(),
      listarCodigosRecuperacionDisponibles: vi.fn().mockResolvedValue([]),
      marcarCodigoRecuperacionUsado: vi.fn(),
      buscarDispositivoConfiableVigente: vi.fn(),
      guardarDispositivoConfiable: vi.fn(),
      listarDispositivosConfiables: vi.fn(),
      revocarDispositivoConfiable: vi.fn(),
      registrarEventoSeguridad: vi.fn().mockResolvedValue(undefined),
    };
    const hash: ServicioHashContrasena = {
      generarHash: vi.fn(),
      verificar: vi.fn().mockResolvedValue(false),
    };
    const tokens: ServicioTokens = {
      generarParTokens: vi.fn(),
      verificarTokenAcceso: vi.fn(),
      verificarTokenRefresh: vi.fn(),
      generarTokenPendiente2FA: vi.fn(),
      verificarTokenPendiente2FA: vi.fn().mockReturnValue({
        sub: 'u-1',
        nombreUsuario: 'admin',
        rol: 'administrador',
        esRedLocal: false,
        motivo: 'red_externa',
        tipo: 'pendiente_2fa',
      }),
    };

    const casoUso = new ValidarSegundoFactor(
      repoUsuarios,
      repo2FA,
      cifrado,
      totp,
      hash,
      tokens,
    );

    await expect(
      casoUso.ejecutar({
        tokenTemporal2FA: 'token-temp',
        codigo: '999999',
        recordarDispositivo: false,
        etiquetaDispositivo: 'Chrome',
        direccionIp: '203.0.113.10',
      }),
    ).rejects.toThrow(ErrorCodigo2FAInvalido);

    expect(repo2FA.registrarEventoSeguridad).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoEvento: '2fa_fallido_externo',
        ipOrigen: '203.0.113.10',
        severidad: 'alta',
      }),
    );
  });

  it('permite desactivar 2FA usando un código de recuperación si no se usa la contraseña', async () => {
    const usuario = new Usuario({
      id: 'u-1',
      nombreUsuario: 'admin',
      hashContrasena: 'hash-password',
      rol: 'administrador',
      secretoTotp: cifrado.cifrar(totp.generarSecretoBase32()),
      totpHabilitado: true,
      creadoEn: new Date(),
    });

    const repoUsuarios: RepositorioUsuarios = {
      buscarPorNombreUsuario: vi.fn(),
      buscarPorId: vi.fn().mockResolvedValue(usuario),
      crear: vi.fn(),
      registrarIntentoInicioSesion: vi.fn(),
    };
    const repo2FA: RepositorioSeguridad2FA = {
      guardarSecretoTotp: vi.fn(),
      desactivarTotp: vi.fn().mockResolvedValue(undefined),
      reemplazarCodigosRecuperacion: vi.fn(),
      listarCodigosRecuperacionDisponibles: vi
        .fn()
        .mockResolvedValue([{ id: 'cod-1', hashCodigo: 'hash-rec-1' }]),
      marcarCodigoRecuperacionUsado: vi.fn(),
      buscarDispositivoConfiableVigente: vi.fn(),
      guardarDispositivoConfiable: vi.fn(),
      listarDispositivosConfiables: vi.fn(),
      revocarDispositivoConfiable: vi.fn(),
      registrarEventoSeguridad: vi.fn().mockResolvedValue(undefined),
    };
    const repoAuditoria = {
      registrar: vi.fn().mockResolvedValue(undefined),
    };
    const hash: ServicioHashContrasena = {
      generarHash: vi.fn(),
      verificar: vi
        .fn()
        .mockImplementation(async (texto: string, h: string) =>
          texto === 'ABCD-1234' && h === 'hash-rec-1',
        ),
    };

    const gestionar = new Gestionar2FA(
      repoUsuarios,
      repo2FA,
      repoAuditoria,
      cifrado,
      totp,
      hash,
    );

    await gestionar.desactivar('u-1', 'abcd-1234', '127.0.0.1');

    expect(repo2FA.desactivarTotp).toHaveBeenCalledWith('u-1');
    expect(repoAuditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: '2fa_desactivar',
        detalles: { metodoConfirmacion: 'codigo_recuperacion' },
      }),
    );
  });
});
