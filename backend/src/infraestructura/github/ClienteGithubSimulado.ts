import { ModoGithub, PerfilGithub, RepositorioGithub } from '../../dominio/entidades/Github';
import { ClienteGithub } from '../../dominio/interfaces/ClienteGithub';

/**
 * Cliente de simulación para desarrollo local: acepta cualquier token con formato válido
 * y devuelve repositorios ficticios. Evita usar credenciales reales en la laptop de desarrollo.
 */
export class ClienteGithubSimulado implements ClienteGithub {
  public readonly modo: ModoGithub = 'simulacion';

  public async validarToken(_token: string): Promise<PerfilGithub> {
    return { usuario: 'hebert-dev (simulado)', alcances: 'repo, admin:repo_hook' };
  }

  public async listarRepositorios(_token: string): Promise<RepositorioGithub[]> {
    const ahora = Date.now();
    const hace = (horas: number) => new Date(ahora - horas * 3_600_000).toISOString();
    return [
      {
        id: 1001,
        nombre: 'barberapp',
        nombreCompleto: 'hebert-dev/barberapp',
        privado: true,
        descripcion: 'Sistema de reservas para barberías',
        ramaPrincipal: 'main',
        lenguaje: 'TypeScript',
        ultimoCommit: { sha: 'a1b2c3d', mensaje: 'feat: confirmar reservas por WhatsApp', fecha: hace(3) },
        urlHtml: 'https://github.com/hebert-dev/barberapp',
      },
      {
        id: 1002,
        nombre: 'portafolio-personal',
        nombreCompleto: 'hebert-dev/portafolio-personal',
        privado: false,
        descripcion: 'Sitio web de portafolio (HTML estático)',
        ramaPrincipal: 'main',
        lenguaje: 'HTML',
        ultimoCommit: { sha: 'e4f5a6b', mensaje: 'docs: agregar proyecto HomeSOC', fecha: hace(30) },
        urlHtml: 'https://github.com/hebert-dev/portafolio-personal',
      },
      {
        id: 1003,
        nombre: 'api-facturacion',
        nombreCompleto: 'hebert-dev/api-facturacion',
        privado: true,
        descripcion: 'API REST de facturación con Dockerfile',
        ramaPrincipal: 'develop',
        lenguaje: 'Python',
        ultimoCommit: { sha: '9c8d7e6', mensaje: 'fix: redondeo de impuestos', fecha: hace(75) },
        urlHtml: 'https://github.com/hebert-dev/api-facturacion',
      },
      {
        id: 1004,
        nombre: 'landing-node',
        nombreCompleto: 'hebert-dev/landing-node',
        privado: false,
        descripcion: 'Landing con Express (Node.js sin Dockerfile)',
        ramaPrincipal: 'main',
        lenguaje: 'JavaScript',
        ultimoCommit: null,
        urlHtml: 'https://github.com/hebert-dev/landing-node',
      },
    ];
  }

  public async listarArchivosRaiz(
    _token: string,
    nombreCompleto: string,
    _rama: string,
  ): Promise<string[]> {
    const clave = nombreCompleto.toLowerCase();
    if (clave.includes('api-facturacion') || clave.includes('barberapp')) {
      return ['Dockerfile', 'package.json', 'src', 'README.md'];
    }
    if (clave.includes('portafolio')) {
      return ['index.html', 'styles.css', 'assets', 'README.md'];
    }
    if (clave.includes('landing-node')) {
      return ['package.json', 'server.js', 'README.md'];
    }
    return ['package.json', 'README.md'];
  }
}
