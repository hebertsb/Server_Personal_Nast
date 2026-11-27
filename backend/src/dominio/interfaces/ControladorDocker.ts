import { AccionContenedor, Contenedor } from '../entidades/Contenedor';
import { Colector } from './Colector';

export interface ResultadoLimpiezaImagenes {
  imagenesEliminadas: number;
  espacioRecuperadoMb: number;
}

export interface ControladorDocker extends Colector<Contenedor[]> {
  obtenerPorId(id: string): Promise<Contenedor | null>;
  ejecutarAccion(id: string, accion: AccionContenedor): Promise<void>;
  obtenerLogs(id: string, lineas: number): Promise<string[]>;
  limpiarImagenesHuerfanas?(): Promise<ResultadoLimpiezaImagenes>;
}
