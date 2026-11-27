import { describe, expect, it, vi } from 'vitest';
import { GestionarAutomatizaciones } from '../../../src/aplicacion/automatizaciones/GestionarAutomatizaciones';
import { NotificarEvento } from '../../../src/aplicacion/notificaciones/NotificarEvento';
import {
  Automatizacion,
  EstadoEnergiaHost,
  LogAutomatizacion,
} from '../../../src/dominio/entidades/Automatizacion';
import { Contenedor } from '../../../src/dominio/entidades/Contenedor';
import { RecursosHost } from '../../../src/dominio/entidades/RecursosHost';
import { Colector } from '../../../src/dominio/interfaces/Colector';
import { ColectorEnergia } from '../../../src/dominio/interfaces/ColectorEnergia';
import { ControladorDocker } from '../../../src/dominio/interfaces/ControladorDocker';
import { RepositorioAuditoria } from '../../../src/dominio/interfaces/RepositorioAuditoria';
import { RepositorioAutomatizaciones } from '../../../src/dominio/interfaces/RepositorioAutomatizaciones';
import { RepositorioSeguridad2FA } from '../../../src/dominio/interfaces/RepositorioSeguridad2FA';
import {
  coincideHorario,
  estaEnCooldown,
  evaluarCondicionMetrica,
  evaluarEstadoEnergia,
  evaluarLimiteReintentosAutoHealing,
} from '../../../src/dominio/reglas/EvaluadorAutomatizaciones';

const recursosMock: RecursosHost = {
  hostname: 'dev-host',
  plataforma: 'linux',
  arquitectura: 'x64',
  modeloCpu: 'Test CPU',
  cantidadNucleos: 8,
  tiempoActividadSeg: 3600,
  cargaPromedio: [2.1, 1.8, 1.5],
  porcentajeCpu: 91.5,
  nucleos: [{ indice: 0, porcentajeUso: 91.5 }],
  ramUsadaMb: 6000,
  ramTotalMb: 8000,
  ramLibreMb: 2000,
  porcentajeRam: 75,
  temperaturaC: 82,
  discos: [
    {
      etiqueta: 'Sistema',
      puntoMontaje: '/',
      totalGb: 100,
      usadoGb: 40,
      libreGb: 60,
      porcentajeUso: 40,
    },
  ],
  marcaTiempo: '2026-11-26T23:30:00.000Z',
};

const contenedorTest: Contenedor = {
  id: 'cid1',
  idCorto: 'cid1',
  nombre: 'test-nginx',
  imagen: 'nginx:alpine',
  estado: 'unhealthy',
  estadoTexto: 'Up (unhealthy)',
  cpuPorcentaje: 0,
  ramUsadaMb: 10,
  ramLimiteMb: 512,
  redRxMb: 0,
  redTxMb: 0,
  puertos: [],
  creadoEn: 'x',
};

const contenedorNucleo: Contenedor = {
  ...contenedorTest,
  id: 'cid-db',
  idCorto: 'cid-db',
  nombre: 'homesoc-db-dev',
  estado: 'running',
};

const admin = { usuarioId: 'u1', rol: 'administrador' as const, direccionIp: '127.0.0.1' };

function crearBaseMocks(reglas: Automatizacion[], energiaInicial: EstadoEnergiaHost) {
  const logs: LogAutomatizacion[] = [];
  const repo: RepositorioAutomatizaciones = {
    listar: vi.fn().mockResolvedValue(reglas),
    obtenerPorId: vi.fn().mockImplementation(async (id) => reglas.find((r) => r.id === id) ?? null),
    crear: vi.fn(),
    actualizar: vi.fn(),
    actualizarHabilitado: vi.fn(),
    actualizarEstadoEjecucion: vi.fn().mockResolvedValue(undefined),
    eliminar: vi.fn(),
    registrarLog: vi.fn().mockImplementation(async (d) => {
      const l: LogAutomatizacion = {
        id: logs.length + 1,
        automatizacionId: d.automatizacionId,
        nombreAutomatizacion: 'Regla',
        tipoAutomatizacion: 'horario',
        resultado: d.resultado,
        detalle: d.detalle,
        fechaHora: '2026-11-26T23:30:00.000Z',
      };
      logs.push(l);
      return l;
    }),
    contarEjecucionesRecientes: vi.fn().mockResolvedValue(0),
    listarLogs: vi.fn().mockResolvedValue(logs),
  };

  const docker: ControladorDocker = {
    nombre: 'docker',
    recolectar: vi.fn().mockResolvedValue([
      { ...contenedorTest, estado: 'running' },
      contenedorNucleo,
    ]),
    obtenerPorId: vi
      .fn()
      .mockImplementation(async (id) => (id === 'test-nginx' ? contenedorTest : contenedorNucleo)),
    ejecutarAccion: vi.fn().mockResolvedValue(undefined),
    obtenerLogs: vi.fn(),
    limpiarImagenesHuerfanas: vi
      .fn()
      .mockResolvedValue({ imagenesEliminadas: 2, espacioRecuperadoMb: 145.5 }),
  };

  const colector: Colector<RecursosHost> = {
    nombre: 'recursos_host',
    recolectar: vi.fn().mockResolvedValue(recursosMock),
  };

  const colectorEnergia: ColectorEnergia = {
    leerEstado: vi.fn().mockResolvedValue(energiaInicial),
    simularEstado: vi.fn(),
  };

  const auditoria: RepositorioAuditoria = { registrar: vi.fn().mockResolvedValue(undefined) };
  const notificador = { emitir: vi.fn().mockResolvedValue([]) } as unknown as NotificarEvento;
  const repoSeg = {
    registrarEventoSeguridad: vi.fn().mockResolvedValue(undefined),
  } as unknown as RepositorioSeguridad2FA;

  const casoUso = new GestionarAutomatizaciones(
    repo,
    docker,
    colector,
    colectorEnergia,
    auditoria,
    notificador,
    repoSeg,
  );

  return { casoUso, repo, docker, notificador, repoSeg };
}

describe('Fase 4 — Automatización ampliada (cooldown, auto-healing, energía y arranque)', () => {
  it('evalúa horarios, condiciones (incl. temperatura), cooldown y límite de auto-healing', () => {
    const fecha = new Date(2026, 10, 26, 23, 30);
    expect(
      coincideHorario(
        { contenedorNombre: 'test-nginx', accion: 'detener', hora: '23:30', diasSemana: [4] },
        fecha,
      ),
    ).toBe(true);

    expect(
      estaEnCooldown(new Date(fecha.getTime() + 60_000).toISOString(), fecha),
    ).toBe(true);
    expect(
      estaEnCooldown(new Date(fecha.getTime() - 60_000).toISOString(), fecha),
    ).toBe(false);

    const tempRes = evaluarCondicionMetrica(
      {
        metrica: 'temperatura_c',
        operador: '>=',
        umbral: 80,
        duracionMinutos: 5,
        cooldownMinutos: 15,
        accion: 'notificar',
      },
      recursosMock,
    );
    expect(tempRes.cumplida).toBe(true);
    expect(tempRes.valorActual).toBe(82);

    expect(evaluarLimiteReintentosAutoHealing(2, 3)).toEqual({
      puedeReintentar: true,
      debeEscalar: false,
    });
    expect(evaluarLimiteReintentosAutoHealing(3, 3)).toEqual({
      puedeReintentar: false,
      debeEscalar: true,
    });
  });

  it('respeta cooldown en evaluación automática y escala auto-healing al superar el límite de reintentos', async () => {
    const futuro = new Date(Date.now() + 600_000).toISOString();
    const reglaEnCooldown: Automatizacion = {
      id: 'a-cool',
      nombre: 'CPU alta',
      descripcion: '',
      tipo: 'condicion',
      configuracion: {
        metrica: 'cpu_porcentaje',
        operador: '>',
        umbral: 80,
        duracionMinutos: 5,
        cooldownMinutos: 15,
        accion: 'notificar',
      },
      canalNotificacion: 'telegram',
      habilitado: true,
      ultimaEjecucionEn: null,
      ultimoResultado: null,
      proximaEjecucionEn: null,
      enfriamientoHasta: futuro,
      creadoEn: 'x',
      actualizadoEn: 'x',
    };

    const reglaHealing: Automatizacion = {
      id: 'a-heal',
      nombre: 'Auto-healing nginx',
      descripcion: '',
      tipo: 'auto_healing',
      configuracion: {
        contenedorNombre: 'test-nginx',
        maxReintentos: 3,
        ventanaMinutos: 15,
        cooldownMinutos: 5,
      },
      canalNotificacion: 'telegram',
      habilitado: true,
      ultimaEjecucionEn: null,
      ultimoResultado: null,
      proximaEjecucionEn: null,
      enfriamientoHasta: null,
      creadoEn: 'x',
      actualizadoEn: 'x',
    };

    const energiaNormal: EstadoEnergiaHost = {
      modo: 'simulacion',
      disponible: true,
      enBateria: false,
      estadoTexto: 'AC',
      porcentajeBateria: 100,
      actualizadoEn: 'x',
    };

    const { casoUso, repo, docker, notificador } = crearBaseMocks(
      [reglaEnCooldown, reglaHealing],
      energiaNormal,
    );

    // Simula que ya hubo 3 intentos recientes -> debe escalar sin reiniciar
    vi.mocked(repo.contarEjecucionesRecientes).mockResolvedValue(3);

    const evalRes = await casoUso.evaluarReglasActivas(new Date());
    expect(evalRes.ejecutadas).toBe(1); // reglaEnCooldown fue omitida
    expect(evalRes.logs[0].resultado).toBe('error');
    expect(evalRes.logs[0].detalle).toContain('ALERTA CRÍTICA');
    expect(docker.ejecutarAccion).not.toHaveBeenCalled();
    expect(notificador.emitir).toHaveBeenCalled();
  });

  it('detiene únicamente contenedores no críticos ante batería crítica y notifica al arrancar el servidor', async () => {
    const reglaEnergia: Automatizacion = {
      id: 'a-pwr',
      nombre: 'Resiliencia corte de luz',
      descripcion: '',
      tipo: 'energia',
      configuracion: {
        umbralBateriaCritica: 15,
        detenerContenedoresEnCritico: true,
        cooldownMinutos: 5,
      },
      canalNotificacion: 'telegram',
      habilitado: true,
      ultimaEjecucionEn: null,
      ultimoResultado: null,
      proximaEjecucionEn: null,
      enfriamientoHasta: null,
      creadoEn: 'x',
      actualizadoEn: 'x',
    };

    const energiaCritica: EstadoEnergiaHost = {
      modo: 'simulacion',
      disponible: true,
      enBateria: true,
      estadoTexto: 'Discharging',
      porcentajeBateria: 12,
      actualizadoEn: 'x',
    };

    expect(
      evaluarEstadoEnergia(
        { umbralBateriaCritica: 15, detenerContenedoresEnCritico: true, cooldownMinutos: 5 },
        energiaCritica,
      ).nivel,
    ).toBe('bateria_critica');

    const { casoUso, docker, notificador, repoSeg } = crearBaseMocks([reglaEnergia], energiaCritica);

    const log = await casoUso.ejecutarManualmente('a-pwr', admin);
    expect(log.resultado).toBe('exitoso');
    expect(log.detalle).toContain('BATERÍA CRÍTICA');
    // Solo detuvo test-nginx (cid1), jamás homesoc-db-dev (cid-db)
    expect(docker.ejecutarAccion).toHaveBeenCalledTimes(1);
    expect(docker.ejecutarAccion).toHaveBeenCalledWith('cid1', 'detener');

    await casoUso.notificarArranqueServidor();
    expect(repoSeg.registrarEventoSeguridad).toHaveBeenCalledWith(
      expect.objectContaining({ tipoEvento: 'servidor_arranque' }),
    );
    expect(notificador.emitir).toHaveBeenCalledWith(
      expect.objectContaining({ tipoEvento: 'servidor_arranque' }),
    );
  });
});
