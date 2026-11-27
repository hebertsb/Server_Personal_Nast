import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import { ErrorApi } from '../servicios/apiCliente';
import {
  AutomatizacionItem,
  automatizacionesServicio,
  CanalNotificacionRegla,
  ConfiguracionActualizaciones,
  ConfiguracionAutoHealing,
  ConfiguracionAutomatizacion,
  ConfiguracionCondicion,
  ConfiguracionEnergia,
  ConfiguracionHeartbeat,
  ConfiguracionHorario,
  ConfiguracionLimpiezaDocker,
  EstadoEnergiaItem,
  LogAutomatizacionItem,
  MetricaCondicion,
  OperadorCondicion,
  TipoAutomatizacion,
} from '../servicios/automatizacionesServicio';
import { contenedoresServicio } from '../servicios/contenedoresServicio';
import { Contenedor } from '../tipos/Contenedor';

const NOMBRES_DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const CONTENEDORES_PROTEGIDOS = new Set([
  'homesoc-db-dev',
  'homesoc-backend-dev',
  'homesoc-frontend-dev',
  'postgres-homesoc',
  'homesoc-backend',
  'homesoc-frontend',
]);

function etiquetaTipo(tipo: TipoAutomatizacion): string {
  const mapa: Record<TipoAutomatizacion, string> = {
    horario: 'Horario (RF-51)',
    condicion: 'Condición (RF-52)',
    auto_healing: 'Auto-healing',
    limpieza_docker: 'Limpieza Docker',
    heartbeat: 'Heartbeat',
    actualizaciones: 'Actualizaciones',
    energia: 'Energía / Batería',
  };
  return mapa[tipo];
}

function etiquetaCanal(canal: CanalNotificacionRegla): string {
  const mapa: Record<CanalNotificacionRegla, string> = {
    panel: 'Solo panel',
    telegram: 'Telegram',
    email: 'Correo',
    webhook: 'Webhook',
  };
  return mapa[canal];
}

function etiquetaMetrica(m: MetricaCondicion): string {
  switch (m) {
    case 'cpu_porcentaje':
      return 'CPU (%)';
    case 'ram_porcentaje':
      return 'RAM (%)';
    case 'disco_porcentaje':
      return 'Disco (%)';
    case 'temperatura_c':
      return 'Temperatura (°C)';
  }
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-BO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function describirConfiguracion(item: AutomatizacionItem): string {
  switch (item.tipo) {
    case 'horario': {
      const cfg = item.configuracion as ConfiguracionHorario;
      const dias = cfg.diasSemana.map((d) => NOMBRES_DIAS[d] ?? d).join(', ');
      return `${cfg.accion.toUpperCase()} "${cfg.contenedorNombre}" a las ${cfg.hora} (${dias})`;
    }
    case 'condicion': {
      const cfg = item.configuracion as ConfiguracionCondicion;
      const accionTxt =
        cfg.accion === 'pausar_no_criticos'
          ? 'detener no críticos'
          : cfg.accion === 'reiniciar_contenedor' && cfg.contenedorNombre
            ? `reiniciar "${cfg.contenedorNombre}"`
            : 'notificar';
      return `Si ${etiquetaMetrica(cfg.metrica)} ${cfg.operador} ${cfg.umbral} (${
        cfg.duracionMinutos ?? 5
      } min, cooldown ${cfg.cooldownMinutos ?? 15} min) → ${accionTxt}`;
    }
    case 'auto_healing': {
      const cfg = item.configuracion as ConfiguracionAutoHealing;
      return `Reiniciar "${cfg.contenedorNombre}" si falla (máx. ${cfg.maxReintentos} intentos en ${cfg.ventanaMinutos} min)`;
    }
    case 'limpieza_docker': {
      const cfg = item.configuracion as ConfiguracionLimpiezaDocker;
      const partes = ['Prune de imágenes huérfanas'];
      if (cfg.umbralDiscoPorcentaje) partes.push(`disco ≥ ${cfg.umbralDiscoPorcentaje}%`);
      if (cfg.hora) partes.push(`a las ${cfg.hora}`);
      return partes.join(' • ');
    }
    case 'heartbeat': {
      const cfg = item.configuracion as ConfiguracionHeartbeat;
      return `Chequeo cada ${cfg.intervaloMinutos} min${
        cfg.urlHeartbeatExterno ? ' • Ping externo activo' : ''
      }${cfg.urlServicioLocal ? ` • Local: ${cfg.urlServicioLocal}` : ''}`;
    }
    case 'actualizaciones': {
      const cfg = item.configuracion as ConfiguracionActualizaciones;
      return `Solo aviso a las ${cfg.hora} (${
        cfg.verificarImagenesDocker ? 'Docker ' : ''
      }${cfg.verificarSistemaOperativo ? '+ SO (:ro)' : ''})`;
    }
    case 'energia': {
      const cfg = item.configuracion as ConfiguracionEnergia;
      return `Alerta por corte de luz • Apagado ordenado si batería ≤ ${cfg.umbralBateriaCritica}%`;
    }
  }
}

export default function Automatizacion() {
  const { tokenAcceso, usuario } = usarAutenticacion();
  const [pestana, setPestana] = useState<'reglas' | 'logs'>('reglas');
  const [reglas, setReglas] = useState<AutomatizacionItem[]>([]);
  const [logs, setLogs] = useState<LogAutomatizacionItem[]>([]);
  const [contenedores, setContenedores] = useState<Contenedor[]>([]);
  const [energia, setEnergia] = useState<EstadoEnergiaItem | null>(null);
  const [cargando, setCargando] = useState(true);
  const [evaluando, setEvaluando] = useState(false);
  const [ejecutandoId, setEjecutandoId] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Campos del formulario
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<TipoAutomatizacion>('horario');
  const [canalNotificacion, setCanalNotificacion] = useState<CanalNotificacionRegla>('telegram');
  const [contenedorNombre, setContenedorNombre] = useState('test-nginx');
  const [accionHorario, setAccionHorario] = useState<'iniciar' | 'detener' | 'reiniciar'>(
    'detener',
  );
  const [hora, setHora] = useState('23:30');
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);
  const [metrica, setMetrica] = useState<MetricaCondicion>('cpu_porcentaje');
  const [operador, setOperador] = useState<OperadorCondicion>('>');
  const [umbral, setUmbral] = useState('85');
  const [duracionMinutos, setDuracionMinutos] = useState('5');
  const [cooldownMinutos, setCooldownMinutos] = useState('15');
  const [accionCondicion, setAccionCondicion] = useState<
    'notificar' | 'reiniciar_contenedor' | 'pausar_no_criticos'
  >('notificar');
  const [maxReintentos, setMaxReintentos] = useState('3');
  const [ventanaMinutos, setVentanaMinutos] = useState('15');
  const [umbralDisco, setUmbralDisco] = useState('85');
  const [urlLocal, setUrlLocal] = useState('http://localhost:4000/health');
  const [urlExterno, setUrlExterno] = useState('');
  const [intervaloMinutos, setIntervaloMinutos] = useState('5');
  const [verificarDocker, setVerificarDocker] = useState(true);
  const [verificarSo, setVerificarSo] = useState(true);
  const [umbralBateria, setUmbralBateria] = useState('15');
  const [detenerEnCritico, setDetenerEnCritico] = useState(true);

  const esAdmin = usuario?.rol === 'superadmin' || usuario?.rol === 'administrador';

  const cargarTodo = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargando(true);
    try {
      const [{ automatizaciones }, { logs: historial }, resContenedores, { energia: estEnergia }] =
        await Promise.all([
          automatizacionesServicio.listar(tokenAcceso),
          automatizacionesServicio.listarLogs(tokenAcceso, 60),
          contenedoresServicio.listar(tokenAcceso),
          automatizacionesServicio.obtenerEnergia(tokenAcceso),
        ]);
      setReglas(automatizaciones);
      setLogs(historial);
      setContenedores(resContenedores.contenedores);
      setEnergia(estEnergia);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudieron cargar las automatizaciones');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    void cargarTodo();
  }, [cargarTodo]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const contenedoresDisponibles = useMemo(() => {
    const nombres = contenedores.map((c) => c.nombre);
    if (!nombres.includes('test-nginx')) {
      nombres.push('test-nginx');
    }
    return nombres;
  }, [contenedores]);

  const resumen = useMemo(() => {
    const activas = reglas.filter((r) => r.habilitado).length;
    const exitosos = logs.filter((l) => l.resultado === 'exitoso').length;
    const errores = logs.filter((l) => l.resultado === 'error').length;
    return { total: reglas.length, activas, exitosos, errores };
  }, [reglas, logs]);

  const reiniciarFormulario = () => {
    setEditandoId(null);
    setNombre('');
    setDescripcion('');
    setTipo('horario');
    setCanalNotificacion('telegram');
    setContenedorNombre(
      contenedores.find((c) => !CONTENEDORES_PROTEGIDOS.has(c.nombre))?.nombre ?? 'test-nginx',
    );
    setAccionHorario('detener');
    setHora('23:30');
    setDiasSemana([1, 2, 3, 4, 5]);
    setDuracionMinutos('5');
    setCooldownMinutos('15');
  };

  const aplicarPlantilla = (
    plantilla: 'auto_healing' | 'limpieza' | 'apagado_nocturno' | 'corte_luz',
  ) => {
    const destino =
      contenedores.find((c) => !CONTENEDORES_PROTEGIDOS.has(c.nombre))?.nombre ?? 'test-nginx';
    setEditandoId(null);
    setMostrarFormulario(true);
    setCanalNotificacion('telegram');

    if (plantilla === 'auto_healing') {
      setNombre(`Auto-healing de ${destino}`);
      setDescripcion('Reinicia automáticamente si pasa a unhealthy o cae (máx. 3 intentos/15 min).');
      setTipo('auto_healing');
      setContenedorNombre(destino);
      setMaxReintentos('3');
      setVentanaMinutos('15');
      setCooldownMinutos('5');
    } else if (plantilla === 'limpieza') {
      setNombre('Limpieza semanal de imágenes Docker');
      setDescripcion('Elimina imágenes huérfanas cada domingo o si el disco supera 85%.');
      setTipo('limpieza_docker');
      setUmbralDisco('85');
      setHora('04:00');
      setDiasSemana([0]);
      setCooldownMinutos('60');
    } else if (plantilla === 'apagado_nocturno') {
      setNombre(`Apagado nocturno de ${destino}`);
      setDescripcion('Detiene el contenedor en horario nocturno para ahorrar recursos.');
      setTipo('horario');
      setContenedorNombre(destino);
      setAccionHorario('detener');
      setHora('23:30');
      setDiasSemana([1, 2, 3, 4, 5]);
    } else {
      setNombre('Resiliencia ante corte de luz');
      setDescripcion('Avisa al pasar a batería y detiene contenedores no críticos al 15%.');
      setTipo('energia');
      setUmbralBateria('15');
      setDetenerEnCritico(true);
      setCooldownMinutos('5');
    }
  };

  const iniciarEdicion = (regla: AutomatizacionItem) => {
    setEditandoId(regla.id);
    setMostrarFormulario(true);
    setNombre(regla.nombre);
    setDescripcion(regla.descripcion ?? '');
    setTipo(regla.tipo);
    setCanalNotificacion(regla.canalNotificacion ?? 'panel');

    if (regla.tipo === 'horario') {
      const cfg = regla.configuracion as ConfiguracionHorario;
      setContenedorNombre(cfg.contenedorNombre);
      setAccionHorario(cfg.accion);
      setHora(cfg.hora);
      setDiasSemana(cfg.diasSemana);
    } else if (regla.tipo === 'condicion') {
      const cfg = regla.configuracion as ConfiguracionCondicion;
      setMetrica(cfg.metrica);
      setOperador(cfg.operador);
      setUmbral(String(cfg.umbral));
      setDuracionMinutos(String(cfg.duracionMinutos ?? 5));
      setCooldownMinutos(String(cfg.cooldownMinutos ?? 15));
      setAccionCondicion(cfg.accion);
      if (cfg.contenedorNombre) setContenedorNombre(cfg.contenedorNombre);
    } else if (regla.tipo === 'auto_healing') {
      const cfg = regla.configuracion as ConfiguracionAutoHealing;
      setContenedorNombre(cfg.contenedorNombre);
      setMaxReintentos(String(cfg.maxReintentos));
      setVentanaMinutos(String(cfg.ventanaMinutos));
      setCooldownMinutos(String(cfg.cooldownMinutos));
    } else if (regla.tipo === 'limpieza_docker') {
      const cfg = regla.configuracion as ConfiguracionLimpiezaDocker;
      setUmbralDisco(String(cfg.umbralDiscoPorcentaje ?? 85));
      if (cfg.hora) setHora(cfg.hora);
      if (cfg.diasSemana) setDiasSemana(cfg.diasSemana);
      setCooldownMinutos(String(cfg.cooldownMinutos ?? 60));
    } else if (regla.tipo === 'heartbeat') {
      const cfg = regla.configuracion as ConfiguracionHeartbeat;
      setUrlLocal(cfg.urlServicioLocal ?? '');
      setUrlExterno(cfg.urlHeartbeatExterno ?? '');
      setIntervaloMinutos(String(cfg.intervaloMinutos ?? 5));
    } else if (regla.tipo === 'actualizaciones') {
      const cfg = regla.configuracion as ConfiguracionActualizaciones;
      setVerificarDocker(cfg.verificarImagenesDocker);
      setVerificarSo(cfg.verificarSistemaOperativo);
      setHora(cfg.hora);
      setDiasSemana(cfg.diasSemana);
    } else if (regla.tipo === 'energia') {
      const cfg = regla.configuracion as ConfiguracionEnergia;
      setUmbralBateria(String(cfg.umbralBateriaCritica));
      setDetenerEnCritico(cfg.detenerContenedoresEnCritico);
      setCooldownMinutos(String(cfg.cooldownMinutos ?? 5));
    }
  };

  const construirConfiguracion = (): ConfiguracionAutomatizacion => {
    const diasSeguros = diasSemana.length > 0 ? diasSemana : [1, 2, 3, 4, 5];
    switch (tipo) {
      case 'horario':
        return {
          contenedorNombre,
          accion: accionHorario,
          hora,
          diasSemana: diasSeguros,
        };
      case 'condicion':
        return {
          metrica,
          operador,
          umbral: Number(umbral),
          duracionMinutos: Number(duracionMinutos),
          cooldownMinutos: Number(cooldownMinutos),
          accion: accionCondicion,
          contenedorNombre:
            accionCondicion === 'reiniciar_contenedor' ? contenedorNombre : undefined,
        };
      case 'auto_healing':
        return {
          contenedorNombre,
          maxReintentos: Number(maxReintentos),
          ventanaMinutos: Number(ventanaMinutos),
          cooldownMinutos: Number(cooldownMinutos),
        };
      case 'limpieza_docker':
        return {
          umbralDiscoPorcentaje: Number(umbralDisco),
          hora,
          diasSemana: diasSeguros,
          cooldownMinutos: Number(cooldownMinutos),
        };
      case 'heartbeat':
        return {
          urlServicioLocal: urlLocal.trim() || undefined,
          urlHeartbeatExterno: urlExterno.trim() || undefined,
          intervaloMinutos: Number(intervaloMinutos),
        };
      case 'actualizaciones':
        return {
          verificarImagenesDocker: verificarDocker,
          verificarSistemaOperativo: verificarSo,
          hora,
          diasSemana: diasSeguros,
        };
      case 'energia':
        return {
          umbralBateriaCritica: Number(umbralBateria),
          detenerContenedoresEnCritico: detenerEnCritico,
          cooldownMinutos: Number(cooldownMinutos),
        };
    }
  };

  const manejarGuardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!tokenAcceso || !nombre.trim()) return;
    setGuardando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        tipo,
        configuracion: construirConfiguracion(),
        canalNotificacion,
        habilitado: true,
      };
      if (editandoId) {
        await automatizacionesServicio.actualizar(editandoId, payload, tokenAcceso);
        setAviso(`Regla "${payload.nombre}" actualizada correctamente`);
      } else {
        await automatizacionesServicio.crear(payload, tokenAcceso);
        setAviso(`Regla "${payload.nombre}" creada correctamente`);
      }
      reiniciarFormulario();
      setMostrarFormulario(false);
      await cargarTodo();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar la regla');
    } finally {
      setGuardando(false);
    }
  };

  const alternarDia = (dia: number) => {
    setDiasSemana((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort((a, b) => a - b),
    );
  };

  const manejarToggle = async (regla: AutomatizacionItem) => {
    if (!tokenAcceso) return;
    try {
      const { automatizacion } = await automatizacionesServicio.alternarEstado(
        regla.id,
        !regla.habilitado,
        tokenAcceso,
      );
      setReglas((prev) => prev.map((r) => (r.id === automatizacion.id ? automatizacion : r)));
      setAviso(
        automatizacion.habilitado
          ? `Regla "${automatizacion.nombre}" activada`
          : `Regla "${automatizacion.nombre}" pausada`,
      );
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar el estado');
    }
  };

  const manejarEjecutarManual = async (regla: AutomatizacionItem) => {
    if (!tokenAcceso) return;
    setEjecutandoId(regla.id);
    try {
      const { log } = await automatizacionesServicio.ejecutarManual(regla.id, tokenAcceso);
      setAviso(`Ejecución (${log.resultado}): ${log.detalle}`);
      await cargarTodo();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'Error al ejecutar la regla');
    } finally {
      setEjecutandoId(null);
    }
  };

  const manejarEvaluarActivas = async () => {
    if (!tokenAcceso) return;
    setEvaluando(true);
    try {
      const res = await automatizacionesServicio.evaluarActivas(tokenAcceso);
      setAviso(
        `Evaluación completada: ${res.evaluadas} regla(s) revisada(s), ${res.ejecutadas} disparada(s).`,
      );
      await cargarTodo();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'Error al evaluar reglas');
    } finally {
      setEvaluando(false);
    }
  };

  const manejarEliminar = async (regla: AutomatizacionItem) => {
    if (!tokenAcceso) return;
    if (!window.confirm(`¿Eliminar la regla "${regla.nombre}"?`)) return;
    try {
      await automatizacionesServicio.eliminar(regla.id, tokenAcceso);
      setAviso(`Regla "${regla.nombre}" eliminada`);
      await cargarTodo();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo eliminar la regla');
    }
  };

  const manejarSimularEnergia = async (enBateria: boolean, porcentajeBateria: number) => {
    if (!tokenAcceso) return;
    try {
      const { energia: nueva } = await automatizacionesServicio.simularEnergia(
        { enBateria, porcentajeBateria },
        tokenAcceso,
      );
      setEnergia(nueva);
      setAviso(`Estado de energía simulado: ${nueva.estadoTexto}`);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo simular energía');
    }
  };

  const renderSelectorContenedor = () => (
    <div>
      <label className="text-[11px] text-text-dim block mb-1">Contenedor Docker</label>
      <select
        value={contenedorNombre}
        onChange={(e) => setContenedorNombre(e.target.value)}
        className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
      >
        {contenedoresDisponibles.map((c) => {
          const protegido = CONTENEDORES_PROTEGIDOS.has(c);
          return (
            <option key={c} value={c} disabled={protegido}>
              {c} {protegido ? '(núcleo protegido)' : ''}
            </option>
          );
        })}
      </select>
    </div>
  );

  const renderSelectorDias = () => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] text-text-dim">Días de la semana</label>
        <div className="flex gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => setDiasSemana([0, 1, 2, 3, 4, 5, 6])}
            className="text-primary hover:underline cursor-pointer"
          >
            Todos
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setDiasSemana([1, 2, 3, 4, 5])}
            className="text-primary hover:underline cursor-pointer"
          >
            L-V
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {NOMBRES_DIAS.map((etiqueta, idx) => (
          <button
            key={etiqueta}
            type="button"
            onClick={() => alternarDia(idx)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer ${
              diasSemana.includes(idx)
                ? 'bg-primary text-[var(--hs-on-accent)]'
                : 'bg-surface-low border border-border-hairline text-text-muted'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full pt-20 px-4 sm:px-6 lg:px-7 pb-12 min-h-screen bg-canvas-base text-text-primary">
      <div className="w-full flex flex-col gap-5">
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Automatización de Servicios
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Horarios, reglas con cooldown, auto-healing, limpieza Docker, heartbeat externo,
              actualizaciones y resiliencia ante cortes de luz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {esAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => void manejarEvaluarActivas()}
                  disabled={evaluando}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-card hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">
                    play_arrow
                  </span>
                  <span>{evaluando ? 'Evaluando…' : 'Evaluar reglas ahora'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (mostrarFormulario) {
                      setMostrarFormulario(false);
                      reiniciarFormulario();
                    } else {
                      reiniciarFormulario();
                      setMostrarFormulario(true);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {mostrarFormulario ? 'close' : 'add_circle'}
                  </span>
                  <span>{mostrarFormulario ? 'Cerrar formulario' : 'Nueva Regla'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-error-container border border-status-critical/30 px-4 py-3 text-xs text-status-critical">
            {error}
          </div>
        )}

        {aviso && (
          <div className="rounded-xl bg-primary/12 border border-primary/25 px-4 py-3 text-xs font-medium text-primary">
            {aviso}
          </div>
        )}

        {/* 4 KPIs + Monitor de Energía */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
            <span className="text-xs font-medium text-text-muted">Reglas Activas / Total</span>
            <div className="text-3xl font-bold font-mono text-primary mt-2">
              {resumen.activas}{' '}
              <span className="text-base text-text-dim font-normal">/ {resumen.total}</span>
            </div>
            <p className="text-[11px] text-text-dim mt-1">Horarios, triggers y resiliencia</p>
          </div>

          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
            <span className="text-xs font-medium text-text-muted">Ejecuciones Exitosas</span>
            <div className="text-3xl font-bold font-mono text-text-primary mt-2">
              {resumen.exitosos}
            </div>
            <p className="text-[11px] text-text-dim mt-1">Historial auditado (RF-53)</p>
          </div>

          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
            <span className="text-xs font-medium text-text-muted">Errores / Escalados</span>
            <div className="text-3xl font-bold font-mono text-status-warning mt-2">
              {resumen.errores}
            </div>
            <p className="text-[11px] text-text-dim mt-1">Alertas críticas o bloqueos</p>
          </div>

          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Energía / Batería</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  energia?.enBateria
                    ? 'bg-status-warning/15 text-status-warning'
                    : 'bg-primary/12 text-primary'
                }`}
              >
                {energia?.enBateria ? 'En batería' : 'Corriente AC'}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-text-primary">
              {energia?.porcentajeBateria !== null && energia?.porcentajeBateria !== undefined
                ? `${energia.porcentajeBateria}%`
                : 'N/D'}
            </div>
            {esAdmin && energia?.modo === 'simulacion' && (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => void manejarSimularEnergia(false, 100)}
                  className="px-2 py-0.5 rounded-md bg-surface-low border border-border-hairline text-[10px] cursor-pointer"
                >
                  AC 100%
                </button>
                <button
                  type="button"
                  onClick={() => void manejarSimularEnergia(true, 65)}
                  className="px-2 py-0.5 rounded-md bg-status-warning/15 text-status-warning text-[10px] cursor-pointer"
                >
                  Corte 65%
                </button>
                <button
                  type="button"
                  onClick={() => void manejarSimularEnergia(true, 12)}
                  className="px-2 py-0.5 rounded-md bg-error-container text-status-critical text-[10px] cursor-pointer"
                >
                  Crítica 12%
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Plantillas rápidas de 1 clic */}
        {esAdmin && (
          <div className="rounded-2xl bg-surface-card border border-border-hairline p-4 flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-text-muted">
              Plantillas rápidas de 1 clic:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => aplicarPlantilla('auto_healing')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-primary">healing</span>
                <span>Auto-healing de contenedor</span>
              </button>
              <button
                type="button"
                onClick={() => aplicarPlantilla('limpieza')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-primary">
                  cleaning_services
                </span>
                <span>Limpieza semanal de Docker</span>
              </button>
              <button
                type="button"
                onClick={() => aplicarPlantilla('apagado_nocturno')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-primary">bedtime</span>
                <span>Apagado nocturno</span>
              </button>
              <button
                type="button"
                onClick={() => aplicarPlantilla('corte_luz')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-status-warning">
                  battery_alert
                </span>
                <span>Alerta de corte de luz</span>
              </button>
            </div>
          </div>
        )}

        {/* Formulario Crear / Editar Regla */}
        {mostrarFormulario && esAdmin && (
          <form
            onSubmit={(e) => void manejarGuardar(e)}
            className="rounded-2xl bg-surface-card border-2 border-primary/35 p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">
                {editandoId ? 'Editar Regla de Automatización' : 'Crear Regla de Automatización'}
              </h2>
              {editandoId && (
                <span className="text-[11px] font-mono text-primary">Editando regla existente</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="text-[11px] text-text-dim block mb-1">Nombre de la regla</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Auto-healing de test-nginx o Alerta CPU > 85%"
                  className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
                />
              </div>
              <div>
                <label className="text-[11px] text-text-dim block mb-1">Tipo de regla</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoAutomatizacion)}
                  className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
                >
                  <option value="horario">Horario de Contenedor (RF-51)</option>
                  <option value="condicion">Condición → Acción / Térmica (RF-52)</option>
                  <option value="auto_healing">Auto-healing de Contenedor</option>
                  <option value="limpieza_docker">Limpieza Automática de Docker</option>
                  <option value="heartbeat">Chequeo HTTP y Heartbeat Externo</option>
                  <option value="actualizaciones">Aviso de Actualizaciones (solo aviso)</option>
                  <option value="energia">Resiliencia Corte de Luz / Batería</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-dim block mb-1">Canal de notificación</label>
                <select
                  value={canalNotificacion}
                  onChange={(e) => setCanalNotificacion(e.target.value as CanalNotificacionRegla)}
                  className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
                >
                  <option value="panel">Solo Panel</option>
                  <option value="telegram">Telegram</option>
                  <option value="email">Correo</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-text-dim block mb-1">
                Descripción / motivo (opcional)
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Breve explicación de cuándo y por qué actúa esta automatización"
                className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
              />
            </div>

            {tipo === 'horario' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {renderSelectorContenedor()}
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Acción</label>
                  <select
                    value={accionHorario}
                    onChange={(e) =>
                      setAccionHorario(e.target.value as 'iniciar' | 'detener' | 'reiniciar')
                    }
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
                  >
                    <option value="iniciar">Iniciar</option>
                    <option value="detener">Detener</option>
                    <option value="reiniciar">Reiniciar</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Hora (24h)</label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                {renderSelectorDias()}
              </div>
            )}

            {tipo === 'condicion' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Métrica del host</label>
                  <select
                    value={metrica}
                    onChange={(e) => setMetrica(e.target.value as MetricaCondicion)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
                  >
                    <option value="cpu_porcentaje">CPU (%)</option>
                    <option value="ram_porcentaje">Memoria RAM (%)</option>
                    <option value="disco_porcentaje">Disco principal (%)</option>
                    <option value="temperatura_c">Temperatura CPU (°C)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Operador y umbral</label>
                  <div className="flex gap-2">
                    <select
                      value={operador}
                      onChange={(e) => setOperador(e.target.value as OperadorCondicion)}
                      className="w-20 rounded-xl bg-surface-low border border-border-hairline px-2 py-2 text-xs font-mono text-text-primary"
                    >
                      <option value=">">&gt;</option>
                      <option value=">=">&gt;=</option>
                      <option value="<">&lt;</option>
                      <option value="<=">&lt;=</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={umbral}
                      onChange={(e) => setUmbral(e.target.value)}
                      className="flex-1 rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Acción correctiva</label>
                  <select
                    value={accionCondicion}
                    onChange={(e) =>
                      setAccionCondicion(
                        e.target.value as
                          | 'notificar'
                          | 'reiniciar_contenedor'
                          | 'pausar_no_criticos',
                      )
                    }
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
                  >
                    <option value="notificar">Notificar alerta</option>
                    <option value="reiniciar_contenedor">Reiniciar contenedor</option>
                    <option value="pausar_no_criticos">
                      Detener contenedores no críticos (protección)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">
                    Tiempo sostenido (minutos)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={duracionMinutos}
                    onChange={(e) => setDuracionMinutos(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">
                    Enfriamiento / Cooldown (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={cooldownMinutos}
                    onChange={(e) => setCooldownMinutos(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                {accionCondicion === 'reiniciar_contenedor' && renderSelectorContenedor()}
              </div>
            )}

            {tipo === 'auto_healing' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {renderSelectorContenedor()}
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Máx. reintentos</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxReintentos}
                    onChange={(e) => setMaxReintentos(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Ventana (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={ventanaMinutos}
                    onChange={(e) => setVentanaMinutos(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Cooldown (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={cooldownMinutos}
                    onChange={(e) => setCooldownMinutos(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
              </div>
            )}

            {tipo === 'limpieza_docker' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">
                    Disparar si disco ≥ (%)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={99}
                    value={umbralDisco}
                    onChange={(e) => setUmbralDisco(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Hora programada</label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                {renderSelectorDias()}
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Cooldown (min)</label>
                  <input
                    type="number"
                    min={5}
                    max={10080}
                    value={cooldownMinutos}
                    onChange={(e) => setCooldownMinutos(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
              </div>
            )}

            {tipo === 'heartbeat' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">
                    URL de servicio local (opcional)
                  </label>
                  <input
                    type="url"
                    value={urlLocal}
                    onChange={(e) => setUrlLocal(e.target.value)}
                    placeholder="http://localhost:4000/health"
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">
                    URL Heartbeat externo (Dead Man&apos;s Switch)
                  </label>
                  <input
                    type="url"
                    value={urlExterno}
                    onChange={(e) => setUrlExterno(e.target.value)}
                    placeholder="https://hc-ping.com/tu-uuid"
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">
                    Intervalo de ping (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={intervaloMinutos}
                    onChange={(e) => setIntervaloMinutos(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
              </div>
            )}

            {tipo === 'actualizaciones' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <label className="inline-flex items-center gap-2 text-xs text-text-primary">
                  <input
                    type="checkbox"
                    checked={verificarDocker}
                    onChange={(e) => setVerificarDocker(e.target.checked)}
                    className="accent-[var(--hs-accent)]"
                  />
                  <span>Inspeccionar imágenes Docker</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-text-primary">
                  <input
                    type="checkbox"
                    checked={verificarSo}
                    onChange={(e) => setVerificarSo(e.target.checked)}
                    className="accent-[var(--hs-accent)]"
                  />
                  <span>Leer resumen SO (:ro)</span>
                </label>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Hora de revisión</label>
                  <input
                    type="time"
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                {renderSelectorDias()}
              </div>
            )}

            {tipo === 'energia' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">
                    Umbral batería crítica (%)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={umbralBateria}
                    onChange={(e) => setUmbralBateria(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-text-primary pb-2">
                  <input
                    type="checkbox"
                    checked={detenerEnCritico}
                    onChange={(e) => setDetenerEnCritico(e.target.checked)}
                    className="accent-[var(--hs-accent)]"
                  />
                  <span>Detener contenedores no críticos en nivel crítico</span>
                </label>
                <div>
                  <label className="text-[11px] text-text-dim block mb-1">Cooldown (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={cooldownMinutos}
                    onChange={(e) => setCooldownMinutos(e.target.value)}
                    className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setMostrarFormulario(false);
                  reiniciarFormulario();
                }}
                className="px-3.5 py-2 rounded-xl bg-surface-low border border-border-hairline text-xs text-text-muted cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="px-4 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {guardando
                  ? 'Guardando…'
                  : editandoId
                    ? 'Guardar cambios'
                    : 'Guardar regla'}
              </button>
            </div>
          </form>
        )}

        {/* Pestañas */}
        <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface-card border border-border-hairline w-fit">
          <button
            type="button"
            onClick={() => setPestana('reglas')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              pestana === 'reglas'
                ? 'bg-primary text-[var(--hs-on-accent)] shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            <span>Horarios y Reglas ({reglas.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setPestana('logs')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              pestana === 'logs'
                ? 'bg-primary text-[var(--hs-on-accent)] shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>Log de Ejecuciones ({logs.length})</span>
          </button>
        </div>

        {pestana === 'reglas' ? (
          <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
            {cargando ? (
              <div className="p-8 text-center text-xs font-mono text-text-dim">
                Cargando reglas…
              </div>
            ) : reglas.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-dim">
                No hay reglas configuradas. Usa una plantilla rápida arriba para comenzar.
              </div>
            ) : (
              <div className="divide-y divide-border-hairline">
                {reglas.map((regla) => (
                  <div
                    key={regla.id}
                    className="px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-surface-card-elevated/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">
                          {regla.nombre}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-surface-low border border-border-hairline text-[10px] font-mono text-primary">
                          {etiquetaTipo(regla.tipo)}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-surface-low border border-border-hairline text-[10px] font-mono text-text-muted">
                          {etiquetaCanal(regla.canalNotificacion)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            regla.habilitado
                              ? 'bg-primary/12 text-primary border-primary/25'
                              : 'bg-surface-low text-text-dim border-border-hairline'
                          }`}
                        >
                          {regla.habilitado ? 'Activa' : 'Pausada'}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-text-muted mt-1">
                        {describirConfiguracion(regla)}
                      </p>
                      {regla.descripcion && (
                        <p className="text-[11px] text-text-dim mt-0.5">{regla.descripcion}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 mt-1.5 text-[11px] font-mono text-text-dim">
                        <span>
                          Última ejecución:{' '}
                          <strong className="text-text-muted">
                            {regla.ultimaEjecucionEn
                              ? `${formatearFecha(regla.ultimaEjecucionEn)} (${regla.ultimoResultado ?? 'ok'})`
                              : 'Sin ejecuciones'}
                          </strong>
                        </span>
                        <span>
                          Próxima programada:{' '}
                          <strong className="text-primary">
                            {regla.proximaEjecucionEn
                              ? formatearFecha(regla.proximaEjecucionEn)
                              : 'Por evento'}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {esAdmin && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => iniciarEdicion(regla)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void manejarToggle(regla)}
                          className="px-3 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer"
                        >
                          {regla.habilitado ? 'Pausar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          disabled={ejecutandoId === regla.id}
                          onClick={() => void manejarEjecutarManual(regla)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/12 hover:bg-primary/20 border border-primary/25 text-xs font-semibold text-primary cursor-pointer disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                          <span>{ejecutandoId === regla.id ? 'Ejecutando…' : 'Ejecutar'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void manejarEliminar(regla)}
                          className="p-1.5 rounded-xl border border-status-critical/30 text-status-critical hover:bg-error-container cursor-pointer"
                          title="Eliminar regla"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-hairline text-[11px] font-semibold uppercase tracking-wider text-text-dim bg-surface-low/50">
                    <th className="py-3 px-4">Regla</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Resultado</th>
                    <th className="py-3 px-4">Detalle</th>
                    <th className="py-3 px-4 text-right">Fecha y Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-hairline text-xs">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-dim">
                        Aún no hay ejecuciones registradas.
                      </td>
                    </tr>
                  ) : (
                    logs.map((l) => (
                      <tr key={l.id} className="hover:bg-surface-card-elevated/40">
                        <td className="py-3 px-4 font-semibold text-text-primary">
                          {l.nombreAutomatizacion}
                        </td>
                        <td className="py-3 px-4 font-mono text-text-muted">
                          {etiquetaTipo(l.tipoAutomatizacion)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold ${
                              l.resultado === 'exitoso'
                                ? 'bg-primary/12 text-primary border-primary/25'
                                : 'bg-error-container text-status-critical border-status-critical/30'
                            }`}
                          >
                            {l.resultado}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-muted">{l.detalle}</td>
                        <td className="py-3 px-4 text-right font-mono text-text-dim whitespace-nowrap">
                          {new Date(l.fechaHora).toLocaleString('es-BO')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
