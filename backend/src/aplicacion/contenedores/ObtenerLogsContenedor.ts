import { ErrorContenedorNoEncontrado } from '../../dominio/errores/ErroresContenedores';
import { ControladorDocker } from '../../dominio/interfaces/ControladorDocker';

export interface EntradaObtenerLogs {
  contenedorId: string;
  lineas: number;
}

export interface ResultadoObtenerLogs {
  contenedorId: string;
  nombre: string;
  lineas: string[];
}

/** Caso de uso RF-08: obtiene las líneas de logs recientes de un contenedor. */
export class ObtenerLogsContenedor {
  constructor(private readonly controladorDocker: ControladorDocker) {}

  public async ejecutar(entrada: EntradaObtenerLogs): Promise<ResultadoObtenerLogs> {
    const contenedor = await this.controladorDocker.obtenerPorId(entrada.contenedorId);
    if (!contenedor) {
      throw new ErrorContenedorNoEncontrado(entrada.contenedorId);
    }

    const lineas = await this.controladorDocker.obtenerLogs(contenedor.id, entrada.lineas);

    return {
      contenedorId: contenedor.id,
      nombre: contenedor.nombre,
      lineas,
    };
  }
}
