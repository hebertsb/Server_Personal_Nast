export type PermisoMcp = 'lectura' | 'escritura';

export interface ExplicacionFalloDespliegue {
  proveedor: string;
  resumen: string;
  causaProbable: string;
  accionesSugeridas: string[];
  generadoEn: string;
}

export interface ResumenSeguridadIa {
  proveedor: string;
  nivelRiesgo: 'bajo' | 'medio' | 'alto';
  resumenEjecutivo: string;
  destacados: string[];
  recomendaciones: string[];
  generadoEn: string;
}

export interface RespuestaConsultaIa {
  proveedor: string;
  respuesta: string;
  textoParaVoz: string;
  generadoEn: string;
}

export interface TokenMcpVista {
  id: string;
  nombre: string;
  prefijo: string;
  permiso: PermisoMcp;
  ultimoUsoEn: string | null;
  revocado: boolean;
  creadoEn: string;
}

export interface TokenMcpPersistido extends TokenMcpVista {
  usuarioId: string;
  tokenHash: string;
}

export interface HerramientaMcpDef {
  name: string;
  description: string;
  permisoRequerido: PermisoMcp;
  inputSchema: Record<string, unknown>;
}
