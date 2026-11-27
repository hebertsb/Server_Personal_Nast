import { describe, expect, it, vi } from 'vitest';
import { GestionarAccesosProyecto } from '../../../src/aplicacion/accesos/GestionarAccesosProyecto';
import { RepositorioAccesosProyecto } from '../../../src/dominio/interfaces/RepositorioAccesosProyecto';
import { estimarPaisPorIp } from '../../../src/dominio/reglas/GeolocalizadorIpBestEffort';

describe('Fase 2 — Geolocalización best-effort y analítica de accesos por proyecto', () => {
  it('clasifica IPs locales, Tailscale y públicas sin consultar servicios externos', () => {
    expect(estimarPaisPorIp('192.168.1.105')).toBe('LAN Local');
    expect(estimarPaisPorIp('100.99.124.109')).toBe('Tailscale Mesh');
    expect(estimarPaisPorIp('181.115.140.22')).toBe('BO');
    expect(estimarPaisPorIp('186.136.80.19')).toBe('AR');
    expect(estimarPaisPorIp('9.9.9.9', 'cl')).toBe('CL');
  });

  it('normaliza proyecto/método, resuelve país y filtra analítica cuando el proyecto es específico', async () => {
    const repo: RepositorioAccesosProyecto = {
      registrarSolicitud: vi.fn().mockImplementation(async (d) => ({
        id: 1,
        ...d,
        pais: d.pais ?? null,
        fechaHora: '2026-11-26T18:00:00.000Z',
      })),
      registrarLote: vi.fn().mockResolvedValue(5),
      obtenerAnalitica: vi.fn().mockResolvedValue({
        proyectosDisponibles: ['barberapp'],
        resumen: {
          totalVisitas: 10,
          visitantesUnicos: 4,
          erroresHttp: 1,
          proyectoMasActivo: 'barberapp',
        },
        visitasPorProyecto: [
          { nombreProyecto: 'barberapp', totalVisitas: 10, visitantesUnicos: 4 },
        ],
        rutasMasSolicitadas: [{ ruta: '/api/reservas', metodo: 'POST', solicitudes: 6 }],
        horariosPico: [{ hora: '18:00', solicitudes: 10, exitosas: 9, errores: 1 }],
        distribucionPaises: [{ pais: 'BO', solicitudes: 10 }],
        solicitudesRecientes: [],
      }),
    };

    const casoUso = new GestionarAccesosProyecto(repo);

    const registrada = await casoUso.registrar({
      nombreProyecto: ' BarberApp ',
      ipOrigen: '181.115.140.10',
      ruta: '/turnos',
      metodo: 'get',
      codigoEstado: 200,
      userAgent: 'Mozilla/5.0',
    });

    expect(registrada.nombreProyecto).toBe('barberapp');
    expect(registrada.metodo).toBe('GET');
    expect(registrada.pais).toBe('BO');

    await casoUso.consultarAnalitica({
      proyecto: 'todos',
      ventana: '24h',
      limite: 50,
    });
    expect(repo.obtenerAnalitica).toHaveBeenCalledWith({
      proyecto: undefined,
      ventana: '24h',
      limite: 50,
    });
  });
});
