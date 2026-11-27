import { describe, expect, it, vi } from 'vitest';
import { IniciarSesion } from '../../../src/aplicacion/autenticacion/IniciarSesion';
import { Usuario } from '../../../src/dominio/entidades/Usuario';
import { ErrorCredencialesInvalidas } from '../../../src/dominio/errores/ErroresAutenticacion';
import { RepositorioUsuarios } from '../../../src/dominio/interfaces/RepositorioUsuarios';
import { ServicioHashContrasena } from '../../../src/dominio/interfaces/ServicioHashContrasena';
import { ServicioTokens } from '../../../src/dominio/interfaces/ServicioTokens';

function crearUsuarioEjemplo(): Usuario {
  return new Usuario({
    id: '00000000-0000-0000-0000-000000000001',
    nombreUsuario: 'admin',
    hashContrasena: '$2a$12$hashSimuladoDePrueba',
    rol: 'administrador',
    secretoTotp: null,
    totpHabilitado: false,
    creadoEn: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function crearMocks() {
  const repositorioUsuarios: RepositorioUsuarios = {
    buscarPorNombreUsuario: vi.fn(),
    buscarPorId: vi.fn(),
    crear: vi.fn(),
    registrarIntentoInicioSesion: vi.fn().mockResolvedValue(undefined),
  };

  const servicioHash: ServicioHashContrasena = {
    generarHash: vi.fn(),
    verificar: vi.fn(),
  };

  const servicioTokens: ServicioTokens = {
    generarParTokens: vi.fn().mockReturnValue({
      tokenAcceso: 'jwt-acceso-prueba',
      tokenRefresh: 'jwt-refresh-prueba',
      expiraEn: '15m',
    }),
    verificarTokenAcceso: vi.fn(),
    verificarTokenRefresh: vi.fn(),
    generarTokenPendiente2FA: vi.fn().mockReturnValue('jwt-pendiente-2fa'),
    verificarTokenPendiente2FA: vi.fn(),
  };

  return { repositorioUsuarios, servicioHash, servicioTokens };
}

describe('Caso de uso IniciarSesion (HU-01)', () => {
  it('autentica correctamente, registra intento exitoso y devuelve tokens sin exponer el hash', async () => {
    const { repositorioUsuarios, servicioHash, servicioTokens } = crearMocks();
    const usuario = crearUsuarioEjemplo();

    vi.mocked(repositorioUsuarios.buscarPorNombreUsuario).mockResolvedValue(usuario);
    vi.mocked(servicioHash.verificar).mockResolvedValue(true);

    const casoUso = new IniciarSesion(repositorioUsuarios, servicioHash, servicioTokens);

    const resultado = await casoUso.ejecutar({
      nombreUsuario: ' admin ',
      contrasena: 'clave-valida',
      direccionIp: '127.0.0.1',
    });

    expect(repositorioUsuarios.buscarPorNombreUsuario).toHaveBeenCalledWith('admin');
    expect(servicioHash.verificar).toHaveBeenCalledWith('clave-valida', usuario.hashContrasena);
    expect(repositorioUsuarios.registrarIntentoInicioSesion).toHaveBeenCalledWith({
      nombreUsuario: 'admin',
      direccionIp: '127.0.0.1',
      exitoso: true,
    });
    expect(servicioTokens.generarParTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        id: usuario.id,
        nombreUsuario: 'admin',
        rol: 'administrador',
      }),
    );
    expect(resultado).toMatchObject({
      requiere2FA: false,
      usuario: {
        id: usuario.id,
        nombreUsuario: 'admin',
        rol: 'administrador',
        totpHabilitado: false,
        creadoEn: usuario.creadoEn,
        activo: true,
      },
      tokenAcceso: 'jwt-acceso-prueba',
      tokenRefresh: 'jwt-refresh-prueba',
      expiraEn: '15m',
    });
    expect('hashContrasena' in resultado.usuario).toBe(false);
  });

  it('lanza ErrorCredencialesInvalidas y registra intento fallido cuando la contraseña es incorrecta', async () => {
    const { repositorioUsuarios, servicioHash, servicioTokens } = crearMocks();
    const usuario = crearUsuarioEjemplo();

    vi.mocked(repositorioUsuarios.buscarPorNombreUsuario).mockResolvedValue(usuario);
    vi.mocked(servicioHash.verificar).mockResolvedValue(false);

    const casoUso = new IniciarSesion(repositorioUsuarios, servicioHash, servicioTokens);

    await expect(
      casoUso.ejecutar({
        nombreUsuario: 'admin',
        contrasena: 'clave-incorrecta',
        direccionIp: '127.0.0.1',
      }),
    ).rejects.toThrow(ErrorCredencialesInvalidas);

    expect(repositorioUsuarios.registrarIntentoInicioSesion).toHaveBeenCalledWith({
      nombreUsuario: 'admin',
      direccionIp: '127.0.0.1',
      exitoso: false,
    });
    expect(servicioTokens.generarParTokens).not.toHaveBeenCalled();
  });

  it('lanza ErrorCredencialesInvalidas y registra intento fallido cuando el usuario no existe', async () => {
    const { repositorioUsuarios, servicioHash, servicioTokens } = crearMocks();

    vi.mocked(repositorioUsuarios.buscarPorNombreUsuario).mockResolvedValue(null);

    const casoUso = new IniciarSesion(repositorioUsuarios, servicioHash, servicioTokens);

    await expect(
      casoUso.ejecutar({
        nombreUsuario: 'inexistente',
        contrasena: 'cualquier-clave',
        direccionIp: '127.0.0.1',
      }),
    ).rejects.toThrow(ErrorCredencialesInvalidas);

    expect(servicioHash.verificar).not.toHaveBeenCalled();
    expect(repositorioUsuarios.registrarIntentoInicioSesion).toHaveBeenCalledWith({
      nombreUsuario: 'inexistente',
      direccionIp: '127.0.0.1',
      exitoso: false,
    });
    expect(servicioTokens.generarParTokens).not.toHaveBeenCalled();
  });
});
