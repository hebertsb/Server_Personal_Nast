/**
 * Patrón Strategy para colectores de métricas y estado (Docker, logs SSH, Pi-hole, host).
 * Cada fuente de datos implementa esta interfaz sin modificar el núcleo del sistema.
 */
export interface Colector<TResultado> {
  readonly nombre: string;
  recolectar(): Promise<TResultado>;
}
