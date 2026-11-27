import { ModuloSistema, RolUsuario } from './Usuario';

export type RolInvitacion = Exclude<RolUsuario, 'superadmin'>;

export interface InvitacionUsuario {
  id: string;
  prefijoToken: string;
  rol: RolInvitacion;
  permisosModulos: ModuloSistema[];
  nota: string | null;
  creadoPorId: string | null;
  expiraEn: Date;
  usadoEn: Date | null;
  usadoPorId: string | null;
  usadoPorNombre?: string | null;
  revocada: boolean;
  creadoEn: Date;
}
