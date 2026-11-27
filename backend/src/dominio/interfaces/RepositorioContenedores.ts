import { Contenedor } from '../entidades/Contenedor';

export interface RepositorioContenedores {
  guardarSnapshots(contenedores: Contenedor[]): Promise<void>;
}
