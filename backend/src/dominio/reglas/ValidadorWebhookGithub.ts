import crypto from 'node:crypto';

/**
 * Valida la firma HMAC-SHA256 enviada por GitHub en la cabecera X-Hub-Signature-256 (RF-32).
 * Usa comparación en tiempo constante para evitar ataques de temporización.
 */
export function validarFirmaWebhookGithub(
  cuerpoCrudo: Buffer,
  firmaRecibida: string | undefined,
  secreto: string,
): boolean {
  if (!firmaRecibida || !secreto || !firmaRecibida.startsWith('sha256=')) {
    return false;
  }

  const esperada = `sha256=${crypto
    .createHmac('sha256', secreto)
    .update(cuerpoCrudo)
    .digest('hex')}`;

  const bufEsperada = Buffer.from(esperada, 'utf8');
  const bufRecibida = Buffer.from(firmaRecibida, 'utf8');

  if (bufEsperada.length !== bufRecibida.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufEsperada, bufRecibida);
}

/** Genera la firma HMAC-SHA256 esperada (útil para pruebas locales y tests unitarios). */
export function firmarPayloadWebhookGithub(cuerpo: string | Buffer, secreto: string): string {
  return `sha256=${crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex')}`;
}
