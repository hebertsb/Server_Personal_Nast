import { describe, expect, it, vi } from 'vitest';
import { GestionarPortafolioProyectos } from '../../../src/aplicacion/portafolio/GestionarPortafolioProyectos';
import { Contenedor } from '../../../src/dominio/entidades/Contenedor';
import { ControladorDocker } from '../../../src/dominio/interfaces/ControladorDocker';
import { RepositorioPortafolio } from '../../../src/dominio/interfaces/RepositorioPortafolio';

describe('GestionarPortafolioProyectos', () => {
  it('agrupa consumo de RAM por proyecto y detecta falta de Landing Page y pendientes', async () => {
    const repoMock: RepositorioPortafolio = {
      listarProyectos: vi.fn().mockResolvedValue([
        {
          id: 'p1',
          nombre: 'Synexoria',
          descripcion: 'Plataforma web',
          prefijoContenedor: 'synexoria',
          estado: 'en_desarrollo',
          repositorioUrl: '',
          creadoPor: 'Hebert',
          creadoEn: '2026-11-27T00:00:00Z',
          actualizadoEn: '2026-11-27T00:00:00Z',
        },
      ]),
      obtenerProyectoPorId: vi.fn().mockResolvedValue({
        id: 'p1',
        nombre: 'Synexoria',
        descripcion: '',
        prefijoContenedor: 'synexoria',
        estado: 'en_desarrollo',
        repositorioUrl: '',
        creadoPor: 'Hebert',
        creadoEn: '2026-11-27T00:00:00Z',
        actualizadoEn: '2026-11-27T00:00:00Z',
      }),
      crearProyecto: vi.fn(),
      actualizarProyecto: vi.fn(),
      eliminarProyecto: vi.fn(),
      listarComponentes: vi.fn().mockResolvedValue([
        {
          id: 'c1',
          proyectoId: 'p1',
          tipo: 'sistema',
          nombre: 'Web Principal',
          url: 'https://synexoria.local',
          contenedorNombre: 'synexoria-web',
          estadoManual: 'activo',
          responsable: 'Hebert',
          actualizadoEn: '2026-11-27T00:00:00Z',
        },
      ]),
      crearComponente: vi.fn(),
      actualizarComponente: vi.fn(),
      eliminarComponente: vi.fn(),
      listarTareas: vi.fn().mockResolvedValue([
        {
          id: 't1',
          proyectoId: 'p1',
          titulo: 'Subir Landing Page',
          estado: 'pendiente',
          prioridad: 'alta',
          asignadoA: 'Colaborador',
          actualizadoPor: 'Hebert',
          creadoEn: '2026-11-27T00:00:00Z',
          actualizadoEn: '2026-11-27T00:00:00Z',
        },
      ]),
      crearTarea: vi.fn(),
      actualizarTarea: vi.fn(),
      eliminarTarea: vi.fn(),
    };

    const contenedores: Contenedor[] = [
      {
        id: '1',
        idCorto: '1',
        nombre: 'synexoria-web',
        imagen: 'synexoria:web',
        estado: 'running',
        estadoDetalle: 'Up',
        puertos: ['3000'],
        porcentajeCpu: 1.2,
        ramUsadaMb: 125.5,
        ramLimiteMb: 1024,
        creadoEn: '2026-11-27T00:00:00Z',
      },
      {
        id: '2',
        idCorto: '2',
        nombre: 'synexoria-api',
        imagen: 'synexoria:api',
        estado: 'running',
        estadoDetalle: 'Up',
        puertos: ['4000'],
        porcentajeCpu: 0.8,
        ramUsadaMb: 110.5,
        ramLimiteMb: 1024,
        creadoEn: '2026-11-27T00:00:00Z',
      },
    ];

    const dockerMock: ControladorDocker = {
      nombre: 'docker-mock',
      recolectar: vi.fn().mockResolvedValue(contenedores),
      ejecutarAccion: vi.fn(),
      obtenerLogs: vi.fn(),
    };

    const casoUso = new GestionarPortafolioProyectos(repoMock, dockerMock);
    const resumen = await casoUso.obtenerResumenCompleto();

    expect(resumen.totalProyectos).toBe(1);
    expect(resumen.proyectosAMedias).toBe(1);
    expect(resumen.tareasPendientes).toBe(1);
    expect(resumen.proyectos[0].ramTotalMb).toBe(236);
    expect(resumen.proyectos[0].tieneLanding).toBe(false);
    expect(resumen.proyectos[0].avisos).toContain('Sin Landing Page activa');
  });
});
