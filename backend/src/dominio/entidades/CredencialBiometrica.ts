export interface CredencialBiometrica {
  id: string;
  usuarioId: string;
  credencialId: string;
  clavePublica: string;
  contador: number;
  transports: string[];
  etiquetaDispositivo: string;
  ultimoUsoEn: Date | null;
  creadoEn: Date;
}

export interface CredencialBiometricaPublica {
  id: string;
  etiquetaDispositivo: string;
  transports: string[];
  ultimoUsoEn: Date | null;
  creadoEn: Date;
}
