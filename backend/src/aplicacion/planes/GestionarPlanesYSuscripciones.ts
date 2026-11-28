import {
  CicloFacturacion,
  ConfiguracionCobro,
  MetodoPagoSuscripcion,
  PlanHosting,
  SolicitudSuscripcion,
} from '../../dominio/entidades/PlanHosting';
import { RolUsuario } from '../../dominio/entidades/Usuario';
import { ErrorDominio } from '../../dominio/errores/ErroresAutenticacion';
import { RepositorioAuditoria } from '../../dominio/interfaces/RepositorioAuditoria';
import {
  DatosCrearPlan,
  RepositorioPlanes,
} from '../../dominio/interfaces/RepositorioPlanes';
import { RepositorioUsuarios } from '../../dominio/interfaces/RepositorioUsuarios';
import { AsistenteIA } from '../ia/AsistenteIA';
import { NotificarEvento } from '../notificaciones/NotificarEvento';

const CONFIG_COBRO_DEFECTO: ConfiguracionCobro = {
  habilitarQr: true,
  habilitarTransferencia: true,
  habilitarEfectivo: true,
  banco: '',
  titular: '',
  numeroCuenta: '',
  qrImagenDataUrl: '',
  instrucciones:
    'Escanea el QR o realiza la transferencia indicando tu nombre de usuario en el concepto, luego registra tu número de referencia para activar tu plan.',
};

export class GestionarPlanesYSuscripciones {
  constructor(
    private readonly repoPlanes: RepositorioPlanes,
    private readonly repoUsuarios: RepositorioUsuarios,
    private readonly auditoria: RepositorioAuditoria,
    private readonly notificarEvento?: NotificarEvento,
    private readonly asistenteIA?: AsistenteIA,
  ) {}

  public async listarPlanes(soloActivos: boolean): Promise<PlanHosting[]> {
    return this.repoPlanes.listarPlanes(soloActivos);
  }

  public async crearPlan(
    datos: DatosCrearPlan,
    actor: { usuarioId: string; rol: RolUsuario; direccionIp: string },
  ): Promise<PlanHosting> {
    if (actor.rol !== 'superadmin') {
      throw new ErrorDominio('PERMISOS_INSUFICIENTES', 'Solo el superadmin puede crear planes', 403);
    }
    const creado = await this.repoPlanes.crearPlan(datos);
    await this.auditoria.registrar({
      usuarioId: actor.usuarioId,
      accion: 'plan_crear',
      recurso: `plan:${creado.codigo}`,
      origen: 'web',
      direccionIp: actor.direccionIp,
      detalles: { nombre: creado.nombre, precioBs: creado.precioBs, ramMb: creado.cuotaRamMb },
    });
    return creado;
  }

  public async actualizarPlan(
    id: string,
    datos: Partial<DatosCrearPlan>,
    actor: { usuarioId: string; rol: RolUsuario; direccionIp: string },
  ): Promise<PlanHosting> {
    if (actor.rol !== 'superadmin') {
      throw new ErrorDominio('PERMISOS_INSUFICIENTES', 'Solo el superadmin puede editar planes', 403);
    }
    const actualizado = await this.repoPlanes.actualizarPlan(id, datos);
    if (!actualizado) {
      throw new ErrorDominio('PLAN_NO_ENCONTRADO', 'Plan no encontrado', 404);
    }
    await this.auditoria.registrar({
      usuarioId: actor.usuarioId,
      accion: 'plan_actualizar',
      recurso: `plan:${actualizado.codigo}`,
      origen: 'web',
      direccionIp: actor.direccionIp,
      detalles: { precioBs: actualizado.precioBs, ramMb: actualizado.cuotaRamMb },
    });
    return actualizado;
  }

  public async eliminarPlan(
    id: string,
    actor: { usuarioId: string; rol: RolUsuario; direccionIp: string },
  ): Promise<void> {
    if (actor.rol !== 'superadmin') {
      throw new ErrorDominio('PERMISOS_INSUFICIENTES', 'Solo el superadmin puede eliminar planes', 403);
    }
    await this.repoPlanes.eliminarPlan(id);
    await this.auditoria.registrar({
      usuarioId: actor.usuarioId,
      accion: 'plan_eliminar',
      recurso: `plan:${id}`,
      origen: 'web',
      direccionIp: actor.direccionIp,
      detalles: {},
    });
  }

  public async obtenerConfigCobro(): Promise<ConfiguracionCobro> {
    if (!this.repoUsuarios.obtenerPreferencia) return { ...CONFIG_COBRO_DEFECTO };
    const pref = await this.repoUsuarios.obtenerPreferencia('cobro_suscripciones');
    if (!pref) return { ...CONFIG_COBRO_DEFECTO };
    return {
      habilitarQr: typeof pref.habilitarQr === 'boolean' ? pref.habilitarQr : true,
      habilitarTransferencia:
        typeof pref.habilitarTransferencia === 'boolean' ? pref.habilitarTransferencia : true,
      habilitarEfectivo:
        typeof pref.habilitarEfectivo === 'boolean' ? pref.habilitarEfectivo : true,
      banco: typeof pref.banco === 'string' ? pref.banco : '',
      titular: typeof pref.titular === 'string' ? pref.titular : '',
      numeroCuenta: typeof pref.numeroCuenta === 'string' ? pref.numeroCuenta : '',
      qrImagenDataUrl: typeof pref.qrImagenDataUrl === 'string' ? pref.qrImagenDataUrl : '',
      instrucciones:
        typeof pref.instrucciones === 'string' && pref.instrucciones.trim()
          ? pref.instrucciones
          : CONFIG_COBRO_DEFECTO.instrucciones,
    };
  }

  public async guardarConfigCobro(
    config: ConfiguracionCobro,
    actor: { usuarioId: string; rol: RolUsuario; direccionIp: string },
  ): Promise<ConfiguracionCobro> {
    if (actor.rol !== 'superadmin') {
      throw new ErrorDominio(
        'PERMISOS_INSUFICIENTES',
        'Solo el superadmin puede configurar los métodos de cobro',
        403,
      );
    }
    if (this.repoUsuarios.guardarPreferencia) {
      await this.repoUsuarios.guardarPreferencia('cobro_suscripciones', { ...config });
    }
    await this.auditoria.registrar({
      usuarioId: actor.usuarioId,
      accion: 'cobro_config_actualizar',
      recurso: 'preferencias_sistema:cobro_suscripciones',
      origen: 'web',
      direccionIp: actor.direccionIp,
      detalles: {
        habilitarQr: config.habilitarQr,
        habilitarTransferencia: config.habilitarTransferencia,
        habilitarEfectivo: config.habilitarEfectivo,
        tieneQr: Boolean(config.qrImagenDataUrl),
      },
    });
    return config;
  }

  public async listarSolicitudes(actor: {
    usuarioId: string;
    rol: RolUsuario;
  }): Promise<SolicitudSuscripcion[]> {
    if (actor.rol === 'superadmin') {
      return this.repoPlanes.listarSolicitudes();
    }
    return this.repoPlanes.listarSolicitudes(actor.usuarioId);
  }

  public async crearSolicitud(
    entrada: {
      planId: string;
      cicloFacturacion?: CicloFacturacion;
      metodoPago: MetodoPagoSuscripcion;
      referenciaPago: string;
      notaCliente: string;
    },
    actor: { usuarioId: string; nombreUsuario: string; direccionIp: string },
  ): Promise<SolicitudSuscripcion> {
    const plan = await this.repoPlanes.obtenerPlanPorId(entrada.planId);
    if (!plan || !plan.activo) {
      throw new ErrorDominio('PLAN_NO_DISPONIBLE', 'El plan seleccionado no está disponible', 404);
    }

    const ciclo: CicloFacturacion = entrada.cicloFacturacion === 'anual' ? 'anual' : 'mensual';
    const descuentoPct = Math.max(0, Math.min(80, plan.descuentoAnualPct ?? 20));
    const montoBs =
      ciclo === 'anual'
        ? Math.round(plan.precioBs * 12 * (1 - descuentoPct / 100))
        : plan.precioBs;

    const solicitud = await this.repoPlanes.crearSolicitud({
      usuarioId: actor.usuarioId,
      nombreUsuario: actor.nombreUsuario,
      planId: plan.id,
      planNombre: plan.nombre,
      cicloFacturacion: ciclo,
      montoBs,
      metodoPago: entrada.metodoPago,
      referenciaPago: entrada.referenciaPago.trim(),
      notaCliente: entrada.notaCliente.trim(),
    });

    const etiquetaCiclo =
      ciclo === 'anual' ? `Anual (-${descuentoPct}% desc.)` : `Mensual (${plan.periodo})`;

    await this.notificarEvento?.emitir({
      tipoEvento: 'portafolio_actualizacion',
      mensaje: `💳 Nueva solicitud de suscripción\nCliente: ${actor.nombreUsuario}\nPlan: ${plan.nombre} • ${etiquetaCiclo}\nMonto: Bs ${montoBs}\nMétodo: ${entrada.metodoPago.toUpperCase()}${
        entrada.referenciaPago ? `\nReferencia: ${entrada.referenciaPago}` : ''
      }${entrada.notaCliente ? `\nNota: ${entrada.notaCliente}` : ''}\nRevisa HomeSOC → Planes y Suscripción para aprobar en 1 clic.`,
    });

    return solicitud;
  }

  public async revisarSolicitud(
    solicitudId: string,
    decision: 'aprobada' | 'rechazada',
    actor: { usuarioId: string; nombreUsuario: string; rol: RolUsuario; direccionIp: string },
  ): Promise<SolicitudSuscripcion> {
    if (actor.rol !== 'superadmin') {
      throw new ErrorDominio(
        'PERMISOS_INSUFICIENTES',
        'Solo el superadmin puede aprobar o rechazar pagos',
        403,
      );
    }
    const solicitud = await this.repoPlanes.obtenerSolicitudPorId(solicitudId);
    if (!solicitud) {
      throw new ErrorDominio('SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada', 404);
    }

    const actualizada = await this.repoPlanes.actualizarEstadoSolicitud(
      solicitudId,
      decision,
      actor.nombreUsuario,
    );
    if (!actualizada) {
      throw new ErrorDominio('SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada', 404);
    }

    const cliente = await this.repoUsuarios.buscarPorId(solicitud.usuarioId).catch(() => null);

    if (decision === 'aprobada') {
      const plan = await this.repoPlanes.obtenerPlanPorId(solicitud.planId);
      if (plan && this.repoUsuarios.actualizarPlanCuota) {
        await this.repoUsuarios.actualizarPlanCuota(solicitud.usuarioId, {
          planNombre: plan.codigo,
          cuotaRamMb: plan.cuotaRamMb,
          cuotaCpu: plan.cuotaCpu,
          maxProyectos: plan.maxProyectos,
          iaBasicaHabilitada: plan.iaBasicaHabilitada,
        });
      }
    }

    await this.notificarEvento?.emitir({
      tipoEvento: 'portafolio_actualizacion',
      mensaje:
        decision === 'aprobada'
          ? `✅ ¡Pago aprobado! Tu plan "${solicitud.planNombre}" ya está activo en HomeSOC.`
          : `❌ Tu solicitud para "${solicitud.planNombre}" fue marcada como rechazada. Contacta al administrador.`,
      destinatario: cliente
        ? {
            nombre: cliente.nombreUsuario,
            telegramChatId: cliente.telegramChatId || undefined,
            whatsappNumero: cliente.whatsappNumero || undefined,
          }
        : undefined,
    });

    await this.auditoria.registrar({
      usuarioId: actor.usuarioId,
      accion: `suscripcion_${decision}`,
      recurso: `solicitud:${solicitudId}`,
      origen: 'web',
      direccionIp: actor.direccionIp,
      detalles: { cliente: solicitud.nombreUsuario, plan: solicitud.planNombre, montoBs: solicitud.montoBs },
    });

    return actualizada;
  }

  public async cancelarMiSolicitud(
    solicitudId: string,
    actor: { usuarioId: string; nombreUsuario: string },
  ): Promise<SolicitudSuscripcion> {
    const solicitud = await this.repoPlanes.obtenerSolicitudPorId(solicitudId);
    if (!solicitud || solicitud.usuarioId !== actor.usuarioId) {
      throw new ErrorDominio('SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada', 404);
    }
    if (solicitud.estado !== 'pendiente') {
      throw new ErrorDominio('ESTADO_INVALIDO', 'Solo puedes cancelar solicitudes pendientes', 400);
    }
    const cancelada = await this.repoPlanes.actualizarEstadoSolicitud(
      solicitudId,
      'cancelada',
      actor.nombreUsuario,
    );
    if (!cancelada) {
      throw new ErrorDominio('SOLICITUD_NO_ENCONTRADA', 'Solicitud no encontrada', 404);
    }
    return cancelada;
  }

  /**
   * Genera una recomendación comercial (descripción, beneficios y precio sugerido en Bs)
   * combinando reglas económicas locales + consulta al modelo IA configurado (Ollama/nube).
   */
  public async recomendarPlanConIA(entrada: {
    nombre: string;
    cuotaRamMb: number;
    cuotaCpu: number;
    maxProyectos: number;
    iaBasicaHabilitada: boolean;
  }): Promise<{
    precioSugeridoBs: number;
    descripcionSugerida: string;
    beneficiosSugeridos: string[];
    consejoComercial: string;
  }> {
    const baseRam = Math.round((entrada.cuotaRamMb / 512) * 15);
    const extraProy = Math.max(0, entrada.maxProyectos - 1) * 4;
    const extraIa = entrada.iaBasicaHabilitada ? 10 : 0;
    const precioSugeridoBs = Math.max(15, Math.round((baseRam + extraProy + extraIa) / 5) * 5);

    const descripcionSugerida = entrada.iaBasicaHabilitada
      ? `Plan diseñado para sistemas completos con hasta ${entrada.maxProyectos} proyectos, ${entrada.cuotaRamMb} MB de RAM y soporte para modelos de IA ligeros + GPU remota.`
      : `Ideal para estudiantes y desarrolladores que necesitan publicar hasta ${entrada.maxProyectos} proyectos web o APIs con ${entrada.cuotaRamMb} MB de RAM y despliegue directo desde GitHub.`;

    const beneficiosSugeridos = [
      `Hasta ${entrada.maxProyectos} proyecto(s) o microservicios`,
      `${entrada.cuotaRamMb} MB RAM y ${entrada.cuotaCpu} vCPU por servicio`,
      'Despliegue en 1 clic desde GitHub (Node.js, Python, PHP, Rust y Docker)',
      entrada.iaBasicaHabilitada
        ? 'Incluye modelos de IA ligeros en el servidor + APIs externas'
        : 'Compatible con APIs externas de IA (Gemini, OpenAI, Groq)',
      'Modo GPU Remota incluido: conecta modelos pesados desde tu laptop',
    ];

    let consejoComercial = `Precio sugerido: Bs ${precioSugeridoBs}/mes para estudiantes en Bolivia. Destaca que incluye Modo GPU Remota sin costo extra y despliegue directo desde GitHub.`;

    if (this.asistenteIA) {
      try {
        const resIa = await this.asistenteIA.consultarAsistente(
          `Recomienda en 2 frases cómo vender a estudiantes universitarios en Bolivia el plan de hosting "${entrada.nombre}" con ${entrada.cuotaRamMb} MB RAM, ${entrada.cuotaCpu} CPU, ${entrada.maxProyectos} proyectos e IA ligera=${entrada.iaBasicaHabilitada ? 'sí' : 'no'} (precio estimado Bs ${precioSugeridoBs}/mes).`,
        );
        if (resIa?.respuesta && resIa.respuesta.length > 20) {
          consejoComercial = resIa.respuesta;
        }
      } catch {
        // Mantiene el consejo determinista
      }
    }

    return {
      precioSugeridoBs,
      descripcionSugerida,
      beneficiosSugeridos,
      consejoComercial,
    };
  }
}
