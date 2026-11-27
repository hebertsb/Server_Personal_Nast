import {
  PuntoHistoricoRecursos,
  RangoHistorico,
} from '../../dominio/entidades/RecursosHost';
import { RepositorioRecursosHost } from '../../dominio/interfaces/RepositorioRecursosHost';

export interface ResumenHistoricoRecursos {
  promedioCpu: number;
  picoCpu: number;
  promedioRamMb: number;
  picoRamMb: number;
  totalMuestras: number;
}

export interface ResultadoHistoricoRecursos {
  rango: RangoHistorico;
  resumen: ResumenHistoricoRecursos;
  puntos: PuntoHistoricoRecursos[];
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Caso de uso RF-25: obtiene la serie histórica de CPU/RAM/temperatura desde
 * PostgreSQL para el rango solicitado y calcula estadísticas agregadas.
 */
export class ObtenerHistoricoRecursos {
  constructor(private readonly repositorioRecursos: RepositorioRecursosHost) {}

  public async ejecutar(rango: RangoHistorico): Promise<ResultadoHistoricoRecursos> {
    const puntos = await this.repositorioRecursos.obtenerHistorico(rango);

    if (puntos.length === 0) {
      return {
        rango,
        resumen: {
          promedioCpu: 0,
          picoCpu: 0,
          promedioRamMb: 0,
          picoRamMb: 0,
          totalMuestras: 0,
        },
        puntos: [],
      };
    }

    let sumaCpu = 0;
    let picoCpu = 0;
    let sumaRam = 0;
    let picoRam = 0;

    for (const punto of puntos) {
      sumaCpu += punto.porcentajeCpu;
      if (punto.porcentajeCpu > picoCpu) picoCpu = punto.porcentajeCpu;
      sumaRam += punto.ramUsadaMb;
      if (punto.ramUsadaMb > picoRam) picoRam = punto.ramUsadaMb;
    }

    return {
      rango,
      resumen: {
        promedioCpu: redondear(sumaCpu / puntos.length),
        picoCpu: redondear(picoCpu),
        promedioRamMb: redondear(sumaRam / puntos.length),
        picoRamMb: redondear(picoRam),
        totalMuestras: puntos.length,
      },
      puntos,
    };
  }
}
