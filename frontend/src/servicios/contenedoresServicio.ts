import {
  AccionContenedor,
  RespuestaAccionContenedor,
  RespuestaListaContenedores,
  RespuestaLogsContenedor,
} from '../tipos/Contenedor';
import { apiCliente } from './apiCliente';

export const contenedoresServicio = {
  listar: (tokenAcceso: string): Promise<RespuestaListaContenedores> =>
    apiCliente.get<RespuestaListaContenedores>('/contenedores', tokenAcceso),

  ejecutarAccion: (
    contenedorId: string,
    accion: AccionContenedor,
    tokenAcceso: string,
  ): Promise<RespuestaAccionContenedor> =>
    apiCliente.post<RespuestaAccionContenedor>(
      `/contenedores/${encodeURIComponent(contenedorId)}/${accion}`,
      undefined,
      tokenAcceso,
    ),

  obtenerLogs: (
    contenedorId: string,
    lineas: number,
    tokenAcceso: string,
  ): Promise<RespuestaLogsContenedor> =>
    apiCliente.get<RespuestaLogsContenedor>(
      `/contenedores/${encodeURIComponent(contenedorId)}/logs?lineas=${lineas}`,
      tokenAcceso,
    ),
};
