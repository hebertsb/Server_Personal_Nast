import { describe, expect, it, vi } from 'vitest';
import { NotificadorWebhook } from '../../../src/infraestructura/notificadores/NotificadorWebhook';

describe('NotificadorWebhook (Observer n8n / integraciones externas)', () => {
  it('opera en modo simulado si no hay URL configurada', async () => {
    const notificador = new NotificadorWebhook('', '');
    const res = await notificador.enviar('chat_local_simulado', 'Prueba local');
    expect(res).toEqual({ enviado: true, modo: 'simulado' });
  });

  it('envía POST JSON con firma HMAC cuando recibe una URL válida', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const notificador = new NotificadorWebhook('', 'secreto_prueba_123');
      const res = await notificador.enviar(
        'http://host.docker.internal:5678/webhook/homesoc-alertas',
        'Fuerza bruta SSH detectada',
      );

      expect(res).toEqual({ enviado: true, modo: 'real' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('http://host.docker.internal:5678/webhook/homesoc-alertas');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['X-HomeSOC-Origen']).toBe('HomeSOC');
      expect(headers['X-HomeSOC-Signature-256']).toMatch(/^sha256=[a-f0-9]{64}$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
