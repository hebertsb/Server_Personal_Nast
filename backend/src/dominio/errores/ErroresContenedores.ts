import { ErrorDominio } from './ErroresAutenticacion';

export class ErrorContenedorNoEncontrado extends ErrorDominio {
  constructor(id: string) {
    super('CONTENEDOR_NO_ENCONTRADO', `No se encontró el contenedor "${id}"`, 404);
  }
}

export class ErrorPermisosInsuficientes extends ErrorDominio {
  constructor() {
    super(
      'PERMISOS_INSUFICIENTES',
      'Se requiere rol de administrador para ejecutar acciones de control',
      403,
    );
  }
}

export class ErrorDockerNoDisponible extends ErrorDominio {
  constructor() {
    super(
      'DOCKER_NO_DISPONIBLE',
      'No se pudo comunicar con el servicio local de Docker',
      503,
    );
  }
}

export class ErrorAccionContenedorInvalida extends ErrorDominio {
  constructor(mensaje: string) {
    super('ACCION_CONTENEDOR_INVALIDA', mensaje, 409);
  }
}
