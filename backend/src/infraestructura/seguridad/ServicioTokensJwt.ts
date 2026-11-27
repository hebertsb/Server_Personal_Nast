import jwt, { SignOptions } from 'jsonwebtoken';
import { RolUsuario } from '../../dominio/entidades/Usuario';
import { ErrorTokenInvalido } from '../../dominio/errores/ErroresAutenticacion';
import {
  DatosTokenUsuario,
  ParTokens,
  PayloadTokenAcceso,
  PayloadTokenPendiente2FA,
  PayloadTokenRefresh,
  ServicioTokens,
} from '../../dominio/interfaces/ServicioTokens';
import { MotivoSegundoFactor } from '../../dominio/reglas/EvaluadorConfianzaOrigen';

interface ConfiguracionTokensJwt {
  secretoAcceso: string;
  secretoRefresh: string;
  expiraAcceso: string;
  expiraRefresh: string;
}

export class ServicioTokensJwt implements ServicioTokens {
  constructor(private readonly config: ConfiguracionTokensJwt) {}

  public generarParTokens(usuario: DatosTokenUsuario): ParTokens {
    const payloadAcceso: PayloadTokenAcceso = {
      sub: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      rol: usuario.rol,
      tipo: 'acceso',
    };

    const payloadRefresh: PayloadTokenRefresh = {
      sub: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      rol: usuario.rol,
      tipo: 'refresh',
    };

    const tokenAcceso = jwt.sign(payloadAcceso, this.config.secretoAcceso, {
      expiresIn: this.config.expiraAcceso as SignOptions['expiresIn'],
    });

    const tokenRefresh = jwt.sign(payloadRefresh, this.config.secretoRefresh, {
      expiresIn: this.config.expiraRefresh as SignOptions['expiresIn'],
    });

    return {
      tokenAcceso,
      tokenRefresh,
      expiraEn: this.config.expiraAcceso,
    };
  }

  public generarTokenPendiente2FA(datos: {
    id: string;
    nombreUsuario: string;
    rol: RolUsuario;
    esRedLocal: boolean;
    motivo: MotivoSegundoFactor;
  }): string {
    const payload: PayloadTokenPendiente2FA = {
      sub: datos.id,
      nombreUsuario: datos.nombreUsuario,
      rol: datos.rol,
      esRedLocal: datos.esRedLocal,
      motivo: datos.motivo,
      tipo: 'pendiente_2fa',
    };

    return jwt.sign(payload, this.config.secretoAcceso, { expiresIn: '5m' });
  }

  public verificarTokenAcceso(token: string): PayloadTokenAcceso {
    return this.verificarEstandar(token, this.config.secretoAcceso, 'acceso') as PayloadTokenAcceso;
  }

  public verificarTokenRefresh(token: string): PayloadTokenRefresh {
    return this.verificarEstandar(
      token,
      this.config.secretoRefresh,
      'refresh',
    ) as PayloadTokenRefresh;
  }

  public verificarTokenPendiente2FA(token: string): PayloadTokenPendiente2FA {
    try {
      const decodificado = jwt.verify(token, this.config.secretoAcceso);
      if (
        typeof decodificado !== 'object' ||
        decodificado === null ||
        decodificado.tipo !== 'pendiente_2fa' ||
        typeof decodificado.sub !== 'string' ||
        typeof decodificado.nombreUsuario !== 'string' ||
        typeof decodificado.esRedLocal !== 'boolean' ||
        typeof decodificado.motivo !== 'string' ||
        (decodificado.rol !== 'administrador' && decodificado.rol !== 'solo_lectura')
      ) {
        throw new ErrorTokenInvalido('Desafío 2FA inválido o expirado');
      }

      return {
        sub: decodificado.sub,
        nombreUsuario: decodificado.nombreUsuario,
        rol: decodificado.rol as RolUsuario,
        esRedLocal: decodificado.esRedLocal,
        motivo: decodificado.motivo as MotivoSegundoFactor,
        tipo: 'pendiente_2fa',
      };
    } catch (error) {
      if (error instanceof ErrorTokenInvalido) throw error;
      throw new ErrorTokenInvalido('Desafío 2FA inválido o expirado');
    }
  }

  private verificarEstandar(
    token: string,
    secreto: string,
    tipoEsperado: 'acceso' | 'refresh',
  ): PayloadTokenAcceso | PayloadTokenRefresh {
    try {
      const decodificado = jwt.verify(token, secreto);

      if (
        typeof decodificado !== 'object' ||
        decodificado === null ||
        decodificado.tipo !== tipoEsperado ||
        typeof decodificado.sub !== 'string' ||
        typeof decodificado.nombreUsuario !== 'string' ||
        (decodificado.rol !== 'administrador' && decodificado.rol !== 'solo_lectura')
      ) {
        throw new ErrorTokenInvalido();
      }

      return {
        sub: decodificado.sub,
        nombreUsuario: decodificado.nombreUsuario,
        rol: decodificado.rol as RolUsuario,
        tipo: tipoEsperado,
      };
    } catch (error) {
      if (error instanceof ErrorTokenInvalido) {
        throw error;
      }
      throw new ErrorTokenInvalido();
    }
  }
}
