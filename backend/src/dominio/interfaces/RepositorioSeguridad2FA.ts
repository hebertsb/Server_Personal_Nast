export interface DispositivoConfiable {
  id: string;
  usuarioId: string;
  etiquetaDispositivo: string;
  ultimaIp: string;
  confiableHasta: string;
  creadoEn: string;
}

export interface CodigoRecuperacionRegistro {
  id: string;
  hashCodigo: string;
}

export type SeveridadEvento = 'baja' | 'media' | 'alta' | 'critica';

export interface NuevoEventoSeguridad {
  tipoEvento: string;
  ipOrigen: string;
  severidad: SeveridadEvento;
  detalles?: Record<string, unknown>;
}

export interface RepositorioSeguridad2FA {
  guardarSecretoTotp(
    usuarioId: string,
    secretoCifrado: string,
    habilitado: boolean,
  ): Promise<void>;
  desactivarTotp(usuarioId: string): Promise<void>;
  reemplazarCodigosRecuperacion(usuarioId: string, hashes: string[]): Promise<void>;
  listarCodigosRecuperacionDisponibles(usuarioId: string): Promise<CodigoRecuperacionRegistro[]>;
  marcarCodigoRecuperacionUsado(codigoId: string): Promise<void>;
  buscarDispositivoConfiableVigente(
    usuarioId: string,
    huellaDispositivo: string,
  ): Promise<DispositivoConfiable | null>;
  guardarDispositivoConfiable(datos: {
    usuarioId: string;
    huellaDispositivo: string;
    etiquetaDispositivo: string;
    ultimaIp: string;
    confiableHasta: Date;
  }): Promise<void>;
  listarDispositivosConfiables(usuarioId: string): Promise<DispositivoConfiable[]>;
  revocarDispositivoConfiable(usuarioId: string, dispositivoId: string): Promise<boolean>;
  registrarEventoSeguridad(evento: NuevoEventoSeguridad): Promise<void>;
}
