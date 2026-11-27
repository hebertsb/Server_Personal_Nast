import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { usarContenedores } from '../hooks/usarContenedores';
import { usarRecursosHost } from '../hooks/usarRecursosHost';
import { RangoHistorico } from '../tipos/RecursosHost';

type MetricaGrafica = 'cpu' | 'ram';

function formatearUptime(segundos: number): string {
  const dias = Math.floor(segundos / 86_400);
  const horas = Math.floor((segundos % 86_400) / 3_600);
  const minutos = Math.floor((segundos % 3_600) / 60);
  if (dias > 0) return `${dias}d ${horas}h ${minutos}m`;
  if (horas > 0) return `${horas}h ${minutos}m`;
  return `${minutos}m`;
}

function formatearGbDesdeMb(mb: number): string {
  return (mb / 1024).toFixed(2);
}

function formatearEtiquetaHora(iso: string, rango: RangoHistorico): string {
  try {
    const fecha = new Date(iso);
    if (rango === '7d') {
      return fecha.toLocaleDateString('es-BO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return fecha.toLocaleTimeString('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
      second: rango === '1h' ? '2-digit' : undefined,
    });
  } catch {
    return iso;
  }
}

export default function RecursosServidor() {
  const [rango, setRango] = useState<RangoHistorico>('24h');
  const [metrica, setMetrica] = useState<MetricaGrafica>('cpu');

  const {
    recursos,
    historico,
    cargando,
    recargando,
    error,
    autoRefresco,
    setAutoRefresco,
    recargar,
  } = usarRecursosHost(rango, 8_000);

  const { contenedores, resumen: resumenContenedores } = usarContenedores(10_000);

  const datosGrafica = useMemo(() => {
    if (!historico) return [];
    return historico.puntos.map((punto) => ({
      hora: formatearEtiquetaHora(punto.fechaHora, rango),
      cpu: punto.porcentajeCpu,
      ram: Math.round(punto.ramUsadaMb),
      ramGb: Number((punto.ramUsadaMb / 1024).toFixed(2)),
    }));
  }, [historico, rango]);

  const contenedoresActivos = useMemo(
    () =>
      contenedores
        .filter((c) => c.estado === 'running' || c.estado === 'unhealthy')
        .sort((a, b) => b.ramUsadaMb - a.ramUsadaMb)
        .slice(0, 6),
    [contenedores],
  );

  const discoPrincipal = recursos?.discos[0] ?? null;

  return (
    <div className="w-full pt-20 px-4 sm:px-6 lg:px-7 pb-12 min-h-screen bg-canvas-base text-text-primary">
      <div className="w-full flex flex-col gap-5">
        {/* Cabecera limpia y espaciosa */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Recursos del Servidor
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              {recursos ? (
                <>
                  {recursos.modeloCpu} ({recursos.cantidadNucleos} núcleos) • {recursos.plataforma}
                </>
              ) : (
                'Telemetría en vivo de CPU, memoria RAM, almacenamiento y contenedores.'
              )}
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
              <span>{autoRefresco ? 'En vivo (8s)' : 'Pausado'}</span>
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

        {/* 4 tarjetas KPI principales estilo Ballast / Veyra */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* KPI 1: CPU */}
          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-text-muted">CPU del Host</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-primary/12 text-primary border border-primary/25">
                <span className="material-symbols-outlined text-[13px]">thermostat</span>
                {recursos?.temperaturaC !== null && recursos?.temperaturaC !== undefined
                  ? `${recursos.temperaturaC} °C`
                  : 'Sensor N/D'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-mono text-text-primary">
                  {cargando || !recursos ? '—' : recursos.porcentajeCpu.toFixed(1)}
                </span>
                <span className="text-sm font-mono font-semibold text-primary">%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden mt-3">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(100, recursos?.porcentajeCpu ?? 0)}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-text-dim mt-2">
                Carga promedio:{' '}
                <span className="text-text-muted">
                  {recursos ? recursos.cargaPromedio.join(' / ') : '—'}
                </span>
              </p>
            </div>
          </div>

          {/* KPI 2: RAM */}
          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-text-muted">Memoria RAM</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-surface-low text-primary border border-border-hairline">
                {recursos ? `${recursos.porcentajeRam.toFixed(1)}%` : '—'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold font-mono text-text-primary">
                  {cargando || !recursos ? '—' : formatearGbDesdeMb(recursos.ramUsadaMb)}
                </span>
                <span className="text-xs font-mono text-text-muted">
                  / {recursos ? `${formatearGbDesdeMb(recursos.ramTotalMb)} GB` : '—'}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden mt-3">
                <div
                  className="h-full rounded-full bg-secondary transition-all duration-300"
                  style={{ width: `${Math.min(100, recursos?.porcentajeRam ?? 0)}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-text-dim mt-2">
                Disponible:{' '}
                <span className="text-text-muted">
                  {recursos ? `${formatearGbDesdeMb(recursos.ramLibreMb)} GB` : '—'}
                </span>
              </p>
            </div>
          </div>

          {/* KPI 3: Disco */}
          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-text-muted truncate">
                {discoPrincipal ? discoPrincipal.etiqueta : 'Disco Principal'} ({discoPrincipal?.puntoMontaje || '/'})
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-surface-low text-text-muted border border-border-hairline shrink-0">
                {discoPrincipal ? `${discoPrincipal.porcentajeUso.toFixed(1)}%` : '—'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold font-mono text-text-primary">
                  {discoPrincipal ? discoPrincipal.usadoGb.toFixed(1) : '—'}
                </span>
                <span className="text-xs font-mono text-text-muted">
                  / {discoPrincipal ? `${discoPrincipal.totalGb.toFixed(1)} GB` : '—'}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden mt-3">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(100, discoPrincipal?.porcentajeUso ?? 0)}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-text-dim mt-2">
                Libre:{' '}
                <span className="text-primary font-semibold">
                  {discoPrincipal ? `${discoPrincipal.libreGb.toFixed(1)} GB` : '—'}
                </span>
              </p>
            </div>
          </div>

          {/* KPI 4: Estado del sistema & contenedores */}
          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-text-muted">Actividad del Host</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/12 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                En línea
              </span>
            </div>

            <div>
              <div className="text-2xl font-bold font-mono text-text-primary">
                {recursos ? formatearUptime(recursos.tiempoActividadSeg) : '—'}
              </div>
              <p className="text-xs text-text-muted mt-1">Tiempo encendido continuo</p>
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border-hairline text-xs">
                <span className="text-text-muted">Contenedores activos</span>
                <Link
                  to="/servicios"
                  className="font-mono font-semibold text-primary hover:underline"
                >
                  {resumenContenedores.activos} / {resumenContenedores.total} →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfica histórica real (Recharts) + Desglose de núcleos */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          <div className="xl:col-span-8 rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Histórico de Rendimiento
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Muestras históricas persistidas en PostgreSQL (cada 30s)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex p-0.5 rounded-xl bg-surface-low border border-border-hairline text-xs">
                  <button
                    type="button"
                    onClick={() => setMetrica('cpu')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      metrica === 'cpu'
                        ? 'bg-primary text-[var(--hs-on-accent)]'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    CPU %
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetrica('ram')}
                    className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      metrica === 'ram'
                        ? 'bg-primary text-[var(--hs-on-accent)]'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    RAM (GB)
                  </button>
                </div>

                <div className="inline-flex p-0.5 rounded-xl bg-surface-low border border-border-hairline text-xs font-mono">
                  {(['1h', '24h', '7d'] as const).map((opcion) => (
                    <button
                      key={opcion}
                      type="button"
                      onClick={() => setRango(opcion)}
                      className={`min-w-[40px] px-2.5 py-1 rounded-lg font-medium border transition-colors cursor-pointer ${
                        rango === opcion
                          ? 'bg-surface-card-elevated text-primary border-primary/25'
                          : 'border-transparent text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {opcion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resumen del rango */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-surface-low border border-border-hairline text-xs">
              <div>
                <span className="text-text-dim block">Promedio</span>
                <span className="font-mono font-semibold text-text-primary text-sm">
                  {historico
                    ? metrica === 'cpu'
                      ? `${historico.resumen.promedioCpu.toFixed(1)}%`
                      : `${formatearGbDesdeMb(historico.resumen.promedioRamMb)} GB`
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-text-dim block">Pico máximo</span>
                <span className="font-mono font-semibold text-primary text-sm">
                  {historico
                    ? metrica === 'cpu'
                      ? `${historico.resumen.picoCpu.toFixed(1)}%`
                      : `${formatearGbDesdeMb(historico.resumen.picoRamMb)} GB`
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-text-dim block">Muestras guardadas</span>
                <span className="font-mono font-semibold text-text-primary text-sm">
                  {historico?.resumen.totalMuestras ?? 0}
                </span>
              </div>
            </div>

            <div className="w-full h-72">
              {datosGrafica.length === 0 ? (
                <div className="w-full h-full rounded-xl bg-surface-low border border-border-hairline flex items-center justify-center text-xs text-text-dim">
                  Recolectando primeras muestras históricas...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={datosGrafica} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaAcentoHost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--hs-accent)" stopOpacity={0.34} />
                        <stop offset="100%" stopColor="var(--hs-accent)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--hs-border-hairline)" />
                    <XAxis
                      dataKey="hora"
                      tick={{ fill: 'var(--hs-text-dim)', fontSize: 11 }}
                      axisLine={{ stroke: 'var(--hs-border-hairline)' }}
                      tickLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      domain={metrica === 'cpu' ? [0, 100] : ['auto', 'auto']}
                      tick={{ fill: 'var(--hs-text-dim)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (metrica === 'cpu' ? `${v}%` : `${v}G`)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--hs-surface-card)',
                        borderColor: 'var(--hs-border-hairline)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: 'var(--hs-text-primary)',
                      }}
                      formatter={(valor: unknown) => [
                        metrica === 'cpu' ? `${Number(valor).toFixed(1)} %` : `${Number(valor).toFixed(2)} GB`,
                        metrica === 'cpu' ? 'CPU' : 'RAM usada',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey={metrica === 'cpu' ? 'cpu' : 'ramGb'}
                      stroke="var(--hs-accent)"
                      strokeWidth={2.2}
                      fill="url(#areaAcentoHost)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Panel derecho: Uso por núcleo + Ficha del host */}
          <div className="xl:col-span-4 rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Carga por Núcleo</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Distribución instantánea de hilos disponibles
              </p>

              <div className="grid grid-cols-2 gap-2.5 mt-4 max-h-60 overflow-y-auto pr-1">
                {(recursos?.nucleos ?? []).map((nucleo) => (
                  <div
                    key={nucleo.indice}
                    className="p-2.5 rounded-xl bg-surface-low border border-border-hairline flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-text-dim">Core {nucleo.indice}</span>
                      <span className="font-semibold text-primary">
                        {nucleo.porcentajeUso.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.min(100, nucleo.porcentajeUso)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-border-hairline flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-dim">Host / Contenedor</span>
                <span className="font-mono text-text-primary">{recursos?.hostname || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-dim">Arquitectura</span>
                <span className="font-mono text-text-primary">{recursos?.arquitectura || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-dim">Temperatura</span>
                <span className="font-mono text-text-primary">
                  {recursos?.temperaturaC !== null && recursos?.temperaturaC !== undefined
                    ? `${recursos.temperaturaC} °C`
                    : 'No expuesta en local'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Almacenamiento y Discos (RF-27 — soporta múltiples discos configurables) */}
        {recursos && recursos.discos.length > 0 && (
          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Almacenamiento y Discos
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Puntos de montaje monitoreados (configurable vía DISCOS_MONITOREADOS)
                </p>
              </div>
              <span className="text-xs font-mono text-text-dim">
                {recursos.discos.length} {recursos.discos.length === 1 ? 'disco' : 'discos'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {recursos.discos.map((disco) => {
                const alerta = disco.porcentajeUso >= 80;
                return (
                  <div
                    key={`${disco.etiqueta}-${disco.puntoMontaje}`}
                    className="rounded-xl bg-surface-low border border-border-hairline p-4 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[18px] text-primary">
                          hard_drive
                        </span>
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-text-primary block truncate">
                            {disco.etiqueta}
                          </span>
                          <span className="text-[11px] font-mono text-text-dim">
                            Montaje: {disco.puntoMontaje}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                          alerta
                            ? 'bg-error-container text-status-critical'
                            : 'bg-primary/12 text-primary'
                        }`}
                      >
                        {disco.porcentajeUso.toFixed(1)}%
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          alerta ? 'bg-status-critical' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(100, disco.porcentajeUso)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-text-muted">
                      <span>
                        Usado: <strong className="text-text-primary">{disco.usadoGb.toFixed(1)} GB</strong> / {disco.totalGb.toFixed(1)} GB
                      </span>
                      <span className="text-primary font-semibold">
                        Libre: {disco.libreGb.toFixed(1)} GB
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Consumo real por contenedor activo (RF-26) */}
        <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
          <div className="px-5 py-4 border-b border-border-hairline flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Consumo por Contenedor Activo
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Top servicios en ejecución ordenados por memoria RAM
              </p>
            </div>
            <Link
              to="/servicios"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-primary transition-all"
            >
              <span>Gestionar todos</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-hairline bg-surface-low/60 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                  <th className="py-3 px-5">Contenedor</th>
                  <th className="py-3 px-4">Imagen</th>
                  <th className="py-3 px-4">CPU</th>
                  <th className="py-3 px-4">RAM</th>
                  <th className="py-3 px-5 text-right">Red (RX / TX)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-hairline">
                {contenedoresActivos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-5 text-center text-xs text-text-dim">
                      No hay contenedores activos detectados.
                    </td>
                  </tr>
                ) : (
                  contenedoresActivos.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-card-elevated/50 transition-colors">
                      <td className="py-3 px-5 font-semibold text-text-primary">{c.nombre}</td>
                      <td className="py-3 px-4 font-mono text-xs text-text-muted">{c.imagen}</td>
                      <td className="py-3 px-4 font-mono text-xs text-primary font-semibold">
                        {c.porcentajeCpu.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-text-primary">
                        {c.ramUsadaMb.toFixed(1)} MB
                      </td>
                      <td className="py-3 px-5 text-right font-mono text-xs text-text-muted">
                        ↓ {c.redRxMb.toFixed(1)} / ↑ {c.redTxMb.toFixed(1)} MB
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
