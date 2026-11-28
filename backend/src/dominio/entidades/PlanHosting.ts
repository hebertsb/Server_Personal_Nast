export type MetodoPagoSuscripcion = 'qr' | 'transferencia' | 'efectivo';
export type EstadoSolicitudSuscripcion = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
export type CicloFacturacion = 'mensual' | 'anual';

export interface PlanHosting {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precioBs: number;
  descuentoAnualPct: number;
  periodo: string;
  cuotaRamMb: number;
  cuotaCpu: number;
  maxProyectos: number;
  maxMiembros: number;
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
  cicloFacturacion: CicloFacturacion;
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

export type TemaVisualOferta = 'azul_neon' | 'fuego_naranja' | 'esmeralda_soc' | 'purpura_ia';

export interface OfertaBannerPlan {
  id: string;
  etiqueta: string;
  titulo: string;
  subtitulo: string;
  descuentoTexto: string;
  temaVisual: TemaVisualOferta;
  imagenFondoDataUrl: string;
  fechaFinIso: string;
  textoBoton: string;
  activa: boolean;
}
