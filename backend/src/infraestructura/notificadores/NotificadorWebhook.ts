import crypto from 'crypto';
import { NotificadorCanal } from '../../dominio/interfaces/RepositorioSeguridadRed';

/**
 * Suscriptor Observer para notificaciones salientes vía Webhook HTTP/HTTPS
 * (ideal para n8n → WhatsApp Meta API / Evolution API / Discord / automatizaciones).
 */
export class NotificadorWebhook implements NotificadorCanal {
  public readonly canal = 'webhook' as const;

  constructor(
    private readonly urlPorDefecto: string = '',
    private readonly secretoHmac: string = '',
  ) {}

  public async enviar(
    destino: string,
    mensaje: string,
  ): Promise<{ enviado: boolean; modo: 'real' | 'simulado' }> {
    const candidato =
      destino && destino !== 'chat_local_simulado' && destino.trim().length > 0
        ? destino.trim()
        : this.urlPorDefecto.trim();

    if (!candidato || candidato === 'dummy' || candidato === 'changeme') {
      return { enviado: true, modo: 'simulado' };
    }

    let urlValida: URL;
    try {
      urlValida = new URL(candidato);
    } catch {
      return { enviado: false, modo: 'real' };
    }

    if (urlValida.protocol !== 'http:' && urlValida.protocol !== 'https:') {
      return { enviado: false, modo: 'real' };
    }

    const cuerpo = JSON.stringify({
      origen: 'HomeSOC',
      mensaje,
      textoFormateado: `🛡️ [HomeSOC] ${mensaje}`,
      timestamp: new Date().toISOString(),
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-HomeSOC-Origen': 'HomeSOC',
    };

    if (this.secretoHmac.trim().length > 0) {
      const firma = crypto
        .createHmac('sha256', this.secretoHmac.trim())
        .update(cuerpo)
        .digest('hex');
      headers['X-HomeSOC-Signature-256'] = `sha256=${firma}`;
    }

    try {
      const respuesta = await fetch(urlValida.toString(), {
        method: 'POST',
        headers,
        body: cuerpo,
        signal: AbortSignal.timeout(5000),
      });
      return { enviado: respuesta.ok, modo: 'real' };
    } catch {
      return { enviado: false, modo: 'real' };
    }
  }
}
