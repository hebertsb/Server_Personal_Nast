import { describe, expect, it, vi } from 'vitest';
import { GestionarProyectosDespliegue } from '../../../src/aplicacion/despliegues/GestionarProyectosDespliegue';
import {
  DespliegueRegistro,
  ProyectoConectado,
  VariableEntornoPersistida,
} from '../../../src/dominio/entidades/Despliegue';
import { ClienteGithub } from '../../../src/dominio/interfaces/ClienteGithub';
import { RepositorioAuditoria } from '../../../src/dominio/interfaces/RepositorioAuditoria';
import { RepositorioConexionGithub } from '../../../src/dominio/interfaces/RepositorioConexionGithub';
import { RepositorioDespliegues } from '../../../src/dominio/interfaces/RepositorioDespliegues';
import { ServicioCifrado } from '../../../src/dominio/interfaces/ServicioCifrado';
import { detectarTipoProyecto } from '../../../src/dominio/reglas/DetectorTipoProyecto';

const admin = {
  usuarioId: 'u1',
  nombreUsuario: 'admin',
  rol: 'administrador' as const,
  direccionIp: '127.0.0.1',
};

describe('Fase 3b — Auto-detección, variables cifradas y despliegues (RF-30..31, RF-34..39)', () => {
  it('prioriza Dockerfile sobre package.json e index.html, y soporta Node.js y HTML estático', () => {
    expect(detectarTipoProyecto(['package.json', 'Dockerfile', 'index.html']).tipoDetectado).toBe(
      'dockerfile',
    );
    expect(detectarTipoProyecto(['package.json', 'src']).tipoDetectado).toBe('nodejs');
    expect(detectarTipoProyecto(['index.html', 'styles.css']).tipoDetectado).toBe('html_estatico');
    expect(detectarTipoProyecto(['README.md', 'main.py']).tipoDetectado).toBeNull();
  });

  it('cifra variables de entorno y jamás expone su valor en respuestas ni logs de despliegue', async () => {
    const proyectoMock: ProyectoConectado = {
      id: 'p1',
      usuarioId: 'u1',
      repoGithubId: 1001,
      nombreProyecto: 'barberapp',
      nombreCompleto: 'hebert-dev/barberapp',
      rama: 'main',
      puerto: 4100,
      tipoProyecto: 'nodejs',
      modoActualizacion: 'polling',
      requiereAprobacion: false,
      ultimoCommitSha: 'a1b2c3d',
      estadoActual: 'configurado',
      totalVariables: 0,
      creadoEn: '2026-11-26T00:00:00.000Z',
      actualizadoEn: '2026-11-26T00:00:00.000Z',
    };

    const vars: VariableEntornoPersistida[] = [];
    const despliegues: DespliegueRegistro[] = [];

    const cliente: ClienteGithub = {
      modo: 'simulacion',
      validarToken: vi.fn(),
      listarRepositorios: vi.fn(),
      listarArchivosRaiz: vi.fn().mockResolvedValue(['package.json', 'server.js']),
    };
    const repoGh: RepositorioConexionGithub = {
      guardar: vi.fn(),
      obtenerPorUsuario: vi.fn().mockResolvedValue({
        usuarioId: 'u1',
        usuarioGithub: 'hebert-dev',
        tokenCifrado: 'cifrado(ghp_test)',
        alcances: 'repo',
        modo: 'simulacion',
        conectadoEn: 'x',
        actualizadoEn: 'x',
      }),
      eliminar: vi.fn(),
    };
    const repoDesp: RepositorioDespliegues = {
      crearProyecto: vi.fn().mockResolvedValue(proyectoMock),
      listarProyectos: vi.fn().mockResolvedValue([proyectoMock]),
      obtenerProyectoPorId: vi.fn().mockResolvedValue(proyectoMock),
      obtenerProyectoPorNombreCompleto: vi.fn().mockResolvedValue(proyectoMock),
      actualizarProyecto: vi.fn().mockResolvedValue(proyectoMock),
      actualizarEstadoProyecto: vi.fn().mockResolvedValue(undefined),
      eliminarProyecto: vi.fn().mockResolvedValue(true),
      listarVariables: vi.fn().mockImplementation(async () => vars),
      guardarVariable: vi.fn().mockImplementation(async (_id, clave, valorCifrado) => {
        const nueva: VariableEntornoPersistida = {
          id: 'v1',
          repositorioId: 'p1',
          clave,
          valorCifrado,
          actualizadoEn: '2026-11-26T00:00:00.000Z',
        };
        vars.push(nueva);
        return nueva;
      }),
      eliminarVariable: vi.fn().mockResolvedValue('API_SECRET'),
      registrarDespliegue: vi.fn().mockImplementation(async (d) => {
        const reg: DespliegueRegistro = {
          id: 'd1',
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
          escaneos: [],
          creadoEn: '2026-11-26T00:00:00.000Z',
        };
        despliegues.push(reg);
        return reg;
      }),
      obtenerDesplieguePorId: vi.fn().mockResolvedValue(null),
      listarDespliegues: vi.fn().mockResolvedValue(despliegues),
      listarEscaneosPorDespliegue: vi.fn().mockResolvedValue([]),
    };
    const cifrado: ServicioCifrado = {
      cifrar: (t) => `cifrado(${t})`,
      descifrar: (t) => t.replace(/^cifrado\((.*)\)$/, '$1'),
    };
    const auditoria: RepositorioAuditoria = { registrar: vi.fn().mockResolvedValue(undefined) };

    const casoUso = new GestionarProyectosDespliegue(
      cliente,
      repoGh,
      repoDesp,
      cifrado,
      auditoria,
    );

    const varVista = await casoUso.guardarVariable('p1', 'api_secret', 'super_secreto_123', admin);
    expect(varVista.clave).toBe('API_SECRET');
    expect(varVista.valorEnmascarado).toBe('••••••••');
    expect(JSON.stringify(varVista)).not.toContain('super_secreto_123');
    expect(vars[0].valorCifrado).toBe('cifrado(super_secreto_123)');

    const despliegue = await casoUso.ejecutarDespliegue('p1', admin, 'manual');
    expect(despliegue.estado).toBe('exitoso');
    expect(despliegue.logConstruccion).toContain('API_SECRET');
    expect(despliegue.logConstruccion).not.toContain('super_secreto_123');
  });
});
