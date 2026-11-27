export type ModoGithub = 'real' | 'simulacion';

/** Conexión con GitHub visible para el usuario (nunca incluye el token). */
export interface ConexionGithub {
  usuarioGithub: string;
  alcances: string;
  modo: ModoGithub;
  conectadoEn: string;
  actualizadoEn: string;
}

/** Conexión completa tal como se persiste (token cifrado). Uso interno de la capa de aplicación. */
export interface ConexionGithubPersistida extends ConexionGithub {
  usuarioId: string;
  tokenCifrado: string;
}

export interface PerfilGithub {
  usuario: string;
  alcances: string;
}

export interface RepositorioGithub {
  id: number;
  nombre: string;
  nombreCompleto: string;
  privado: boolean;
  descripcion: string | null;
  ramaPrincipal: string;
  lenguaje: string | null;
  ultimoCommit: {
    sha: string;
    mensaje: string;
    fecha: string;
  } | null;
  urlHtml: string;
}
