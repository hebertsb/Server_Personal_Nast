import { ModoGithub, PerfilGithub, RepositorioGithub } from '../entidades/Github';

/** Puerto hacia la API de GitHub (Strategy: real vs. simulación local). */
export interface ClienteGithub {
  readonly modo: ModoGithub;
  /** Valida el token y devuelve el perfil asociado. Lanza ErrorGithubTokenInvalido si no sirve. */
  validarToken(token: string): Promise<PerfilGithub>;
  listarRepositorios(token: string): Promise<RepositorioGithub[]>;
  /** Lista nombres de archivos/carpetas en la raíz del repositorio para auto-detección (RF-31). */
  listarArchivosRaiz(token: string, nombreCompleto: string, rama: string): Promise<string[]>;
}
