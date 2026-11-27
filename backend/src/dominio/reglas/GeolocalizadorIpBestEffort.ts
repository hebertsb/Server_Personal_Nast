import { esIpEnRedLocal } from './EvaluadorConfianzaOrigen';

const RANGOS_LAN = ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
const RANGO_TAILSCALE = ['100.64.0.0/10'];

/**
 * Regla pura de dominio (RF-18 y RNF-07): geolocaliza de forma best-effort a nivel de país/red
 * sin almacenar datos personales identificables ni enviar telemetría a servicios externos.
 */
export function estimarPaisPorIp(ipCruda: string, codigoPaisCabecera?: string | null): string {
  if (codigoPaisCabecera && /^[A-Za-z]{2,20}$/.test(codigoPaisCabecera.trim())) {
    return codigoPaisCabecera.trim().toUpperCase();
  }

  const ip = ipCruda.trim().replace(/^::ffff:/, '');

  if (esIpEnRedLocal(ip, RANGOS_LAN)) {
    return 'LAN Local';
  }

  if (esIpEnRedLocal(ip, RANGO_TAILSCALE)) {
    return 'Tailscale Mesh';
  }

  // Prefijos regionales públicos comunes (best-effort local sin consultas externas)
  if (ip.startsWith('181.115.') || ip.startsWith('190.186.') || ip.startsWith('200.87.')) {
    return 'BO';
  }
  if (ip.startsWith('186.136.') || ip.startsWith('190.210.')) {
    return 'AR';
  }
  if (ip.startsWith('177.222.') || ip.startsWith('200.147.')) {
    return 'BR';
  }
  if (ip.startsWith('190.160.') || ip.startsWith('200.54.')) {
    return 'CL';
  }
  if (ip.startsWith('34.') || ip.startsWith('35.') || ip.startsWith('8.8.')) {
    return 'US';
  }

  return 'Internacional';
}
