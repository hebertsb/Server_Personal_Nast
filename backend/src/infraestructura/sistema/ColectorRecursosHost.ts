import fs from 'node:fs/promises';
import os from 'node:os';
import {
  DiscoHost,
  NucleoCpu,
  RecursosHost,
} from '../../dominio/entidades/RecursosHost';
import { Colector } from '../../dominio/interfaces/Colector';

interface TiemposNucleo {
  activo: number;
  total: number;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function capturarTiemposCpu(): TiemposNucleo[] {
  return os.cpus().map((cpu) => {
    const { user, nice, sys, idle, irq } = cpu.times;
    const total = user + nice + sys + idle + irq;
    return {
      activo: total - idle,
      total,
    };
  });
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DefinicionDisco {
  etiqueta: string;
  puntoMontaje: string;
}

function parsearDiscosConfigurados(configuracion: string): DefinicionDisco[] {
  const resultado: DefinicionDisco[] = [];
  for (const entrada of configuracion.split(',')) {
    const limpia = entrada.trim();
    if (!limpia) continue;
    const indiceDosPuntos = limpia.indexOf(':');
    if (indiceDosPuntos > 0) {
      const etiqueta = limpia.slice(0, indiceDosPuntos).trim();
      const puntoMontaje = limpia.slice(indiceDosPuntos + 1).trim();
      if (etiqueta && puntoMontaje) {
        resultado.push({ etiqueta, puntoMontaje });
      }
    } else {
      resultado.push({ etiqueta: limpia, puntoMontaje: limpia });
    }
  }
  return resultado.length > 0 ? resultado : [{ etiqueta: 'Sistema', puntoMontaje: '/' }];
}

/**
 * Colector del patrón Strategy que lee métricas reales del sistema operativo
 * (CPU por núcleo, RAM disponible vía /proc/meminfo, discos vía statfs y temperatura best-effort).
 */
export class ColectorRecursosHost implements Colector<RecursosHost> {
  public readonly nombre = 'recursos_host';
  private muestraPreviaCpu: TiemposNucleo[] | null = null;
  private readonly discosConfigurados: DefinicionDisco[];

  constructor(discosMonitoreados = 'Sistema:/') {
    this.discosConfigurados = parsearDiscosConfigurados(discosMonitoreados);
  }

  public async recolectar(): Promise<RecursosHost> {
    if (!this.muestraPreviaCpu) {
      this.muestraPreviaCpu = capturarTiemposCpu();
      await esperar(120);
    }

    const muestraActual = capturarTiemposCpu();
    const { porcentajeCpu, nucleos } = this.calcularUsoCpu(this.muestraPreviaCpu, muestraActual);
    this.muestraPreviaCpu = muestraActual;

    const memoria = await this.obtenerMemoria();
    const [discos, temperaturaC] = await Promise.all([
      this.obtenerDiscos(),
      this.obtenerTemperaturaBestEffort(),
    ]);

    const cpus = os.cpus();
    const carga = os.loadavg();

    return {
      hostname: os.hostname(),
      plataforma: `${os.type()} ${os.release()}`,
      arquitectura: os.arch(),
      modeloCpu: cpus[0]?.model?.trim() || 'CPU desconocida',
      cantidadNucleos: cpus.length,
      tiempoActividadSeg: Math.floor(os.uptime()),
      cargaPromedio: [
        redondear(carga[0] ?? 0),
        redondear(carga[1] ?? 0),
        redondear(carga[2] ?? 0),
      ],
      porcentajeCpu,
      nucleos,
      ramUsadaMb: memoria.usadaMb,
      ramTotalMb: memoria.totalMb,
      ramLibreMb: memoria.libreMb,
      porcentajeRam: memoria.porcentajeRam,
      temperaturaC,
      discos,
      marcaTiempo: new Date().toISOString(),
    };
  }

  private calcularUsoCpu(
    previa: TiemposNucleo[],
    actual: TiemposNucleo[],
  ): { porcentajeCpu: number; nucleos: NucleoCpu[] } {
    let deltaActivoTotal = 0;
    let deltaTotalGlobal = 0;
    const nucleos: NucleoCpu[] = [];

    for (let i = 0; i < actual.length; i++) {
      const p = previa[i] ?? actual[i];
      const a = actual[i];
      const deltaActivo = Math.max(0, a.activo - p.activo);
      const deltaTotal = Math.max(0, a.total - p.total);

      deltaActivoTotal += deltaActivo;
      deltaTotalGlobal += deltaTotal;

      const porcentajeNucleo =
        deltaTotal > 0 ? Math.min(100, (deltaActivo / deltaTotal) * 100) : 0;

      nucleos.push({
        indice: i + 1,
        porcentajeUso: redondear(porcentajeNucleo),
      });
    }

    const porcentajeCpu =
      deltaTotalGlobal > 0
        ? redondear(Math.min(100, (deltaActivoTotal / deltaTotalGlobal) * 100))
        : 0;

    return { porcentajeCpu, nucleos };
  }

  private async obtenerMemoria(): Promise<{
    totalMb: number;
    usadaMb: number;
    libreMb: number;
    porcentajeRam: number;
  }> {
    const mb = 1024 * 1024;
    let totalBytes = os.totalmem();
    let disponibleBytes = os.freemem();

    try {
      const meminfo = await fs.readFile('/proc/meminfo', 'utf8');
      const totalMatch = meminfo.match(/^MemTotal:\s+(\d+)\s+kB/m);
      const dispMatch = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB/m);
      if (totalMatch && dispMatch) {
        totalBytes = Number(totalMatch[1]) * 1024;
        disponibleBytes = Number(dispMatch[1]) * 1024;
      }
    } catch {
      // Fuera de Linux usa os.totalmem/os.freemem
    }

    const usadaBytes = Math.max(0, totalBytes - disponibleBytes);
    const totalMb = redondear(totalBytes / mb);
    const usadaMb = redondear(usadaBytes / mb);
    const libreMb = redondear(disponibleBytes / mb);
    const porcentajeRam = totalBytes > 0 ? redondear((usadaBytes / totalBytes) * 100) : 0;

    return { totalMb, usadaMb, libreMb, porcentajeRam };
  }

  private async obtenerDiscos(): Promise<DiscoHost[]> {
    const gb = 1024 * 1024 * 1024;
    const resultados = await Promise.all(
      this.discosConfigurados.map(async ({ etiqueta, puntoMontaje }): Promise<DiscoHost | null> => {
        try {
          const estadisticas = await fs.statfs(puntoMontaje);
          const tamanoBloque = Number(estadisticas.bsize);
          const totalBytes = Number(estadisticas.blocks) * tamanoBloque;
          const libreTotalBytes = Number(estadisticas.bfree) * tamanoBloque;
          const disponibleUsuarioBytes = Number(estadisticas.bavail) * tamanoBloque;
          const usadoBytes = Math.max(0, totalBytes - libreTotalBytes);

          return {
            etiqueta,
            puntoMontaje,
            totalGb: redondear(totalBytes / gb),
            usadoGb: redondear(usadoBytes / gb),
            libreGb: redondear(disponibleUsuarioBytes / gb),
            porcentajeUso: totalBytes > 0 ? redondear((usadoBytes / totalBytes) * 100) : 0,
          };
        } catch {
          return null;
        }
      }),
    );

    return resultados.filter((d): d is DiscoHost => d !== null);
  }

  private async obtenerTemperaturaBestEffort(): Promise<number | null> {
    const rutasSensores = [
      '/sys/class/thermal/thermal_zone0/temp',
      '/sys/class/hwmon/hwmon0/temp1_input',
    ];

    for (const ruta of rutasSensores) {
      try {
        const crudo = (await fs.readFile(ruta, 'utf8')).trim();
        const miligrados = Number(crudo);
        if (Number.isFinite(miligrados) && miligrados > 0) {
          const celsius = miligrados > 1000 ? miligrados / 1000 : miligrados;
          if (celsius > 0 && celsius < 130) {
            return redondear(celsius);
          }
        }
      } catch {
        // Sensor no expuesto en el entorno actual (ej. Docker Desktop)
      }
    }

    return null;
  }
}
