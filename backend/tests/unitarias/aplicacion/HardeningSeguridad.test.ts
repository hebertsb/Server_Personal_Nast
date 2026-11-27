import express from 'express';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { ConsultarSeguridad } from '../../../src/aplicacion/seguridad/ConsultarSeguridad';
import { RepositorioEventos } from '../../../src/dominio/interfaces/RepositorioEventos';
import { crearLimitadorLogin } from '../../../src/presentacion/middlewares/rateLimit.middleware';

describe('Fase 0.7 — Rate limiting y consulta de seguridad/auditoría', () => {
  it('bloquea con HTTP 429 tras exceder intentos fallidos de login y registra evento de seguridad', async () => {
    const registrarEvento = vi.fn().mockResolvedValue(undefined);
    const app = express();
    const limitador = crearLimitadorLogin({
      maxIntentos: 2,
      ventanaMinutos: 15,
      registrarEvento,
      logger: pino({ level: 'silent' }),
    });

    app.post('/login', limitador, (_req, res) => {
      res.status(401).json({ error: { codigo: 'CREDENCIALES_INVALIDAS' } });
    });

    const servidor = http.createServer(app);
    await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    const { port } = servidor.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}/login`;

    try {
      const r1 = await fetch(url, { method: 'POST' });
      const r2 = await fetch(url, { method: 'POST' });
      const r3 = await fetch(url, { method: 'POST' });
      const cuerpo3 = (await r3.json()) as { error?: { codigo?: string } };

      expect(r1.status).toBe(401);
      expect(r2.status).toBe(401);
      expect(r3.status).toBe(429);
      expect(cuerpo3.error?.codigo).toBe('DEMASIADOS_INTENTOS');
      expect(registrarEvento).toHaveBeenCalledWith(
        expect.objectContaining({
          tipoEvento: 'rate_limit_login',
          severidad: 'alta',
        }),
      );
    } finally {
      await new Promise<void>((resolve) => servidor.close(() => resolve()));
    }
  });

  it('consulta eventos de seguridad y registros de auditoría vía RepositorioEventos', async () => {
    const repo: RepositorioEventos = {
      listarEventosSeguridad: vi.fn().mockResolvedValue([
        {
          id: 1,
          tipoEvento: 'rate_limit_login',
          ipOrigen: '127.0.0.1',
          severidad: 'alta',
          detalles: {},
          fechaHora: '2026-11-26T16:00:00.000Z',
        },
      ]),
      listarAuditoriaAcciones: vi.fn().mockResolvedValue([
        {
          id: 10,
          usuarioId: 'u-1',
          nombreUsuario: 'admin',
          accion: 'contenedor_detener',
          recurso: 'test-nginx',
          origen: 'web',
          direccionIp: '127.0.0.1',
          detalles: {},
          fechaHora: '2026-11-26T16:00:00.000Z',
        },
      ]),
    };

    const casoUso = new ConsultarSeguridad(repo);
    const eventos = await casoUso.obtenerEventos(25);
    const auditoria = await casoUso.obtenerAuditoria(25);

    expect(repo.listarEventosSeguridad).toHaveBeenCalledWith(25);
    expect(repo.listarAuditoriaAcciones).toHaveBeenCalledWith(25);
    expect(eventos).toHaveLength(1);
    expect(auditoria[0].accion).toBe('contenedor_detener');
  });
});
