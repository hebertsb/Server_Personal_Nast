import { apiCliente } from './apiCliente';

export type SeveridadEvento = 'baja' | 'media' | 'alta' | 'critica';

export interface EventoSeguridadItem {
  id: number;
  tipoEvento: string;
  ipOrigen: string;
  severidad: SeveridadEvento;
  detalles: Record<string, unknown>;
  fechaHora: string;
}

export interface RegistroAuditoriaItem {
  id: number;
  usuarioId: string | null;
  nombreUsuario: string | null;
  accion: string;
  recurso: string;
  origen: string;
  direccionIp: string | null;
  detalles: Record<string, unknown>;
  fechaHora: string;
}

export interface IntentoSshFallido {
  ipOrigen: string;
  usuarioIntentado: string;
  puerto: number;
  fechaHora: string;
  lineaCruda: string;
}

export interface HallazgoFuerzaBruta {
  ipOrigen: string;
  totalIntentos: number;
  usuariosIntentados: string[];
  primerIntento: string;
  ultimoIntento: string;
  severidad: 'alta' | 'critica';
}

export interface RespuestaAnalisisSsh {
  intentosFallidos: IntentoSshFallido[];
  hallazgosFuerzaBruta: HallazgoFuerzaBruta[];
  alertasEmitidas: number;
}

export interface IpBloqueadaItem {
  id: string;
  direccionIp: string;
  motivo: string;
  bloqueadoPor: string;
  creadoEn: string;
}

export interface ConfiguracionNotificacionItem {
  id: string;
  tipoEvento: string;
  canal: 'telegram' | 'email' | 'webhook';
  destino: string;
  habilitado: boolean;
}

export interface AlertaEnviadaItem {
  id: number;
  tipoEvento: string;
  mensaje: string;
  canal: 'telegram' | 'email' | 'webhook';
  enviadoEn: string;
}

export interface EstadisticasPihole {
  disponible: boolean;
  modo: 'simulacion_local' | 'real';
  estadoProteccion: 'activo' | 'pausado';
  consultasTotales24h: number;
  consultasBloqueadas24h: number;
  porcentajeBloqueado: number;
  dominiosEnListaNegra: number;
  topDominiosPermitidos: Array<{ dominio: string; consultas: number }>;
  topDominiosBloqueados: Array<{ dominio: string; consultas: number }>;
  clientesRedLocal: Array<{
    ip: string;
    hostname: string;
    consultas: number;
    ultimaActividad: string;
    estado: 'activo' | 'inactivo';
  }>;
  actividadPorHora: Array<{ hora: string; permitidas: number; bloqueadas: number }>;
  actualizadoEn: string;
}

export type VentanaAccesosProyecto = '24h' | '7d' | '30d';

export interface SolicitudProyectoItem {
  id: number;
  nombreProyecto: string;
  ipOrigen: string;
  ruta: string;
  metodo: string;
  codigoEstado: number;
  userAgent: string;
  pais: string | null;
  fechaHora: string;
}

export interface AnaliticaAccesosProyecto {
  proyectosDisponibles: string[];
  resumen: {
    totalVisitas: number;
    visitantesUnicos: number;
    erroresHttp: number;
    proyectoMasActivo: string | null;
  };
  visitasPorProyecto: Array<{
    nombreProyecto: string;
    totalVisitas: number;
    visitantesUnicos: number;
  }>;
  rutasMasSolicitadas: Array<{
    ruta: string;
    metodo: string;
    solicitudes: number;
  }>;
  horariosPico: Array<{
    hora: string;
    solicitudes: number;
    exitosas: number;
    errores: number;
  }>;
  distribucionPaises: Array<{
    pais: string;
    solicitudes: number;
  }>;
  solicitudesRecientes: SolicitudProyectoItem[];
}

export const seguridadServicio = {
  listarEventos: (tokenAcceso: string, limite = 50): Promise<{ eventos: EventoSeguridadItem[] }> =>
    apiCliente.get<{ eventos: EventoSeguridadItem[] }>(
      `/seguridad/eventos?limite=${limite}`,
      tokenAcceso,
    ),

  listarAuditoria: (
    tokenAcceso: string,
    limite = 50,
  ): Promise<{ registros: RegistroAuditoriaItem[] }> =>
    apiCliente.get<{ registros: RegistroAuditoriaItem[] }>(
      `/seguridad/auditoria?limite=${limite}`,
      tokenAcceso,
    ),

  obtenerSsh: (tokenAcceso: string): Promise<RespuestaAnalisisSsh> =>
    apiCliente.get<RespuestaAnalisisSsh>('/seguridad/ssh', tokenAcceso),

  analizarSsh: (tokenAcceso: string): Promise<RespuestaAnalisisSsh> =>
    apiCliente.post<RespuestaAnalisisSsh>('/seguridad/ssh/analizar', undefined, tokenAcceso),

  simularAtaqueSsh: (tokenAcceso: string): Promise<RespuestaAnalisisSsh> =>
    apiCliente.post<RespuestaAnalisisSsh>('/seguridad/ssh/simular', undefined, tokenAcceso),

  listarIpsBloqueadas: (tokenAcceso: string): Promise<{ ips: IpBloqueadaItem[] }> =>
    apiCliente.get<{ ips: IpBloqueadaItem[] }>('/seguridad/ips-bloqueadas', tokenAcceso),

  bloquearIp: (
    datos: { direccionIp: string; motivo: string },
    tokenAcceso: string,
  ): Promise<{ ip: IpBloqueadaItem }> =>
    apiCliente.post<{ ip: IpBloqueadaItem }>('/seguridad/ips-bloqueadas', datos, tokenAcceso),

  desbloquearIp: (id: string, tokenAcceso: string): Promise<{ mensaje: string }> =>
    apiCliente.delete<{ mensaje: string }>(
      `/seguridad/ips-bloqueadas/${encodeURIComponent(id)}`,
      tokenAcceso,
    ),

  listarAlertasNotificaciones: (
    tokenAcceso: string,
  ): Promise<{
    alertas: AlertaEnviadaItem[];
    configuraciones: ConfiguracionNotificacionItem[];
  }> =>
    apiCliente.get<{
      alertas: AlertaEnviadaItem[];
      configuraciones: ConfiguracionNotificacionItem[];
    }>('/notificaciones/alertas', tokenAcceso),

  actualizarConfiguracionNotificacion: (
    datos: {
      tipoEvento: string;
      canal: 'telegram' | 'email' | 'webhook';
      destino: string;
      habilitado: boolean;
    },
    tokenAcceso: string,
  ): Promise<{ configuracion: ConfiguracionNotificacionItem }> =>
    apiCliente.put<{ configuracion: ConfiguracionNotificacionItem }>(
      '/notificaciones/configuracion',
      datos,
      tokenAcceso,
    ),

  probarNotificacion: (
    tokenAcceso: string,
    opciones?: { canal?: 'telegram' | 'email' | 'webhook'; destino?: string },
  ): Promise<{ alerta: AlertaEnviadaItem }> =>
    apiCliente.post<{ alerta: AlertaEnviadaItem }>(
      '/notificaciones/probar',
      opciones ?? { canal: 'telegram' },
      tokenAcceso,
    ),

  obtenerPihole: (tokenAcceso: string): Promise<EstadisticasPihole> =>
    apiCliente.get<EstadisticasPihole>('/red/pihole', tokenAcceso),

  obtenerAnaliticaAccesos: (
    tokenAcceso: string,
    proyecto?: string,
    ventana: VentanaAccesosProyecto = '24h',
  ): Promise<AnaliticaAccesosProyecto> => {
    const params = new URLSearchParams({ ventana });
    if (proyecto && proyecto !== 'todos') {
      params.set('proyecto', proyecto);
    }
    return apiCliente.get<AnaliticaAccesosProyecto>(
      `/accesos-proyectos?${params.toString()}`,
      tokenAcceso,
    );
  },

  simularAccesosProyecto: (tokenAcceso: string): Promise<{ insertados: number }> =>
    apiCliente.post<{ insertados: number }>('/accesos-proyectos/simular', undefined, tokenAcceso),
};
