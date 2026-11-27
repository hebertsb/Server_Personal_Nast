import { describe, expect, it, vi } from 'vitest';
import { ListarContenedores } from '../../../src/aplicacion/contenedores/ListarContenedores';
import { Contenedor } from '../../../src/dominio/entidades/Contenedor';
import { Colector } from '../../../src/dominio/interfaces/Colector';
import { RepositorioContenedores } from '../../../src/dominio/interfaces/RepositorioContenedores';

function crearContenedorMock(parcial: Partial<Contenedor> & { nombre: string }): Contenedor {
  return {
    id: `id-${parcial.nombre}`,
    idCorto: `short-${parcial.nombre}`.slice(0, 12),
    imagen: 'nginx:alpine',
    estado: 'running',
    estadoDetalle: 'Up 2 hours',
    creadoEn: '2026-11-26T00:00:00.000Z',
    puertos: [],
    porcentajeCpu: 1.5,
    ramUsadaMb: 32,
    ramLimiteMb: 512,
    redRxMb: 1.2,
    redTxMb: 0.4,
    ...parcial,
  };
}

describe('Caso de uso ListarContenedores (RF-05 / RF-06)', () => {
  it('ordena los contenedores por prioridad de estado, persiste snapshots y calcula el resumen', async () => {
    const colector: Colector<Contenedor[]> = {
      nombre: 'docker',
      recolectar: vi.fn().mockResolvedValue([
        crearContenedorMock({ nombre: 'z-detenido', estado: 'stopped', porcentajeCpu: 0, ramUsadaMb: 0 }),
        crearContenedorMock({ nombre: 'test-nginx', estado: 'running' }),
        crearContenedorMock({ nombre: 'api-critica', estado: 'unhealthy' }),
        crearContenedorMock({ nombre: 'alpha-web', estado: 'running' }),
      ]),
    };

    const repositorio: RepositorioContenedores = {
      guardarSnapshots: vi.fn().mockResolvedValue(undefined),
    };

    const casoUso = new ListarContenedores(colector, repositorio);
    const resultado = await casoUso.ejecutar();

    expect(resultado.contenedores.map((c) => c.nombre)).toEqual([
      'api-critica',
      'alpha-web',
      'test-nginx',
      'z-detenido',
    ]);
    expect(resultado.resumen).toEqual({
      total: 4,
      activos: 2,
      detenidos: 1,
      conProblemas: 1,
    });
    expect(repositorio.guardarSnapshots).toHaveBeenCalledTimes(1);
    expect(repositorio.guardarSnapshots).toHaveBeenCalledWith(resultado.contenedores);
  });

  it('no inserta snapshots cuando no existen contenedores', async () => {
    const colector: Colector<Contenedor[]> = {
      nombre: 'docker',
      recolectar: vi.fn().mockResolvedValue([]),
    };
    const repositorio: RepositorioContenedores = {
      guardarSnapshots: vi.fn().mockResolvedValue(undefined),
    };

    const casoUso = new ListarContenedores(colector, repositorio);
    const resultado = await casoUso.ejecutar();

    expect(resultado.contenedores).toEqual([]);
    expect(resultado.resumen.total).toBe(0);
    expect(repositorio.guardarSnapshots).not.toHaveBeenCalled();
  });
});
