export type RolUsuario = 'administrador' | 'solo_lectura';

export interface PropiedadesUsuario {
  id: string;
  nombreUsuario: string;
  hashContrasena: string;
  rol: RolUsuario;
  secretoTotp: string | null;
  totpHabilitado: boolean;
  creadoEn: Date;
}

export interface PerfilUsuarioPublico {
  id: string;
  nombreUsuario: string;
  rol: RolUsuario;
  totpHabilitado: boolean;
  creadoEn: Date;
}

/**
 * Entidad de dominio que representa un usuario de HomeSOC.
 * Nunca expone hash de contraseña ni secreto TOTP hacia capas externas.
 */
export class Usuario {
  public readonly id: string;
  public readonly nombreUsuario: string;
  public readonly hashContrasena: string;
  public readonly rol: RolUsuario;
  public readonly secretoTotp: string | null;
  public readonly totpHabilitado: boolean;
  public readonly creadoEn: Date;

  constructor(props: PropiedadesUsuario) {
    this.id = props.id;
    this.nombreUsuario = props.nombreUsuario;
    this.hashContrasena = props.hashContrasena;
    this.rol = props.rol;
    this.secretoTotp = props.secretoTotp;
    this.totpHabilitado = props.totpHabilitado;
    this.creadoEn = props.creadoEn;
  }

  /** Devuelve únicamente los campos seguros para enviar al cliente. */
  public aPerfilPublico(): PerfilUsuarioPublico {
    return {
      id: this.id,
      nombreUsuario: this.nombreUsuario,
      rol: this.rol,
      totpHabilitado: this.totpHabilitado,
      creadoEn: this.creadoEn,
    };
  }
}
