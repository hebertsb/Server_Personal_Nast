import {
  RangoHistorico,
  RecursosHost,
  RespuestaHistoricoRecursos,
} from '../tipos/RecursosHost';
import { apiCliente } from './apiCliente';

export const recursosServicio = {
  obtenerActual: (tokenAcceso: string): Promise<RecursosHost> =>
    apiCliente.get<RecursosHost>('/recursos/host', tokenAcceso),

  obtenerHistorico: (
    rango: RangoHistorico,
    tokenAcceso: string,
  ): Promise<RespuestaHistoricoRecursos> =>
    apiCliente.get<RespuestaHistoricoRecursos>(
      `/recursos/host/historico?rango=${encodeURIComponent(rango)}`,
      tokenAcceso,
    ),
};
