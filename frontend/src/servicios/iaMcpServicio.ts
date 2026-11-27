import { apiCliente } from './apiCliente';

export interface ExplicacionFalloItem {
  proveedor: string;
  resumen: string;
  causaProbable: string;
  accionesSugeridas: string[];
  generadoEn: string;
}

export interface ResumenSeguridadIaItem {
  proveedor: string;
  nivelRiesgo: 'bajo' | 'medio' | 'alto';
  resumenEjecutivo: string;
  destacados: string[];
  recomendaciones: string[];
  generadoEn: string;
}

export interface RespuestaConsultaIaItem {
  proveedor: string;
  respuesta: string;
  textoParaVoz: string;
  generadoEn: string;
}

export interface TokenMcpItem {
  id: string;
  nombre: string;
  prefijo: string;
  permiso: 'lectura' | 'escritura';
  ultimoUsoEn: string | null;
  revocado: boolean;
  creadoEn: string;
}

export const iaMcpServicio = {
  explicarDespliegue: (
    proyectoId: string,
    despliegueId: string,
    tokenAcceso: string,
  ): Promise<{ explicacion: ExplicacionFalloItem }> =>
    apiCliente.post<{ explicacion: ExplicacionFalloItem }>(
      '/ia/explicar-despliegue',
      { proyectoId, despliegueId },
      tokenAcceso,
    ),

  resumenSeguridad: (tokenAcceso: string): Promise<{ resumen: ResumenSeguridadIaItem }> =>
    apiCliente.get<{ resumen: ResumenSeguridadIaItem }>('/ia/resumen-seguridad', tokenAcceso),

  consultar: (
    pregunta: string,
    tokenAcceso: string,
  ): Promise<{ resultado: RespuestaConsultaIaItem }> =>
    apiCliente.post<{ resultado: RespuestaConsultaIaItem }>(
      '/ia/consultar',
      { pregunta },
      tokenAcceso,
    ),

  listarTokensMcp: (tokenAcceso: string): Promise<{ tokens: TokenMcpItem[] }> =>
    apiCliente.get<{ tokens: TokenMcpItem[] }>('/mcp/tokens', tokenAcceso),

  crearTokenMcp: (
    datos: { nombre: string; permiso: 'lectura' | 'escritura' },
    tokenAcceso: string,
  ): Promise<{ tokenPlano: string; token: TokenMcpItem }> =>
    apiCliente.post<{ tokenPlano: string; token: TokenMcpItem }>(
      '/mcp/tokens',
      datos,
      tokenAcceso,
    ),

  revocarTokenMcp: (id: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(`/mcp/tokens/${encodeURIComponent(id)}`, tokenAcceso),
};
