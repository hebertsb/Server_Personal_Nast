import { describe, expect, it, vi } from 'vitest';
import { ControlarContenedor } from '../../../src/aplicacion/contenedores/ControlarContenedor';
import { Contenedor } from '../../../src/dominio/entidades/Contenedor';
import {
  ErrorContenedorNoEncontrado,
  ErrorPermisosInsuficientes,
} from '../../../src/dominio/errores/ErroresContenedores';
import { ControladorDocker } from '../../../src/dominio/interfaces/ControladorDocker';
import { RepositorioAuditoria } from '../../../src/dominio/interfaces/RepositorioAuditoria';

const contenedorEjemplo: Contenedor = {
  id: 'abcdef1234567890',
  idCorto: 'abcdef123456',
  nombre: 'test-nginx',
  imagen: 'nginx:alpine',
  estado: 'running',
  estadoDetalle: 'Up 10 minutes',
  creadoEn: '2026-11-26T00:00:00.000Z',
  puertos: [],
  porcentajeCpu: 0.4,
  ramUsadaMb: 12.5,
  ramLimiteMb: 512,
  redRxMb: 0.2,
  redTxMb: 0.1,
};

function crearMocks() {
  const controladorDocker: ControladorDocker = {
    nombre: 'docker',
    recolectar: vi.fn(),
    obtenerPorId: vi.fn(),
    ejecutarAccion: vi.fn().mockResolvedValue(undefined),
    obtenerLogs: vi.fn(),
  };

  const repositorioAuditoria: RepositorioAuditoria = {
    registrar: vi.fn().mockResolvedValue(undefined),
  };

  return { controladorDocker, repositorioAuditoria };
}

describe('Caso de uso ControlarContenedor (RF-07)', () => {
  it('permite a un administrador detener un contenedor y registra la auditoría', async () => {
    const { controladorDocker, repositorioAuditoria } = crearMocks();
    vi.mocked(controladorDocker.obtenerPorId).mockResolvedValue(contenedorEjemplo);

    const casoUso = new ControlarContenedor(controladorDocker, repositorioAuditoria);
    const resultado = await casoUso.ejecutar({
      contenedorId: 'test-nginx',
      accion: 'detener',
      usuarioId: 'user-1',
      rolUsuario: 'administrador',
      direccionIp: '127.0.0.1',
    });

    expect(controladorDocker.ejecutarAccion).toHaveBeenCalledWith(
      contenedorEjemplo.id,
      'detener',
    );
    expect(repositorioAuditoria.registrar).toHaveBeenCalledWith({
      usuarioId: 'user-1',
      accion: 'contenedor_detener',
      recurso: 'test-nginx',
      origen: 'web',
      direccionIp: '127.0.0.1',
      detalles: {
        contenedorId: 'abcdef123456',
        imagen: 'nginx:alpine',
        estadoPrevio: 'running',
      },
    });
    expect(resultado.nombre).toBe('test-nginx');
    expect(resultado.accion).toBe('detener');
  });

  it('rechaza acciones de control a usuarios con rol solo_lectura', async () => {
    const { controladorDocker, repositorioAuditoria } = crearMocks();

    const casoUso = new ControlarContenedor(controladorDocker, repositorioAuditoria);

    await expect(
      casoUso.ejecutar({
        contenedorId: 'test-nginx',
        accion: 'reiniciar',
        usuarioId: 'user-2',
        rolUsuario: 'solo_lectura',
        direccionIp: '127.0.0.1',
      }),
    ).rejects.toThrow(ErrorPermisosInsuficientes);

    expect(controladorDocker.ejecutarAccion).not.toHaveBeenCalled();
    expect(repositorioAuditoria.registrar).not.toHaveBeenCalled();
  });

  it('lanza ErrorContenedorNoEncontrado cuando el contenedor no existe', async () => {
    const { controladorDocker, repositorioAuditoria } = crearMocks();
    vi.mocked(controladorDocker.obtenerPorId).mockResolvedValue(null);

    const casoUso = new ControlarContenedor(controladorDocker, repositorioAuditoria);

    await expect(
      casoUso.ejecutar({
        contenedorId: 'no-existe',
        accion: 'iniciar',
        usuarioId: 'user-1',
        rolUsuario: 'administrador',
        direccionIp: '127.0.0.1',
      }),
    ).rejects.toThrow(ErrorContenedorNoEncontrado);

    expect(controladorDocker.ejecutarAccion).not.toHaveBeenCalled();
    expect(repositorioAuditoria.registrar).not.toHaveBeenCalled();
  });
});
