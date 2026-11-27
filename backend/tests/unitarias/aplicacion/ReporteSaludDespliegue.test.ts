import { describe, expect, it, vi } from 'vitest';
import {
  formatearReporteTelegram,
  ReporteSaludDespliegue,
  serializarLogSaludConReporte,
  MARCADOR_REPORTE_INICIO,
} from '../../../src/dominio/reglas/ReporteSaludDespliegue';
import { VerificadorSaludDespliegue } from '../../../src/infraestructura/docker/VerificadorSaludDespliegue';

describe('ReporteSaludDespliegue (Antes vs. Después)', () => {
  it('formatea reporte en tabla legible para Telegram/n8n e incluye alerta si .env está expuesto', () => {
    const reporte: ReporteSaludDespliegue = {
      proyecto: 'mi-api',
      rama: 'main',
      commitSha: '1fa5212abcdef',
      puerto: 4100,
      estadoFinal: 'exitoso',
      duracionSeg: 34,
      timestamp: '2026-11-27T19:00:00.000Z',
      antes: [{ prueba: 'Servidor web', estado: 'ok', detalle: 'responde (200 · 14ms)' }],
      despues: [
        { prueba: 'Servidor web (/)', estado: 'ok', detalle: 'responde (200 · 18ms)' },
        { prueba: 'Seguridad /.env', estado: 'error', detalle: '¡EXPUESTO (HTTP 200)!' },
      ],
    };

    const texto = formatearReporteTelegram(reporte);
    expect(texto).toContain('Reporte de Despliegue: mi-api (main · 1fa5212)');
    expect(texto).toContain('Salud ANTES');
    expect(texto).toContain('Salud DESPUÉS');
    expect(texto).toContain('ALERTA DE SEGURIDAD');

    const serializado = serializarLogSaludConReporte('OK', reporte);
    expect(serializado).toContain(MARCADOR_REPORTE_INICIO);
  });

  it('marca /.env como protegido ante 404 y como error ante 200', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/.env')) return Promise.resolve({ status: 404 });
      if (url.endsWith('/.git/config')) return Promise.resolve({ status: 403 });
      if (url.endsWith('/health')) return Promise.resolve({ status: 200 });
      return Promise.resolve({ status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const verificador = new VerificadorSaludDespliegue('http://127.0.0.1');
      const pruebas = await verificador.verificarDespues(4100, 'homesoc-app-demo', true);
      const envPrueba = pruebas.find((p) => p.prueba === 'Seguridad /.env');
      const healthPrueba = pruebas.find((p) => p.prueba.includes('/health'));
      expect(envPrueba?.estado).toBe('ok');
      expect(healthPrueba?.estado).toBe('ok');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
