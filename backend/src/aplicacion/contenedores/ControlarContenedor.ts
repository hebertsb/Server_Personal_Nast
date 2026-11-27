import { AccionContenedor } from '../../dominio/entidades/Contenedor';
import { RolUsuario } from '../../dominio/entidades/Usuario';
import {
  ErrorContenedorNoEncontrado,
  ErrorPermisosInsuficientes,
} from '../../dominio/errores/ErroresContenedores';
import { ControladorDocker } from '../../dominio/interfaces/ControladorDocker';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';

export interface EntradaControlarContenedor {
  contenedorId: string;
  accion: AccionContenedor;
  usuarioId: string;
  rolUsuario: RolUsuario;
  direccionIp: string;
}

export interface ResultadoControlarContenedor {
  contenedorId: string;
  nombre: string;
  accion: AccionContenedor;
  mensaje: string;
}

const MENSAJE_ACCION: Record<AccionContenedor, string> = {
  iniciar: 'Contenedor iniciado correctamente',
  detener: 'Contenedor detenido correctamente',
  reiniciar: 'Contenedor reiniciado correctamente',
};

/**
 * Caso de uso RF-07: valida permisos de administrador, ejecuta start/stop/restart
 * vía el controlador de Docker y registra la acción en la tabla inmutable de auditoría.
 */
export class ControlarContenedor {
  constructor(
    private readonly controladorDocker: ControladorDocker,
    private readonly repositorioAuditoria: RepositorioAuditoria,
  ) {}

  public async ejecutar(
    entrada: EntradaControlarContenedor,
  ): Promise<ResultadoControlarContenedor> {
    if (entrada.rolUsuario !== 'administrador') {
      throw new ErrorPermisosInsuficientes();
    }

    const contenedor = await this.controladorDocker.obtenerPorId(entrada.contenedorId);
    if (!contenedor) {
      throw new ErrorContenedorNoEncontrado(entrada.contenedorId);
    }

    await this.controladorDocker.ejecutarAccion(contenedor.id, entrada.accion);

    await this.repositorioAuditoria.registrar({
      usuarioId: entrada.usuarioId,
      accion: `contenedor_${entrada.accion}`,
      recurso: contenedor.nombre,
      origen: 'web',
      direccionIp: entrada.direccionIp,
      detalles: {
        contenedorId: contenedor.idCorto,
        imagen: contenedor.imagen,
        estadoPrevio: contenedor.estado,
      },
    });

    return {
      contenedorId: contenedor.id,
      nombre: contenedor.nombre,
      accion: entrada.accion,
      mensaje: MENSAJE_ACCION[entrada.accion],
    };
  }
}
