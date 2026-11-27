import fs from 'node:fs/promises';
import { Colector } from '../../dominio/interfaces/Colector';
import { IntentoSshFallido } from '../../dominio/reglas/PoliticaBloqueoFuerzaBruta';

const REGEX_LINEA_SSH =
  /^(\S+|\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+\S+\s+sshd\[\d+\]:\s+Failed password for (?:invalid user )?(\S+) from ([0-9a-fA-F.:]+) port (\d+)/;

function normalizarFechaLinea(marca: string): string {
  const intentoIso = Date.parse(marca);
  if (Number.isFinite(intentoIso)) {
    return new Date(intentoIso).toISOString();
  }
  const conAnioActual = Date.parse(`${marca} ${new Date().getUTCFullYear()} UTC`);
  if (Number.isFinite(conAnioActual)) {
    return new Date(conAnioActual).toISOString();
  }
  return new Date().toISOString();
}

/** Parseador puro de líneas de OpenSSH (exportado para pruebas unitarias directas). */
export function parsearLineasAuthLog(contenido: string): IntentoSshFallido[] {
  const lineas = contenido.replace(/\r\n/g, '\n').split('\n');
  const intentos: IntentoSshFallido[] = [];

  for (const linea of lineas) {
    const limpia = linea.trim();
    if (!limpia || !limpia.includes('Failed password for')) continue;

    const match = limpia.match(REGEX_LINEA_SSH);
    if (!match) continue;

    const [, marcaTiempo, usuarioIntentado, ipOrigen, puertoStr] = match;
    intentos.push({
      ipOrigen,
      usuarioIntentado,
      puerto: Number(puertoStr),
      fechaHora: normalizarFechaLinea(marcaTiempo),
      lineaCruda: limpia,
    });
  }

  return intentos.sort((a, b) => Date.parse(b.fechaHora) - Date.parse(a.fechaHora));
}

/**
 * Colector Strategy (RF-12): lee el archivo auth.log configurado (fixture local en dev)
 * y extrae todos los intentos de inicio de sesión SSH fallidos.
 */
export class ColectorAuthLog implements Colector<IntentoSshFallido[]> {
  public readonly nombre = 'auth_log_ssh';

  constructor(private readonly rutaArchivo: string) {}

  public async recolectar(): Promise<IntentoSshFallido[]> {
    try {
      const contenido = await fs.readFile(this.rutaArchivo, 'utf8');
      return parsearLineasAuthLog(contenido);
    } catch {
      return [];
    }
  }

  /** Agrega una ráfaga simulada de 6 intentos SSH fallidos al fixture local (solo uso en dev). */
  public async simularRafagaLocal(ipAtacante = '198.51.100.77'): Promise<void> {
    const usuarios = ['root', 'admin', 'ubuntu', 'deploy', 'postgres', 'git'];
    const baseMs = Date.now();
    const nuevasLineas = usuarios
      .map((usr, idx) => {
        const ts = new Date(baseMs + idx * 1000).toISOString();
        const puerto = 48000 + idx;
        return `${ts} homesoc-local sshd[${3100 + idx}]: Failed password for invalid user ${usr} from ${ipAtacante} port ${puerto} ssh2`;
      })
      .join('\n');

    await fs.appendFile(this.rutaArchivo, `\n${nuevasLineas}\n`, 'utf8');
  }
}
