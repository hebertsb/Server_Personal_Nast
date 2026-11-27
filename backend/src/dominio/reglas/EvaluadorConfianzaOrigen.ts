export type MotivoSegundoFactor =
  | 'no_habilitado'
  | 'confiable'
  | 'red_externa'
  | 'dispositivo_nuevo';

export interface EvaluacionSegundoFactor {
  requerido: boolean;
  esRedLocal: boolean;
  motivo: MotivoSegundoFactor;
}

function normalizarIpv4(ipCruda: string): string | null {
  const limpia = ipCruda.trim();
  if (limpia === '::1') return '127.0.0.1';
  const ipv4Mapeada = limpia.startsWith('::ffff:') ? limpia.slice(7) : limpia;
  const partes = ipv4Mapeada.split('.');
  if (partes.length !== 4) return null;
  for (const parte of partes) {
    if (!/^\d+$/.test(parte)) return null;
    const numero = Number(parte);
    if (numero < 0 || numero > 255) return null;
  }
  return ipv4Mapeada;
}

function ipv4AEntero(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number);
  return (((a << 24) >>> 0) + ((b << 16) >>> 0) + ((c << 8) >>> 0) + (d >>> 0)) >>> 0;
}

/** Comprueba si una dirección IP pertenece a alguno de los rangos CIDR locales confiables. */
export function esIpEnRedLocal(ip: string, rangosCidr: string[]): boolean {
  const ipv4 = normalizarIpv4(ip);
  if (!ipv4) return false;
  const valorIp = ipv4AEntero(ipv4);

  for (const rango of rangosCidr) {
    const limpio = rango.trim();
    if (!limpio) continue;
    const [redBase, mascaraStr] = limpio.split('/');
    const redNormalizada = normalizarIpv4(redBase);
    if (!redNormalizada) continue;

    const bits = mascaraStr !== undefined ? Number(mascaraStr) : 32;
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) continue;

    const mascara = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    const valorRed = ipv4AEntero(redNormalizada);

    if ((valorIp & mascara) === (valorRed & mascara)) {
      return true;
    }
  }

  return false;
}

/**
 * Regla pura de dominio (RF-04a..d):
 * - Si el usuario no tiene 2FA activo, no se exige.
 * - Si el acceso proviene de red externa (fuera de CIDR confiable), SIEMPRE exige 2FA.
 * - Si viene de red local pero el dispositivo no es confiable, exige 2FA.
 * - Si viene de red local y el dispositivo es confiable vigente, omite 2FA.
 */
export function evaluarRequerimiento2FA(parametros: {
  totpHabilitado: boolean;
  direccionIp: string;
  rangosConfiablesCidr: string[];
  dispositivoConfiableVigente: boolean;
}): EvaluacionSegundoFactor {
  const esRedLocal = esIpEnRedLocal(parametros.direccionIp, parametros.rangosConfiablesCidr);

  if (!parametros.totpHabilitado) {
    return { requerido: false, esRedLocal, motivo: 'no_habilitado' };
  }

  if (!esRedLocal) {
    return { requerido: true, esRedLocal: false, motivo: 'red_externa' };
  }

  if (!parametros.dispositivoConfiableVigente) {
    return { requerido: true, esRedLocal: true, motivo: 'dispositivo_nuevo' };
  }

  return { requerido: false, esRedLocal: true, motivo: 'confiable' };
}
