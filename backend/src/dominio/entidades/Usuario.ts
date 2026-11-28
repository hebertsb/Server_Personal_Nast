export type RolUsuario = 'superadmin' | 'administrador' | 'colaborador' | 'solo_lectura';

export type ModuloSistema =
  | 'recursos'
  | 'servicios'
  | 'red'
  | 'seguridad'
  | 'automatizacion'
  | 'configuracion'
  | 'usuarios'
  | 'ia';

export const MODULOS_SISTEMA: readonly ModuloSistema[] = [
  'recursos',
  'servicios',
  'red',
  'seguridad',
  'automatizacion',
  'configuracion',
  'usuarios',
  'ia',
] as const;

export const PERMISOS_POR_DEFECTO_ROL: Record<RolUsuario, ModuloSistema[]> = {
  superadmin: [...MODULOS_SISTEMA],
  administrador: [
    'recursos',
    'servicios',
    'red',
    'seguridad',
    'automatizacion',
    'configuracion',
    'ia',
  ],
  colaborador: ['recursos', 'servicios', 'ia'],
  solo_lectura: ['recursos', 'servicios', 'red'],
};

export interface PropiedadesUsuario {
  id: string;
  nombreUsuario: string;
  hashContrasena: string;
  rol: RolUsuario;
  secretoTotp: string | null;
  totpHabilitado: boolean;
  creadoEn: Date;
  activo?: boolean;
  permisosModulos?: ModuloSistema[];
  ultimoAccesoEn?: Date | null;
  ultimaIpAcceso?: string | null;
  versionSesion?: number;
  telegramChatId?: string;
  whatsappNumero?: string;
  planNombre?: string;
  cuotaRamMb?: number;
  cuotaCpu?: number;
  maxProyectos?: number;
  iaBasicaHabilitada?: boolean;
}

export interface PerfilUsuarioPublico {
  id: string;
  nombreUsuario: string;
  rol: RolUsuario;
  totpHabilitado: boolean;
  creadoEn: Date;
  activo: boolean;
  permisosModulos: ModuloSistema[];
  ultimoAccesoEn: Date | null;
  ultimaIpAcceso: string | null;
  telegramChatId: string;
  whatsappNumero: string;
  planNombre: string;
  cuotaRamMb: number;
  cuotaCpu: number;
  maxProyectos: number;
  iaBasicaHabilitada: boolean;
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
  public readonly activo: boolean;
  public readonly permisosModulos: ModuloSistema[];
  public readonly ultimoAccesoEn: Date | null;
  public readonly ultimaIpAcceso: string | null;
  public readonly versionSesion: number;
  public readonly telegramChatId: string;
  public readonly whatsappNumero: string;
  public readonly planNombre: string;
  public readonly cuotaRamMb: number;
  public readonly cuotaCpu: number;
  public readonly maxProyectos: number;
  public readonly iaBasicaHabilitada: boolean;

  constructor(props: PropiedadesUsuario) {
    this.id = props.id;
    this.nombreUsuario = props.nombreUsuario;
    this.hashContrasena = props.hashContrasena;
    this.rol = props.rol;
    this.secretoTotp = props.secretoTotp;
    this.totpHabilitado = props.totpHabilitado;
    this.creadoEn = props.creadoEn;
    this.activo = props.activo ?? true;
    this.permisosModulos =
      props.permisosModulos && props.permisosModulos.length > 0
        ? props.permisosModulos
        : [...PERMISOS_POR_DEFECTO_ROL[props.rol]];
    this.ultimoAccesoEn = props.ultimoAccesoEn ?? null;
    this.ultimaIpAcceso = props.ultimaIpAcceso ?? null;
    this.versionSesion = props.versionSesion ?? 1;
    this.telegramChatId = props.telegramChatId ?? '';
    this.whatsappNumero = props.whatsappNumero ?? '';
    this.planNombre = props.planNombre ?? (props.rol === 'superadmin' ? 'ilimitado' : 'basico');
    this.cuotaRamMb = props.cuotaRamMb ?? (props.rol === 'superadmin' ? 4096 : 512);
    this.cuotaCpu = props.cuotaCpu ?? (props.rol === 'superadmin' ? 4 : 0.75);
    this.maxProyectos = props.maxProyectos ?? (props.rol === 'superadmin' ? 50 : 2);
    this.iaBasicaHabilitada = props.iaBasicaHabilitada ?? props.rol === 'superadmin';
  }

  /** Indica si el usuario puede acceder a un módulo específico. */
  public tienePermisoModulo(modulo: ModuloSistema): boolean {
    if (this.rol === 'superadmin') return true;
    return this.permisosModulos.includes(modulo);
  }

  /** Devuelve únicamente los campos seguros para enviar al cliente. */
  public aPerfilPublico(): PerfilUsuarioPublico {
    return {
      id: this.id,
      nombreUsuario: this.nombreUsuario,
      rol: this.rol,
      totpHabilitado: this.totpHabilitado,
      creadoEn: this.creadoEn,
      activo: this.activo,
      permisosModulos:
        this.rol === 'superadmin' ? [...MODULOS_SISTEMA] : [...this.permisosModulos],
      ultimoAccesoEn: this.ultimoAccesoEn,
      ultimaIpAcceso: this.ultimaIpAcceso,
      telegramChatId: this.telegramChatId,
      whatsappNumero: this.whatsappNumero,
      planNombre: this.planNombre,
      cuotaRamMb: this.cuotaRamMb,
      cuotaCpu: this.cuotaCpu,
      maxProyectos: this.maxProyectos,
      iaBasicaHabilitada: this.iaBasicaHabilitada,
    };
  }
}
