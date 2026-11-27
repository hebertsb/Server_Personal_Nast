import { apiCliente } from './apiCliente';

export type RolUsuario = 'administrador' | 'solo_lectura';

export type MotivoSegundoFactor =
  | 'no_habilitado'
  | 'confiable'
  | 'red_externa'
  | 'dispositivo_nuevo';

export interface UsuarioAutenticado {
  id: string;
  nombreUsuario: string;
  rol: RolUsuario;
  totpHabilitado: boolean;
  creadoEn: string;
}

export interface CredencialesLogin {
  nombreUsuario: string;
  contrasena: string;
}

export interface RespuestaSesionActiva {
  requiere2FA?: false;
  usuario: UsuarioAutenticado;
  tokenAcceso: string;
  expiraEn: string;
  usoCodigoRecuperacion?: boolean;
}

export interface RespuestaPendiente2FA {
  requiere2FA: true;
  motivo2FA: MotivoSegundoFactor;
  esRedLocal: boolean;
  tokenTemporal2FA: string;
  usuario: UsuarioAutenticado;
}

export type RespuestaLogin = RespuestaSesionActiva | RespuestaPendiente2FA;

export interface DispositivoConfiable {
  id: string;
  usuarioId: string;
  etiquetaDispositivo: string;
  ultimaIp: string;
  confiableHasta: string;
  creadoEn: string;
}

export interface Estado2FA {
  totpHabilitado: boolean;
  codigosRecuperacionRestantes: number;
  dispositivosConfiables: DispositivoConfiable[];
}

export interface ConfiguracionInicial2FA {
  secretoManual: string;
  qrDataUrl: string;
  uriOtpAuth: string;
}

export const autenticacionServicio = {
  login: (credenciales: CredencialesLogin): Promise<RespuestaLogin> =>
    apiCliente.post<RespuestaLogin>('/auth/login', credenciales),

  verificar2FA: (datos: {
    tokenTemporal2FA: string;
    codigo: string;
    recordarDispositivo: boolean;
  }): Promise<RespuestaSesionActiva> =>
    apiCliente.post<RespuestaSesionActiva>('/auth/2fa/verificar', datos),

  renovar: (): Promise<RespuestaSesionActiva> =>
    apiCliente.post<RespuestaSesionActiva>('/auth/refresh'),

  cerrarSesion: (): Promise<{ mensaje: string }> =>
    apiCliente.post<{ mensaje: string }>('/auth/logout'),

  obtenerPerfil: (tokenAcceso: string): Promise<{ usuario: UsuarioAutenticado }> =>
    apiCliente.get<{ usuario: UsuarioAutenticado }>('/auth/perfil', tokenAcceso),

  obtenerEstado2FA: (tokenAcceso: string): Promise<Estado2FA> =>
    apiCliente.get<Estado2FA>('/auth/2fa/estado', tokenAcceso),

  iniciar2FA: (tokenAcceso: string): Promise<ConfiguracionInicial2FA> =>
    apiCliente.post<ConfiguracionInicial2FA>('/auth/2fa/iniciar', undefined, tokenAcceso),

  confirmar2FA: (
    codigo: string,
    tokenAcceso: string,
  ): Promise<{ activado: true; codigosRecuperacion: string[] }> =>
    apiCliente.post<{ activado: true; codigosRecuperacion: string[] }>(
      '/auth/2fa/confirmar',
      { codigo },
      tokenAcceso,
    ),

  desactivar2FA: (
    datos: { contrasena?: string; codigoRecuperacion?: string },
    tokenAcceso: string,
  ): Promise<{ mensaje: string }> =>
    apiCliente.post<{ mensaje: string }>(
      '/auth/2fa/desactivar',
      datos,
      tokenAcceso,
    ),

  revocarDispositivo2FA: (
    dispositivoId: string,
    tokenAcceso: string,
  ): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(
      `/auth/2fa/dispositivos/${encodeURIComponent(dispositivoId)}`,
      tokenAcceso,
    ),
};
