import { describe, expect, it, vi } from 'vitest';
import { RenovarSesion } from '../../../src/aplicacion/autenticacion/RenovarSesion';
import { Usuario } from '../../../src/dominio/entidades/Usuario';
import { ErrorTokenInvalido } from '../../../src/dominio/errores/ErroresAutenticacion';
import { RepositorioUsuarios } from '../../../src/dominio/interfaces/RepositorioUsuarios';
import { ServicioTokens } from '../../../src/dominio/interfaces/ServicioTokens';

const usuarioActivo = new Usuario({
  id: '00000000-0000-0000-0000-000000000001',
  nombreUsuario: 'admin',
  hashContrasena: '$2a$12$hashSimulado',
  rol: 'administrador',
  secretoTotp: null,
  totpHabilitado: false,
  creadoEn: new Date('2026-01-01T00:00:00.000Z'),
});

function crearMocks() {
  const repositorioUsuarios: RepositorioUsuarios = {
    buscarPorNombreUsuario: vi.fn(),
    buscarPorId: vi.fn(),
    crear: vi.fn(),
    registrarIntentoInicioSesion: vi.fn(),
  };
  const servicioTokens: ServicioTokens = {
    generarParTokens: vi.fn().mockReturnValue({
      tokenAcceso: 'nuevo-acceso',
      tokenRefresh: 'nuevo-refresh',
      expiraEn: '15m',
    }),
    verificarTokenAcceso: vi.fn(),
    verificarTokenRefresh: vi.fn(),
    generarTokenPendiente2FA: vi.fn(),
    verificarTokenPendiente2FA: vi.fn(),
  };
  return { repositorioUsuarios, servicioTokens };
}

describe('Caso de uso RenovarSesion', () => {
  it('valida el refresh token y rota el par de tokens cuando el usuario existe', async () => {
    const { repositorioUsuarios, servicioTokens } = crearMocks();
    vi.mocked(servicioTokens.verificarTokenRefresh).mockReturnValue({
      sub: usuarioActivo.id,
      nombreUsuario: 'admin',
      rol: 'administrador',
      tipo: 'refresh',
    });
    vi.mocked(repositorioUsuarios.buscarPorId).mockResolvedValue(usuarioActivo);

    const casoUso = new RenovarSesion(repositorioUsuarios, servicioTokens);
    const resultado = await casoUso.ejecutar('refresh-valido');

    expect(resultado.tokenAcceso).toBe('nuevo-acceso');
    expect(resultado.tokenRefresh).toBe('nuevo-refresh');
    expect(resultado.usuario.nombreUsuario).toBe('admin');
  });

  it('lanza ErrorTokenInvalido si el usuario asociado ya no existe', async () => {
    const { repositorioUsuarios, servicioTokens } = crearMocks();
    vi.mocked(servicioTokens.verificarTokenRefresh).mockReturnValue({
      sub: 'id-eliminado',
      nombreUsuario: 'admin',
      rol: 'administrador',
      tipo: 'refresh',
    });
    vi.mocked(repositorioUsuarios.buscarPorId).mockResolvedValue(null);

    const casoUso = new RenovarSesion(repositorioUsuarios, servicioTokens);

    await expect(casoUso.ejecutar('refresh-valido')).rejects.toThrow(ErrorTokenInvalido);
    expect(servicioTokens.generarParTokens).not.toHaveBeenCalled();
  });
});
