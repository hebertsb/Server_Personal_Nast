import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PruebaSaludDespliegue } from '../../dominio/reglas/ReporteSaludDespliegue';

const execFileAsync = promisify(execFile);

interface ResultadoSondaHttp {
  alcanzable: boolean;
  codigo: number | null;
  latenciaMs: number;
  error?: string;
}

async function sondearHttp(url: string, timeoutMs = 3500): Promise<ResultadoSondaHttp> {
  const inicio = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      alcanzable: true,
      codigo: res.status,
      latenciaMs: Math.max(1, Date.now() - inicio),
    };
  } catch (err) {
    return {
      alcanzable: false,
      codigo: null,
      latenciaMs: Math.max(1, Date.now() - inicio),
      error: err instanceof Error ? err.message : 'Sin conexión',
    };
  }
}

async function verificarContenedorActivo(nombreContenedor: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['inspect', '--format', '{{.State.Running}}', nombreContenedor],
      { timeout: 5000 },
    );
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Sonda real de salud y seguridad HTTP Antes vs. Después de cada despliegue
 * (Capa de Infraestructura). Valida respuesta web, endpoints /health|/up y
 * que archivos sensibles (/.env, /.git/config) estén bloqueados (403/404).
 */
export class VerificadorSaludDespliegue {
  constructor(private readonly hostDestino: string = 'http://host.docker.internal') {}

  public async verificarAntes(
    puerto: number,
    nombreContenedor: string,
  ): Promise<PruebaSaludDespliegue[]> {
    const pruebas: PruebaSaludDespliegue[] = [];
    const activoPrevio = await verificarContenedorActivo(nombreContenedor);
    pruebas.push({
      prueba: 'Contenedor previo',
      estado: activoPrevio ? 'ok' : 'advertencia',
      detalle: activoPrevio ? `activo (${nombreContenedor})` : 'sin contenedor previo (primer despliegue)',
    });

    const web = await sondearHttp(`${this.hostDestino}:${puerto}/`, 2500);
    if (web.alcanzable && web.codigo !== null && web.codigo < 500) {
      pruebas.push({
        prueba: 'Servidor web',
        estado: 'ok',
        detalle: `responde (${web.codigo} · ${web.latenciaMs}ms)`,
      });
    } else if (!activoPrevio) {
      pruebas.push({
        prueba: 'Servidor web',
        estado: 'advertencia',
        detalle: 'no publicado aún (primer despliegue)',
      });
    } else {
      pruebas.push({
        prueba: 'Servidor web',
        estado: 'error',
        detalle: web.codigo ? `error HTTP ${web.codigo}` : 'sin respuesta previa',
      });
    }

    return pruebas;
  }

  public async verificarDespues(
    puerto: number,
    nombreContenedor: string,
    contenedorCorriendo: boolean,
  ): Promise<PruebaSaludDespliegue[]> {
    const pruebas: PruebaSaludDespliegue[] = [
      {
        prueba: 'Contenedor Docker',
        estado: contenedorCorriendo ? 'ok' : 'error',
        detalle: contenedorCorriendo
          ? `activo (${nombreContenedor})`
          : `detenido tras el arranque (${nombreContenedor})`,
      },
    ];

    if (!contenedorCorriendo) {
      return pruebas;
    }

    // 1. Sonda principal HTTP / (hasta 3 intentos para dar margen de arranque al servicio)
    let web: ResultadoSondaHttp = { alcanzable: false, codigo: null, latenciaMs: 0 };
    for (let intento = 0; intento < 3; intento++) {
      web = await sondearHttp(`${this.hostDestino}:${puerto}/`, 3500);
      if (web.alcanzable && web.codigo !== null && web.codigo < 500) break;
      await new Promise((r) => setTimeout(r, 1500));
    }

    pruebas.push({
      prueba: 'Servidor web (/)',
      estado:
        web.alcanzable && web.codigo !== null && web.codigo < 500
          ? 'ok'
          : 'error',
      detalle:
        web.alcanzable && web.codigo !== null
          ? `responde (${web.codigo} · ${web.latenciaMs}ms)`
          : `sin respuesta (${web.error ?? 'timeout'})`,
    });

    // 2. Endpoint de salud dedicado (/health, /up, /api/health)
    let healthEncontrado: { ruta: string; codigo: number; latenciaMs: number } | null = null;
    for (const ruta of ['/health', '/up', '/api/health']) {
      const s = await sondearHttp(`${this.hostDestino}:${puerto}${ruta}`, 2500);
      if (s.alcanzable && s.codigo !== null && s.codigo >= 200 && s.codigo < 300) {
        healthEncontrado = { ruta, codigo: s.codigo, latenciaMs: s.latenciaMs };
        break;
      }
    }
    pruebas.push(
      healthEncontrado
        ? {
            prueba: `Health check (${healthEncontrado.ruta})`,
            estado: 'ok',
            detalle: `arranca (${healthEncontrado.codigo} · ${healthEncontrado.latenciaMs}ms)`,
          }
        : {
            prueba: 'Health check (/health | /up)',
            estado: 'advertencia',
            detalle: 'sin ruta dedicada (se recomienda exponer /health)',
          },
    );

    // 3. Prueba de seguridad en vivo: /.env y /.git/config NO deben devolver HTTP 200
    for (const archivo of ['/.env', '/.git/config']) {
      const s = await sondearHttp(`${this.hostDestino}:${puerto}${archivo}`, 2500);
      const protegido = !s.alcanzable || (s.codigo !== null && s.codigo !== 200);
      pruebas.push({
        prueba: `Seguridad ${archivo}`,
        estado: protegido ? 'ok' : 'error',
        detalle: protegido
          ? `protegido (${s.codigo ?? 'bloqueado'})`
          : '¡EXPUESTO (HTTP 200)! Bloquea acceso público inmediatamente',
      });
    }

    return pruebas;
  }
}
