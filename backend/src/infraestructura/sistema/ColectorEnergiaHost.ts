import fs from 'node:fs/promises';
import path from 'node:path';
import { EstadoEnergiaHost } from '../../dominio/entidades/Automatizacion';
import { ColectorEnergia } from '../../dominio/interfaces/ColectorEnergia';

const BASE_SYSFS_ENERGIA = '/sys/class/power_supply';

/**
 * Colector Strategy de energía/batería del host:
 * - En modo 'real' (Linux): lee /sys/class/power_supply/BAT0/status y capacity.
 * - En modo 'simulacion' (dev local): mantiene un estado configurable en memoria
 *   para probar cortes de luz y apagado ordenado por batería baja sin riesgo.
 */
export class ColectorEnergiaHost implements ColectorEnergia {
  private estadoSimulado: EstadoEnergiaHost;

  constructor(private readonly modo: 'simulacion' | 'real' = 'simulacion') {
    this.estadoSimulado = {
      modo: 'simulacion',
      disponible: true,
      enBateria: false,
      estadoTexto: 'Charging / AC (Simulado)',
      porcentajeBateria: 100,
      actualizadoEn: new Date().toISOString(),
    };
  }

  public async leerEstado(): Promise<EstadoEnergiaHost> {
    if (this.modo === 'simulacion') {
      return {
        ...this.estadoSimulado,
        actualizadoEn: new Date().toISOString(),
      };
    }

    try {
      const entradas = await fs.readdir(BASE_SYSFS_ENERGIA);
      const bateria = entradas.find((e) => /^BAT\d+$/i.test(e));
      if (!bateria) {
        return {
          modo: 'real',
          disponible: false,
          enBateria: false,
          estadoTexto: 'Sin batería detectada (AC)',
          porcentajeBateria: null,
          actualizadoEn: new Date().toISOString(),
        };
      }

      const [statusRaw, capRaw] = await Promise.all([
        fs.readFile(path.join(BASE_SYSFS_ENERGIA, bateria, 'status'), 'utf8'),
        fs.readFile(path.join(BASE_SYSFS_ENERGIA, bateria, 'capacity'), 'utf8'),
      ]);

      const estadoTexto = statusRaw.trim();
      const porcentaje = Number.parseInt(capRaw.trim(), 10);
      const enBateria = estadoTexto.toLowerCase() === 'discharging';

      return {
        modo: 'real',
        disponible: true,
        enBateria,
        estadoTexto,
        porcentajeBateria: Number.isFinite(porcentaje) ? porcentaje : null,
        actualizadoEn: new Date().toISOString(),
      };
    } catch {
      return {
        modo: 'real',
        disponible: false,
        enBateria: false,
        estadoTexto: 'Sensor de batería no accesible',
        porcentajeBateria: null,
        actualizadoEn: new Date().toISOString(),
      };
    }
  }

  public simularEstado(parcial: {
    enBateria: boolean;
    porcentajeBateria: number;
  }): EstadoEnergiaHost {
    this.estadoSimulado = {
      modo: 'simulacion',
      disponible: true,
      enBateria: parcial.enBateria,
      estadoTexto: parcial.enBateria
        ? `Discharging (${parcial.porcentajeBateria}% - Simulado)`
        : `AC / Charging (${parcial.porcentajeBateria}% - Simulado)`,
      porcentajeBateria: parcial.porcentajeBateria,
      actualizadoEn: new Date().toISOString(),
    };
    return { ...this.estadoSimulado };
  }
}
