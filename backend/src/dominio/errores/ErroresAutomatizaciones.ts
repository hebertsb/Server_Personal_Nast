import { ErrorDominio } from './ErroresAutenticacion';

export class ErrorAutomatizacionNoEncontrada extends ErrorDominio {
  constructor(id: string) {
    super('AUTOMATIZACION_NO_ENCONTRADA', `No se encontró la automatización "${id}"`, 404);
  }
}
