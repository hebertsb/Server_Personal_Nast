import {
  DestinatarioNotificacion,
  NotificadorCanal,
} from '../../dominio/interfaces/RepositorioSeguridadRed';

/**
 * Suscriptor Observer para notificaciones vía Telegram (RF-20).
 * En entorno local con TELEGRAM_TOKEN=dummy opera en modo simulado seguro
 * sin realizar llamadas externas.
 */
export class NotificadorTelegram implements NotificadorCanal {
  public readonly canal = 'telegram' as const;

  constructor(
    private readonly tokenBot: string,
    private readonly chatIdPorDefecto: string,
  ) {}

  public async enviar(
    destino: string,
    mensaje: string,
    destinatario?: DestinatarioNotificacion,
  ): Promise<{ enviado: boolean; modo: 'real' | 'simulado'; detalle?: string }> {
    const tokenLimpio = this.tokenBot.trim();
    const esTokenSimulado =
      !tokenLimpio || tokenLimpio === 'dummy' || tokenLimpio === 'changeme';

    if (esTokenSimulado) {
      return { enviado: true, modo: 'simulado' };
    }

    const chatId =
      destinatario?.telegramChatId?.trim() ||
      (destino && destino !== 'chat_local_simulado' ? destino : this.chatIdPorDefecto);

    try {
      const respuesta = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(tokenLimpio)}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🛡️ [HomeSOC] ${mensaje}`,
          }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!respuesta.ok) {
        let desc = `HTTP ${respuesta.status}`;
        try {
          const body = (await respuesta.json()) as { description?: string };
          if (body.description) desc = body.description;
        } catch {
          // Ignorar
        }
        const hint = desc.toLowerCase().includes('chat not found')
          ? 'Telegram: chat not found. Abre el chat de tu bot en Telegram y presiona Iniciar / Start primero.'
          : `Telegram rechazó el envío: ${desc}`;
        return { enviado: false, modo: 'real', detalle: hint };
      }

      return { enviado: true, modo: 'real' };
    } catch (err) {
      return {
        enviado: false,
        modo: 'real',
        detalle: `Error de red hacia Telegram: ${err instanceof Error ? err.message : 'desconocido'}`,
      };
    }
  }
}
