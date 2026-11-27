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

export class ErrorUsuarioSuspendido extends ErrorDominio {
  constructor(mensaje = 'Tu cuenta se encuentra suspendida. Contacta al Superadmin.') {
    super('USUARIO_SUSPENDIDO', mensaje, 403);
  }
}

export class ErrorPermisoDenegado extends ErrorDominio {
  constructor(mensaje = 'No tienes permisos suficientes para acceder a este recurso') {
    super('PERMISO_DENEGADO', mensaje, 403);
  }
}

export class ErrorSetupNoDisponible extends ErrorDominio {
  constructor(
    mensaje = 'La configuración inicial ya fue completada. Usa el inicio de sesión o un token de invitación.',
  ) {
    super('SETUP_NO_DISPONIBLE', mensaje, 403);
  }
}

export class ErrorInvitacionInvalida extends ErrorDominio {
  constructor(mensaje = 'El token de invitación es inválido, ya fue utilizado o ha expirado') {
    super('INVITACION_INVALIDA', mensaje, 400);
  }
}

export class ErrorUsuarioYaExiste extends ErrorDominio {
  constructor(mensaje = 'Ese nombre de usuario ya está registrado') {
    super('USUARIO_YA_EXISTE', mensaje, 409);
  }
}
