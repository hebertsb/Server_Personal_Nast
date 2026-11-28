import {
  CicloFacturacion,
  EstadoSolicitudSuscripcion,
  MetodoPagoSuscripcion,
  PlanHosting,
  SolicitudSuscripcion,
} from '../entidades/PlanHosting';

export interface DatosCrearPlan {
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

export interface RepositorioPlanes {
  listarPlanes(soloActivos?: boolean): Promise<PlanHosting[]>;
  obtenerPlanPorId(id: string): Promise<PlanHosting | null>;
  crearPlan(datos: DatosCrearPlan): Promise<PlanHosting>;
  actualizarPlan(id: string, datos: Partial<DatosCrearPlan>): Promise<PlanHosting | null>;
  eliminarPlan(id: string): Promise<boolean>;

  listarSolicitudes(usuarioId?: string): Promise<SolicitudSuscripcion[]>;
  obtenerSolicitudPorId(id: string): Promise<SolicitudSuscripcion | null>;
  crearSolicitud(datos: {
    usuarioId: string;
    nombreUsuario: string;
    planId: string;
    planNombre: string;
    cicloFacturacion: CicloFacturacion;
    montoBs: number;
    metodoPago: MetodoPagoSuscripcion;
    referenciaPago: string;
    notaCliente: string;
  }): Promise<SolicitudSuscripcion>;
  actualizarEstadoSolicitud(
    id: string,
    estado: EstadoSolicitudSuscripcion,
    revisadoPor: string,
  ): Promise<SolicitudSuscripcion | null>;
}
