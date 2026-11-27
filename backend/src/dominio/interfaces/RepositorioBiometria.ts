import { CredencialBiometrica } from '../entidades/CredencialBiometrica';

export interface GuardarCredencialBiometricaDatos {
  usuarioId: string;
  credencialId: string;
  clavePublica: string;
  contador: number;
  transports: string[];
  etiquetaDispositivo: string;
}

export interface RepositorioBiometria {
  listarPorUsuario(usuarioId: string): Promise<CredencialBiometrica[]>;
  buscarPorCredencialId(credencialId: string): Promise<CredencialBiometrica | null>;
  guardar(datos: GuardarCredencialBiometricaDatos): Promise<CredencialBiometrica>;
  actualizarContadorYUso(id: string, nuevoContador: number): Promise<void>;
  eliminar(id: string, usuarioId: string): Promise<boolean>;
}
