import { InvitacionUsuario, RolInvitacion } from '../entidades/InvitacionUsuario';
import { ModuloSistema, RolUsuario, Usuario } from '../entidades/Usuario';

export interface CrearUsuarioDatos {
  nombreUsuario: string;
  hashContrasena: string;
  rol: RolUsuario;
  permisosModulos?: ModuloSistema[];
}

export interface CrearInvitacionDatos {
  tokenHash: string;
  prefijoToken: string;
  rol: RolInvitacion;
  permisosModulos: ModuloSistema[];
  nota: string | null;
  creadoPorId: string;
  expiraEn: Date;
}

export interface IntentoInicioSesionDatos {
  nombreUsuario: string;
  direccionIp: string;
  exitoso: boolean;
}

export interface RepositorioUsuarios {
  buscarPorNombreUsuario(nombreUsuario: string): Promise<Usuario | null>;
  buscarPorId(id: string): Promise<Usuario | null>;
  crear(datos: CrearUsuarioDatos): Promise<Usuario>;
  registrarIntentoInicioSesion(intento: IntentoInicioSesionDatos): Promise<void>;
  contarUsuarios?(): Promise<number>;
  listarTodos?(): Promise<Usuario[]>;
  actualizarAcceso?(id: string, direccionIp: string): Promise<void>;
  actualizarPermisosYRol?(
    id: string,
    rol: RolUsuario,
    permisosModulos: ModuloSistema[],
  ): Promise<Usuario | null>;
  actualizarEstadoActivo?(id: string, activo: boolean): Promise<Usuario | null>;
  actualizarContrasenaYRevocarSesiones?(id: string, hashContrasena: string): Promise<void>;
  incrementarVersionSesion?(id: string): Promise<void>;
  crearInvitacion?(datos: CrearInvitacionDatos): Promise<InvitacionUsuario>;
  listarInvitaciones?(): Promise<InvitacionUsuario[]>;
  buscarInvitacionPorHash?(tokenHash: string): Promise<InvitacionUsuario | null>;
  marcarInvitacionUsada?(id: string, usadoPorId: string): Promise<void>;
  revocarInvitacion?(id: string): Promise<boolean>;
}
