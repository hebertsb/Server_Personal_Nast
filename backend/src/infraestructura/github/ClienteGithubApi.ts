import { ModoGithub, PerfilGithub, RepositorioGithub } from '../../dominio/entidades/Github';
import {
  ErrorGithubNoDisponible,
  ErrorGithubTokenInvalido,
} from '../../dominio/errores/ErroresGithub';
import { ClienteGithub } from '../../dominio/interfaces/ClienteGithub';

const URL_API = 'https://api.github.com';
const TIMEOUT_MS = 8000;

interface RepoApi {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  language: string | null;
  html_url: string;
}

interface CommitApi {
  sha: string;
  commit: { message: string; author?: { date?: string } };
}

/** Cliente real de la API REST de GitHub (usa fetch nativo, sin dependencias externas). */
export class ClienteGithubApi implements ClienteGithub {
  public readonly modo: ModoGithub = 'real';

  private cabeceras(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'HomeSOC',
    };
  }

  private async solicitar(ruta: string, token: string): Promise<Response> {
    try {
      return await fetch(`${URL_API}${ruta}`, {
        headers: this.cabeceras(token),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ErrorGithubNoDisponible();
    }
  }

  public async validarToken(token: string): Promise<PerfilGithub> {
    const respuesta = await this.solicitar('/user', token);
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorGithubTokenInvalido();
    }
    if (!respuesta.ok) {
      throw new ErrorGithubNoDisponible();
    }
    const datos = (await respuesta.json()) as { login: string };
    return {
      usuario: datos.login,
      alcances: respuesta.headers.get('x-oauth-scopes') ?? '',
    };
  }

  public async listarRepositorios(token: string): Promise<RepositorioGithub[]> {
    const respuesta = await this.solicitar(
      '/user/repos?per_page=30&sort=pushed&affiliation=owner,collaborator,organization_member',
      token,
    );
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorGithubTokenInvalido();
    }
    if (!respuesta.ok) {
      throw new ErrorGithubNoDisponible();
    }

    const repos = (await respuesta.json()) as RepoApi[];

    return Promise.all(
      repos.map(async (repo): Promise<RepositorioGithub> => {
        let ultimoCommit: RepositorioGithub['ultimoCommit'] = null;
        try {
          const resCommit = await this.solicitar(
            `/repos/${repo.full_name}/commits?per_page=1&sha=${encodeURIComponent(repo.default_branch)}`,
            token,
          );
          if (resCommit.ok) {
            const commits = (await resCommit.json()) as CommitApi[];
            const primero = commits[0];
            if (primero) {
              ultimoCommit = {
                sha: primero.sha.slice(0, 7),
                mensaje: primero.commit.message.split('\n')[0].slice(0, 120),
                fecha: primero.commit.author?.date ?? '',
              };
            }
          }
        } catch {
          ultimoCommit = null;
        }
        return {
          id: repo.id,
          nombre: repo.name,
          nombreCompleto: repo.full_name,
          privado: repo.private,
          descripcion: repo.description,
          ramaPrincipal: repo.default_branch,
          lenguaje: repo.language,
          ultimoCommit,
          urlHtml: repo.html_url,
        };
      }),
    );
  }

  public async listarArchivosRaiz(
    token: string,
    nombreCompleto: string,
    rama: string,
  ): Promise<string[]> {
    const respuesta = await this.solicitar(
      `/repos/${nombreCompleto}/contents?ref=${encodeURIComponent(rama)}`,
      token,
    );
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorGithubTokenInvalido();
    }
    if (!respuesta.ok) {
      return [];
    }
    const items = (await respuesta.json()) as Array<{ name?: string }>;
    return Array.isArray(items)
      ? items.map((i) => i.name ?? '').filter(Boolean)
      : [];
  }
}
