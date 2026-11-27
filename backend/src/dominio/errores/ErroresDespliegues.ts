import { ErrorDominio } from './ErroresAutenticacion';

export class ErrorProyectoNoEncontrado extends ErrorDominio {
  constructor(id: string) {
    super('PROYECTO_NO_ENCONTRADO', `No se encontró el proyecto "${id}"`, 404);
  }
}

export class ErrorProyectoDuplicado extends ErrorDominio {
  constructor(nombre: string) {
    super(
      'PROYECTO_DUPLICADO',
      `El proyecto o repositorio "${nombre}" ya está configurado en HomeSOC`,
      409,
    );
  }
}

export class ErrorTipoProyectoNoSoportado extends ErrorDominio {
  constructor(mensaje: string) {
    super('TIPO_PROYECTO_NO_SOPORTADO', mensaje, 422);
  }
}

export class ErrorVariableNoEncontrada extends ErrorDominio {
  constructor() {
    super('VARIABLE_NO_ENCONTRADA', 'No se encontró la variable de entorno solicitada', 404);
  }
}
