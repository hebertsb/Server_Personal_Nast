export type MetodoPagoSuscripcion = 'qr' | 'transferencia' | 'efectivo';
export type EstadoSolicitudSuscripcion = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

export interface PlanHosting {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precioBs: number;
  periodo: string;
  cuotaRamMb: number;
  cuotaCpu: number;
  maxProyectos: number;
  iaBasicaHabilitada: boolean;
  beneficios: string[];
  destacado: boolean;
  activo: boolean;
  orden: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface SolicitudSuscripcion {
  id: string;
  usuarioId: string;
  nombreUsuario: string;
  planId: string;
  planNombre: string;
  montoBs: number;
  metodoPago: MetodoPagoSuscripcion;
  referenciaPago: string;
  notaCliente: string;
  estado: EstadoSolicitudSuscripcion;
  revisadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ConfiguracionCobro {
  habilitarQr: boolean;
  habilitarTransferencia: boolean;
  habilitarEfectivo: boolean;
  banco: string;
  titular: string;
  numeroCuenta: string;
  qrImagenDataUrl: string;
  instrucciones: string;
}
