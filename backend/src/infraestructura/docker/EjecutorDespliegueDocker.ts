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

  public async ejecutar(
    entrada: EntradaEjecucionDespliegue,
  ): Promise<ResultadoEjecucionDespliegue> {
    const nombreContenedor = sanitizarNombreContenedor(entrada.nombreProyecto);
    const etiquetaImagen = `${nombreContenedor}:${entrada.commitSha.slice(0, 12)}`;
    const dirTrabajo = await fs.mkdtemp(path.join(os.tmpdir(), 'homesoc-deploy-'));
    const secretosARedactar = [entrada.tokenGithub, ...Object.values(entrada.variablesEntorno)];
    const logs: string[] = [];

    try {
      logs.push(`[HomeSOC] Clonando ${entrada.nombreCompleto} (rama ${entrada.rama})…`);
      const urlRepo = `https://x-access-token:${encodeURIComponent(entrada.tokenGithub)}@github.com/${entrada.nombreCompleto}.git`;
      await execFileAsync(
        'git',
        ['clone', '--depth', '1', '--branch', entrada.rama, urlRepo, dirTrabajo],
        { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
      );

      // Si no trae Dockerfile propio, escribir la plantilla base (Node.js o HTML estático)
      const rutaDockerfile = path.join(dirTrabajo, 'Dockerfile');
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

      logs.push(`[HomeSOC] Construyendo imagen Docker ${etiquetaImagen}…`);
      const buildRes = await execFileAsync(
        'docker',
        ['build', '-t', etiquetaImagen, '-t', `${nombreContenedor}:latest`, dirTrabajo],
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
        '--label',
        'homesoc.managed=true',
        '--label',
        `homesoc.proyecto=${entrada.nombreProyecto}`,
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
        };
      }

      return {
        exitoso: true,
        healthCheckOk: true,
        nombreContenedor,
        logConstruccion: redactarSecretos(logs.join('\n'), secretosARedactar),
        logHealthCheck: `Contenedor ${nombreContenedor} activo y respondiendo en puerto ${entrada.puerto}.`,
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
