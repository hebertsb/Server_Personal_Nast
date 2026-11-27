import { describe, expect, it, vi } from 'vitest';
import { NotificarEvento } from '../../../src/aplicacion/notificaciones/NotificarEvento';
import { DetectarFuerzaBruta } from '../../../src/aplicacion/seguridad/DetectarFuerzaBruta';
import { Colector } from '../../../src/dominio/interfaces/Colector';
import { RepositorioSeguridad2FA } from '../../../src/dominio/interfaces/RepositorioSeguridad2FA';
import {
  NotificadorCanal,
  RepositorioSeguridadRed,
} from '../../../src/dominio/interfaces/RepositorioSeguridadRed';
import {
  IntentoSshFallido,
  PoliticaBloqueoFuerzaBruta,
} from '../../../src/dominio/reglas/PoliticaBloqueoFuerzaBruta';
import { parsearLineasAuthLog } from '../../../src/infraestructura/sistema/ColectorAuthLog';

describe('Fase 1 — Parseo SSH, PoliticaBloqueoFuerzaBruta y Observer de Notificaciones', () => {
  const logEjemplo = [
    '2026-11-26T16:10:01Z homesoc sshd[10]: Failed password for invalid user root from 185.220.101.42 port 51201 ssh2',
    '2026-11-26T16:10:15Z homesoc sshd[11]: Failed password for invalid user admin from 185.220.101.42 port 51202 ssh2',
    '2026-11-26T16:10:30Z homesoc sshd[12]: Failed password for root from 185.220.101.42 port 51203 ssh2',
    '2026-11-26T16:11:00Z homesoc sshd[13]: Failed password for invalid user git from 185.220.101.42 port 51204 ssh2',
    '2026-11-26T16:11:20Z homesoc sshd[14]: Failed password for invalid user ubuntu from 185.220.101.42 port 51205 ssh2',
    '2026-11-26T16:12:00Z homesoc sshd[15]: Failed password for root from 45.155.205.99 port 44001 ssh2',
  ].join('\n');

  it('extrae intentos fallidos de líneas OpenSSH válidas y detecta fuerza bruta al alcanzar el umbral', () => {
    const intentos = parsearLineasAuthLog(logEjemplo);
    expect(intentos).toHaveLength(6);

    const politica = new PoliticaBloqueoFuerzaBruta();
    const hallazgos = politica.evaluar(intentos, {
      umbralIntentos: 5,
      ventanaMinutos: 15,
    });

    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].ipOrigen).toBe('185.220.101.42');
    expect(hallazgos[0].totalIntentos).toBe(5);
    expect(hallazgos[0].usuariosIntentados).toEqual(['root', 'admin', 'git', 'ubuntu']);
  });

  it('registra evento fuerza_bruta_ssh y despacha notificación Observer a Telegram', async () => {
    const intentos = parsearLineasAuthLog(logEjemplo);
    const colector: Colector<IntentoSshFallido[]> = {
      nombre: 'auth_log_ssh',
      recolectar: vi.fn().mockResolvedValue(intentos),
    };
    const repo2FA: RepositorioSeguridad2FA = {
      guardarSecretoTotp: vi.fn(),
      desactivarTotp: vi.fn(),
      reemplazarCodigosRecuperacion: vi.fn(),
      listarCodigosRecuperacionDisponibles: vi.fn(),
      marcarCodigoRecuperacionUsado: vi.fn(),
      buscarDispositivoConfiableVigente: vi.fn(),
      guardarDispositivoConfiable: vi.fn(),
      listarDispositivosConfiables: vi.fn(),
      revocarDispositivoConfiable: vi.fn(),
      registrarEventoSeguridad: vi.fn().mockResolvedValue(undefined),
    };
    const repoRed: RepositorioSeguridadRed = {
      listarIpsBloqueadas: vi.fn(),
      bloquearIp: vi.fn(),
      desbloquearIp: vi.fn(),
      listarConfiguracionNotificaciones: vi.fn().mockResolvedValue([
        {
          id: 'c-1',
          tipoEvento: 'fuerza_bruta_ssh',
          canal: 'telegram',
          destino: 'chat_123',
          habilitado: true,
        },
      ]),
      actualizarConfiguracionNotificacion: vi.fn(),
      registrarAlertaEnviada: vi.fn().mockImplementation(async (d) => ({
        id: 1,
        ...d,
        enviadoEn: '2026-11-26T16:12:00.000Z',
      })),
      listarAlertasEnviadas: vi.fn(),
    };

    const notificadorTelegram: NotificadorCanal = {
      canal: 'telegram',
      enviar: vi.fn().mockResolvedValue({ enviado: true, modo: 'simulado' }),
    };

    const observer = new NotificarEvento(repoRed);
    observer.suscribir(notificadorTelegram);
    const recibidasEnVivo: string[] = [];
    const cancelarSse = observer.suscribirTiempoReal((alerta) => {
      recibidasEnVivo.push(alerta.tipoEvento);
    });

    const casoUso = new DetectarFuerzaBruta(
      colector,
      new PoliticaBloqueoFuerzaBruta(),
      repo2FA,
      observer,
      5,
      15,
    );

    const resultado = await casoUso.ejecutar({ registrarYNotificar: true });
    cancelarSse();

    expect(resultado.hallazgosFuerzaBruta).toHaveLength(1);
    expect(resultado.alertasEmitidas).toBe(1);
    expect(recibidasEnVivo).toEqual(['fuerza_bruta_ssh']);
    expect(repo2FA.registrarEventoSeguridad).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoEvento: 'fuerza_bruta_ssh',
        ipOrigen: '185.220.101.42',
      }),
    );
    expect(notificadorTelegram.enviar).toHaveBeenCalledTimes(1);
    expect(repoRed.registrarAlertaEnviada).toHaveBeenCalledTimes(1);
  });
});
