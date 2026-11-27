export class ErrorDominio extends Error {
  public readonly codigo: string;
  public readonly estadoHttp: number;

  constructor(codigo: string, mensaje: string, estadoHttp: number) {
    super(mensaje);
    this.name = this.constructor.name;
    this.codigo = codigo;
    this.estadoHttp = estadoHttp;
  }
}

export class ErrorCredencialesInvalidas extends ErrorDominio {
  constructor() {
    super('CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos', 401);
  }
}

export class ErrorTokenInvalido extends ErrorDominio {
  constructor(mensaje = 'Token de acceso inválido o expirado') {
    super('TOKEN_INVALIDO', mensaje, 401);
  }
}

export class ErrorCodigo2FAInvalido extends ErrorDominio {
  constructor(mensaje = 'El código de verificación 2FA o de recuperación es inválido') {
    super('CODIGO_2FA_INVALIDO', mensaje, 401);
  }
}

export class Error2FANoConfigurado extends ErrorDominio {
  constructor(mensaje = 'Primero debes iniciar la configuración de 2FA antes de confirmarla') {
    super('DOS_FACTORES_NO_CONFIGURADO', mensaje, 400);
  }
}
