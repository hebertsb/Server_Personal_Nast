export type EstadoPruebaSalud = 'ok' | 'advertencia' | 'error';

export interface PruebaSaludDespliegue {
  prueba: string;
  estado: EstadoPruebaSalud;
  detalle: string;
}

export interface ReporteSaludDespliegue {
  proyecto: string;
  rama: string;
  commitSha: string;
  puerto: number;
  estadoFinal: 'exitoso' | 'fallido' | 'revertido';
  duracionSeg: number;
  timestamp: string;
  antes: PruebaSaludDespliegue[];
  despues: PruebaSaludDespliegue[];
}

export const MARCADOR_REPORTE_INICIO = '<!--HOMESOC_REPORTE_JSON:';
export const MARCADOR_REPORTE_FIN = '-->';

function iconoEstado(estado: EstadoPruebaSalud): string {
  if (estado === 'ok') return '✅';
  if (estado === 'advertencia') return '⚠️';
  return '❌';
}

/**
 * Formatea el reporte Antes vs. Después en una tabla compacta y legible
 * para alertas de Telegram / n8n / WhatsApp.
 */
export function formatearReporteTelegram(reporte: ReporteSaludDespliegue): string {
  const badgeEstado =
    reporte.estadoFinal === 'exitoso'
      ? '✅ EXITOSO'
      : reporte.estadoFinal === 'revertido'
        ? '↩️ REVERTIDO'
        : '❌ FALLIDO';

  const lineas: string[] = [
    `📦 Reporte de Despliegue: ${reporte.proyecto} (${reporte.rama} · ${reporte.commitSha.slice(0, 7)})`,
    `Estado: ${badgeEstado} (${reporte.duracionSeg}s) | Puerto: ${reporte.puerto}`,
    '',
    '── Salud ANTES ──',
    ...reporte.antes.map((p) => `${iconoEstado(p.estado)} ${p.prueba}: ${p.detalle}`),
    '',
    '── Salud DESPUÉS ──',
    ...reporte.despues.map((p) => `${iconoEstado(p.estado)} ${p.prueba}: ${p.detalle}`),
  ];

  const fugas = reporte.despues.filter(
    (p) => p.estado === 'error' && p.prueba.toLowerCase().includes('seguridad'),
  );
  if (fugas.length > 0) {
    lineas.push('', '🚨 ALERTA DE SEGURIDAD: se detectó un archivo sensible expuesto tras el despliegue.');
  }

  return lineas.join('\n');
}

/**
 * Embebe el JSON estructurado al final del logHealthCheck para que la UI renderice
 * la tabla Antes vs. Después sin romper compatibilidad con despliegues previos.
 */
export function serializarLogSaludConReporte(
  resumenTexto: string,
  reporte: ReporteSaludDespliegue,
): string {
  return `${resumenTexto}\n${MARCADOR_REPORTE_INICIO}${JSON.stringify(reporte)}${MARCADOR_REPORTE_FIN}`;
}
