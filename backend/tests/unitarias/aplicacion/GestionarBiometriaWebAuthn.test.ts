import { describe, expect, it, vi } from 'vitest';
import { GestionarBiometriaWebAuthn } from '../../../src/aplicacion/autenticacion/GestionarBiometriaWebAuthn';
import { Usuario } from '../../../src/dominio/entidades/Usuario';
import { ErrorDominio } from '../../../src/dominio/errores/ErroresAutenticacion';
import { RepositorioAuditoria } from '../../../src/dominio/interfaces/RepositorioAuditoria';
import { RepositorioBiometria } from '../../../src/dominio/interfaces/RepositorioBiometria';
import { RepositorioSeguridad2FA } from '../../../src/dominio/interfaces/RepositorioSeguridad2FA';
import { RepositorioUsuarios } from '../../../src/dominio/interfaces/RepositorioUsuarios';
import { ServicioTokens } from '../../../src/dominio/interfaces/ServicioTokens';

describe('GestionarBiometriaWebAuthn', () => {
  const usuarioDemo = new Usuario({
    id: '00000000-0000-0000-0000-000000000010',
    nombreUsuario: 'hebert',
    hashContrasena: 'hash:clave',
    rol: 'superadmin',
    secretoTotp: null,
    totpHabilitado: false,
    creadoEn: new Date(),
  });

  function crearContexto() {
    const repoBiometria: RepositorioBiometria = {
      listarPorUsuario: vi.fn(async () => []),
      buscarPorCredencialId: vi.fn(async () => null),
      guardar: vi.fn(),
      actualizarContadorYUso: vi.fn(async () => {}),
      eliminar: vi.fn(async () => true),
    };
    const repoUsuarios: RepositorioUsuarios = {
      buscarPorNombreUsuario: vi.fn(async () => usuarioDemo),
      buscarPorId: vi.fn(async () => usuarioDemo),
      crear: vi.fn(),
      registrarIntentoInicioSesion: vi.fn(async () => {}),
    };
    const repoAuditoria: RepositorioAuditoria = {
      registrar: vi.fn(async () => {}),
    };
    const repo2FA = {
      registrarEventoSeguridad: vi.fn(async () => {}),
    } as unknown as RepositorioSeguridad2FA;
    const servicioTokens: ServicioTokens = {
      generarParTokens: vi.fn(() => ({
        tokenAcceso: 'jwt-bio',
        tokenRefresh: 'ref-bio',
        expiraEn: '15m',
      })),
      verificarTokenAcceso: vi.fn(),
      verificarTokenRefresh: vi.fn(),
      generarTokenPendiente2FA: vi.fn(),
      verificarTokenPendiente2FA: vi.fn(),
    };

    const casoUso = new GestionarBiometriaWebAuthn(
      repoBiometria,
      repoUsuarios,
      repoAuditoria,
      repo2FA,
      servicioTokens,
    );

    return { casoUso, repoBiometria };
  }

  it('genera opciones de registro WebAuthn con verificación biométrica obligatoria', async () => {
    const { casoUso } = crearContexto();
    const opciones = await casoUso.generarOpcionesRegistro({
      usuarioId: usuarioDemo.id,
      rpID: 'home-lab.tail3b5ebb.ts.net',
      origin: 'https://home-lab.tail3b5ebb.ts.net:8444',
    });

    expect(opciones.rp.id).toBe('home-lab.tail3b5ebb.ts.net');
    expect(opciones.challenge.length).toBeGreaterThan(10);
    expect(opciones.authenticatorSelection?.userVerification).toBe('required');
  });

  it('rechaza login biométrico si la cuenta aún no tiene dispositivos registrados', async () => {
    const { casoUso } = crearContexto();
    await expect(
      casoUso.generarOpcionesLogin({
        nombreUsuario: 'hebert',
        rpID: 'home-lab.tail3b5ebb.ts.net',
        origin: 'https://home-lab.tail3b5ebb.ts.net:8444',
      }),
    ).rejects.toBeInstanceOf(ErrorDominio);
  });
});
