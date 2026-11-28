import { useCallback, useEffect, useState } from 'react';
import { usarAutenticacion } from '../../contexto/ContextoAutenticacion';
import { ErrorApi } from '../../servicios/apiCliente';
import {
  EstadoComponentePortafolio,
  EstadoProyectoPortafolio,
  portafolioServicio,
  PrioridadTareaPortafolio,
  ProyectoPortafolioItem,
  ResumenPortafolioRespuesta,
  TareaPortafolioItem,
  TipoComponentePortafolio,
} from '../../servicios/portafolioServicio';

const ETIQUETA_TIPO: Record<TipoComponentePortafolio, string> = {
  sistema: 'Sistema',
  landing: 'Landing Page',
  demo: 'Demo',
  api: 'API / Backend',
  bd: 'Base de Datos',
  otro: 'Servicio',
};

function badgeEstadoComponente(estado: EstadoComponentePortafolio): {
  texto: string;
  clase: string;
} {
  switch (estado) {
    case 'activo':
      return { texto: 'Activo', clase: 'bg-primary/15 text-primary border-primary/25' };
    case 'caido':
      return {
        texto: 'Caído',
        clase: 'bg-error-container text-status-critical border-status-critical/30',
      };
    case 'en_progreso':
      return {
        texto: 'En progreso',
        clase: 'bg-status-warning/15 text-status-warning border-status-warning/30',
      };
    default:
      return {
        texto: 'Pendiente',
        clase: 'bg-surface-card-elevated text-text-dim border-border-hairline',
      };
  }
}

export default function PanelPortafolioProyectos() {
  const { tokenAcceso, usuario } = usarAutenticacion();
  const [resumen, setResumen] = useState<ResumenPortafolioRespuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [autodetectando, setAutodetectando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Nuevo proyecto
  const [mostrarNuevoProyecto, setMostrarNuevoProyecto] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [prefijoNuevo, setPrefijoNuevo] = useState('');
  const [descNueva, setDescNueva] = useState('');
  const [estadoNuevo, setEstadoNuevo] = useState<EstadoProyectoPortafolio>('en_desarrollo');

  // Formulario rápido por proyecto (componente o tarea)
  const [proyectoCompAbierto, setProyectoCompAbierto] = useState<string | null>(null);
  const [compTipo, setCompTipo] = useState<TipoComponentePortafolio>('landing');
  const [compNombre, setCompNombre] = useState('');
  const [compUrl, setCompUrl] = useState('');
  const [compContenedor, setCompContenedor] = useState('');
  const [compEstado, setCompEstado] = useState<EstadoComponentePortafolio>('activo');

  const [nuevaTareaPorProy, setNuevaTareaPorProy] = useState<Record<string, string>>({});
  const [asignadoPorProy, setAsignadoPorProy] = useState<Record<string, string>>({});
  const [prioridadPorProy, setPrioridadPorProy] = useState<
    Record<string, PrioridadTareaPortafolio>
  >({});

  const puedeEditar =
    usuario?.rol === 'superadmin' ||
    usuario?.rol === 'administrador' ||
    usuario?.rol === 'colaborador';

  const cargar = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargando(true);
    try {
      const data = await portafolioServicio.obtenerResumen(tokenAcceso);
      setResumen(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el portafolio');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const manejarAutodetectar = async () => {
    if (!tokenAcceso || !puedeEditar) return;
    setAutodetectando(true);
    setError(null);
    try {
      const res = await portafolioServicio.autodetectar(tokenAcceso);
      await cargar();
      setAviso(
        res.creados > 0
          ? `Se detectaron y crearon ${res.creados} proyecto(s) desde tus contenedores Docker.`
          : 'Todos tus grupos de contenedores Docker ya están registrados en el portafolio.',
      );
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo auto-detectar');
    } finally {
      setAutodetectando(false);
    }
  };

  const manejarCrearProyecto = async () => {
    if (!tokenAcceso || !nombreNuevo.trim()) return;
    try {
      await portafolioServicio.crearProyecto(
        {
          nombre: nombreNuevo.trim(),
          prefijoContenedor: prefijoNuevo.trim() || nombreNuevo.trim().toLowerCase(),
          descripcion: descNueva.trim(),
          estado: estadoNuevo,
        },
        tokenAcceso,
      );
      setNombreNuevo('');
      setPrefijoNuevo('');
      setDescNueva('');
      setMostrarNuevoProyecto(false);
      setAviso('Proyecto agregado al portafolio.');
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo crear el proyecto');
    }
  };

  const manejarCrearComponente = async (proyectoId: string) => {
    if (!tokenAcceso || !compNombre.trim()) return;
    try {
      await portafolioServicio.crearComponente(
        proyectoId,
        {
          tipo: compTipo,
          nombre: compNombre.trim(),
          url: compUrl.trim(),
          contenedorNombre: compContenedor.trim(),
          estadoManual: compEstado,
        },
        tokenAcceso,
      );
      setCompNombre('');
      setCompUrl('');
      setCompContenedor('');
      setProyectoCompAbierto(null);
      setAviso('Componente guardado y notificado por el canal de alertas.');
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo agregar el componente');
    }
  };

  const manejarCrearTarea = async (proyectoId: string) => {
    if (!tokenAcceso) return;
    const titulo = (nuevaTareaPorProy[proyectoId] ?? '').trim();
    if (!titulo) return;
    try {
      await portafolioServicio.crearTarea(
        proyectoId,
        {
          titulo,
          prioridad: prioridadPorProy[proyectoId] ?? 'media',
          asignadoA: (asignadoPorProy[proyectoId] ?? '').trim(),
        },
        tokenAcceso,
      );
      setNuevaTareaPorProy((prev) => ({ ...prev, [proyectoId]: '' }));
      setAsignadoPorProy((prev) => ({ ...prev, [proyectoId]: '' }));
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo agregar el pendiente');
    }
  };

  const manejarToggleTarea = async (tarea: TareaPortafolioItem) => {
    if (!tokenAcceso || !puedeEditar) return;
    const siguiente = tarea.estado === 'completado' ? 'pendiente' : 'completado';
    try {
      await portafolioServicio.actualizarTarea(tarea.id, { estado: siguiente }, tokenAcceso);
      if (siguiente === 'completado') {
        setAviso(`Pendiente "${tarea.titulo}" marcado como completado (notificado a Telegram/n8n).`);
      }
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo actualizar el pendiente');
    }
  };

  const manejarEliminarProyecto = async (proy: ProyectoPortafolioItem) => {
    if (!tokenAcceso) return;
    if (!window.confirm(`¿Quitar "${proy.nombre}" del portafolio? No detiene ningún contenedor.`)) {
      return;
    }
    try {
      await portafolioServicio.eliminarProyecto(proy.id, tokenAcceso);
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo eliminar');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="p-3.5 rounded-xl bg-error-container border border-status-critical/30 text-xs text-status-critical">
          {error}
        </div>
      )}
      {aviso && (
        <div className="p-3.5 rounded-xl bg-primary/12 border border-primary/25 text-xs text-primary flex items-center justify-between gap-2">
          <span>{aviso}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="text-[11px] underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* KPIs globales del Portafolio */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl bg-surface-card border border-border-hairline p-4">
          <span className="text-xs text-text-muted">Proyectos</span>
          <div className="text-2xl font-bold font-mono text-text-primary mt-1">
            {resumen?.totalProyectos ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-surface-card border border-border-hairline p-4">
          <span className="text-xs text-text-muted">A medias / mejoras</span>
          <div className="text-2xl font-bold font-mono text-status-warning mt-1">
            {resumen?.proyectosAMedias ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-surface-card border border-border-hairline p-4">
          <span className="text-xs text-text-muted">Componentes caídos</span>
          <div className="text-2xl font-bold font-mono text-status-critical mt-1">
            {resumen?.componentesCaidos ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-surface-card border border-border-hairline p-4">
          <span className="text-xs text-text-muted">Pendientes abiertos</span>
          <div className="text-2xl font-bold font-mono text-primary mt-1">
            {resumen?.tareasPendientes ?? 0}
          </div>
        </div>
        <div className="rounded-2xl bg-surface-card border border-border-hairline p-4 col-span-2 lg:col-span-1">
          <span className="text-xs text-text-muted">RAM total proyectos</span>
          <div className="text-2xl font-bold font-mono text-text-primary mt-1">
            {resumen ? `${resumen.ramTotalProyectosMb} MB` : '0 MB'}
          </div>
        </div>
      </div>

      {/* Barra de acciones */}
      {puedeEditar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-text-muted">
            Organiza tus proyectos por piezas (Sistema, Landing, Demo, API, BD), controla su RAM y
            consulta pendientes por chat o voz.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={autodetectando}
              onClick={() => void manejarAutodetectar()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/35 bg-primary/10 text-primary text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
              <span>{autodetectando ? 'Detectando…' : 'Auto-detectar desde Docker'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMostrarNuevoProyecto((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Nuevo proyecto</span>
            </button>
          </div>
        </div>
      )}

      {/* Formulario nuevo proyecto */}
      {mostrarNuevoProyecto && (
        <div className="rounded-2xl bg-surface-card border border-primary/30 p-4 flex flex-col gap-3">
          <div className="text-sm font-semibold text-text-primary">Registrar proyecto en el Portafolio</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Nombre (ej. Synexoria)"
              className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
            />
            <input
              type="text"
              value={prefijoNuevo}
              onChange={(e) => setPrefijoNuevo(e.target.value)}
              placeholder="Prefijo Docker (ej. synexoria)"
              className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
            />
            <select
              value={estadoNuevo}
              onChange={(e) => setEstadoNuevo(e.target.value as EstadoProyectoPortafolio)}
              className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
            >
              <option value="en_desarrollo">En desarrollo (a medias)</option>
              <option value="en_produccion">En producción</option>
              <option value="pausado">Pausado</option>
            </select>
            <button
              type="button"
              onClick={() => void manejarCrearProyecto()}
              className="rounded-xl bg-primary text-[var(--hs-on-accent)] px-3 py-2 text-xs font-semibold cursor-pointer"
            >
              Guardar proyecto
            </button>
          </div>
          <input
            type="text"
            value={descNueva}
            onChange={(e) => setDescNueva(e.target.value)}
            placeholder="Descripción breve (opcional)"
            className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
          />
        </div>
      )}

      {/* Lista agrupada por proyecto */}
      {cargando ? (
        <div className="p-8 text-center text-xs font-mono text-text-dim">
          Cargando portafolio y consumo en vivo…
        </div>
      ) : !resumen || resumen.proyectos.length === 0 ? (
        <div className="rounded-2xl bg-surface-card border border-border-hairline p-8 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-primary/70">folder_managed</span>
          <div className="text-sm font-semibold text-text-primary">
            Tu Portafolio de Proyectos está vacío
          </div>
          <p className="text-xs text-text-muted max-w-md">
            Haz clic en <strong>Auto-detectar desde Docker</strong> para agrupar automáticamente tus
            proyectos reales (Synexoria, Adorbit, Ajedrez, HomeSOC, etc.) con su RAM total y
            componentes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {resumen.proyectos.map((proy) => (
            <div
              key={proy.id}
              className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-4"
            >
              {/* Encabezado del proyecto */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-text-primary">{proy.nombre}</h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-primary/12 text-primary border border-primary/25">
                      {proy.ramTotalMb} MB RAM
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface-low text-text-muted border border-border-hairline">
                      CPU {proy.cpuTotalPorcentaje}%
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                        proy.tieneLanding
                          ? 'bg-primary/12 text-primary'
                          : 'bg-status-warning/15 text-status-warning'
                      }`}
                    >
                      {proy.tieneLanding ? 'Landing OK' : 'Sin Landing'}
                    </span>
                  </div>
                  {proy.descripcion && (
                    <p className="text-xs text-text-muted mt-1">{proy.descripcion}</p>
                  )}
                </div>
                {(usuario?.rol === 'superadmin' || usuario?.rol === 'administrador') && (
                  <button
                    type="button"
                    onClick={() => void manejarEliminarProyecto(proy)}
                    title="Quitar proyecto del portafolio"
                    className="p-1.5 rounded-lg text-text-dim hover:text-status-critical hover:bg-error-container/50 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>

              {/* Avisos rápidos del proyecto */}
              {proy.avisos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {proy.avisos.map((av, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-status-warning/12 border border-status-warning/25 text-[11px] text-status-warning font-medium"
                    >
                      {av}
                    </span>
                  ))}
                </div>
              )}

              {/* Sub-componentes (Sistema, Landing, Demo, API, BD) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">
                    Servicios y Sub-componentes ({proy.componentes.length})
                  </span>
                  {puedeEditar && (
                    <button
                      type="button"
                      onClick={() =>
                        setProyectoCompAbierto(proyectoCompAbierto === proy.id ? null : proy.id)
                      }
                      className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                    >
                      + Agregar pieza (Landing / Demo / API)
                    </button>
                  )}
                </div>

                {proyectoCompAbierto === proy.id && (
                  <div className="p-3 rounded-xl bg-surface-low border border-border-hairline flex flex-col gap-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <select
                        value={compTipo}
                        onChange={(e) => setCompTipo(e.target.value as TipoComponentePortafolio)}
                        className="rounded-lg bg-surface-card border border-border-hairline px-2.5 py-1.5 text-xs text-text-primary"
                      >
                        <option value="landing">Landing Page</option>
                        <option value="sistema">Sistema</option>
                        <option value="demo">Demo</option>
                        <option value="api">API / Backend</option>
                        <option value="bd">Base de Datos</option>
                        <option value="otro">Otro</option>
                      </select>
                      <input
                        type="text"
                        value={compNombre}
                        onChange={(e) => setCompNombre(e.target.value)}
                        placeholder="Nombre (ej. Landing v1)"
                        className="rounded-lg bg-surface-card border border-border-hairline px-2.5 py-1.5 text-xs text-text-primary"
                      />
                      <select
                        value={compEstado}
                        onChange={(e) =>
                          setCompEstado(e.target.value as EstadoComponentePortafolio)
                        }
                        className="rounded-lg bg-surface-card border border-border-hairline px-2.5 py-1.5 text-xs text-text-primary"
                      >
                        <option value="activo">Activo</option>
                        <option value="en_progreso">En progreso</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="caido">Caído</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={compUrl}
                        onChange={(e) => setCompUrl(e.target.value)}
                        placeholder="URL (opcional)"
                        className="rounded-lg bg-surface-card border border-border-hairline px-2.5 py-1.5 text-xs text-text-primary"
                      />
                      <input
                        type="text"
                        value={compContenedor}
                        onChange={(e) => setCompContenedor(e.target.value)}
                        placeholder="Contenedor Docker (opcional)"
                        className="rounded-lg bg-surface-card border border-border-hairline px-2.5 py-1.5 text-xs font-mono text-text-primary"
                      />
                      <button
                        type="button"
                        onClick={() => void manejarCrearComponente(proy.id)}
                        className="rounded-lg bg-primary text-[var(--hs-on-accent)] px-3 py-1.5 text-xs font-semibold cursor-pointer"
                      >
                        Guardar pieza
                      </button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-border-hairline rounded-xl border border-border-hairline bg-surface-low/60 overflow-hidden">
                  {proy.componentes.length === 0 ? (
                    <div className="px-3 py-2.5 text-[11px] text-text-dim">
                      Sin componentes registrados todavía.
                    </div>
                  ) : (
                    proy.componentes.map((comp) => {
                      const b = badgeEstadoComponente(comp.estadoVivo);
                      return (
                        <div
                          key={comp.id}
                          className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-surface-card text-[10px] font-mono text-text-muted border border-border-hairline">
                              {ETIQUETA_TIPO[comp.tipo]}
                            </span>
                            <span className="font-medium text-text-primary truncate">
                              {comp.nombre}
                            </span>
                            {comp.responsable && (
                              <span className="text-[10px] text-text-dim">({comp.responsable})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {comp.ramMb > 0 && (
                              <span className="text-[11px] font-mono text-text-muted">
                                {comp.ramMb} MB
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold ${b.clase}`}
                            >
                              {b.texto}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pendientes y mejoras */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-text-primary">
                  Pendientes y mejoras ({proy.pendientesAbiertos} abierto(s))
                </span>

                <div className="flex flex-col gap-1.5">
                  {proy.tareas.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-low border border-border-hairline text-xs"
                    >
                      <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={t.estado === 'completado'}
                          disabled={!puedeEditar}
                          onChange={() => void manejarToggleTarea(t)}
                          className="accent-primary cursor-pointer"
                        />
                        <span
                          className={
                            t.estado === 'completado'
                              ? 'line-through text-text-dim truncate'
                              : 'text-text-primary truncate'
                          }
                        >
                          {t.titulo}
                        </span>
                      </label>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {t.asignadoA && (
                          <span className="px-1.5 py-0.5 rounded bg-surface-card text-[10px] font-mono text-text-muted">
                            {t.asignadoA}
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            t.prioridad === 'alta'
                              ? 'bg-error-container text-status-critical'
                              : 'bg-surface-card text-text-dim'
                          }`}
                        >
                          {t.prioridad}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {puedeEditar && (
                  <div className="flex flex-col sm:flex-row gap-1.5 mt-1">
                    <input
                      type="text"
                      value={nuevaTareaPorProy[proy.id] ?? ''}
                      onChange={(e) =>
                        setNuevaTareaPorProy((prev) => ({ ...prev, [proy.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void manejarCrearTarea(proy.id);
                      }}
                      placeholder="Agregar pendiente (ej. Subir landing page)…"
                      className="flex-1 rounded-xl bg-surface-low border border-border-hairline px-3 py-1.5 text-xs text-text-primary"
                    />
                    <input
                      type="text"
                      value={asignadoPorProy[proy.id] ?? ''}
                      onChange={(e) =>
                        setAsignadoPorProy((prev) => ({ ...prev, [proy.id]: e.target.value }))
                      }
                      placeholder="Responsable"
                      className="sm:w-28 rounded-xl bg-surface-low border border-border-hairline px-2.5 py-1.5 text-xs text-text-primary"
                    />
                    <select
                      value={prioridadPorProy[proy.id] ?? 'media'}
                      onChange={(e) =>
                        setPrioridadPorProy((prev) => ({
                          ...prev,
                          [proy.id]: e.target.value as PrioridadTareaPortafolio,
                        }))
                      }
                      className="sm:w-24 rounded-xl bg-surface-low border border-border-hairline px-2 py-1.5 text-xs text-text-primary"
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void manejarCrearTarea(proy.id)}
                      className="px-3 py-1.5 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer"
                    >
                      Añadir
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
