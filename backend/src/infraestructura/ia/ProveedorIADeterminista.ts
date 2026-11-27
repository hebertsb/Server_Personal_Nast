import {
  ExplicacionFalloDespliegue,
  RespuestaConsultaIa,
  ResumenSeguridadIa,
} from '../../dominio/entidades/IaYMcp';
import {
  ContextoConsultaServidor,
  EntradaExplicarFallo,
  EntradaResumenSeguridad,
  ProveedorIA,
} from '../../dominio/interfaces/ProveedorIA';

/**
 * Proveedor determinista de respaldo (RF-58): garantiza que las funciones de IA
 * respondan siempre en español claro incluso sin API key externa ni GPU local.
 */
export class ProveedorIADeterminista implements ProveedorIA {
  public readonly nombre = 'analizador-local';

  public async explicarFalloDespliegue(
    entrada: EntradaExplicarFallo,
  ): Promise<ExplicacionFalloDespliegue> {
    const texto = `${entrada.logConstruccion}\n${entrada.logHealthCheck}`.toLowerCase();
    let causaProbable = 'Error general durante la fase de construcción o arranque del contenedor.';
    const accionesSugeridas: string[] = [];

    if (texto.includes('gitleaks') || texto.includes('secreto') || texto.includes('gate')) {
      causaProbable =
        'El Gate de Seguridad (gitleaks) detectó un posible secreto o credencial en el commit y detuvo el despliegue automáticamente.';
      accionesSugeridas.push(
        'Retira la credencial del repositorio y cárgala en la sección de Variables Cifradas de HomeSOC.',
        'Rota la clave expuesta en el servicio externo.',
        'Si es un falso positivo verificado, usa el botón "Aprobar y desplegar".',
      );
    } else if (texto.includes('healthcheck') || texto.includes('503') || texto.includes('timeout')) {
      causaProbable =
        'La nueva versión no respondió al Health Check en el puerto configurado; HomeSOC ejecutó rollback automático para mantener la versión previa.';
      accionesSugeridas.push(
        'Verifica que las variables de entorno requeridas existan en HomeSOC antes del git push.',
        'Confirma que la app escuche en 0.0.0.0 en el puerto configurado.',
        'Revisa el log de construcción para errores de migración o conexión a base de datos.',
      );
    } else {
      accionesSugeridas.push(
        'Revisa las últimas líneas del log técnico en el historial del proyecto.',
        'Valida que el Dockerfile o package.json compile localmente sin errores.',
      );
    }

    return {
      proveedor: this.nombre,
      resumen: `Análisis del despliegue ${entrada.commitSha} de "${entrada.nombreProyecto}" (estado: ${entrada.estado}).`,
      causaProbable,
      accionesSugeridas,
      generadoEn: new Date().toISOString(),
    };
  }

  public async generarResumenSeguridad(
    entrada: EntradaResumenSeguridad,
  ): Promise<ResumenSeguridadIa> {
    const nivelRiesgo: 'bajo' | 'medio' | 'alto' =
      entrada.eventosCriticosOAltos >= 3
        ? 'alto'
        : entrada.eventosCriticosOAltos >= 1 || entrada.intentosSshFallidos >= 5
          ? 'medio'
          : 'bajo';

    const resumenEjecutivo =
      nivelRiesgo === 'bajo'
        ? `Jornada estable en tu homelab: ${entrada.totalEventos24h} eventos registrados sin incidentes críticos recientes.`
        : `Actividad de seguridad relevante: ${entrada.eventosCriticosOAltos} evento(s) de severidad alta/crítica y ${entrada.intentosSshFallidos} intentos SSH fallidos.`;

    return {
      proveedor: this.nombre,
      nivelRiesgo,
      resumenEjecutivo,
      destacados: [
        `Eventos en 24h: ${entrada.totalEventos24h} (${entrada.eventosCriticosOAltos} altos/críticos)`,
        `IPs bloqueadas actualmente: ${entrada.ipsBloqueadas}`,
        `Intentos SSH fallidos detectados: ${entrada.intentosSshFallidos}`,
        ...(entrada.tiposFrecuentes.length > 0
          ? [`Tipos más frecuentes: ${entrada.tiposFrecuentes.join(', ')}`]
          : []),
      ],
      recomendaciones:
        nivelRiesgo === 'bajo'
          ? ['Mantener 2FA TOTP activo y revisar periódicamente los dispositivos de confianza.']
          : [
              'Revisar las IPs sospechosas en Seguridad y bloquear orígenes recurrentes.',
              'Confirmar que el acceso SSH use autenticación por llave pública y sin root.',
            ],
      generadoEn: new Date().toISOString(),
    };
  }

  public async responderConsulta(
    pregunta: string,
    ctx: ContextoConsultaServidor,
  ): Promise<RespuestaConsultaIa> {
    const q = pregunta.toLowerCase();
    let respuesta = '';

    if (q.includes('seguridad') || q.includes('alerta') || q.includes('ataque')) {
      respuesta = `Estado de seguridad: actualmente hay ${ctx.alertasAltasRecientes} evento(s) de severidad alta o crítica recientes. Revisa la pestaña Seguridad y Auditoría para bloquear IPs si es necesario.`;
    } else if (q.includes('contenedor') || q.includes('docker') || q.includes('servicio')) {
      respuesta = `Tienes ${ctx.contenedoresActivos} de ${ctx.contenedoresTotales} contenedores Docker en ejecución y ${ctx.proyectosDesplegados} proyecto(s) conectado(s) desde GitHub.`;
    } else if (q.includes('cpu') || q.includes('ram') || q.includes('disco') || q.includes('recurso')) {
      respuesta = `Recursos actuales del servidor: CPU al ${ctx.cpuPorcentaje}%, memoria RAM al ${ctx.ramPorcentaje}% y disco principal al ${ctx.discoPorcentaje}%.`;
    } else {
      respuesta = `Tu servidor HomeSOC está en línea: CPU al ${ctx.cpuPorcentaje}%, RAM al ${ctx.ramPorcentaje}%, disco al ${ctx.discoPorcentaje}%, ${ctx.contenedoresActivos} de ${ctx.contenedoresTotales} contenedores activos, ${ctx.proyectosDesplegados} proyecto(s) desplegado(s) y ${ctx.alertasAltasRecientes} alerta(s) de seguridad recientes.`;
    }

    return {
      proveedor: this.nombre,
      respuesta,
      textoParaVoz: respuesta,
      generadoEn: new Date().toISOString(),
    };
  }
}
