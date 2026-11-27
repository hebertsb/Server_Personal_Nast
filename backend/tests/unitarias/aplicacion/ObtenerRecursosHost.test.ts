import { describe, expect, it, vi } from 'vitest';
import { ObtenerHistoricoRecursos } from '../../../src/aplicacion/recursos/ObtenerHistoricoRecursos';
import { ObtenerRecursosHost } from '../../../src/aplicacion/recursos/ObtenerRecursosHost';
import { RecursosHost } from '../../../src/dominio/entidades/RecursosHost';
import { Colector } from '../../../src/dominio/interfaces/Colector';
import { RepositorioRecursosHost } from '../../../src/dominio/interfaces/RepositorioRecursosHost';

const muestraHost: RecursosHost = {
  hostname: 'homesoc-dev',
  plataforma: 'Linux 6.6',
  arquitectura: 'x64',
  modeloCpu: 'AMD Ryzen 5 5500U',
  cantidadNucleos: 6,
  tiempoActividadSeg: 3600,
  cargaPromedio: [0.42, 0.38, 0.31],
  porcentajeCpu: 22.5,
  nucleos: [
    { indice: 1, porcentajeUso: 20 },
    { indice: 2, porcentajeUso: 25 },
  ],
  ramUsadaMb: 4096,
  ramTotalMb: 16384,
  ramLibreMb: 12288,
  porcentajeRam: 25,
  temperaturaC: 48.5,
  discos: [
    {
      etiqueta: 'Sistema',
      puntoMontaje: '/',
      totalGb: 250,
      usadoGb: 100,
      libreGb: 150,
      porcentajeUso: 40,
    },
  ],
  marcaTiempo: '2026-11-26T14:00:00.000Z',
};

describe('Casos de uso de Recursos del Host (RF-24 / RF-25)', () => {
  it('recolecta recursos actuales y persiste el snapshot por defecto', async () => {
    const colector: Colector<RecursosHost> = {
      nombre: 'recursos_host',
      recolectar: vi.fn().mockResolvedValue(muestraHost),
    };
    const repositorio: RepositorioRecursosHost = {
      guardarSnapshot: vi.fn().mockResolvedValue(undefined),
      obtenerHistorico: vi.fn(),
    };

    const casoUso = new ObtenerRecursosHost(colector, repositorio);
    const resultado = await casoUso.ejecutar();

    expect(resultado).toEqual(muestraHost);
    expect(repositorio.guardarSnapshot).toHaveBeenCalledWith(muestraHost);
  });

  it('calcula promedio y pico de CPU y RAM en el histórico', async () => {
    const repositorio: RepositorioRecursosHost = {
      guardarSnapshot: vi.fn(),
      obtenerHistorico: vi.fn().mockResolvedValue([
        {
          porcentajeCpu: 10,
          ramUsadaMb: 2000,
          ramTotalMb: 8000,
          temperaturaC: 45,
          fechaHora: '2026-11-26T13:00:00.000Z',
        },
        {
          porcentajeCpu: 40,
          ramUsadaMb: 3000,
          ramTotalMb: 8000,
          temperaturaC: 52,
          fechaHora: '2026-11-26T13:30:00.000Z',
        },
      ]),
    };

    const casoUso = new ObtenerHistoricoRecursos(repositorio);
    const resultado = await casoUso.ejecutar('24h');

    expect(repositorio.obtenerHistorico).toHaveBeenCalledWith('24h');
    expect(resultado.resumen).toEqual({
      promedioCpu: 25,
      picoCpu: 40,
      promedioRamMb: 2500,
      picoRamMb: 3000,
      totalMuestras: 2,
    });
    expect(resultado.puntos).toHaveLength(2);
  });

  it('devuelve resumen en cero cuando no hay muestras históricas', async () => {
    const repositorio: RepositorioRecursosHost = {
      guardarSnapshot: vi.fn(),
      obtenerHistorico: vi.fn().mockResolvedValue([]),
    };

    const casoUso = new ObtenerHistoricoRecursos(repositorio);
    const resultado = await casoUso.ejecutar('1h');

    expect(resultado.resumen.totalMuestras).toBe(0);
    expect(resultado.resumen.picoCpu).toBe(0);
    expect(resultado.puntos).toEqual([]);
  });
});
