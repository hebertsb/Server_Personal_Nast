import { EstadoEnergiaHost } from '../entidades/Automatizacion';

/** Puerto Strategy para monitoreo de energía/batería del host (real Linux o simulación local). */
export interface ColectorEnergia {
  leerEstado(): Promise<EstadoEnergiaHost>;
  /** Permite simular cortes de luz / batería baja únicamente en entorno de desarrollo. */
  simularEstado(parcial: { enBateria: boolean; porcentajeBateria: number }): EstadoEnergiaHost;
}
