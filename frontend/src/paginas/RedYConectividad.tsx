import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import { ErrorApi } from '../servicios/apiCliente';
import {
  AnaliticaAccesosProyecto,
  EstadisticasPihole,
  seguridadServicio,
  SolicitudProyectoItem,
  VentanaAccesosProyecto,
} from '../servicios/seguridadServicio';

type SubVistaRed = 'pihole' | 'trafico-proyectos';

function estiloCodigoHttp(codigo: number): string {
  if (codigo >= 500) {
    return 'bg-error-container text-status-critical border-status-critical/30';
  }
  if (codigo >= 400) {
    return 'bg-status-warning/15 text-status-warning border-status-warning/30';
  }
  return 'bg-primary/12 text-primary border-primary/25';
}

export default function RedYConectividad() {
  const { tokenAcceso } = usarAutenticacion();
  const [subVista, setSubVista] = useState<SubVistaRed>('pihole');
  const [datos, setDatos] = useState<EstadisticasPihole | null>(null);
  const [analiticaAccesos, setAnaliticaAccesos] = useState<AnaliticaAccesosProyecto | null>(null);
  const [proyectoFiltro, setProyectoFiltro] = useState<string>('todos');
  const [ventanaAccesos, setVentanaAccesos] = useState<VentanaAccesosProyecto>('24h');
  const [ipsBloqueadas, setIpsBloqueadas] = useState<Set<string>>(() => new Set());
  const [ipBloqueando, setIpBloqueando] = useState<string | null>(null);
  const [mensajeAccion, setMensajeAccion] = useState<string | null>(null);
  const [filtroEstadoHttp, setFiltroEstadoHttp] = useState<'todas' | 'errores'>('todas');
  const [busquedaBitacora, setBusquedaBitacora] = useState<string>('');
  const [cargando, setCargando] = useState(true);
  const [simulandoTrafico, setSimulandoTrafico] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargando(true);
    try {
      const [resPihole, resAccesos, resIps] = await Promise.all([
        seguridadServicio.obtenerPihole(tokenAcceso),
        seguridadServicio.obtenerAnaliticaAccesos(tokenAcceso, proyectoFiltro, ventanaAccesos),
        seguridadServicio.listarIpsBloqueadas(tokenAcceso),
      ]);
      setDatos(resPihole);
      setAnaliticaAccesos(resAccesos);
      setIpsBloqueadas(new Set(resIps.ips.map((i) => i.direccionIp)));
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar telemetría de red');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso, proyectoFiltro, ventanaAccesos]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!mensajeAccion) return;
    const temporizador = window.setTimeout(() => setMensajeAccion(null), 4000);
    return () => window.clearTimeout(temporizador);
  }, [mensajeAccion]);

  const solicitudesFiltradas = useMemo(() => {
    const lista = analiticaAccesos?.solicitudesRecientes ?? [];
    const q = busquedaBitacora.trim().toLowerCase();
    return lista.filter((s) => {
      if (filtroEstadoHttp === 'errores' && s.codigoEstado < 400) {
        return false;
      }
      if (!q) return true;
      return [s.ipOrigen, s.ruta, s.nombreProyecto, s.pais ?? ''].some((campo) =>
        campo.toLowerCase().includes(q),
      );
    });
  }, [analiticaAccesos, filtroEstadoHttp, busquedaBitacora]);

  const manejarBloquearIp = async (sol: SolicitudProyectoItem) => {
    if (!tokenAcceso) return;
    if (
      !window.confirm(
        `¿Bloquear la IP ${sol.ipOrigen}? Se agregará a la lista negra del firewall.`,
      )
    ) {
      return;
    }
    setIpBloqueando(sol.ipOrigen);
    try {
      const motivo =
        `Bloqueo manual desde analítica HTTP: ${sol.metodo} ${sol.ruta} (${sol.codigoEstado}) en ${sol.nombreProyecto}`.slice(
          0,
          255,
        );
      await seguridadServicio.bloquearIp({ direccionIp: sol.ipOrigen, motivo }, tokenAcceso);
      setIpsBloqueadas((prev) => {
        const siguiente = new Set(prev);
        siguiente.add(sol.ipOrigen);
        return siguiente;
      });
      setMensajeAccion(`IP ${sol.ipOrigen} bloqueada correctamente`);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo bloquear la IP');
    } finally {
      setIpBloqueando(null);
    }
  };

  const manejarSimularTrafico = async () => {
    if (!tokenAcceso) return;
    setSimulandoTrafico(true);
    try {
      await seguridadServicio.simularAccesosProyecto(tokenAcceso);
      const resAccesos = await seguridadServicio.obtenerAnaliticaAccesos(
        tokenAcceso,
        proyectoFiltro,
        ventanaAccesos,
      );
      setAnaliticaAccesos(resAccesos);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo simular tráfico HTTP');
    } finally {
      setSimulandoTrafico(false);
    }
  };

  return (
    <div className="w-full pt-20 px-4 sm:px-6 lg:px-7 pb-12 min-h-screen bg-canvas-base text-text-primary">
      <div className="w-full flex flex-col gap-5">
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Red y Conectividad
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Filtrado DNS Pi-hole (RF-10..11) y flujo de accesos HTTP a proyectos desplegados
              (RF-16..19).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {subVista === 'pihole' && datos && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/12 border border-primary/25 text-xs font-medium text-primary">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {datos.modo === 'simulacion_local'
                  ? 'Pi-hole (Simulación Local)'
                  : 'Pi-hole Conectado'}
              </span>
            )}
            {import.meta.env.DEV && subVista === 'trafico-proyectos' && (
              <button
                type="button"
                onClick={() => void manejarSimularTrafico()}
                disabled={simulandoTrafico}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/12 hover:bg-primary/20 border border-primary/25 text-xs font-semibold text-primary cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                <span>{simulandoTrafico ? 'Generando...' : 'Simular tráfico HTTP'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void cargar()}
              disabled={cargando}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-card hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer"
            >
              <span
                className={`material-symbols-outlined text-[16px] text-primary ${
                  cargando ? 'animate-spin' : ''
                }`}
              >
                refresh
              </span>
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Selector de pestaña de Red */}
        <div className="inline-flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-surface-card border border-border-hairline w-fit">
          <button
            type="button"
            onClick={() => setSubVista('pihole')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              subVista === 'pihole'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-card-elevated'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">dns</span>
            <span>DNS Pi-hole y Dispositivos</span>
          </button>

          <button
            type="button"
            onClick={() => setSubVista('trafico-proyectos')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              subVista === 'trafico-proyectos'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-card-elevated'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">monitoring</span>
            <span>Tráfico y Accesos a Proyectos</span>
            <span className="px-1.5 py-0.5 rounded-md bg-surface-low text-[10px] font-mono text-primary">
              Fase 2
            </span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-error-container border border-status-critical/30 px-4 py-3 text-xs text-status-critical">
            {error}
          </div>
        )}

        {subVista === 'pihole' ? (
          <>
            {/* 4 KPIs Pi-hole (RF-10) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
              <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
                <span className="text-xs font-medium text-text-muted">Consultas DNS (24h)</span>
                <div className="text-3xl font-bold font-mono text-text-primary mt-2">
                  {datos ? datos.consultasTotales24h.toLocaleString('es-BO') : '—'}
                </div>
                <p className="text-[11px] text-text-dim mt-1">Total procesadas por Pi-hole</p>
              </div>

              <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
                <span className="text-xs font-medium text-text-muted">Consultas Bloqueadas</span>
                <div className="text-3xl font-bold font-mono text-primary mt-2">
                  {datos ? datos.consultasBloqueadas24h.toLocaleString('es-BO') : '—'}
                </div>
                <p className="text-[11px] text-text-dim mt-1">Rastreadores y anuncios filtrados</p>
              </div>

              <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
                <span className="text-xs font-medium text-text-muted">Porcentaje Bloqueado</span>
                <div className="text-3xl font-bold font-mono text-text-primary mt-2">
                  {datos ? `${datos.porcentajeBloqueado}%` : '—'}
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden mt-2.5">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, datos?.porcentajeBloqueado ?? 0)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
                <span className="text-xs font-medium text-text-muted">Dominios en Blocklist</span>
                <div className="text-3xl font-bold font-mono text-text-primary mt-2">
                  {datos ? datos.dominiosEnListaNegra.toLocaleString('es-BO') : '—'}
                </div>
                <p className="text-[11px] text-primary font-medium mt-1">
                  Protección DNS: {datos?.estadoProteccion === 'activo' ? 'Activa' : 'Pausada'}
                </p>
              </div>
            </div>

            {/* Gráfica de actividad DNS por hora + Clientes de red local */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-7 rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    Flujo de Consultas DNS (Permitidas vs. Bloqueadas)
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Actividad distribuida en las últimas 24 horas
                  </p>
                </div>

                <div className="w-full h-72">
                  {datos && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={datos.actividadPorHora}
                        margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="gradPermitidas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--hs-accent)" stopOpacity={0.32} />
                            <stop offset="100%" stopColor="var(--hs-accent)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--hs-border-hairline)" />
                        <XAxis
                          dataKey="hora"
                          tick={{ fill: 'var(--hs-text-dim)', fontSize: 11 }}
                          axisLine={{ stroke: 'var(--hs-border-hairline)' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: 'var(--hs-text-dim)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--hs-surface-card)',
                            borderColor: 'var(--hs-border-hairline)',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: 'var(--hs-text-primary)',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="permitidas"
                          name="Permitidas"
                          stroke="var(--hs-accent)"
                          strokeWidth={2.2}
                          fill="url(#gradPermitidas)"
                        />
                        <Area
                          type="monotone"
                          dataKey="bloqueadas"
                          name="Bloqueadas"
                          stroke="var(--hs-warning)"
                          strokeWidth={2}
                          fillOpacity={0}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Dispositivos activos en red local (RF-11) */}
              <div className="xl:col-span-5 rounded-2xl bg-surface-card border border-border-hairline overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-border-hairline flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">
                      Dispositivos en Red Local (RF-11)
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Clientes activos detectados por resolución DNS
                    </p>
                  </div>
                  <span className="text-xs font-mono text-primary">
                    {datos?.clientesRedLocal.length ?? 0} activos
                  </span>
                </div>

                <div className="divide-y divide-border-hairline flex-1">
                  {(datos?.clientesRedLocal ?? []).map((cliente) => (
                    <div
                      key={cliente.ip}
                      className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-surface-card-elevated/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          <span className="text-sm font-semibold text-text-primary truncate">
                            {cliente.hostname}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-text-dim block mt-0.5">
                          {cliente.ip} • {cliente.ultimaActividad}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-surface-low border border-border-hairline font-mono text-xs text-primary shrink-0">
                        {cliente.consultas.toLocaleString('es-BO')} req
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Dominios Permitidos y Bloqueados (RF-10) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
                <div className="px-5 py-4 border-b border-border-hairline">
                  <h2 className="text-sm font-semibold text-text-primary">
                    Top Dominios Permitidos
                  </h2>
                </div>
                <div className="divide-y divide-border-hairline">
                  {(datos?.topDominiosPermitidos ?? []).map((item) => (
                    <div key={item.dominio} className="px-5 py-3 flex items-center justify-between">
                      <span className="font-mono text-xs text-text-primary">{item.dominio}</span>
                      <span className="font-mono text-xs font-semibold text-primary">
                        {item.consultas.toLocaleString('es-BO')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
                <div className="px-5 py-4 border-b border-border-hairline">
                  <h2 className="text-sm font-semibold text-text-primary">
                    Top Dominios Bloqueados
                  </h2>
                </div>
                <div className="divide-y divide-border-hairline">
                  {(datos?.topDominiosBloqueados ?? []).map((item) => (
                    <div key={item.dominio} className="px-5 py-3 flex items-center justify-between">
                      <span className="font-mono text-xs text-text-primary">{item.dominio}</span>
                      <span className="font-mono text-xs font-semibold text-status-critical">
                        {item.consultas.toLocaleString('es-BO')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Sub-vista Fase 2: Flujo de datos y analítica de accesos a proyectos desplegados (RF-16..19) */
          <div className="flex flex-col gap-5">
            {/* Barra de filtros por proyecto y ventana temporal */}
            <div className="rounded-2xl bg-surface-card border border-border-hairline p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-text-muted mr-1.5">Proyecto:</span>
                {['todos', ...(analiticaAccesos?.proyectosDisponibles ?? [])].map((proy) => (
                  <button
                    key={proy}
                    type="button"
                    onClick={() => setProyectoFiltro(proy)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      proyectoFiltro === proy
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-low text-text-muted hover:text-text-primary border border-border-hairline'
                    }`}
                  >
                    {proy === 'todos' ? 'Todos los proyectos' : proy}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-low border border-border-hairline">
                {(['24h', '7d', '30d'] as VentanaAccesosProyecto[]).map((ventana) => (
                  <button
                    key={ventana}
                    type="button"
                    onClick={() => setVentanaAccesos(ventana)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-medium cursor-pointer ${
                      ventanaAccesos === ventana
                        ? 'bg-primary text-on-primary'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {ventana}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 KPIs de Accesos a Proyectos (RF-16) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
              <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
                <span className="text-xs font-medium text-text-muted">
                  Solicitudes HTTP ({ventanaAccesos})
                </span>
                <div className="text-3xl font-bold font-mono text-text-primary mt-2">
                  {analiticaAccesos
                    ? analiticaAccesos.resumen.totalVisitas.toLocaleString('es-BO')
                    : '—'}
                </div>
                <p className="text-[11px] text-text-dim mt-1">
                  Total de peticiones recibidas (RF-16)
                </p>
              </div>

              <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
                <span className="text-xs font-medium text-text-muted">Visitantes Únicos (IP)</span>
                <div className="text-3xl font-bold font-mono text-primary mt-2">
                  {analiticaAccesos
                    ? analiticaAccesos.resumen.visitantesUnicos.toLocaleString('es-BO')
                    : '—'}
                </div>
                <p className="text-[11px] text-text-dim mt-1">
                  Direcciones IP distintas registradas
                </p>
              </div>

              <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
                <span className="text-xs font-medium text-text-muted">Proyecto Más Activo</span>
                <div className="text-2xl font-bold font-mono text-text-primary mt-2 truncate">
                  {analiticaAccesos?.resumen.proyectoMasActivo ?? '—'}
                </div>
                <p className="text-[11px] text-primary font-medium mt-1">
                  Mayor volumen en la ventana seleccionada
                </p>
              </div>

              <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
                <span className="text-xs font-medium text-text-muted">Respuestas 4xx / 5xx</span>
                <div className="text-3xl font-bold font-mono text-status-warning mt-2">
                  {analiticaAccesos
                    ? analiticaAccesos.resumen.erroresHttp.toLocaleString('es-BO')
                    : '—'}
                </div>
                <p className="text-[11px] text-text-dim mt-1">
                  Rutas no encontradas, denegadas o errores
                </p>
              </div>
            </div>

            {/* Participación de Tráfico por Proyecto (RF-16) */}
            <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    Participación de Tráfico por Proyecto (RF-16)
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Haz clic en un proyecto para filtrar toda la vista
                  </p>
                </div>
              </div>

              {analiticaAccesos && analiticaAccesos.visitasPorProyecto.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {analiticaAccesos.visitasPorProyecto.map((proy) => {
                    const total = Math.max(1, analiticaAccesos.resumen.totalVisitas);
                    const porcentaje = Math.round((proy.totalVisitas / total) * 100);
                    const seleccionado = proyectoFiltro === proy.nombreProyecto;
                    return (
                      <button
                        key={proy.nombreProyecto}
                        type="button"
                        onClick={() =>
                          setProyectoFiltro(seleccionado ? 'todos' : proy.nombreProyecto)
                        }
                        className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          seleccionado
                            ? 'border-primary bg-primary/10'
                            : 'border-border-hairline bg-surface-low hover:bg-surface-card-elevated'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-text-primary truncate">
                            {proy.nombreProyecto}
                          </span>
                          <span className="text-xs font-mono font-semibold text-primary shrink-0">
                            {porcentaje}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono text-text-muted mt-1.5">
                          <span>{proy.totalVisitas.toLocaleString('es-BO')} req</span>
                          <span>{proy.visitantesUnicos.toLocaleString('es-BO')} IPs</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden mt-2.5">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.max(4, porcentaje)}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-text-dim py-2">
                  Sin tráfico en la ventana seleccionada
                </p>
              )}
            </div>

            {/* Gráfica de Horarios Pico (RF-19) + Distribución Geográfica (RF-18) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-7 rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">
                      Horarios Pico de Tráfico HTTP (RF-19)
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Curva continua de solicitudes por franja horaria (2xx/3xx vs. 4xx/5xx)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-medium text-text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                      Exitosas (2xx/3xx)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-status-warning" />
                      Errores (4xx/5xx)
                    </span>
                  </div>
                </div>

                {/* Mini-resumen de franja pico */}
                {analiticaAccesos && (() => {
                  const pico = [...analiticaAccesos.horariosPico].sort(
                    (a, b) => b.solicitudes - a.solicitudes,
                  )[0];
                  const promedioHora =
                    analiticaAccesos.horariosPico.length > 0
                      ? (
                          analiticaAccesos.resumen.totalVisitas /
                          analiticaAccesos.horariosPico.length
                        ).toFixed(1)
                      : '0.0';
                  return (
                    <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-surface-low/65 border border-border-hairline">
                      <div>
                        <span className="text-[11px] text-text-dim block">Franja pico</span>
                        <span className="text-sm font-bold font-mono text-primary">
                          {pico && pico.solicitudes > 0 ? `${pico.hora} (${pico.solicitudes} req)` : 'Sin pico'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-text-dim block">Promedio / hora</span>
                        <span className="text-sm font-bold font-mono text-text-primary">
                          {promedioHora} req/h
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-text-dim block">Tasa de éxito</span>
                        <span className="text-sm font-bold font-mono text-primary">
                          {analiticaAccesos.resumen.totalVisitas > 0
                            ? `${Math.round(
                                ((analiticaAccesos.resumen.totalVisitas -
                                  analiticaAccesos.resumen.erroresHttp) /
                                  analiticaAccesos.resumen.totalVisitas) *
                                  100,
                              )}%`
                            : '100%'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="w-full h-72">
                  {analiticaAccesos && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analiticaAccesos.horariosPico}
                        margin={{ top: 10, right: 12, left: -14, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="gradTraficoExitoso" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--hs-accent)" stopOpacity={0.36} />
                            <stop offset="100%" stopColor="var(--hs-accent)" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="gradTraficoError" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--hs-warning)" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="var(--hs-warning)" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--hs-border-hairline)" />
                        <XAxis
                          dataKey="hora"
                          tick={{ fill: 'var(--hs-text-dim)', fontSize: 11 }}
                          axisLine={{ stroke: 'var(--hs-border-hairline)' }}
                          tickLine={false}
                          minTickGap={18}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: 'var(--hs-text-dim)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--hs-surface-card)',
                            borderColor: 'var(--hs-border-hairline)',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: 'var(--hs-text-primary)',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="exitosas"
                          name="Exitosas (2xx/3xx)"
                          stroke="var(--hs-accent)"
                          strokeWidth={2.4}
                          fill="url(#gradTraficoExitoso)"
                          activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--hs-accent)' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="errores"
                          name="Errores (4xx/5xx)"
                          stroke="var(--hs-warning)"
                          strokeWidth={2}
                          fill="url(#gradTraficoError)"
                          activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--hs-warning)' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Distribución por País (RF-18) y Visitas por Proyecto */}
              <div className="xl:col-span-5 flex flex-col gap-5">
                <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
                  <h2 className="text-base font-semibold text-text-primary">
                    Origen Geográfico Aproximado (RF-18)
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Estimación best-effort por prefijo de IP / GeoIP
                  </p>

                  <div className="mt-4 flex flex-col gap-2.5">
                    {(analiticaAccesos?.distribucionPaises ?? []).map((item) => {
                      const total = Math.max(1, analiticaAccesos?.resumen.totalVisitas ?? 1);
                      const pct = Math.round((item.solicitudes / total) * 100);
                      return (
                        <div key={item.pais} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-text-primary">{item.pais}</span>
                            <span className="font-mono text-text-muted">
                              {item.solicitudes} req ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
                  <h2 className="text-base font-semibold text-text-primary">
                    Rutas Más Solicitadas (RF-19)
                  </h2>
                  <div className="mt-3 divide-y divide-border-hairline">
                    {(analiticaAccesos?.rutasMasSolicitadas ?? []).slice(0, 6).map((r) => (
                      <div
                        key={`${r.metodo}-${r.ruta}`}
                        className="py-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded-md bg-surface-low border border-border-hairline font-mono text-[10px] font-semibold text-primary shrink-0">
                            {r.metodo}
                          </span>
                          <span className="font-mono text-xs text-text-primary truncate">
                            {r.ruta}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-semibold text-text-muted shrink-0">
                          {r.solicitudes}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {mensajeAccion && (
              <div className="rounded-xl bg-primary/12 border border-primary/25 px-4 py-3 text-xs font-medium text-primary">
                {mensajeAccion}
              </div>
            )}

            {/* Bitácora detallada de solicitudes HTTP (RF-17) */}
            <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
              <div className="px-5 py-4 border-b border-border-hairline flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    Detalle de Solicitudes HTTP Recientes (RF-17)
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    IP de origen, proyecto destino, ruta, código HTTP, país estimado y User-Agent
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-low border border-border-hairline">
                    <button
                      type="button"
                      onClick={() => setFiltroEstadoHttp('todas')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                        filtroEstadoHttp === 'todas'
                          ? 'bg-primary text-on-primary'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroEstadoHttp('errores')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                        filtroEstadoHttp === 'errores'
                          ? 'bg-primary text-on-primary'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      Solo 4xx/5xx
                    </button>
                  </div>

                  <input
                    type="search"
                    value={busquedaBitacora}
                    onChange={(e) => setBusquedaBitacora(e.target.value)}
                    placeholder="Buscar IP, ruta o proyecto…"
                    className="rounded-xl bg-surface-low border border-border-hairline px-3 py-1.5 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-primary"
                  />

                  <span className="text-xs font-mono text-text-muted whitespace-nowrap">
                    {solicitudesFiltradas.length} de{' '}
                    {analiticaAccesos?.solicitudesRecientes.length ?? 0} registros
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-hairline text-[11px] font-semibold uppercase tracking-wider text-text-dim bg-surface-low/50">
                      <th className="py-3 px-4">Proyecto</th>
                      <th className="py-3 px-4">Método y Ruta</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">IP Origen</th>
                      <th className="py-3 px-4">País</th>
                      <th className="py-3 px-4">User-Agent</th>
                      <th className="py-3 px-4 text-right">Fecha y Hora</th>
                      <th className="py-3 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-hairline text-xs">
                    {solicitudesFiltradas.length > 0 ? (
                      solicitudesFiltradas.map((sol) => {
                        const yaBloqueada = ipsBloqueadas.has(sol.ipOrigen);
                        const esRedConfiable =
                          sol.pais === 'LAN Local' || sol.pais === 'Tailscale Mesh';
                        return (
                          <tr
                            key={sol.id}
                            className={`hover:bg-surface-card-elevated/40 ${
                              sol.codigoEstado >= 400 ? 'bg-error-container/30' : ''
                            }`}
                          >
                            <td className="py-3 px-4 font-semibold text-text-primary">
                              {sol.nombreProyecto}
                            </td>
                            <td className="py-3 px-4 font-mono text-text-primary">
                              <span className="text-primary font-semibold mr-1.5">
                                {sol.metodo}
                              </span>
                              {sol.ruta}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold ${estiloCodigoHttp(
                                  sol.codigoEstado,
                                )}`}
                              >
                                {sol.codigoEstado}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-text-muted">{sol.ipOrigen}</td>
                            <td className="py-3 px-4 font-mono text-text-primary">
                              {sol.pais ?? 'DESCONOCIDO'}
                            </td>
                            <td className="py-3 px-4 text-text-dim max-w-xs truncate">
                              {sol.userAgent}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-text-dim whitespace-nowrap">
                              {new Date(sol.fechaHora).toLocaleString('es-BO')}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {yaBloqueada ? (
                                <span className="inline-flex px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold bg-error-container text-status-critical border-status-critical/30">
                                  Bloqueada
                                </span>
                              ) : esRedConfiable ? (
                                <span className="text-[11px] text-text-dim">Red confiable</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void manejarBloquearIp(sol)}
                                  disabled={ipBloqueando === sol.ipOrigen}
                                  className="inline-flex items-center gap-1 text-status-critical border border-status-critical/30 hover:bg-error-container rounded-lg px-2 py-1 text-[11px] font-medium cursor-pointer disabled:opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[13px]">
                                    block
                                  </span>
                                  <span>
                                    {ipBloqueando === sol.ipOrigen ? 'Bloqueando…' : 'Bloquear'}
                                  </span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 px-4 text-center text-xs text-text-dim">
                          No hay solicitudes que coincidan con el filtro
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
