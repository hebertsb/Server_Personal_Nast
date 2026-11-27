import { NotificadorCanal } from '../../dominio/interfaces/RepositorioSeguridadRed';

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
  ): Promise<{ enviado: boolean; modo: 'real' | 'simulado' }> {
    const tokenLimpio = this.tokenBot.trim();
    const esTokenSimulado =
      !tokenLimpio || tokenLimpio === 'dummy' || tokenLimpio === 'changeme';

    if (esTokenSimulado) {
      return { enviado: true, modo: 'simulado' };
    }

    const chatId =
      destino && destino !== 'chat_local_simulado' ? destino : this.chatIdPorDefecto;

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

    return {
      enviado: respuesta.ok,
      modo: 'real',
    };
  }
}
