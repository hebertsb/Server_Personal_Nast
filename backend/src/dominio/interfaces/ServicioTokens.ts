import { RolUsuario } from '../entidades/Usuario';
import { MotivoSegundoFactor } from '../reglas/EvaluadorConfianzaOrigen';

export interface DatosTokenUsuario {
  id: string;
  nombreUsuario: string;
  rol: RolUsuario;
}

export interface PayloadTokenAcceso {
  sub: string;
  nombreUsuario: string;
  rol: RolUsuario;
  tipo: 'acceso';
}

export interface PayloadTokenRefresh {
  sub: string;
  nombreUsuario: string;
  rol: RolUsuario;
  tipo: 'refresh';
}

export interface PayloadTokenPendiente2FA {
  sub: string;
  nombreUsuario: string;
  rol: RolUsuario;
  esRedLocal: boolean;
  motivo: MotivoSegundoFactor;
  tipo: 'pendiente_2fa';
}

export interface ParTokens {
  tokenAcceso: string;
  tokenRefresh: string;
  expiraEn: string;
}

export interface ServicioTokens {
  generarParTokens(usuario: DatosTokenUsuario): ParTokens;
  verificarTokenAcceso(token: string): PayloadTokenAcceso;
  verificarTokenRefresh(token: string): PayloadTokenRefresh;
  generarTokenPendiente2FA(datos: {
    id: string;
    nombreUsuario: string;
    rol: RolUsuario;
    esRedLocal: boolean;
    motivo: MotivoSegundoFactor;
  }): string;
  verificarTokenPendiente2FA(token: string): PayloadTokenPendiente2FA;
}
