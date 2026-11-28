export interface IpBloqueada {
  id: string;
  direccionIp: string;
  motivo: string;
  bloqueadoPor: string;
  creadoEn: string;
}

export type CanalNotificacion = 'telegram' | 'email' | 'webhook';

export interface ConfiguracionNotificacion {
  id: string;
  tipoEvento: string;
  canal: CanalNotificacion;
  destino: string;
  habilitado: boolean;
}

export interface AlertaEnviada {
  id: number;
  tipoEvento: string;
  mensaje: string;
  canal: CanalNotificacion;
  enviadoEn: string;
}

export interface DestinatarioNotificacion {
  nombre: string;
  telegramChatId?: string;
  whatsappNumero?: string;
}

export interface NotificadorCanal {
  readonly canal: CanalNotificacion;
  enviar(
    destino: string,
    mensaje: string,
    destinatario?: DestinatarioNotificacion,
  ): Promise<{ enviado: boolean; modo: 'real' | 'simulado'; detalle?: string }>;
}

export interface RepositorioSeguridadRed {
  listarIpsBloqueadas(): Promise<IpBloqueada[]>;
  bloquearIp(datos: {
    direccionIp: string;
    motivo: string;
    bloqueadoPor: string;
  }): Promise<IpBloqueada>;
  desbloquearIp(id: string): Promise<IpBloqueada | null>;
  listarConfiguracionNotificaciones(): Promise<ConfiguracionNotificacion[]>;
  actualizarConfiguracionNotificacion(datos: {
    tipoEvento: string;
    canal: CanalNotificacion;
    destino: string;
    habilitado: boolean;
  }): Promise<ConfiguracionNotificacion>;
  registrarAlertaEnviada(datos: {
    tipoEvento: string;
    mensaje: string;
    canal: CanalNotificacion;
  }): Promise<AlertaEnviada>;
  listarAlertasEnviadas(limite: number): Promise<AlertaEnviada[]>;
}
