import { ErrorDominio } from './ErroresAutenticacion';

export class ErrorGithubTokenInvalido extends ErrorDominio {
  constructor() {
    super(
      'GITHUB_TOKEN_INVALIDO',
      'GitHub rechazó el token. Verifica que sea un Personal Access Token (classic) vigente',
      422,
    );
  }
}

export class ErrorGithubNoConectado extends ErrorDominio {
  constructor() {
    super('GITHUB_NO_CONECTADO', 'No hay una cuenta de GitHub conectada', 404);
  }
}

export class ErrorGithubNoDisponible extends ErrorDominio {
  constructor() {
    super('GITHUB_NO_DISPONIBLE', 'No se pudo comunicar con la API de GitHub', 503);
  }
}

export class ErrorGithubPermisos extends ErrorDominio {
  constructor() {
    super(
      'PERMISOS_INSUFICIENTES',
      'Se requiere rol de administrador para gestionar la conexión con GitHub',
      403,
    );
  }
}
