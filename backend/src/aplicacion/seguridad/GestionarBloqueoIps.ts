import { RolUsuario } from '../../dominio/entidades/Usuario';
import { ErrorPermisosInsuficientes } from '../../dominio/errores/ErroresContenedores';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';
import { RepositorioSeguridad2FA } from '../../dominio/interfaces/RepositorioSeguridad2FA';
import {
  IpBloqueada,
  RepositorioSeguridadRed,
} from '../../dominio/interfaces/RepositorioSeguridadRed';
import { NotificarEvento } from '../notificaciones/NotificarEvento';

export class GestionarBloqueoIps {
  constructor(
    private readonly repositorioSeguridadRed: RepositorioSeguridadRed,
    private readonly repositorioSeguridad2FA: RepositorioSeguridad2FA,
    private readonly repositorioAuditoria: RepositorioAuditoria,
    private readonly notificarEvento: NotificarEvento,
  ) {}

  public async listar(): Promise<IpBloqueada[]> {
    return this.repositorioSeguridadRed.listarIpsBloqueadas();
  }

  public async bloquear(entrada: {
    direccionIp: string;
    motivo: string;
    usuarioId: string;
    nombreUsuario: string;
    rolUsuario: RolUsuario;
    ipOrigenAdmin: string;
  }): Promise<IpBloqueada> {
    if (entrada.rolUsuario !== 'superadmin' && entrada.rolUsuario !== 'administrador') {
      throw new ErrorPermisosInsuficientes();
    }

    const bloqueada = await this.repositorioSeguridadRed.bloquearIp({
      direccionIp: entrada.direccionIp.trim(),
      motivo: entrada.motivo.trim(),
      bloqueadoPor: entrada.nombreUsuario,
    });

    await Promise.all([
      this.repositorioSeguridad2FA.registrarEventoSeguridad({
        tipoEvento: 'ip_bloqueada',
        ipOrigen: bloqueada.direccionIp,
        severidad: 'alta',
        detalles: {
          motivo: bloqueada.motivo,
          bloqueadoPor: entrada.nombreUsuario,
        },
      }),
      this.repositorioAuditoria.registrar({
        usuarioId: entrada.usuarioId,
        accion: 'ip_bloquear',
        recurso: bloqueada.direccionIp,
        origen: 'web',
        direccionIp: entrada.ipOrigenAdmin,
        detalles: { motivo: bloqueada.motivo },
      }),
      this.notificarEvento.emitir({
        tipoEvento: 'ip_bloqueada',
        mensaje: `IP ${bloqueada.direccionIp} bloqueada manualmente por ${entrada.nombreUsuario}. Motivo: ${bloqueada.motivo}`,
      }),
    ]);

    return bloqueada;
  }

  public async desbloquear(entrada: {
    id: string;
    usuarioId: string;
    rolUsuario: RolUsuario;
    ipOrigenAdmin: string;
  }): Promise<void> {
    if (entrada.rolUsuario !== 'superadmin' && entrada.rolUsuario !== 'administrador') {
      throw new ErrorPermisosInsuficientes();
    }

    const eliminada = await this.repositorioSeguridadRed.desbloquearIp(entrada.id);
    if (eliminada) {
      await this.repositorioAuditoria.registrar({
        usuarioId: entrada.usuarioId,
        accion: 'ip_desbloquear',
        recurso: eliminada.direccionIp,
        origen: 'web',
        direccionIp: entrada.ipOrigenAdmin,
      });
    }
  }
}
