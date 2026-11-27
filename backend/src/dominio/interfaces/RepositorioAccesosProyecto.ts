import {
  AnaliticaAccesosProyecto,
  FiltroAccesosProyecto,
  NuevaSolicitudProyecto,
  SolicitudProyecto,
} from '../entidades/SolicitudProyecto';

export interface RepositorioAccesosProyecto {
  registrarSolicitud(datos: NuevaSolicitudProyecto): Promise<SolicitudProyecto>;
  registrarLote(lote: NuevaSolicitudProyecto[]): Promise<number>;
  obtenerAnalitica(filtro: FiltroAccesosProyecto): Promise<AnaliticaAccesosProyecto>;
}
