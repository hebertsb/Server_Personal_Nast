import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  EjecutorDespliegue,
  EntradaEjecucionDespliegue,
  ResultadoEjecucionDespliegue,
} from '../../dominio/interfaces/EjecutorDespliegue';
import { VerificadorSaludDespliegue } from './VerificadorSaludDespliegue';

const execFileAsync = promisify(execFile);

function sanitizarNombreContenedor(nombre: string): string {
  const limpio = nombre.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48);
  return `homesoc-app-${limpio || 'servicio'}`;
}

function redactarSecretos(texto: string, secretos: string[]): string {
  let resultado = texto;
  for (const s of secretos) {
    if (s && s.length >= 6) {
      resultado = resultado.split(s).join('***');
    }
  }
  return resultado;
}

/**
 * Ejecutor real de despliegues Docker (Capa de Infraestructura):
 * clona el repositorio con el token OAuth/PAT sin registrarlo en logs,
 * construye la imagen con Dockerfile (o plantilla base) e inyecta variables
 * descifradas solo por entorno del subproceso (nunca en argumentos visibles).
 */
export class EjecutorDespliegueDocker implements EjecutorDespliegue {
  public readonly modo = 'real' as const;
  private readonly verificadorSalud = new VerificadorSaludDespliegue();

  public async ejecutar(
    entrada: EntradaEjecucionDespliegue,
  ): Promise<ResultadoEjecucionDespliegue> {
    const nombreContenedor = sanitizarNombreContenedor(entrada.nombreProyecto);
    const etiquetaImagen = `${nombreContenedor}:${entrada.commitSha.slice(0, 12)}`;
    const dirTrabajo = await fs.mkdtemp(path.join(os.tmpdir(), 'homesoc-deploy-'));
    const secretosARedactar = [entrada.tokenGithub, ...Object.values(entrada.variablesEntorno)];
    const logs: string[] = [];

    // Sonda ANTES del despliegue (comparativa de salud previa)
    const pruebasAntes = await this.verificadorSalud.verificarAntes(
      entrada.puerto,
      nombreContenedor,
    );

    try {
      logs.push(`[HomeSOC] Clonando ${entrada.nombreCompleto} (rama ${entrada.rama})…`);
      const urlRepo = `https://x-access-token:${encodeURIComponent(entrada.tokenGithub)}@github.com/${entrada.nombreCompleto}.git`;
      await execFileAsync(
        'git',
        ['clone', '--depth', '1', '--branch', entrada.rama, urlRepo, dirTrabajo],
        { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
      );

      // Resolver carpeta raíz (soporte para monorepos/microservicios sin path traversal)
      const carpetaLimpia = (entrada.carpetaRaiz ?? '/').replace(/^\/+|\/+$/g, '');
      const dirRaizResuelto = path.resolve(dirTrabajo);
      const dirContexto = carpetaLimpia
        ? path.resolve(dirRaizResuelto, carpetaLimpia)
        : dirRaizResuelto;
      if (
        dirContexto !== dirRaizResuelto &&
        !dirContexto.startsWith(`${dirRaizResuelto}${path.sep}`)
      ) {
        throw new Error('Carpeta raíz inválida (fuera del repositorio).');
      }

      // Si no trae Dockerfile propio, escribir la plantilla base (Node.js o HTML estático)
      const rutaDockerfile = path.join(dirContexto, 'Dockerfile');
      let tieneDockerfile = true;
      try {
        await fs.access(rutaDockerfile);
      } catch {
        tieneDockerfile = false;
      }

      if (!tieneDockerfile && entrada.plantillaDockerfile) {
        await fs.writeFile(rutaDockerfile, entrada.plantillaDockerfile, 'utf8');
        logs.push(`[HomeSOC] Plantilla Dockerfile generada automáticamente (${entrada.tipoProyecto}).`);
      }

      logs.push(
        `[HomeSOC] Construyendo imagen Docker ${etiquetaImagen} (carpeta: /${carpetaLimpia})…`,
      );
      const buildRes = await execFileAsync(
        'docker',
        ['build', '-t', etiquetaImagen, '-t', `${nombreContenedor}:latest`, dirContexto],
        { timeout: 300_000, maxBuffer: 8 * 1024 * 1024 },
      );
      if (buildRes.stdout) logs.push(buildRes.stdout.slice(-2000));
      if (buildRes.stderr) logs.push(buildRes.stderr.slice(-1500));

      // Reemplazar únicamente el contenedor previo administrado por HomeSOC (prefijo homesoc-app-)
      await execFileAsync('docker', ['rm', '-f', nombreContenedor], { timeout: 30_000 }).catch(
        () => {},
      );

      const puertoContenedor =
        entrada.tipoProyecto === 'html_estatico' ? 80 : entrada.puerto;

      const argsRun: string[] = [
        'run',
        '-d',
        '--name',
        nombreContenedor,
        '--restart',
        'unless-stopped',
        '--memory',
        '512m',
        '--cpus',
        '0.75',
        '--pids-limit',
        '128',
        '--security-opt',
        'no-new-privileges:true',
        '--label',
        'homesoc.managed=true',
        '--label',
        `homesoc.proyecto=${entrada.nombreProyecto}`,
        ...(entrada.subdominio
          ? ['--label', `homesoc.subdominio=${entrada.subdominio}`]
          : []),
        '-p',
        `${entrada.puerto}:${puertoContenedor}`,
        '-e',
        `PORT=${puertoContenedor}`,
      ];

      // Pasar únicamente los NOMBRES de variables en argv; los valores entran vía env del proceso
      const envSubproceso: NodeJS.ProcessEnv = { ...process.env };
      for (const [clave, valor] of Object.entries(entrada.variablesEntorno)) {
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(clave)) {
          argsRun.push('-e', clave);
          envSubproceso[clave] = valor;
        }
      }

      argsRun.push(etiquetaImagen);

      logs.push(
        `[HomeSOC] Iniciando contenedor ${nombreContenedor} en puerto ${entrada.puerto} (variables inyectadas: ${Object.keys(entrada.variablesEntorno).length})…`,
      );
      const runRes = await execFileAsync('docker', argsRun, {
        env: envSubproceso,
        timeout: 60_000,
      });
      logs.push(`[HomeSOC] Contenedor iniciado: ${runRes.stdout.trim().slice(0, 12)}`);

      // Health check real: verificar que el contenedor sigue en ejecución tras 3s
      await new Promise((r) => setTimeout(r, 3000));
      const inspectRes = await execFileAsync(
        'docker',
        ['inspect', '--format', '{{.State.Running}}', nombreContenedor],
        { timeout: 10_000 },
      );
      const corriendo = inspectRes.stdout.trim() === 'true';

      const pruebasDespues = await this.verificadorSalud.verificarDespues(
        entrada.puerto,
        nombreContenedor,
        corriendo,
      );

      if (!corriendo) {
        const logsContenedor = await execFileAsync(
          'docker',
          ['logs', '--tail', '30', nombreContenedor],
          { timeout: 10_000 },
        ).catch(() => ({ stdout: '', stderr: '' }));
        logs.push('[HomeSOC] El contenedor se detuvo al arrancar:');
        logs.push((logsContenedor.stderr || logsContenedor.stdout || 'Sin salida').slice(-1500));
        return {
          exitoso: false,
          healthCheckOk: false,
          nombreContenedor,
          logConstruccion: redactarSecretos(logs.join('\n'), secretosARedactar),
          logHealthCheck: `Contenedor ${nombreContenedor} detenido inesperadamente tras el arranque.`,
          pruebasAntes,
          pruebasDespues,
        };
      }

      const fallaCritica = pruebasDespues.some((p) => p.estado === 'error');
      return {
        exitoso: true,
        healthCheckOk: !fallaCritica,
        nombreContenedor,
        logConstruccion: redactarSecretos(logs.join('\n'), secretosARedactar),
        logHealthCheck: fallaCritica
          ? `Contenedor ${nombreContenedor} activo en puerto ${entrada.puerto}, pero se detectaron fallos en las pruebas post-despliegue.`
          : `Contenedor ${nombreContenedor} activo y verificado en puerto ${entrada.puerto}.`,
        pruebasAntes,
        pruebasDespues,
      };
    } catch (error) {
      const detalle =
        error instanceof Error
          ? `${error.message}\n${(error as { stderr?: string }).stderr ?? ''}`
          : String(error);
      logs.push(`[HomeSOC] Error durante el despliegue: ${detalle.slice(-1800)}`);
      return {
        exitoso: false,
        healthCheckOk: false,
        nombreContenedor,
        logConstruccion: redactarSecretos(logs.join('\n'), secretosARedactar),
        logHealthCheck: 'No se completó el build/arranque del contenedor.',
      };
    } finally {
      await fs.rm(dirTrabajo, { recursive: true, force: true }).catch(() => {});
    }
  }
}
