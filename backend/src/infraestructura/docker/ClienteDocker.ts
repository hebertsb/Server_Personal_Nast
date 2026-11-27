import Docker from 'dockerode';

export class ClienteDocker {
  private readonly docker: Docker;

  constructor(socketPath = '/var/run/docker.sock') {
    this.docker = new Docker({ socketPath });
  }

  /** Comprueba si el socket local de Docker responde correctamente. */
  public async verificarConexion(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }
}
