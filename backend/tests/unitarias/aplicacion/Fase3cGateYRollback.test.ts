import { describe, expect, it, vi } from 'vitest';
import { GestionarProyectosDespliegue } from '../../../src/aplicacion/despliegues/GestionarProyectosDespliegue';
import { DespliegueRegistro, ProyectoConectado } from '../../../src/dominio/entidades/Despliegue';
import { ClienteGithub } from '../../../src/dominio/interfaces/ClienteGithub';
import { RepositorioAuditoria } from '../../../src/dominio/interfaces/RepositorioAuditoria';
import { RepositorioConexionGithub } from '../../../src/dominio/interfaces/RepositorioConexionGithub';
import { RepositorioDespliegues } from '../../../src/dominio/interfaces/RepositorioDespliegues';
import { ServicioCifrado } from '../../../src/dominio/interfaces/ServicioCifrado';
import { evaluarGateSeguridad } from '../../../src/dominio/reglas/EvaluadorGateSeguridad';
import {
  firmarPayloadWebhookGithub,
  validarFirmaWebhookGithub,
} from '../../../src/dominio/reglas/ValidadorWebhookGithub';

const admin = {
  usuarioId: 'u1',
  nombreUsuario: 'admin',
  rol: 'administrador' as const,
  direccionIp: '127.0.0.1',
};

function crearRepoMock(): {
  proyecto: ProyectoConectado;
  repoDesp: RepositorioDespliegues;
  despliegues: DespliegueRegistro[];
} {
  const proyecto: ProyectoConectado = {
    id: 'p1',
    usuarioId: 'u1',
    repoGithubId: 1004,
    nombreProyecto: 'landing-node',
    nombreCompleto: 'hebert-dev/landing-node',
    rama: 'main',
    puerto: 4100,
    tipoProyecto: 'nodejs',
    modoActualizacion: 'webhook',
    requiereAprobacion: false,
    ultimoCommitSha: 'aaa1111',
    estadoActual: 'activo',
    totalVariables: 0,
    creadoEn: '2026-11-26T00:00:00.000Z',
    actualizadoEn: '2026-11-26T00:00:00.000Z',
  };
  const despliegues: DespliegueRegistro[] = [];

  const repoDesp: RepositorioDespliegues = {
    crearProyecto: vi.fn(),
    listarProyectos: vi.fn().mockResolvedValue([proyecto]),
    obtenerProyectoPorId: vi.fn().mockResolvedValue(proyecto),
    obtenerProyectoPorNombreCompleto: vi.fn().mockResolvedValue(proyecto),
    actualizarProyecto: vi.fn(),
    actualizarEstadoProyecto: vi.fn().mockImplementation(async (_id, estado, sha) => {
      proyecto.estadoActual = estado;
      if (sha) proyecto.ultimoCommitSha = sha;
    }),
    eliminarProyecto: vi.fn(),
    listarVariables: vi.fn().mockResolvedValue([]),
    guardarVariable: vi.fn(),
    eliminarVariable: vi.fn(),
    registrarDespliegue: vi.fn().mockImplementation(async (d) => {
      const reg: DespliegueRegistro = {
        id: `d-${despliegues.length + 1}`,
        repositorioId: d.repositorioId,
        commitSha: d.commitSha,
        origen: d.origen,
        estado: d.estado,
        logConstruccion: d.logConstruccion,
        duracionMs: d.duracionMs,
        ejecutadoPor: d.ejecutadoPor,
        healthCheckOk: d.healthCheckOk ?? null,
        logHealthCheck: d.logHealthCheck ?? '',
        rollbackAutomatico: d.rollbackAutomatico ?? false,
        despliegueOrigenId: d.despliegueOrigenId ?? null,
        escaneos: (d.escaneos ?? []).map((e, i) => ({
          ...e,
          id: `e-${i}`,
          despliegueId: `d-${despliegues.length + 1}`,
          creadoEn: '2026-11-26T00:00:00.000Z',
        })),
        creadoEn: '2026-11-26T00:00:00.000Z',
      };
      despliegues.push(reg);
      return reg;
    }),
    obtenerDesplieguePorId: vi.fn().mockImplementation(async (_rid, did) =>
      despliegues.find((x) => x.id === did) ?? null,
    ),
    listarDespliegues: vi.fn().mockResolvedValue(despliegues),
    listarEscaneosPorDespliegue: vi.fn().mockResolvedValue([]),
  };

  return { proyecto, repoDesp, despliegues };
}

describe('Fase 3c — Webhook HMAC, Gate de seguridad, Health check y Rollback', () => {
  it('valida firma HMAC-SHA256 de GitHub y rechaza firmas alteradas o ausentes', () => {
    const cuerpo = Buffer.from('{"ref":"refs/heads/main"}', 'utf8');
    const secreto = 'mi_secreto_webhook_1234';
    const firmaValida = firmarPayloadWebhookGithub(cuerpo, secreto);

    expect(validarFirmaWebhookGithub(cuerpo, firmaValida, secreto)).toBe(true);
    expect(validarFirmaWebhookGithub(cuerpo, 'sha256=0000', secreto)).toBe(false);
    expect(validarFirmaWebhookGithub(cuerpo, undefined, secreto)).toBe(false);
  });

  it('detiene el despliegue cuando el Gate detecta un hallazgo crítico y permite aprobar manualmente', async () => {
    const { proyecto, repoDesp } = crearRepoMock();
    const cliente: ClienteGithub = {
      modo: 'simulacion',
      validarToken: vi.fn(),
      listarRepositorios: vi.fn(),
      listarArchivosRaiz: vi.fn(),
    };
    const repoGh: RepositorioConexionGithub = {
      guardar: vi.fn(),
      obtenerPorUsuario: vi.fn(),
      eliminar: vi.fn(),
    };
    const cifrado: ServicioCifrado = { cifrar: (s) => s, descifrar: (s) => s };
    const auditoria: RepositorioAuditoria = { registrar: vi.fn().mockResolvedValue(undefined) };

    const casoUso = new GestionarProyectosDespliegue(
      cliente,
      repoGh,
      repoDesp,
      cifrado,
      auditoria,
    );

    const gate = evaluarGateSeguridad({
      tipoProyecto: 'nodejs',
      commitSha: 'bad1234',
      simularHallazgoCritico: true,
    });
    expect(gate.aprobado).toBe(false);
    expect(gate.hallazgosCriticosTotales).toBeGreaterThan(0);

    const detenido = await casoUso.ejecutarDespliegue('p1', admin, 'webhook', {
      commitSha: 'bad1234',
      simularHallazgoCritico: true,
    });
    expect(detenido.estado).toBe('pendiente_aprobacion');
    expect(proyecto.estadoActual).toBe('pendiente_aprobacion');

    const aprobado = await casoUso.aprobarDesplieguePendiente('p1', detenido.id, admin);
    expect(aprobado.estado).toBe('exitoso');
    expect(proyecto.ultimoCommitSha).toBe('bad1234');
  });

  it('ejecuta rollback automático ante fallo de health check y mantiene el commit anterior activo', async () => {
    const { proyecto, repoDesp } = crearRepoMock();
    const cliente: ClienteGithub = {
      modo: 'simulacion',
      validarToken: vi.fn(),
      listarRepositorios: vi.fn(),
      listarArchivosRaiz: vi.fn(),
    };
    const repoGh: RepositorioConexionGithub = {
      guardar: vi.fn(),
      obtenerPorUsuario: vi.fn(),
      eliminar: vi.fn(),
    };
    const cifrado: ServicioCifrado = { cifrar: (s) => s, descifrar: (s) => s };
    const auditoria: RepositorioAuditoria = { registrar: vi.fn().mockResolvedValue(undefined) };

    const casoUso = new GestionarProyectosDespliegue(
      cliente,
      repoGh,
      repoDesp,
      cifrado,
      auditoria,
    );

    const fallido = await casoUso.ejecutarDespliegue('p1', admin, 'webhook', {
      commitSha: 'brk9999',
      simularFalloHealthCheck: true,
    });

    expect(fallido.estado).toBe('fallido');
    expect(fallido.healthCheckOk).toBe(false);
    expect(fallido.rollbackAutomatico).toBe(true);
    // Conserva la versión anterior sirviendo sin interrupción
    expect(proyecto.ultimoCommitSha).toBe('aaa1111');
    expect(proyecto.estadoActual).toBe('activo');
  });
});
