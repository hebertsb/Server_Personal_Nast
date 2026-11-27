import { RolUsuario, Usuario } from '../entidades/Usuario';

export interface CrearUsuarioDatos {
  nombreUsuario: string;
  hashContrasena: string;
  rol: RolUsuario;
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
}
