import {
  AlertaEnviada,
  CanalNotificacion,
  NotificadorCanal,
  RepositorioSeguridadRed,
} from '../../dominio/interfaces/RepositorioSeguridadRed';

export interface EventoNotificable {
  tipoEvento: string;
  mensaje: string;
}

export type EscuchadorTiempoReal = (alerta: AlertaEnviada) => void;

/**
 * Patrón Observer (RF-20, RF-21 y docs/HomeSOC_Arquitectura.md sección 2):
 * recibe eventos de seguridad y los despacha a todos los canales suscritos
 * que estén habilitados en configuracion_notificaciones, registrando cada envío en alertas_enviadas
 * y retransmitiendo en tiempo real a los clientes web/PWA conectados vía SSE.
 */
export class NotificarEvento {
  private readonly suscriptores = new Map<CanalNotificacion, NotificadorCanal>();
  private readonly escuchadoresTiempoReal = new Set<EscuchadorTiempoReal>();

  constructor(private readonly repositorioSeguridadRed: RepositorioSeguridadRed) {}

  public suscribir(notificador: NotificadorCanal): void {
    this.suscriptores.set(notificador.canal, notificador);
  }

  public suscribirTiempoReal(escuchador: EscuchadorTiempoReal): () => void {
    this.escuchadoresTiempoReal.add(escuchador);
    return () => {
      this.escuchadoresTiempoReal.delete(escuchador);
    };
  }

  private difundirTiempoReal(alerta: AlertaEnviada): void {
    for (const escuchador of this.escuchadoresTiempoReal) {
      try {
        escuchador(alerta);
      } catch {
        // Un cliente SSE desconectado nunca interrumpe el despacho al resto
      }
    }
  }

  public async emitir(evento: EventoNotificable): Promise<AlertaEnviada[]> {
    const configuraciones =
      await this.repositorioSeguridadRed.listarConfiguracionNotificaciones();

    const activas = configuraciones.filter(
      (c) => c.tipoEvento === evento.tipoEvento && c.habilitado,
    );

    const alertasRegistradas: AlertaEnviada[] = [];

    for (const config of activas) {
      const notificador = this.suscriptores.get(config.canal);
      if (!notificador) continue;

      const resultado = await notificador.enviar(config.destino, evento.mensaje);
      if (resultado.enviado) {
        const prefijo = resultado.modo === 'simulado' ? '[Simulado Local] ' : '';
        const alerta = await this.repositorioSeguridadRed.registrarAlertaEnviada({
          tipoEvento: evento.tipoEvento,
          mensaje: `${prefijo}${evento.mensaje}`,
          canal: config.canal,
        });
        alertasRegistradas.push(alerta);
        this.difundirTiempoReal(alerta);
      }
    }

    return alertasRegistradas;
  }

  public async enviarPrueba(
    canal: CanalNotificacion = 'telegram',
    destinoOpcional?: string,
  ): Promise<AlertaEnviada> {
    const notificador = this.suscriptores.get(canal);
    const textoBase = 'Notificación de prueba desde HomeSOC (patrón Observer activo)';
    let modo: 'real' | 'simulado' = 'simulado';

    if (notificador) {
      let destino = destinoOpcional?.trim() || 'chat_local_simulado';
      if (destino === 'chat_local_simulado' && canal === 'webhook') {
        const configs = await this.repositorioSeguridadRed.listarConfiguracionNotificaciones();
        const encontrada = configs.find((c) => c.canal === 'webhook' && c.destino.startsWith('http'));
        if (encontrada) destino = encontrada.destino;
      }
      const res = await notificador.enviar(destino, textoBase);
      if (!res.enviado) {
        throw new Error(
          res.detalle ?? `No se pudo entregar la notificación de prueba por canal ${canal}`,
        );
      }
      modo = res.modo;
    }

    const prefijo = modo === 'simulado' ? '[Simulado Local] ' : '';
    const alerta = await this.repositorioSeguridadRed.registrarAlertaEnviada({
      tipoEvento: 'prueba_manual',
      mensaje: `${prefijo}${textoBase}`,
      canal,
    });
    this.difundirTiempoReal(alerta);
    return alerta;
  }
}
