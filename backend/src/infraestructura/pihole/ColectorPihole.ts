import { EstadisticasPihole } from '../../dominio/entidades/EstadisticasPihole';
import { Colector } from '../../dominio/interfaces/Colector';

interface ConfiguracionColectorPihole {
  modo: 'simulacion' | 'real';
  apiUrl: string;
  apiPassword?: string;
}

/**
 * Colector Strategy para Pi-hole y dispositivos de red local (RF-10, RF-11).
 * Soporta Pi-hole v6 (/api/auth + /api/stats/*) y fallback a v5 (/summaryRaw) o simulación local.
 */
export class ColectorPihole implements Colector<EstadisticasPihole> {
  public readonly nombre = 'pihole';
  private sidCache: { sid: string; expiraEn: number } | null = null;

  constructor(private readonly config: ConfiguracionColectorPihole) {}

  private async obtenerSidV6(baseUrl: string): Promise<string | null> {
    if (!this.config.apiPassword) return null;
    if (this.sidCache && this.sidCache.expiraEn > Date.now()) {
      return this.sidCache.sid;
    }

    try {
      const resp = await fetch(`${baseUrl}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: this.config.apiPassword }),
        signal: AbortSignal.timeout(4000),
      });
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        session?: { valid?: boolean; sid?: string; validity?: number };
      };
      if (json.session?.valid && json.session.sid) {
        const ttlMs = Math.max(60, (json.session.validity ?? 300) - 30) * 1000;
        this.sidCache = { sid: json.session.sid, expiraEn: Date.now() + ttlMs };
        return json.session.sid;
      }
    } catch {
      return null;
    }
    return null;
  }

  private async recolectarV6(baseUrl: string): Promise<EstadisticasPihole | null> {
    const sid = await this.obtenerSidV6(baseUrl);
    const headers: Record<string, string> = sid ? { sid } : {};

    const [resSummary, resTopPerm, resTopBloq, resClientes, resHist] = await Promise.all([
      fetch(`${baseUrl}/stats/summary`, { headers, signal: AbortSignal.timeout(4000) }),
      fetch(`${baseUrl}/stats/top_domains?count=5`, { headers, signal: AbortSignal.timeout(4000) }).catch(() => null),
      fetch(`${baseUrl}/stats/top_domains?blocked=true&count=5`, { headers, signal: AbortSignal.timeout(4000) }).catch(() => null),
      fetch(`${baseUrl}/stats/top_clients?count=8`, { headers, signal: AbortSignal.timeout(4000) }).catch(() => null),
      fetch(`${baseUrl}/history`, { headers, signal: AbortSignal.timeout(4000) }).catch(() => null),
    ]);

    if (resSummary.status === 401) {
      this.sidCache = null;
      return null;
    }
    if (!resSummary.ok) return null;

    const summary = (await resSummary.json()) as {
      queries?: { total?: number; blocked?: number; percent_blocked?: number };
      gravity?: { domains_being_blocked?: number };
    };

    const topPermJson = resTopPerm?.ok
      ? ((await resTopPerm.json()) as { domains?: Array<{ domain: string; count: number }> })
      : null;
    const topBloqJson = resTopBloq?.ok
      ? ((await resTopBloq.json()) as { domains?: Array<{ domain: string; count: number }> })
      : null;
    const clientesJson = resClientes?.ok
      ? ((await resClientes.json()) as {
          clients?: Array<{ ip: string; name?: string | null; count: number }>;
        })
      : null;
    const histJson = resHist?.ok
      ? ((await resHist.json()) as {
          history?: Array<{ timestamp: number; total: number; blocked: number }>;
        })
      : null;

    const actividadPorHora = (histJson?.history ?? []).slice(-12).map((h) => {
      const d = new Date(h.timestamp * 1000);
      const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const bloqueadas = Number(h.blocked ?? 0);
      const permitidas = Math.max(0, Number(h.total ?? 0) - bloqueadas);
      return { hora, permitidas, bloqueadas };
    });

    const base = this.generarSimulacionLocal();
    return {
      disponible: true,
      modo: 'real',
      estadoProteccion: 'activo',
      consultasTotales24h: Number(summary.queries?.total ?? 0),
      consultasBloqueadas24h: Number(summary.queries?.blocked ?? 0),
      porcentajeBloqueado: Math.round(Number(summary.queries?.percent_blocked ?? 0) * 100) / 100,
      dominiosEnListaNegra: Number(summary.gravity?.domains_being_blocked ?? 0),
      topDominiosPermitidos: (topPermJson?.domains ?? []).map((d) => ({
        dominio: d.domain,
        consultas: Number(d.count ?? 0),
      })),
      topDominiosBloqueados: (topBloqJson?.domains ?? []).map((d) => ({
        dominio: d.domain,
        consultas: Number(d.count ?? 0),
      })),
      clientesRedLocal: (clientesJson?.clients ?? []).map((c) => ({
        ip: c.ip,
        hostname: c.name || c.ip,
        consultas: Number(c.count ?? 0),
        ultimaActividad: 'Activo (24h)',
        estado: 'activo',
      })),
      actividadPorHora: actividadPorHora.length > 0 ? actividadPorHora : base.actividadPorHora,
      actualizadoEn: new Date().toISOString(),
    };
  }

  public async recolectar(): Promise<EstadisticasPihole> {
    if (this.config.modo === 'real') {
      const baseUrl = this.config.apiUrl.replace(/\/+$/, '');
      try {
        const datosV6 = await this.recolectarV6(baseUrl);
        if (datosV6) return datosV6;

        const respuesta = await fetch(`${baseUrl}/summaryRaw`, {
          signal: AbortSignal.timeout(3500),
        });
        if (respuesta.ok) {
          const datos = (await respuesta.json()) as Record<string, unknown>;
          return {
            ...this.generarSimulacionLocal(),
            modo: 'real',
            consultasTotales24h: Number(datos.dns_queries_today ?? 0),
            consultasBloqueadas24h: Number(datos.ads_blocked_today ?? 0),
            porcentajeBloqueado:
              Math.round(Number(datos.ads_percentage_today ?? 0) * 100) / 100,
            dominiosEnListaNegra: Number(datos.domains_being_blocked ?? 0),
            actualizadoEn: new Date().toISOString(),
          };
        }
      } catch {
        // Fallback seguro a simulación si Pi-hole no responde
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
