import { ConexionGithubPersistida } from '../entidades/Github';

export interface RepositorioConexionGithub {
  guardar(conexion: {
    usuarioId: string;
    usuarioGithub: string;
    tokenCifrado: string;
    alcances: string;
    modo: 'real' | 'simulacion';
  }): Promise<ConexionGithubPersistida>;
  obtenerPorUsuario(usuarioId: string): Promise<ConexionGithubPersistida | null>;
  eliminar(usuarioId: string): Promise<boolean>;
}
