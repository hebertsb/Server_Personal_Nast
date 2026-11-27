import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import { PALETAS_ACENTO, usarTema } from '../contexto/ContextoTema';
import { ErrorApi } from '../servicios/apiCliente';
import { autenticacionServicio, Estado2FA } from '../servicios/autenticacionServicio';
import { ConexionGithubItem, githubServicio } from '../servicios/githubServicio';
import { iaMcpServicio, TokenMcpItem } from '../servicios/iaMcpServicio';
import {
  AlertaEnviadaItem,
  ConfiguracionNotificacionItem,
  seguridadServicio,
} from '../servicios/seguridadServicio';

interface EstadoSaludSistema {
  estado: string;
  postgres: string;
  docker: string;
  marcaTiempo?: string;
}

interface EventoInstalacionPwa extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ETIQUETAS_EVENTO: Record<string, string> = {
  fuerza_bruta_ssh: 'Ataque de fuerza bruta SSH',
  '2fa_fallido_externo': 'Fallo de 2FA desde red externa',
  rate_limit_login: 'Bloqueo por límite de intentos de login',
  ip_bloqueada: 'Dirección IP bloqueada',
  servidor_arranque: 'Arranque del servidor (en línea nuevamente)',
  alerta_recurso: 'Umbral de recursos del host (CPU/RAM/Disco/Temp)',
  auto_healing: 'Auto-healing de contenedor ejecutado',
  auto_healing_critico: 'Escalado crítico de Auto-healing',
  energia_corte_luz: 'Corte de luz (paso a batería)',
  energia_bateria_critica: 'Batería crítica (apagado ordenado)',
  aviso_actualizaciones: 'Aviso de actualizaciones pendientes',
  gate_seguridad_bloqueado: 'Gate de seguridad bloqueó despliegue',
  despliegue_rollback_automatico: 'Rollback automático por fallo de health check',
};

export default function ConfiguracionGeneral() {
  const { tokenAcceso, usuario } = usarAutenticacion();
  const { acento, esOscuro, alternarTema, establecerAcento } = usarTema();

  const [salud, setSalud] = useState<EstadoSaludSistema | null>(null);
  const [estado2FA, setEstado2FA] = useState<Estado2FA | null>(null);
  const [conexionGithub, setConexionGithub] = useState<ConexionGithubItem | null>(null);
  const [configNotifs, setConfigNotifs] = useState<ConfiguracionNotificacionItem[]>([]);
  const [alertas, setAlertas] = useState<AlertaEnviadaItem[]>([]);
  const [tokensMcp, setTokensMcp] = useState<TokenMcpItem[]>([]);
  const [nombreTokenMcp, setNombreTokenMcp] = useState('N.O.V.A. (GlassIsland)');
  const [permisoTokenMcp, setPermisoTokenMcp] = useState<'lectura' | 'escritura'>('lectura');
  const [tokenMcpRecienCreado, setTokenMcpRecienCreado] = useState<string | null>(null);
  const [creandoTokenMcp, setCreandoTokenMcp] = useState(false);
  const [urlCodeServer, setUrlCodeServer] = useState<string>(
    () => localStorage.getItem('homesoc_codeserver_url') || '',
  );
  const [rutaCodeServer, setRutaCodeServer] = useState<string>(
    () => localStorage.getItem('homesoc_codeserver_ruta') || '/home/coder/project',
  );
  const [cargando, setCargando] = useState(true);
  const [probandoAlerta, setProbandoAlerta] = useState(false);
  const [actualizandoEvento, setActualizandoEvento] = useState<string | null>(null);
  const [eventoPwa, setEventoPwa] = useState<EventoInstalacionPwa | null>(null);
  const [pwaInstalada, setPwaInstalada] = useState(false);
  const [permisoNotif, setPermisoNotif] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'no_soportado',
  );
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const esAdmin = usuario?.rol === 'superadmin' || usuario?.rol === 'administrador';

  const cargarTodo = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargando(true);
    try {
      const [resSalud, res2FA, resGh, resNotifs, resMcp] = await Promise.all([
        fetch('/health')
          .then((r) => (r.ok ? (r.json() as Promise<EstadoSaludSistema>) : null))
          .catch(() => null),
        autenticacionServicio.obtenerEstado2FA(tokenAcceso),
        githubServicio.obtenerEstado(tokenAcceso),
        seguridadServicio.listarAlertasNotificaciones(tokenAcceso),
        iaMcpServicio.listarTokensMcp(tokenAcceso).catch(() => ({ tokens: [] })),
      ]);

      setSalud(resSalud);
      setEstado2FA(res2FA);
      setConexionGithub(resGh.conexion);
      setConfigNotifs(resNotifs.configuraciones ?? []);
      setAlertas(resNotifs.alertas ?? []);
      setTokensMcp(resMcp.tokens ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar la configuración');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    void cargarTodo();
  }, [cargarTodo]);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setPwaInstalada(true);
    }
    const manejador = (e: Event) => {
      e.preventDefault();
      setEventoPwa(e as EventoInstalacionPwa);
    };
    window.addEventListener('beforeinstallprompt', manejador);
    return () => window.removeEventListener('beforeinstallprompt', manejador);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const manejarProbarAlerta = async () => {
    if (!tokenAcceso) return;
    setProbandoAlerta(true);
    try {
      const { alerta } = await seguridadServicio.probarNotificacion(tokenAcceso);
      setAlertas((prev) => [alerta, ...prev]);
      setAviso('Notificación de prueba enviada correctamente');
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo enviar la alerta de prueba');
    } finally {
      setProbandoAlerta(false);
    }
  };

  const manejarToggleNotificacion = async (cfg: ConfiguracionNotificacionItem) => {
    if (!tokenAcceso || !esAdmin) return;
    setActualizandoEvento(cfg.id);
    try {
      const { configuracion } = await seguridadServicio.actualizarConfiguracionNotificacion(
        {
          tipoEvento: cfg.tipoEvento,
          canal: cfg.canal,
          destino: cfg.destino,
          habilitado: !cfg.habilitado,
        },
        tokenAcceso,
      );
      setConfigNotifs((prev) =>
        prev.map((c) => (c.id === configuracion.id ? configuracion : c)),
      );
      setAviso(
        `Evento "${ETIQUETAS_EVENTO[cfg.tipoEvento] ?? cfg.tipoEvento}" ${
          configuracion.habilitado ? 'habilitado' : 'pausado'
        }`,
      );
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo actualizar la notificación');
    } finally {
      setActualizandoEvento(null);
    }
  };

  const manejarInstalarPwa = async () => {
    if (!eventoPwa) return;
    await eventoPwa.prompt();
    const eleccion = await eventoPwa.userChoice;
    if (eleccion.outcome === 'accepted') {
      setPwaInstalada(true);
      setAviso('HomeSOC instalado como aplicación PWA');
    }
    setEventoPwa(null);
  };

  const manejarSolicitarPermisoNotif = async () => {
    if (!('Notification' in window)) return;
    const resultado = await Notification.requestPermission();
    setPermisoNotif(resultado);
    if (resultado === 'granted') {
      setAviso('Notificaciones en tiempo real del navegador/PWA activadas');
    } else if (resultado === 'denied') {
      setError('El navegador bloqueó las notificaciones. Puedes habilitarlas en el candado de la URL.');
    }
  };

  const manejarCrearTokenMcp = async (e: FormEvent) => {
    e.preventDefault();
    if (!tokenAcceso || !nombreTokenMcp.trim()) return;
    setCreandoTokenMcp(true);
    try {
      const res = await iaMcpServicio.crearTokenMcp(
        { nombre: nombreTokenMcp.trim(), permiso: permisoTokenMcp },
        tokenAcceso,
      );
      setTokenMcpRecienCreado(res.tokenPlano);
      setTokensMcp((prev) => [res.token, ...prev]);
      setAviso('Token MCP creado. Cópialo ahora: no volverá a mostrarse.');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo crear el token MCP');
    } finally {
      setCreandoTokenMcp(false);
    }
  };

  const manejarRevocarTokenMcp = async (id: string) => {
    if (!tokenAcceso) return;
    if (!window.confirm('¿Revocar este token MCP? El agente externo perderá acceso de inmediato.')) {
      return;
    }
    try {
      await iaMcpServicio.revocarTokenMcp(id, tokenAcceso);
      setTokensMcp((prev) => prev.map((t) => (t.id === id ? { ...t, revocado: true } : t)));
      setAviso('Token MCP revocado correctamente');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo revocar el token MCP');
    }
  };

  const notifsHabilitadas = configNotifs.filter((c) => c.habilitado).length;

  return (
    <div className="w-full pt-20 px-4 sm:px-6 lg:px-7 pb-12 min-h-screen bg-canvas-base text-text-primary">
      <div className="w-full flex flex-col gap-5">
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Configuración General
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Estado del sistema, matriz de notificaciones (RF-20, RF-21), seguridad, integración
              GitHub, apariencia y Progressive Web App (RF-23a).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {eventoPwa && !pwaInstalada && (
              <button
                type="button"
                onClick={() => void manejarInstalarPwa()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">install_desktop</span>
                <span>Instalar App (PWA)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void cargarTodo()}
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

        {/* 4 KPIs reales del sistema */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
            <span className="text-xs font-medium text-text-muted">Motor Backend &amp; DB</span>
            <div className="text-2xl font-bold font-mono text-primary mt-2">
              {salud?.estado === 'ok' ? 'En línea' : 'Verificando…'}
            </div>
            <p className="text-[11px] font-mono text-text-dim mt-1">
              PostgreSQL: {salud?.postgres ?? '—'} • Docker: {salud?.docker ?? '—'}
            </p>
          </div>

          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
            <span className="text-xs font-medium text-text-muted">Notificaciones Activas</span>
            <div className="text-2xl font-bold font-mono text-text-primary mt-2">
              {notifsHabilitadas}{' '}
              <span className="text-sm font-normal text-text-dim">/ {configNotifs.length}</span>
            </div>
            <p className="text-[11px] text-text-dim mt-1">
              {alertas.length} alertas registradas en historial
            </p>
          </div>

          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
            <span className="text-xs font-medium text-text-muted">Seguridad 2FA (TOTP)</span>
            <div className="text-2xl font-bold font-mono text-text-primary mt-2">
              {estado2FA?.totpHabilitado ? 'Activo' : 'Desactivado'}
            </div>
            <p className="text-[11px] text-text-dim mt-1">
              {estado2FA?.dispositivosConfiables.length ?? 0} dispositivos de confianza
            </p>
          </div>

          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5">
            <span className="text-xs font-medium text-text-muted">Integración GitHub</span>
            <div className="text-xl font-bold font-mono text-text-primary mt-2 truncate">
              {conexionGithub ? `@${conexionGithub.usuarioGithub}` : 'Sin conectar'}
            </div>
            <p className="text-[11px] text-primary mt-1">
              {conexionGithub ? `Modo ${conexionGithub.modo}` : 'Configurar en Servicios'}
            </p>
          </div>
        </div>

        {/* Matriz de Notificaciones (RF-20, RF-21) */}
        <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
          <div className="px-5 py-4 border-b border-border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Notificaciones por Evento (RF-20 / RF-21)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Activa o pausa qué eventos del servidor despachan alertas por canal (Observer).
              </p>
            </div>
            {esAdmin && (
              <button
                type="button"
                onClick={() => void manejarProbarAlerta()}
                disabled={probandoAlerta}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>{probandoAlerta ? 'Enviando…' : 'Enviar alerta de prueba'}</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-border-hairline">
            {configNotifs.map((cfg) => (
              <div
                key={cfg.id}
                className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-surface-card-elevated/40"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-text-primary">
                    {ETIQUETAS_EVENTO[cfg.tipoEvento] ?? cfg.tipoEvento}
                  </div>
                  <div className="text-[11px] font-mono text-text-dim mt-0.5">
                    {cfg.tipoEvento} • canal: {cfg.canal}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!esAdmin || actualizandoEvento === cfg.id}
                  onClick={() => void manejarToggleNotificacion(cfg)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer disabled:opacity-50 ${
                    cfg.habilitado
                      ? 'bg-primary/12 text-primary border-primary/25'
                      : 'bg-surface-low text-text-dim border-border-hairline'
                  }`}
                >
                  {cfg.habilitado ? 'Habilitado' : 'Pausado'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Apariencia, PWA y Accesos Rápidos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Apariencia y Progressive Web App (RF-23a)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Personaliza el modo Día/Noche, la tonalidad aurora e instala HomeSOC en móvil o
                escritorio.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-low border border-border-hairline">
              <span className="text-xs font-medium text-text-primary">
                Tema actual: <strong>{esOscuro ? 'Modo Noche' : 'Modo Día'}</strong>
              </span>
              <button
                type="button"
                onClick={alternarTema}
                className="px-3 py-1.5 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer"
              >
                Cambiar a {esOscuro ? 'Modo Día' : 'Modo Noche'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {PALETAS_ACENTO.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => establecerAcento(p.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                    acento === p.id
                      ? 'border-primary bg-primary/12 text-primary'
                      : 'border-border-hairline bg-surface-low text-text-muted'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: esOscuro ? p.colorNoche : p.colorDia }}
                  />
                  <span>{p.nombre}</span>
                </button>
              ))}
            </div>

            <div className="text-xs text-text-dim flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-hairline">
              <span>
                Notificaciones PWA (SSE en vivo):{' '}
                <strong className="text-text-primary">
                  {permisoNotif === 'granted'
                    ? 'Activadas'
                    : permisoNotif === 'denied'
                      ? 'Bloqueadas en navegador'
                      : 'Pendiente de permiso'}
                </strong>
              </span>
              {permisoNotif !== 'granted' && permisoNotif !== 'no_soportado' ? (
                <button
                  type="button"
                  onClick={() => void manejarSolicitarPermisoNotif()}
                  className="px-3 py-1 rounded-xl bg-primary/12 border border-primary/25 text-primary text-xs font-semibold cursor-pointer"
                >
                  Activar notificaciones
                </button>
              ) : (
                <span className="font-mono text-[11px] text-primary">
                  {pwaInstalada ? 'PWA Standalone' : '/manifest.json'}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-3">
            <h2 className="text-base font-semibold text-text-primary">
              Sesión Actual y Accesos Administrativos
            </h2>
            <div className="p-3.5 rounded-xl bg-surface-low border border-border-hairline text-xs flex flex-col gap-1.5">
              <div>
                Usuario:{' '}
                <strong className="font-mono text-text-primary">{usuario?.nombreUsuario}</strong>
              </div>
              <div>
                Rol: <strong className="font-mono text-primary">{usuario?.rol}</strong>
              </div>
              <div>
                Endurecimiento DB:{' '}
                <strong className="font-mono text-primary">
                  RLS activo + Auditoría inmutable
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
              <Link
                to="/seguridad"
                className="p-3 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary flex items-center justify-between"
              >
                <span>Gestionar 2FA y Auditoría</span>
                <span className="material-symbols-outlined text-[16px] text-primary">
                  arrow_forward
                </span>
              </Link>
              <Link
                to="/servicios"
                className="p-3 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary flex items-center justify-between"
              >
                <span>Conexión GitHub y Deploys</span>
                <span className="material-symbols-outlined text-[16px] text-primary">
                  arrow_forward
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Servidor MCP y Conexión con Agentes de Voz (N.O.V.A. / GlassIsland — RF-63..65) */}
        <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Servidor MCP y Agente de Voz N.O.V.A. (RF-63 a RF-65)
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Genera tokens acotados (<code className="font-mono">lectura</code> o{' '}
              <code className="font-mono">escritura</code>) para conectar{' '}
              <strong>GlassIsland / N.O.V.A.</strong> al endpoint{' '}
              <code className="font-mono text-primary">POST /api/v1/mcp</code>. Ninguna herramienta
              MCP expone secretos y toda acción queda auditada con origen <code className="font-mono">mcp</code>.
            </p>
          </div>

          {esAdmin && (
            <form
              onSubmit={(e) => void manejarCrearTokenMcp(e)}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <input
                type="text"
                value={nombreTokenMcp}
                onChange={(e) => setNombreTokenMcp(e.target.value)}
                placeholder="Nombre del agente (ej. N.O.V.A. Laptop)"
                className="flex-1 rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
              />
              <select
                value={permisoTokenMcp}
                onChange={(e) => setPermisoTokenMcp(e.target.value as 'lectura' | 'escritura')}
                className="sm:w-44 rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
              >
                <option value="lectura">Solo lectura</option>
                <option value="escritura">Lectura + Escritura</option>
              </select>
              <button
                type="submit"
                disabled={creandoTokenMcp || !nombreTokenMcp.trim()}
                className="px-4 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {creandoTokenMcp ? 'Generando…' : 'Crear Token MCP'}
              </button>
            </form>
          )}

          {tokenMcpRecienCreado && (
            <div className="p-3.5 rounded-xl bg-primary/12 border border-primary/30 text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-primary">
                  Copia tu token ahora (solo se muestra una vez):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(tokenMcpRecienCreado);
                    setAviso('Token MCP copiado al portapapeles');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-primary text-[var(--hs-on-accent)] text-[11px] font-semibold cursor-pointer"
                >
                  Copiar token
                </button>
              </div>
              <code className="font-mono text-text-primary break-all select-all">
                {tokenMcpRecienCreado}
              </code>
              <div className="text-[11px] text-text-muted font-mono pt-1 border-t border-primary/20">
                Endpoint MCP: <span className="text-text-primary">{window.location.origin}/api/v1/mcp</span> • Header:{' '}
                <span className="text-text-primary">Authorization: Bearer &lt;token&gt;</span>
              </div>
            </div>
          )}

          {tokensMcp.length > 0 && (
            <div className="divide-y divide-border-hairline rounded-xl bg-surface-low border border-border-hairline">
              {tokensMcp.map((t) => (
                <div
                  key={t.id}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text-primary">{t.nombre}</span>
                    <span className="font-mono text-text-dim">{t.prefijo}…</span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-card border border-border-hairline font-mono text-[10px] text-primary">
                      {t.permiso}
                    </span>
                    {t.revocado && (
                      <span className="px-2 py-0.5 rounded-md bg-error-container text-status-critical text-[10px] font-semibold">
                        Revocado
                      </span>
                    )}
                  </div>
                  {esAdmin && !t.revocado && (
                    <button
                      type="button"
                      onClick={() => void manejarRevocarTokenMcp(t.id)}
                      className="text-status-critical hover:underline text-[11px] cursor-pointer"
                    >
                      Revocar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acceso directo a VS Code Web (code-server) por proyecto */}
        <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Editor Remoto VS Code Web (code-server)
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Configura la URL de tu <code className="font-mono">code-server</code> (local o
              Tailscale) y la carpeta base de proyectos para abrir cada proyecto desplegado en su
              propia carpeta desde cualquier dispositivo o celular.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="url"
              value={urlCodeServer}
              onChange={(e) => setUrlCodeServer(e.target.value)}
              placeholder="https://tu-servidor:8443"
              className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
            />
            <input
              type="text"
              value={rutaCodeServer}
              onChange={(e) => setRutaCodeServer(e.target.value)}
              placeholder="/home/coder/project"
              className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
            />
            <button
              type="button"
              onClick={() => {
                const limpia = urlCodeServer.trim();
                if (limpia && !/^https?:\/\//i.test(limpia)) {
                  setError(
                    'La dirección de VS Code Web debe ser una URL web (ej. https://100.99.124.109:8443), no un comando ssh.',
                  );
                  return;
                }
                setError(null);
                localStorage.setItem('homesoc_codeserver_url', limpia);
                localStorage.setItem('homesoc_codeserver_ruta', rutaCodeServer.trim());
                setAviso('Enlace de VS Code Web guardado correctamente');
              }}
              className="px-4 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer"
            >
              Guardar enlace VS Code
            </button>
          </div>
          {/^https?:\/\//i.test(urlCodeServer.trim()) && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-hairline text-xs">
              <span className="text-text-muted">
                También verás el botón <strong>VS Code</strong> en cada proyecto desplegado en{' '}
                <em>Servicios y Despliegues</em>.
              </span>
              <a
                href={`${urlCodeServer.trim().replace(/\/+$/, '')}/?folder=${encodeURIComponent(
                  rutaCodeServer.trim() || '/home/coder/project',
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary/15 border border-primary/35 text-primary font-semibold hover:bg-primary/25 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">code</span>
                Abrir VS Code Web ahora
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
