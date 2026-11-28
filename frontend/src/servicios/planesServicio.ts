import { apiCliente } from './apiCliente';

export type MetodoPagoSuscripcion = 'qr' | 'transferencia' | 'efectivo';
export type EstadoSolicitudSuscripcion = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
export type CicloFacturacion = 'mensual' | 'anual';

export interface PlanHostingItem {
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
}

export interface ConfiguracionCobroItem {
  habilitarQr: boolean;
  habilitarTransferencia: boolean;
  habilitarEfectivo: boolean;
  banco: string;
  titular: string;
  numeroCuenta: string;
  qrImagenDataUrl: string;
  instrucciones: string;
}

export interface SolicitudSuscripcionItem {
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
}

export interface RecomendacionPlanIa {
  precioSugeridoBs: number;
  descripcionSugerida: string;
  beneficiosSugeridos: string[];
  consejoComercial: string;
}

export const planesServicio = {
  listarPlanesPublicos: (): Promise<{ planes: PlanHostingItem[] }> =>
    apiCliente.get<{ planes: PlanHostingItem[] }>('/planes/publicos'),

  listarPlanes: (tokenAcceso: string): Promise<{ planes: PlanHostingItem[] }> =>
    apiCliente.get<{ planes: PlanHostingItem[] }>('/planes', tokenAcceso),

  crearPlan: (
    datos: Omit<PlanHostingItem, 'id'>,
    tokenAcceso: string,
  ): Promise<{ plan: PlanHostingItem }> =>
    apiCliente.post<{ plan: PlanHostingItem }>('/planes', datos, tokenAcceso),

  actualizarPlan: (
    id: string,
    datos: Omit<PlanHostingItem, 'id'>,
    tokenAcceso: string,
  ): Promise<{ plan: PlanHostingItem }> =>
    apiCliente.put<{ plan: PlanHostingItem }>(
      `/planes/${encodeURIComponent(id)}`,
      datos,
      tokenAcceso,
    ),

  eliminarPlan: (id: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(`/planes/${encodeURIComponent(id)}`, tokenAcceso),

  recomendarConIa: (
    datos: {
      nombre: string;
      cuotaRamMb: number;
      cuotaCpu: number;
      maxProyectos: number;
      iaBasicaHabilitada: boolean;
    },
    tokenAcceso: string,
  ): Promise<{ recomendacion: RecomendacionPlanIa }> =>
    apiCliente.post<{ recomendacion: RecomendacionPlanIa }>(
      '/planes/recomendar-ia',
      datos,
      tokenAcceso,
    ),

  obtenerCobro: (tokenAcceso: string): Promise<{ cobro: ConfiguracionCobroItem }> =>
    apiCliente.get<{ cobro: ConfiguracionCobroItem }>('/planes/cobro', tokenAcceso),

  guardarCobro: (
    datos: ConfiguracionCobroItem,
    tokenAcceso: string,
  ): Promise<{ cobro: ConfiguracionCobroItem }> =>
    apiCliente.put<{ cobro: ConfiguracionCobroItem }>('/planes/cobro', datos, tokenAcceso),

  leerQrOcr: (
    imagenDataUrl: string,
    tokenAcceso: string,
  ): Promise<{
    datos: { banco: string; titular: string; numeroCuenta: string; textoDetectado: string };
  }> =>
    apiCliente.post<{
      datos: { banco: string; titular: string; numeroCuenta: string; textoDetectado: string };
    }>('/planes/cobro/ocr', { imagenDataUrl }, tokenAcceso),

  listarSolicitudes: (
    tokenAcceso: string,
  ): Promise<{ solicitudes: SolicitudSuscripcionItem[] }> =>
    apiCliente.get<{ solicitudes: SolicitudSuscripcionItem[] }>('/planes/solicitudes', tokenAcceso),

  crearSolicitud: (
    datos: {
      planId: string;
      cicloFacturacion: CicloFacturacion;
      metodoPago: MetodoPagoSuscripcion;
      referenciaPago: string;
      notaCliente: string;
    },
    tokenAcceso: string,
  ): Promise<{ solicitud: SolicitudSuscripcionItem }> =>
    apiCliente.post<{ solicitud: SolicitudSuscripcionItem }>(
      '/planes/solicitudes',
      datos,
      tokenAcceso,
    ),

  revisarSolicitud: (
    id: string,
    decision: 'aprobada' | 'rechazada',
    tokenAcceso: string,
  ): Promise<{ solicitud: SolicitudSuscripcionItem }> =>
    apiCliente.patch<{ solicitud: SolicitudSuscripcionItem }>(
      `/planes/solicitudes/${encodeURIComponent(id)}/revisar`,
      { decision },
      tokenAcceso,
    ),

  cancelarSolicitud: (
    id: string,
    tokenAcceso: string,
  ): Promise<{ solicitud: SolicitudSuscripcionItem }> =>
    apiCliente.patch<{ solicitud: SolicitudSuscripcionItem }>(
      `/planes/solicitudes/${encodeURIComponent(id)}/cancelar`,
      {},
      tokenAcceso,
    ),
};
