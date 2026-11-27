import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { ServicioTotp } from '../../dominio/interfaces/ServicioTotp';

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ALFABETO_RECUPERACION = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PERIODO_SEGUNDOS = 30;
const DIGITOS_TOTP = 6;
const VENTANA_DERIVA = 1;

function codificarBase32(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = '';

  for (const byte of bytes) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO_BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    salida += ALFABETO_BASE32[(valor << (5 - bits)) & 31];
  }

  return salida;
}

function decodificarBase32(base32: string): Buffer {
  const limpio = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];

  for (const caracter of limpio) {
    const idx = ALFABETO_BASE32.indexOf(caracter);
    if (idx === -1) continue;
    valor = (valor << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** Calcula el código TOTP RFC 6238 (HMAC-SHA1, 6 dígitos) para un contador temporal dado. */
export function calcularTotpParaContador(secretoBase32: string, contador: number): string {
  const clave = decodificarBase32(secretoBase32);
  const bufferContador = Buffer.alloc(8);
  const parteAlta = Math.floor(contador / 0x100000000);
  const parteBaja = contador >>> 0;
  bufferContador.writeUInt32BE(parteAlta, 0);
  bufferContador.writeUInt32BE(parteBaja, 4);

  const hmac = crypto.createHmac('sha1', clave).update(bufferContador).digest();
  const desplazamiento = hmac[hmac.length - 1] & 0x0f;
  const codigoBinario =
    ((hmac[desplazamiento] & 0x7f) << 24) |
    ((hmac[desplazamiento + 1] & 0xff) << 16) |
    ((hmac[desplazamiento + 2] & 0xff) << 8) |
    (hmac[desplazamiento + 3] & 0xff);

  return String(codigoBinario % 10 ** DIGITOS_TOTP).padStart(DIGITOS_TOTP, '0');
}

/**
 * Implementación estándar RFC 6238 (compatible con Google Authenticator, Authy y Ente)
 * usando node:crypto nativo y qrcode para renderizar el QR.
 */
export class ServicioTotpCrypto implements ServicioTotp {
  constructor(private readonly emisor = 'HomeSOC') {}

  public generarSecretoBase32(): string {
    return codificarBase32(crypto.randomBytes(20));
  }

  public construirUriOtpAuth(nombreUsuario: string, secretoBase32: string): string {
    const etiqueta = encodeURIComponent(`${this.emisor}:${nombreUsuario}`);
    const issuer = encodeURIComponent(this.emisor);
    return `otpauth://totp/${etiqueta}?secret=${secretoBase32}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITOS_TOTP}&period=${PERIODO_SEGUNDOS}`;
  }

  public async generarQrDataUrl(uriOtpAuth: string): Promise<string> {
    return QRCode.toDataURL(uriOtpAuth, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
    });
  }

  public verificarCodigo(secretoBase32: string, codigo: string): boolean {
    const limpio = codigo.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(limpio)) {
      return false;
    }

    const contadorActual = Math.floor(Date.now() / 1000 / PERIODO_SEGUNDOS);
    const bufEntrada = Buffer.from(limpio, 'utf8');

    for (let delta = -VENTANA_DERIVA; delta <= VENTANA_DERIVA; delta++) {
      const esperado = calcularTotpParaContador(secretoBase32, contadorActual + delta);
      const bufEsperado = Buffer.from(esperado, 'utf8');
      if (
        bufEntrada.length === bufEsperado.length &&
        crypto.timingSafeEqual(bufEntrada, bufEsperado)
      ) {
        return true;
      }
    }

    return false;
  }

  public generarCodigosRecuperacion(cantidad = 8): string[] {
    const codigos: string[] = [];
    for (let i = 0; i < cantidad; i++) {
      const bytes = crypto.randomBytes(8);
      let bloque = '';
      for (let j = 0; j < 8; j++) {
        bloque += ALFABETO_RECUPERACION[bytes[j] % ALFABETO_RECUPERACION.length];
      }
      codigos.push(`${bloque.slice(0, 4)}-${bloque.slice(4, 8)}`);
    }
    return codigos;
  }
}
