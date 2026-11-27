import { apiCliente } from './apiCliente';
import { ModuloSistema, RolUsuario, UsuarioAutenticado } from './autenticacionServicio';

export type RolInvitacion = Exclude<RolUsuario, 'superadmin'>;

export interface InvitacionUsuarioItem {
  id: string;
  prefijoToken: string;
  rol: RolInvitacion;
  permisosModulos: ModuloSistema[];
  nota: string | null;
  expiraEn: string;
  usadoEn: string | null;
  usadoPorNombre?: string | null;
  revocada: boolean;
  creadoEn: string;
}

export const usuariosServicio = {
  listarUsuarios: (tokenAcceso: string): Promise<{ usuarios: UsuarioAutenticado[] }> =>
    apiCliente.get<{ usuarios: UsuarioAutenticado[] }>('/usuarios', tokenAcceso),

  listarInvitaciones: (tokenAcceso: string): Promise<{ invitaciones: InvitacionUsuarioItem[] }> =>
    apiCliente.get<{ invitaciones: InvitacionUsuarioItem[] }>('/usuarios/invitaciones', tokenAcceso),

  crearInvitacion: (
    datos: {
      rol: RolInvitacion;
      permisosModulos: ModuloSistema[];
      expiraEnHoras: number;
      nota?: string;
    },
    tokenAcceso: string,
  ): Promise<{ invitacion: InvitacionUsuarioItem; tokenPlano: string }> =>
    apiCliente.post<{ invitacion: InvitacionUsuarioItem; tokenPlano: string }>(
      '/usuarios/invitaciones',
      datos,
      tokenAcceso,
    ),

  revocarInvitacion: (id: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(
      `/usuarios/invitaciones/${encodeURIComponent(id)}`,
      tokenAcceso,
    ),

  actualizarPermisos: (
    id: string,
    datos: { rol: RolUsuario; permisosModulos: ModuloSistema[] },
    tokenAcceso: string,
  ): Promise<{ usuario: UsuarioAutenticado }> =>
    apiCliente.put<{ usuario: UsuarioAutenticado }>(
      `/usuarios/${encodeURIComponent(id)}/permisos`,
      datos,
      tokenAcceso,
    ),

  cambiarEstado: (
    id: string,
    activo: boolean,
    tokenAcceso: string,
  ): Promise<{ usuario: UsuarioAutenticado }> =>
    apiCliente.patch<{ usuario: UsuarioAutenticado }>(
      `/usuarios/${encodeURIComponent(id)}/estado`,
      { activo },
      tokenAcceso,
    ),

  revocarSesiones: (id: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.post<{ mensaje: string }>(
      `/usuarios/${encodeURIComponent(id)}/revocar-sesiones`,
      {},
      tokenAcceso,
    ),

  obtenerConfigEditor: (
    tokenAcceso: string,
  ): Promise<{ editor: { url: string; rutaBase: string } }> =>
    apiCliente.get<{ editor: { url: string; rutaBase: string } }>(
      '/configuracion/editor',
      tokenAcceso,
    ),

  guardarConfigEditor: (
    datos: { url: string; rutaBase: string },
    tokenAcceso: string,
  ): Promise<{ editor: { url: string; rutaBase: string } }> =>
    apiCliente.put<{ editor: { url: string; rutaBase: string } }>(
      '/configuracion/editor',
      datos,
      tokenAcceso,
    ),
};
