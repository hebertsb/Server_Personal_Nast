import {
  ConfiguracionAutomatizacion,
  ConfiguracionCondicion,
  ConfiguracionEnergia,
  ConfiguracionHeartbeat,
  ConfiguracionHorario,
  ConfiguracionLimpiezaDocker,
  ConfiguracionActualizaciones,
  EstadoEnergiaHost,
  TipoAutomatizacion,
} from '../entidades/Automatizacion';
import { RecursosHost } from '../entidades/RecursosHost';

/** Evalúa si un horario programado coincide con la fecha/hora indicada (RF-51). */
export function coincideHorario(
  config: { hora?: string; diasSemana?: number[] },
  fecha: Date,
): boolean {
  if (!config.hora || !config.diasSemana || config.diasSemana.length === 0) {
    return false;
  }
  const diaActual = fecha.getDay();
  if (!config.diasSemana.includes(diaActual)) {
    return false;
  }
  const hh = String(fecha.getHours()).padStart(2, '0');
  const mm = String(fecha.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}` === config.hora;
}

/** Verifica si una regla se encuentra actualmente dentro de su ventana de enfriamiento (cooldown). */
export function estaEnCooldown(enfriamientoHasta: string | null, ahora: Date = new Date()): boolean {
  if (!enfriamientoHasta) return false;
  const limite = new Date(enfriamientoHasta).getTime();
  return Number.isFinite(limite) && limite > ahora.getTime();
}

/** Calcula la próxima fecha/hora estimada de ejecución para reglas con horario o intervalo. */
export function calcularProximaEjecucion(
  tipo: TipoAutomatizacion,
  config: ConfiguracionAutomatizacion,
  ahora: Date = new Date(),
): string | null {
  if (tipo === 'heartbeat') {
    const cfg = config as ConfiguracionHeartbeat;
    const mins = Math.max(1, cfg.intervaloMinutos || 5);
    return new Date(ahora.getTime() + mins * 60_000).toISOString();
  }

  let hora: string | undefined;
  let diasSemana: number[] | undefined;

  if (tipo === 'horario') {
    const cfg = config as ConfiguracionHorario;
    hora = cfg.hora;
    diasSemana = cfg.diasSemana;
  } else if (tipo === 'limpieza_docker') {
    const cfg = config as ConfiguracionLimpiezaDocker;
    hora = cfg.hora;
    diasSemana = cfg.diasSemana;
  } else if (tipo === 'actualizaciones') {
    const cfg = config as ConfiguracionActualizaciones;
    hora = cfg.hora;
    diasSemana = cfg.diasSemana;
  }

  if (!hora || !diasSemana || diasSemana.length === 0) {
    return null;
  }

  const [hhStr, mmStr] = hora.split(':');
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;

  for (let offsetDias = 0; offsetDias <= 7; offsetDias++) {
    const candidato = new Date(ahora);
    candidato.setDate(ahora.getDate() + offsetDias);
    candidato.setHours(hh, mm, 0, 0);
    if (diasSemana.includes(candidato.getDay()) && candidato.getTime() > ahora.getTime()) {
      return candidato.toISOString();
    }
  }
  return null;
}

/** Extrae el valor numérico de la métrica monitoreada (incluyendo temperatura) y evalúa la condición. */
export function evaluarCondicionMetrica(
  config: ConfiguracionCondicion,
  recursos: RecursosHost,
): { cumplida: boolean; valorActual: number | null } {
  let valorActual: number | null = null;
  switch (config.metrica) {
    case 'cpu_porcentaje':
      valorActual = recursos.porcentajeCpu;
      break;
    case 'ram_porcentaje':
      valorActual = recursos.porcentajeRam;
      break;
    case 'disco_porcentaje':
      valorActual = recursos.discos[0]?.porcentajeUso ?? 0;
      break;
    case 'temperatura_c':
      valorActual = recursos.temperaturaC;
      break;
  }

  if (valorActual === null) {
    return { cumplida: false, valorActual: null };
  }

  let cumplida = false;
  switch (config.operador) {
    case '>':
      cumplida = valorActual > config.umbral;
      break;
    case '>=':
      cumplida = valorActual >= config.umbral;
      break;
    case '<':
      cumplida = valorActual < config.umbral;
      break;
    case '<=':
      cumplida = valorActual <= config.umbral;
      break;
  }

  return { cumplida, valorActual };
}

/** Evalúa el límite de reintentos de Auto-healing para evitar bucles infinitos de reinicio. */
export function evaluarLimiteReintentosAutoHealing(
  intentosRecientes: number,
  maxReintentos: number,
): { puedeReintentar: boolean; debeEscalar: boolean } {
  if (intentosRecientes >= maxReintentos) {
    return { puedeReintentar: false, debeEscalar: true };
  }
  return { puedeReintentar: true, debeEscalar: false };
}

/** Evalúa si hay corte de luz (paso a batería) o nivel crítico de batería para apagado ordenado. */
export function evaluarEstadoEnergia(
  config: ConfiguracionEnergia,
  estado: EstadoEnergiaHost,
): { nivel: 'normal' | 'corte_luz' | 'bateria_critica' } {
  if (!estado.disponible || !estado.enBateria) {
    return { nivel: 'normal' };
  }
  if (
    estado.porcentajeBateria !== null &&
    estado.porcentajeBateria <= config.umbralBateriaCritica
  ) {
    return { nivel: 'bateria_critica' };
  }
  return { nivel: 'corte_luz' };
}
