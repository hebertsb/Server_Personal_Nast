import { Colector } from '../../dominio/interfaces/Colector';
import { RepositorioSeguridad2FA } from '../../dominio/interfaces/RepositorioSeguridad2FA';
import {
  HallazgoFuerzaBruta,
  IntentoSshFallido,
  PoliticaBloqueoFuerzaBruta,
} from '../../dominio/reglas/PoliticaBloqueoFuerzaBruta';
import { NotificarEvento } from '../notificaciones/NotificarEvento';

export interface ResultadoAnalisisSsh {
  intentosFallidos: IntentoSshFallido[];
  hallazgosFuerzaBruta: HallazgoFuerzaBruta[];
  alertasEmitidas: number;
}

/**
 * Caso de uso RF-12 / RF-13 (docs/HomeSOC_Arquitectura.md sección 5):
 * recolecta intentos SSH fallidos, evalúa la regla de dominio PoliticaBloqueoFuerzaBruta
 * y, cuando se solicita persistir, registra el evento de seguridad y emite notificación Observer.
 */
export class DetectarFuerzaBruta {
  constructor(
    private readonly colectorAuthLog: Colector<IntentoSshFallido[]>,
    private readonly politica: PoliticaBloqueoFuerzaBruta,
    private readonly repositorioSeguridad2FA: RepositorioSeguridad2FA,
    private readonly notificarEvento: NotificarEvento,
    private readonly umbralIntentos = 5,
    private readonly ventanaMinutos = 15,
  ) {}

  public async ejecutar(opciones: { registrarYNotificar?: boolean } = {}): Promise<ResultadoAnalisisSsh> {
    const intentosFallidos = await this.colectorAuthLog.recolectar();
    const hallazgosFuerzaBruta = this.politica.evaluar(intentosFallidos, {
      umbralIntentos: this.umbralIntentos,
      ventanaMinutos: this.ventanaMinutos,
    });

    let alertasEmitidas = 0;

    if (opciones.registrarYNotificar) {
      for (const hallazgo of hallazgosFuerzaBruta) {
        await this.repositorioSeguridad2FA.registrarEventoSeguridad({
          tipoEvento: 'fuerza_bruta_ssh',
          ipOrigen: hallazgo.ipOrigen,
          severidad: hallazgo.severidad,
          detalles: {
            totalIntentos: hallazgo.totalIntentos,
            usuariosIntentados: hallazgo.usuariosIntentados,
            primerIntento: hallazgo.primerIntento,
            ultimoIntento: hallazgo.ultimoIntento,
          },
        });

        const alertas = await this.notificarEvento.emitir({
          tipoEvento: 'fuerza_bruta_ssh',
          mensaje: `Ataque de fuerza bruta SSH detectado desde ${hallazgo.ipOrigen} (${hallazgo.totalIntentos} intentos fallidos sobre usuarios: ${hallazgo.usuariosIntentados.join(', ')})`,
        });
        alertasEmitidas += alertas.length;
      }
    }

    return {
      intentosFallidos,
      hallazgosFuerzaBruta,
      alertasEmitidas,
    };
  }
}
