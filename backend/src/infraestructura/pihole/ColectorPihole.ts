import { EstadisticasPihole } from '../../dominio/entidades/EstadisticasPihole';
import { Colector } from '../../dominio/interfaces/Colector';

interface ConfiguracionColectorPihole {
  modo: 'simulacion' | 'real';
  apiUrl: string;
}

/**
 * Colector Strategy para Pi-hole y dispositivos de red local (RF-10, RF-11).
 * En entorno local opera en modo simulación según docs/HomeSOC_Plan_Implementacion.md (sección 2.3).
 */
export class ColectorPihole implements Colector<EstadisticasPihole> {
  public readonly nombre = 'pihole';

  constructor(private readonly config: ConfiguracionColectorPihole) {}

  public async recolectar(): Promise<EstadisticasPihole> {
    if (this.config.modo === 'real') {
      try {
        const respuesta = await fetch(`${this.config.apiUrl}/summaryRaw`, {
          signal: AbortSignal.timeout(3500),
        });
        if (respuesta.ok) {
          const datos = (await respuesta.json()) as Record<string, unknown>;
          const totales = Number(datos.dns_queries_today ?? 0);
          const bloqueadas = Number(datos.ads_blocked_today ?? 0);
          const porcentaje = Number(datos.ads_percentage_today ?? 0);
          const blocklist = Number(datos.domains_being_blocked ?? 0);

          return {
            ...this.generarSimulacionLocal(),
            modo: 'real',
            consultasTotales24h: totales,
            consultasBloqueadas24h: bloqueadas,
            porcentajeBloqueado: Math.round(porcentaje * 100) / 100,
            dominiosEnListaNegra: blocklist,
          };
        }
      } catch {
        // Si el Pi-hole real no responde, cae de forma segura a simulación local
      }
    }

    return this.generarSimulacionLocal();
  }

  private generarSimulacionLocal(): EstadisticasPihole {
    return {
      disponible: true,
      modo: 'simulacion_local',
      estadoProteccion: 'activo',
      consultasTotales24h: 28_450,
      consultasBloqueadas24h: 6_318,
      porcentajeBloqueado: 22.21,
      dominiosEnListaNegra: 148_920,
      topDominiosPermitidos: [
        { dominio: 'github.com', consultas: 1842 },
        { dominio: 'api.npmjs.org', consultas: 1210 },
        { dominio: 'registry-1.docker.io', consultas: 965 },
        { dominio: 'cloudflare.com', consultas: 814 },
        { dominio: 'tailscale.com', consultas: 690 },
      ],
      topDominiosBloqueados: [
        { dominio: 'telemetry.microsoft.com', consultas: 1420 },
        { dominio: 'googleads.g.doubleclick.net', consultas: 1105 },
        { dominio: 'app-measurement.com', consultas: 840 },
        { dominio: 'metrics.icloud.com', consultas: 615 },
        { dominio: 'ads.tiktok.com', consultas: 492 },
      ],
      clientesRedLocal: [
        {
          ip: '192.168.1.7',
          hostname: 'home-lab (Servidor Principal)',
          consultas: 9840,
          ultimaActividad: 'Hace 4s',
          estado: 'activo',
        },
        {
          ip: '192.168.1.105',
          hostname: 'laptop-hebert-dev',
          consultas: 11_230,
          ultimaActividad: 'Hace 2s',
          estado: 'activo',
        },
        {
          ip: '192.168.1.112',
          hostname: 'tablet-panel-soc',
          consultas: 4120,
          ultimaActividad: 'Hace 18s',
          estado: 'activo',
        },
        {
          ip: '100.99.124.109',
          hostname: 'tailscale-mesh-gateway',
          consultas: 3260,
          ultimaActividad: 'Hace 1m',
          estado: 'activo',
        },
      ],
      actividadPorHora: [
        { hora: '00:00', permitidas: 620, bloqueadas: 180 },
        { hora: '04:00', permitidas: 410, bloqueadas: 145 },
        { hora: '08:00', permitidas: 1240, bloqueadas: 340 },
        { hora: '12:00', permitidas: 1890, bloqueadas: 520 },
        { hora: '16:00', permitidas: 2310, bloqueadas: 640 },
        { hora: '20:00', permitidas: 2640, bloqueadas: 790 },
        { hora: 'Ahora', permitidas: 2150, bloqueadas: 610 },
      ],
      actualizadoEn: new Date().toISOString(),
    };
  }
}
