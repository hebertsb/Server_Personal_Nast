import { useCallback, useEffect, useMemo, useState } from 'react';
import PanelDesplieguesGithub from '../componentes/despliegues/PanelDesplieguesGithub';
import PanelPortafolioProyectos from '../componentes/despliegues/PanelPortafolioProyectos';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import { usarContenedores } from '../hooks/usarContenedores';
import { ErrorApi } from '../servicios/apiCliente';
import { contenedoresServicio } from '../servicios/contenedoresServicio';
import {
  AccionContenedor,
  Contenedor,
  EstadoContenedor,
} from '../tipos/Contenedor';

type PestanaModulo = 'contenedores' | 'despliegues' | 'portafolio';
type FiltroEstado = 'todos' | 'activos' | 'detenidos' | 'problemas';

interface ConfirmacionAccion {
  contenedor: Contenedor;
  accion: AccionContenedor;
}

interface NotificacionEstado {
  tipo: 'exito' | 'error';
  mensaje: string;
}

const CONTENEDORES_NUCLEO_HOMESOC = new Set([
  'homesoc-db-dev',
  'homesoc-backend-dev',
  'homesoc-frontend-dev',
]);

function etiquetaEstado(estado: EstadoContenedor): {
  texto: string;
  clasePill: string;
  clasePunto: string;
} {
  switch (estado) {
    case 'running':
      return {
        texto: 'Activo',
        clasePill: 'bg-primary/12 text-primary border border-primary/25',
        clasePunto: 'bg-primary',
      };
    case 'unhealthy':
      return {
        texto: 'Con fallo',
        clasePill: 'bg-error-container text-status-critical border border-status-critical/30',
        clasePunto: 'bg-status-critical',
      };
    case 'restarting':
      return {
        texto: 'Reiniciando',
        clasePill: 'bg-status-warning/15 text-status-warning border border-status-warning/30',
        clasePunto: 'bg-status-warning animate-pulse',
      };
    case 'paused':
      return {
        texto: 'Pausado',
        clasePill: 'bg-status-warning/15 text-status-warning border border-status-warning/30',
        clasePunto: 'bg-status-warning',
      };
    default:
      return {
        texto: 'Detenido',
        clasePill: 'bg-surface-card-elevated text-text-muted border border-border-hairline',
        clasePunto: 'bg-text-dim',
      };
  }
}

function formatearHora(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function ServiciosYDespliegues() {
  const { usuario, tokenAcceso } = usarAutenticacion();
  const {
    contenedores,
    resumen,
    actualizadoEn,
    cargando,
    recargando,
    error,
    accionEnCurso,
    autoRefresco,
    setAutoRefresco,
    recargar,
    controlarContenedor,
  } = usarContenedores(10_000);

  const [pestana, setPestana] = useState<PestanaModulo>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('oauth') ? 'despliegues' : 'contenedores';
  });
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [confirmacion, setConfirmacion] = useState<ConfirmacionAccion | null>(null);
  const [notificacion, setNotificacion] = useState<NotificacionEstado | null>(null);

  // Estado del visor de logs (RF-08)
  const [contenedorLogs, setContenedorLogs] = useState<Contenedor | null>(null);
  const [lineasLogs, setLineasLogs] = useState<string[]>([]);
  const [cantidadLineas, setCantidadLineas] = useState<number>(100);
  const [filtroLogs, setFiltroLogs] = useState('');
  const [cargandoLogs, setCargandoLogs] = useState(false);
  const [errorLogs, setErrorLogs] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const esAdmin =
    usuario?.rol === 'superadmin' ||
    usuario?.rol === 'administrador' ||
    usuario?.rol === 'colaborador';

  const mostrarNotificacion = useCallback((tipo: 'exito' | 'error', mensaje: string) => {
    setNotificacion({ tipo, mensaje });
    window.setTimeout(() => {
      setNotificacion((actual) => (actual?.mensaje === mensaje ? null : actual));
    }, 4000);
  }, []);

  const cargarLogs = useCallback(
    async (contenedor: Contenedor, lineas: number) => {
      if (!tokenAcceso) return;
      setCargandoLogs(true);
      setErrorLogs(null);
      try {
        const res = await contenedoresServicio.obtenerLogs(contenedor.id, lineas, tokenAcceso);
        setLineasLogs(res.lineas);
      } catch (err) {
        if (err instanceof ErrorApi) {
          setErrorLogs(err.message);
        } else {
          setErrorLogs('No se pudieron cargar los logs del contenedor');
        }
      } finally {
        setCargandoLogs(false);
      }
    },
    [tokenAcceso],
  );

  useEffect(() => {
    if (contenedorLogs) {
      void cargarLogs(contenedorLogs, cantidadLineas);
    }
  }, [contenedorLogs, cantidadLineas, cargarLogs]);

  const contenedoresFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return contenedores.filter((c) => {
      if (filtroEstado === 'activos' && c.estado !== 'running') return false;
      if (filtroEstado === 'detenidos' && c.estado !== 'stopped' && c.estado !== 'paused') {
        return false;
      }
      if (
        filtroEstado === 'problemas' &&
        c.estado !== 'unhealthy' &&
        c.estado !== 'restarting'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.imagen.toLowerCase().includes(q) ||
        c.idCorto.toLowerCase().includes(q) ||
        c.puertos.some((p) => String(p.publico ?? p.privado).includes(q))
      );
    });
  }, [contenedores, filtroEstado, busqueda]);

  const lineasLogsFiltradas = useMemo(() => {
    const q = filtroLogs.trim().toLowerCase();
    if (!q) return lineasLogs;
    return lineasLogs.filter((l) => l.toLowerCase().includes(q));
  }, [lineasLogs, filtroLogs]);

  const ejecutarAccionDirecta = async (contenedor: Contenedor, accion: AccionContenedor) => {
    try {
      const mensaje = await controlarContenedor(contenedor.id, accion);
      mostrarNotificacion('exito', `${contenedor.nombre}: ${mensaje}`);
    } catch (err) {
      const mensaje =
        err instanceof ErrorApi ? err.message : 'Error al ejecutar la acción en Docker';
      mostrarNotificacion('error', mensaje);
    }
  };

  const solicitarAccion = (contenedor: Contenedor, accion: AccionContenedor) => {
    if (accion === 'iniciar') {
      void ejecutarAccionDirecta(contenedor, accion);
      return;
    }
    setConfirmacion({ contenedor, accion });
  };

  const confirmarAccion = async () => {
    if (!confirmacion) return;
    const { contenedor, accion } = confirmacion;
    setConfirmacion(null);
    await ejecutarAccionDirecta(contenedor, accion);
  };

  const copiarLogs = async () => {
    if (lineasLogsFiltradas.length === 0) return;
    try {
      await navigator.clipboard.writeText(lineasLogsFiltradas.join('\n'));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      mostrarNotificacion('error', 'No se pudo copiar al portapapeles');
    }
  };

  return (
    <div className="w-full pt-20 px-4 sm:px-6 lg:px-7 pb-12 min-h-screen bg-canvas-base text-text-primary">
      <div className="w-full flex flex-col gap-5">
        {/* Cabecera limpia y aireada */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Servicios y Despliegues
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Monitoreo en tiempo real, control operativo y logs de contenedores Docker locales.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresco((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                autoRefresco
                  ? 'bg-primary/12 border-primary/30 text-primary'
                  : 'bg-surface-card border-border-hairline text-text-muted hover:text-text-primary'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  autoRefresco ? 'bg-primary animate-pulse' : 'bg-text-dim'
                }`}
              />
              <span>{autoRefresco ? 'Auto-refresco 10s' : 'Auto-refresco pausado'}</span>
            </button>

            <button
              type="button"
              onClick={() => void recargar()}
              disabled={recargando}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-card hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary transition-all disabled:opacity-60 cursor-pointer"
            >
              <span
                className={`material-symbols-outlined text-[16px] text-primary ${
                  recargando ? 'animate-spin' : ''
                }`}
              >
                refresh
              </span>
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Sub-pestañas limpias */}
        <div className="flex items-center justify-between gap-3 border-b border-border-hairline pb-3">
          <div className="inline-flex items-center p-1 rounded-xl bg-surface-card border border-border-hairline gap-1">
            <button
              type="button"
              onClick={() => setPestana('contenedores')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                pestana === 'contenedores'
                  ? 'bg-primary text-[var(--hs-on-accent)] shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">deployed_code</span>
              <span>Contenedores Docker</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  pestana === 'contenedores'
                    ? 'bg-black/15 text-[var(--hs-on-accent)]'
                    : 'bg-surface-card-elevated text-text-muted'
                }`}
              >
                {resumen.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPestana('despliegues')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                pestana === 'despliegues'
                  ? 'bg-primary text-[var(--hs-on-accent)] shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
              <span>Despliegues GitHub</span>
            </button>

            <button
              type="button"
              onClick={() => setPestana('portafolio')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                pestana === 'portafolio'
                  ? 'bg-primary text-[var(--hs-on-accent)] shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">folder_managed</span>
              <span>Proyectos y Pendientes</span>
            </button>
          </div>

          <span className="hidden sm:inline text-xs font-mono text-text-dim">
            Última lectura: {formatearHora(actualizadoEn)}
          </span>
        </div>

        {pestana === 'despliegues' ? (
          <PanelDesplieguesGithub />
        ) : pestana === 'portafolio' ? (
          <PanelPortafolioProyectos />
        ) : (
          <>
            {/* KPIs minimalistas estilo Ballast / Veyra */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-2xl bg-surface-card border border-border-hairline p-4 flex flex-col gap-1">
                <span className="text-xs text-text-muted font-medium">Total contenedores</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-3xl font-bold text-text-primary font-mono">
                    {resumen.total}
                  </span>
                  <span className="material-symbols-outlined text-[20px] text-text-dim">
                    inventory_2
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-card border border-border-hairline p-4 flex flex-col gap-1">
                <span className="text-xs text-text-muted font-medium">En ejecución</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-3xl font-bold text-primary font-mono">
                    {resumen.activos}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Activos
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-card border border-border-hairline p-4 flex flex-col gap-1">
                <span className="text-xs text-text-muted font-medium">Detenidos / Pausados</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-3xl font-bold text-text-primary font-mono">
                    {resumen.detenidos}
                  </span>
                  <span className="material-symbols-outlined text-[20px] text-text-dim">
                    pause_circle
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-card border border-border-hairline p-4 flex flex-col gap-1">
                <span className="text-xs text-text-muted font-medium">Requieren atención</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span
                    className={`text-3xl font-bold font-mono ${
                      resumen.conProblemas > 0 ? 'text-status-critical' : 'text-text-primary'
                    }`}
                  >
                    {resumen.conProblemas}
                  </span>
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      resumen.conProblemas > 0 ? 'text-status-critical' : 'text-text-dim'
                    }`}
                  >
                    {resumen.conProblemas > 0 ? 'warning' : 'verified'}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl bg-error-container border border-status-critical/30 px-4 py-3 text-xs text-status-critical flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void recargar()}
                  className="px-2.5 py-1 rounded-lg bg-surface-card text-text-primary border border-border-hairline font-medium cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Barra de filtros + buscador */}
            <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
              <div className="p-4 border-b border-border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'todos', texto: 'Todos', cuenta: resumen.total },
                      { id: 'activos', texto: 'Activos', cuenta: resumen.activos },
                      { id: 'detenidos', texto: 'Detenidos', cuenta: resumen.detenidos },
                      { id: 'problemas', texto: 'Con problemas', cuenta: resumen.conProblemas },
                    ] as const
                  ).map((f) => {
                    const activo = filtroEstado === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFiltroEstado(f.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          activo
                            ? 'bg-primary text-[var(--hs-on-accent)]'
                            : 'bg-surface-low text-text-muted hover:text-text-primary hover:bg-surface-card-elevated border border-border-hairline'
                        }`}
                      >
                        <span>{f.texto}</span>
                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                            activo ? 'bg-black/15' : 'bg-surface-card text-text-dim'
                          }`}
                        >
                          {f.cuenta}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-64">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-text-dim">
                    search
                  </span>
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Filtrar por nombre, imagen o puerto..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-surface-low border border-border-hairline text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                  />
                </div>
              </div>

              {/* Tabla principal limpia */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-hairline bg-surface-low/60 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                      <th className="py-3 px-4">Contenedor</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Puertos</th>
                      <th className="py-3 px-4">CPU</th>
                      <th className="py-3 px-4">RAM</th>
                      <th className="py-3 px-4">Red (RX / TX)</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-hairline text-sm">
                    {cargando ? (
                      Array.from({ length: 4 }).map((_, idx) => (
                        <tr key={idx} className="animate-pulse">
                          <td className="py-4 px-4" colSpan={7}>
                            <div className="h-5 rounded-lg bg-surface-card-elevated w-full" />
                          </td>
                        </tr>
                      ))
                    ) : contenedoresFiltrados.length === 0 ? (
                      <tr>
                        <td className="py-10 px-4 text-center text-sm text-text-muted" colSpan={7}>
                          No se encontraron contenedores con el filtro actual.
                        </td>
                      </tr>
                    ) : (
                      contenedoresFiltrados.map((contenedor) => {
                        const badge = etiquetaEstado(contenedor.estado);
                        const ocupado = accionEnCurso?.startsWith(`${contenedor.id}:`) ?? false;
                        const estaCorriendo =
                          contenedor.estado === 'running' || contenedor.estado === 'unhealthy';
                        const esNucleo = CONTENEDORES_NUCLEO_HOMESOC.has(contenedor.nombre);
                        const porcentajeRam =
                          contenedor.ramLimiteMb > 0
                            ? Math.min(100, (contenedor.ramUsadaMb / contenedor.ramLimiteMb) * 100)
                            : 0;

                        return (
                          <tr
                            key={contenedor.id}
                            className="hover:bg-surface-card-elevated/55 transition-colors"
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col min-w-[180px]">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-text-primary">
                                    {contenedor.nombre}
                                  </span>
                                  {esNucleo && (
                                    <span className="px-1.5 py-0.5 rounded bg-surface-low border border-border-hairline text-[10px] font-mono text-text-dim">
                                      HomeSOC
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-mono text-text-dim mt-0.5 truncate max-w-[260px]">
                                  {contenedor.imagen} • {contenedor.idCorto}
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badge.clasePill}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${badge.clasePunto}`} />
                                  {badge.texto}
                                </span>
                                <span className="text-[11px] text-text-dim font-mono">
                                  {contenedor.estadoDetalle}
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              {contenedor.puertos.length === 0 ? (
                                <span className="text-xs text-text-dim font-mono">Interno</span>
                              ) : (
                                <div className="flex flex-wrap gap-1 max-w-[170px]">
                                  {contenedor.puertos.slice(0, 3).map((p, i) => (
                                    <span
                                      key={i}
                                      className="px-1.5 py-0.5 rounded-md bg-surface-low border border-border-hairline text-[11px] font-mono text-text-muted"
                                    >
                                      {p.publico ? `${p.publico}→${p.privado}` : p.privado}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 min-w-[110px]">
                              <div className="flex flex-col gap-1">
                                <span className="font-mono text-xs font-semibold text-text-primary">
                                  {contenedor.porcentajeCpu.toFixed(1)}%
                                </span>
                                <div className="w-20 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${Math.min(100, contenedor.porcentajeCpu)}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 min-w-[130px]">
                              <div className="flex flex-col gap-1">
                                <span className="font-mono text-xs font-semibold text-text-primary">
                                  {contenedor.ramUsadaMb.toFixed(1)} MB
                                </span>
                                <div className="w-24 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-secondary transition-all"
                                    style={{ width: `${porcentajeRam}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                              <span className="text-primary">↓ {contenedor.redRxMb.toFixed(1)}</span>
                              <span className="mx-1.5 text-text-dim">/</span>
                              <span>↑ {contenedor.redTxMb.toFixed(1)} MB</span>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-end gap-1.5">
                                {esAdmin && !estaCorriendo && (
                                  <button
                                    type="button"
                                    disabled={ocupado}
                                    onClick={() => solicitarAccion(contenedor, 'iniciar')}
                                    title="Iniciar contenedor"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-[var(--hs-on-accent)] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">
                                      play_arrow
                                    </span>
                                    <span>Iniciar</span>
                                  </button>
                                )}

                                {esAdmin && estaCorriendo && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={ocupado}
                                      onClick={() => solicitarAccion(contenedor, 'reiniciar')}
                                      title="Reiniciar contenedor"
                                      className="p-1.5 rounded-lg bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-text-muted hover:text-primary disabled:opacity-50 transition-all cursor-pointer"
                                    >
                                      <span
                                        className={`material-symbols-outlined text-[17px] ${
                                          ocupado ? 'animate-spin' : ''
                                        }`}
                                      >
                                        restart_alt
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={ocupado}
                                      onClick={() => solicitarAccion(contenedor, 'detener')}
                                      title="Detener contenedor"
                                      className="p-1.5 rounded-lg bg-surface-low hover:bg-error-container border border-border-hairline text-text-muted hover:text-status-critical disabled:opacity-50 transition-all cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[17px]">
                                        stop
                                      </span>
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setFiltroLogs('');
                                    setContenedorLogs(contenedor);
                                  }}
                                  title="Ver logs recientes"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-muted hover:text-text-primary transition-all cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px]">
                                    article
                                  </span>
                                  <span className="hidden xl:inline">Logs</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de confirmación de acción (detener / reiniciar) */}
      {confirmacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-card border border-border-hairline p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmacion.accion === 'detener'
                    ? 'bg-error-container text-status-critical'
                    : 'bg-primary/15 text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {confirmacion.accion === 'detener' ? 'stop_circle' : 'restart_alt'}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  {confirmacion.accion === 'detener'
                    ? '¿Detener contenedor?'
                    : '¿Reiniciar contenedor?'}
                </h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  Vas a {confirmacion.accion}{' '}
                  <strong className="text-text-primary font-mono">
                    {confirmacion.contenedor.nombre}
                  </strong>
                  . Esta acción quedará registrada en la auditoría de HomeSOC.
                </p>
                {CONTENEDORES_NUCLEO_HOMESOC.has(confirmacion.contenedor.nombre) && (
                  <p className="mt-2 p-2.5 rounded-xl bg-error-container text-status-critical text-[11px] font-medium">
                    Aviso: este contenedor forma parte del entorno local de HomeSOC. Detenerlo
                    puede interrumpir temporalmente el panel.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setConfirmacion(null)}
                className="px-4 py-2 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-muted hover:text-text-primary cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarAccion()}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  confirmacion.accion === 'detener'
                    ? 'bg-status-critical text-white hover:opacity-90'
                    : 'bg-primary text-[var(--hs-on-accent)] hover:opacity-90'
                }`}
              >
                Confirmar {confirmacion.accion}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer / Modal de Logs recientes (RF-08) */}
      {contenedorLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <div className="w-full max-w-4xl h-[80vh] rounded-2xl bg-surface-card border border-border-hairline shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border-hairline flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[19px]">terminal</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">
                    Logs de <span className="font-mono text-primary">{contenedorLogs.nombre}</span>
                  </h3>
                  <p className="text-[11px] font-mono text-text-dim truncate">
                    {contenedorLogs.imagen} • {lineasLogsFiltradas.length} líneas visibles
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={filtroLogs}
                  onChange={(e) => setFiltroLogs(e.target.value)}
                  placeholder="Filtrar texto..."
                  className="h-8 px-2.5 rounded-lg bg-surface-low border border-border-hairline text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-primary w-40"
                />
                <select
                  value={cantidadLineas}
                  onChange={(e) => setCantidadLineas(Number(e.target.value))}
                  className="h-8 px-2 rounded-lg bg-surface-low border border-border-hairline text-xs font-mono text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value={50}>50 líneas</option>
                  <option value={100}>100 líneas</option>
                  <option value={250}>250 líneas</option>
                </select>
                <button
                  type="button"
                  onClick={() => void cargarLogs(contenedorLogs, cantidadLineas)}
                  className="h-8 px-2.5 rounded-lg bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs text-text-primary flex items-center gap-1 cursor-pointer"
                >
                  <span
                    className={`material-symbols-outlined text-[15px] ${
                      cargandoLogs ? 'animate-spin' : ''
                    }`}
                  >
                    refresh
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void copiarLogs()}
                  className="h-8 px-2.5 rounded-lg bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs text-text-primary flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-primary">
                    {copiado ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContenedorLogs(null)}
                  aria-label="Cerrar logs"
                  className="h-8 w-8 rounded-lg bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-text-muted hover:text-text-primary flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px]">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-surface-dim p-4 font-mono text-xs leading-relaxed">
              {cargandoLogs ? (
                <p className="text-text-dim">Cargando logs recientes...</p>
              ) : errorLogs ? (
                <p className="text-status-critical">{errorLogs}</p>
              ) : lineasLogsFiltradas.length === 0 ? (
                <p className="text-text-dim">Sin entradas de log disponibles.</p>
              ) : (
                lineasLogsFiltradas.map((linea, idx) => (
                  <div
                    key={idx}
                    className="py-0.5 px-2 rounded hover:bg-surface-card/60 whitespace-pre-wrap break-all text-text-primary/90"
                  >
                    <span className="inline-block w-8 select-none text-text-dim mr-2 text-right">
                      {idx + 1}
                    </span>
                    {linea}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast flotante de confirmación / error */}
      {notificacion && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl border shadow-xl backdrop-blur-xl flex items-center gap-2.5 text-xs font-medium ${
            notificacion.tipo === 'exito'
              ? 'bg-surface-card/95 border-primary/35 text-text-primary'
              : 'bg-surface-card/95 border-status-critical/40 text-status-critical'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] ${
              notificacion.tipo === 'exito' ? 'text-primary' : 'text-status-critical'
            }`}
          >
            {notificacion.tipo === 'exito' ? 'check_circle' : 'error'}
          </span>
          <span>{notificacion.mensaje}</span>
        </div>
      )}
    </div>
  );
}
