import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usarAutenticacion } from '../../contexto/ContextoAutenticacion';
import { apiCliente } from '../../servicios/apiCliente';
import { ModuloSistema } from '../../servicios/autenticacionServicio';
import { contenedoresServicio } from '../../servicios/contenedoresServicio';
import { AlertaEnviadaItem, seguridadServicio } from '../../servicios/seguridadServicio';
import AsistenteVozDrawer from '../ia/AsistenteVozDrawer';
import SelectorTema from './SelectorTema';

interface ItemMenu {
  ruta: string;
  modulo: ModuloSistema;
  icono: string;
  texto: string;
  descripcion: string;
  grupo: 'Monitoreo' | 'Operación' | 'Sistema';
  badge?: string;
  badgeDetalle?: string;
  alerta?: string;
  alertaDetalle?: string;
}

interface TooltipFlotante {
  titulo: string;
  descripcion: string;
  etiqueta?: string;
  esAlerta?: boolean;
  top: number;
  left: number;
}

const ITEMS_MENU: ItemMenu[] = [
  {
    ruta: '/',
    modulo: 'recursos',
    icono: 'monitoring',
    texto: 'Recursos del Servidor',
    descripcion: 'CPU, RAM, discos y sensores en vivo',
    grupo: 'Monitoreo',
  },
  {
    ruta: '/servicios',
    modulo: 'servicios',
    icono: 'deployed_code',
    texto: 'Servicios y Despliegues',
    descripcion: 'Contenedores Docker, GitHub y logs',
    grupo: 'Operación',
  },
  {
    ruta: '/planes',
    modulo: 'servicios',
    icono: 'workspace_premium',
    texto: 'Planes y Suscripción',
    descripcion: 'Catálogo de planes, vista previa y pagos QR',
    grupo: 'Sistema',
  },
  {
    ruta: '/red',
    modulo: 'red',
    icono: 'hub',
    texto: 'Red y Conectividad',
    descripcion: 'Pi-hole, Tailscale y túneles activos',
    grupo: 'Monitoreo',
  },
  {
    ruta: '/seguridad',
    modulo: 'seguridad',
    icono: 'shield',
    texto: 'Seguridad y Auditoría',
    descripcion: 'SSH, fuerza bruta, 2FA y auditoría',
    grupo: 'Operación',
  },
  {
    ruta: '/automatizacion',
    modulo: 'automatizacion',
    icono: 'bolt',
    texto: 'Automatización',
    descripcion: 'Horarios y reglas condición-acción',
    grupo: 'Operación',
  },
  {
    ruta: '/usuarios',
    modulo: 'usuarios',
    icono: 'group',
    texto: 'Usuarios y Accesos',
    descripcion: 'Roles, invitaciones y permisos por ventana',
    grupo: 'Sistema',
  },
  {
    ruta: '/configuracion',
    modulo: 'configuracion',
    icono: 'tune',
    texto: 'Configuración General',
    descripcion: 'Notificaciones, backups y MCP',
    grupo: 'Sistema',
  },
];

const ORDEN_GRUPOS: Array<ItemMenu['grupo']> = ['Monitoreo', 'Operación', 'Sistema'];

export default function LayoutPrincipal({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario, tokenAcceso, cerrarSesion, tienePermisoModulo } = usarAutenticacion();

  const [sidebarAbierto, setSidebarAbierto] = useState(true);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [tooltip, setTooltip] = useState<TooltipFlotante | null>(null);
  const [contenedoresActivos, setContenedoresActivos] = useState<number | null>(null);
  const [alertasRecientes, setAlertasRecientes] = useState<number>(0);
  const [alertaEnVivo, setAlertaEnVivo] = useState<AlertaEnviadaItem | null>(null);
  const [asistenteAbierto, setAsistenteAbierto] = useState(false);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  // Carga inicial de contadores reales del menú lateral (sin valores hardcodeados)
  useEffect(() => {
    if (!tokenAcceso) return;
    let cancelado = false;
    void Promise.all([
      contenedoresServicio.listar(tokenAcceso).catch(() => null),
      seguridadServicio.listarEventos(tokenAcceso, 20).catch(() => null),
    ]).then(([resCont, resEv]) => {
      if (cancelado) return;
      if (resCont) {
        setContenedoresActivos(resCont.resumen.activos);
      }
      if (resEv) {
        const criticas = resEv.eventos.filter(
          (e) => e.severidad === 'alta' || e.severidad === 'critica',
        ).length;
        setAlertasRecientes(criticas);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [tokenAcceso]);

  // Suscripción en tiempo real (SSE) a alertas del Observer para PWA / navegador
  useEffect(() => {
    if (!tokenAcceso) return;
    const url = `${apiCliente.base}/notificaciones/stream?token=${encodeURIComponent(tokenAcceso)}`;
    const fuente = new EventSource(url);

    const manejarAlerta = (evento: MessageEvent) => {
      try {
        const alerta = JSON.parse(evento.data) as AlertaEnviadaItem;
        setAlertaEnVivo(alerta);
        setAlertasRecientes((prev) => prev + 1);

        if ('Notification' in window && Notification.permission === 'granted') {
          if ('serviceWorker' in navigator) {
            void navigator.serviceWorker.ready
              .then((reg) =>
                reg.showNotification('HomeSOC — Alerta', {
                  body: alerta.mensaje,
                  icon: '/icon.svg',
                  tag: `homesoc-${alerta.id}`,
                }),
              )
              .catch(() => {
                new Notification('HomeSOC — Alerta', { body: alerta.mensaje, icon: '/icon.svg' });
              });
          } else {
            new Notification('HomeSOC — Alerta', { body: alerta.mensaje, icon: '/icon.svg' });
          }
        }
      } catch {
        // Ignorar mensajes malformados
      }
    };

    fuente.addEventListener('alerta', manejarAlerta as EventListener);
    return () => {
      fuente.removeEventListener('alerta', manejarAlerta as EventListener);
      fuente.close();
    };
  }, [tokenAcceso]);

  useEffect(() => {
    if (!alertaEnVivo) return;
    const t = window.setTimeout(() => setAlertaEnVivo(null), 6500);
    return () => window.clearTimeout(t);
  }, [alertaEnVivo]);

  useEffect(() => {
    setMenuMovilAbierto(false);
    setTooltip(null);
  }, [location.pathname, sidebarAbierto]);

  useEffect(() => {
    const manejarAtajo = (evento: KeyboardEvent) => {
      if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        setSidebarAbierto(true);
        setTimeout(() => inputBusquedaRef.current?.focus(), 60);
      }
    };
    window.addEventListener('keydown', manejarAtajo);
    return () => window.removeEventListener('keydown', manejarAtajo);
  }, []);

  const mostrarTooltip = useCallback(
    (
      elemento: HTMLElement,
      datos: { titulo: string; descripcion: string; etiqueta?: string; esAlerta?: boolean },
    ) => {
      if (sidebarAbierto) return;
      const rect = elemento.getBoundingClientRect();
      setTooltip({
        ...datos,
        top: rect.top + rect.height / 2,
        left: rect.right + 14,
      });
    },
    [sidebarAbierto],
  );

  const ocultarTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const itemsFiltrados = useMemo(() => {
    const itemsPermitidos = ITEMS_MENU.filter((item) => tienePermisoModulo(item.modulo));
    const itemsConContadores: ItemMenu[] = itemsPermitidos.map((item) => {
      if (item.ruta === '/servicios' && contenedoresActivos !== null) {
        return {
          ...item,
          badge: String(contenedoresActivos),
          badgeDetalle: `${contenedoresActivos} activos`,
        };
      }
      if (item.ruta === '/seguridad' && alertasRecientes > 0) {
        return {
          ...item,
          alerta: String(alertasRecientes),
          alertaDetalle: `${alertasRecientes} alertas`,
        };
      }
      return item;
    });
    const consulta = busqueda.trim().toLowerCase();
    if (!consulta) return itemsConContadores;
    return itemsConContadores.filter(
      (item) =>
        item.texto.toLowerCase().includes(consulta) ||
        item.descripcion.toLowerCase().includes(consulta) ||
        item.grupo.toLowerCase().includes(consulta),
    );
  }, [busqueda, contenedoresActivos, alertasRecientes, tienePermisoModulo]);

  const moduloActual =
    ITEMS_MENU.find((m) => m.ruta === location.pathname)?.texto || 'Panel Principal';

  const inicialesUsuario = (usuario?.nombreUsuario || 'AD').slice(0, 2).toUpperCase();

  const manejarCerrarSesion = async () => {
    await cerrarSesion();
    navigate('/login', { replace: true });
  };

  const renderContenidoSidebar = (expandido: boolean) => (
    <div className="flex flex-col h-full">
      {/* Cabecera de marca */}
      <div
        className={`flex items-center border-b border-border-hairline transition-all duration-200 ${
          expandido ? 'px-4 py-4 justify-between' : 'px-2 py-4 justify-center'
        }`}
      >
        <Link
          to="/"
          onMouseEnter={(e) =>
            mostrarTooltip(e.currentTarget, {
              titulo: 'HomeSOC',
              descripcion: 'Inicio • Panel de control Homelab',
            })
          }
          onMouseLeave={ocultarTooltip}
          onFocus={(e) =>
            mostrarTooltip(e.currentTarget, {
              titulo: 'HomeSOC',
              descripcion: 'Inicio • Panel de control Homelab',
            })
          }
          onBlur={ocultarTooltip}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-sm ring-1 ring-primary/35 bg-[#081412]">
            <img
              src="/logo-homesoc.jpg"
              alt="HomeSOC"
              className="w-full h-full object-cover scale-110"
            />
          </div>
          {expandido && (
            <div className="flex flex-col min-w-0">
              <span className="text-[15px] font-bold tracking-tight text-text-primary leading-tight truncate">
                Home<span className="text-primary">SOC</span>
              </span>
              <span className="text-[11px] text-text-dim leading-tight truncate">
                Homelab Control
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Buscador rápido ⌘K */}
      <div className={`${expandido ? 'px-3 pt-3 pb-1' : 'px-2 pt-3 pb-1 flex justify-center'}`}>
        {expandido ? (
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[17px] text-text-dim pointer-events-none">
              search
            </span>
            <input
              ref={inputBusquedaRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && itemsFiltrados.length > 0) {
                  navigate(itemsFiltrados[0].ruta);
                  setBusqueda('');
                }
              }}
              placeholder="Ir a módulo..."
              className="w-full h-9 pl-8 pr-11 rounded-xl bg-surface-low border border-border-hairline text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15 transition-all"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-surface-card border border-border-hairline text-[10px] font-mono text-text-dim">
              ⌘K
            </kbd>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSidebarAbierto(true);
              setTimeout(() => inputBusquedaRef.current?.focus(), 60);
            }}
            onMouseEnter={(e) =>
              mostrarTooltip(e.currentTarget, {
                titulo: 'Buscar módulo',
                descripcion: 'Abre el buscador rápido',
                etiqueta: 'Ctrl+K',
              })
            }
            onMouseLeave={ocultarTooltip}
            onFocus={(e) =>
              mostrarTooltip(e.currentTarget, {
                titulo: 'Buscar módulo',
                descripcion: 'Abre el buscador rápido',
                etiqueta: 'Ctrl+K',
              })
            }
            onBlur={ocultarTooltip}
            className="w-10 h-10 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-text-muted hover:text-primary flex items-center justify-center transition-all cursor-pointer"
            aria-label="Buscar módulo"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
          </button>
        )}
      </div>

      {/* Navegación por grupos */}
      <nav
        onScroll={ocultarTooltip}
        className={`flex-1 overflow-y-auto py-3 ${expandido ? 'px-3' : 'px-2'}`}
      >
        {ORDEN_GRUPOS.map((grupo) => {
          const itemsDelGrupo = itemsFiltrados.filter((item) => item.grupo === grupo);
          if (itemsDelGrupo.length === 0) return null;

          return (
            <div key={grupo} className="mb-4 last:mb-0">
              {expandido ? (
                <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                  {grupo}
                </div>
              ) : (
                <div className="mx-auto my-2 w-6 h-px bg-border-hairline" />
              )}

              <div className="flex flex-col gap-1">
                {itemsDelGrupo.map((item) => {
                  const activo = location.pathname === item.ruta;
                  const datosGuia = {
                    titulo: item.texto,
                    descripcion: item.descripcion,
                    etiqueta: item.alertaDetalle || item.badgeDetalle,
                    esAlerta: Boolean(item.alerta),
                  };

                  return (
                    <Link
                      key={item.ruta}
                      to={item.ruta}
                      onMouseEnter={(e) => mostrarTooltip(e.currentTarget, datosGuia)}
                      onMouseLeave={ocultarTooltip}
                      onFocus={(e) => mostrarTooltip(e.currentTarget, datosGuia)}
                      onBlur={ocultarTooltip}
                      className={`group relative flex items-center rounded-xl transition-all duration-150 ${
                        expandido ? 'justify-between gap-2 px-2.5 py-2' : 'justify-center h-10 w-10 mx-auto'
                      } ${
                        activo
                          ? 'bg-primary text-[var(--hs-on-accent)] font-semibold shadow-sm'
                          : 'text-text-muted hover:text-text-primary hover:bg-surface-card-elevated'
                      }`}
                    >
                      <div className={`flex items-center ${expandido ? 'gap-2.5 min-w-0 flex-1' : 'justify-center'}`}>
                        <span
                          className={`material-symbols-outlined shrink-0 text-[19px] transition-colors ${
                            activo ? 'text-[var(--hs-on-accent)]' : 'text-text-dim group-hover:text-primary'
                          }`}
                        >
                          {item.icono}
                        </span>
                        {expandido && (
                          <span className="text-[13px] truncate">{item.texto}</span>
                        )}
                      </div>

                      {expandido && item.badge && (
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                            activo
                              ? 'bg-black/15 text-[var(--hs-on-accent)]'
                              : 'bg-surface-card-elevated text-text-muted border border-border-hairline'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}

                      {expandido && item.alerta && (
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                            activo
                              ? 'bg-black/15 text-[var(--hs-on-accent)]'
                              : 'bg-error-container text-error'
                          }`}
                        >
                          {item.alerta}
                        </span>
                      )}

                      {/* Punto indicador en modo colapsado */}
                      {!expandido && (item.alerta || item.badge) && (
                        <span
                          className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                            item.alerta ? 'bg-status-critical' : 'bg-primary'
                          }`}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {itemsFiltrados.length === 0 && expandido && (
          <p className="px-3 py-4 text-xs text-text-dim text-center">
            Sin coincidencias para &ldquo;{busqueda}&rdquo;
          </p>
        )}
      </nav>

      {/* Pie del sidebar: perfil de usuario */}
      <div className={`border-t border-border-hairline flex flex-col gap-2.5 ${expandido ? 'p-3' : 'p-2 items-center'}`}>
        {/* Perfil de usuario */}
        <div
          onMouseEnter={(e) =>
            mostrarTooltip(e.currentTarget, {
              titulo: usuario?.nombreUsuario || 'admin',
              descripcion: `Sesión activa • Rol ${usuario?.rol || 'administrador'}`,
            })
          }
          onMouseLeave={ocultarTooltip}
          className={`flex items-center rounded-xl bg-surface-low border border-border-hairline ${
            expandido ? 'justify-between p-2 gap-2' : 'p-1.5 justify-center'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary border border-primary/25 font-mono text-xs font-bold flex items-center justify-center shrink-0">
              {inicialesUsuario}
            </div>
            {expandido && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-text-primary truncate leading-tight">
                  {usuario?.nombreUsuario || 'admin'}
                </span>
                <span className="text-[10px] text-text-dim uppercase tracking-wide truncate leading-tight">
                  {usuario?.rol || 'administrador'}
                </span>
              </div>
            )}
          </div>
          {expandido && (
            <button
              type="button"
              onClick={manejarCerrarSesion}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="p-1.5 rounded-lg text-text-muted hover:text-status-critical hover:bg-error-container transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[17px]">logout</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas-base text-text-primary font-sans selection:bg-primary/20 selection:text-primary transition-colors duration-200">
      {/* Tarjeta guía flotante (position: fixed) al pasar el cursor en modo colapsado */}
      {!sidebarAbierto && tooltip && (
        <div
          role="tooltip"
          style={{ top: `${tooltip.top}px`, left: `${tooltip.left}px` }}
          className="hidden lg:flex fixed z-[60] -translate-y-1/2 pointer-events-none items-center"
        >
          {/* Flecha indicadora hacia el ícono */}
          <div className="w-2.5 h-2.5 -mr-1.5 rotate-45 bg-surface-card border-l border-b border-border-hairline" />
          <div className="rounded-xl bg-surface-card/95 backdrop-blur-xl border border-border-hairline px-3.5 py-2.5 shadow-xl min-w-[190px] max-w-[260px]">
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-xs font-semibold text-text-primary leading-tight">
                {tooltip.titulo}
              </span>
              {tooltip.etiqueta && (
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                    tooltip.esAlerta
                      ? 'bg-error-container text-error'
                      : 'bg-primary/15 text-primary'
                  }`}
                >
                  {tooltip.etiqueta}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
              {tooltip.descripcion}
            </p>
          </div>
        </div>
      )}

      {/* Overlay móvil */}
      {menuMovilAbierto && (
        <div
          onClick={() => setMenuMovilAbierto(false)}
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar móvil desplegable */}
      <aside
        className={`fixed inset-y-3 left-3 z-50 w-[264px] rounded-2xl bg-surface-container-lowest border border-border-hairline lg:hidden transition-transform duration-200 ${
          menuMovilAbierto ? 'translate-x-0' : '-translate-x-[115%]'
        }`}
        style={{ boxShadow: 'var(--hs-shadow-sidebar)' }}
      >
        {renderContenidoSidebar(true)}
      </aside>

      {/* Sidebar escritorio flotante y colapsable */}
      <aside
        className={`hidden lg:flex flex-col fixed top-3 bottom-3 left-3 z-40 rounded-2xl bg-surface-container-lowest border border-border-hairline transition-all duration-200 ${
          sidebarAbierto ? 'w-[252px]' : 'w-[74px]'
        }`}
        style={{ boxShadow: 'var(--hs-shadow-sidebar)' }}
      >
        {/* Botón circular en el borde para plegar/desplegar (estilo Glassy SideBar / Nido) */}
        <button
          type="button"
          onClick={() => setSidebarAbierto((prev) => !prev)}
          onMouseEnter={(e) =>
            mostrarTooltip(e.currentTarget, {
              titulo: 'Expandir menú lateral',
              descripcion: 'Muestra los nombres y buscador',
            })
          }
          onMouseLeave={ocultarTooltip}
          title={sidebarAbierto ? 'Contraer menú lateral' : 'Expandir menú lateral'}
          aria-label={sidebarAbierto ? 'Contraer menú lateral' : 'Expandir menú lateral'}
          className="absolute -right-3.5 top-5 z-50 w-7 h-7 rounded-full bg-surface-card hover:bg-surface-card-elevated border border-border-hairline text-text-muted hover:text-primary shadow-sm flex items-center justify-center transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">
            {sidebarAbierto ? 'chevron_left' : 'chevron_right'}
          </span>
        </button>

        {renderContenidoSidebar(sidebarAbierto)}
      </aside>

      {/* Contenedor principal */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-200 ${
          sidebarAbierto ? 'lg:pl-[272px]' : 'lg:pl-[94px]'
        }`}
      >
        {/* Barra superior minimalista con glass sutil */}
        <header
          className={`fixed top-0 right-0 left-0 h-16 z-30 px-4 sm:px-6 flex items-center justify-between border-b border-border-hairline backdrop-blur-md transition-all duration-200 ${
            sidebarAbierto ? 'lg:left-[272px]' : 'lg:left-[94px]'
          }`}
          style={{ backgroundColor: 'var(--hs-glass-bg)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(true)}
              className="lg:hidden h-9 w-9 rounded-xl bg-surface-card border border-border-hairline text-text-muted hover:text-text-primary flex items-center justify-center cursor-pointer"
              aria-label="Abrir menú"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-text-dim font-medium">HomeSOC</span>
              <span className="hidden sm:inline text-text-dim">/</span>
              <span className="font-semibold text-text-primary truncate">{moduloActual}</span>
            </div>

            <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>Nodo Activo</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAsistenteAbierto(true)}
              title="Asistente IA y Voz"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary/12 hover:bg-primary/20 border border-primary/25 text-primary text-xs font-semibold transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">graphic_eq</span>
              <span className="hidden sm:inline">IA / Voz</span>
            </button>

            <SelectorTema alineacion="derecha" />

            <button
              type="button"
              onClick={manejarCerrarSesion}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="h-9 w-9 rounded-xl bg-surface-card hover:bg-error-container border border-border-hairline text-text-muted hover:text-status-critical transition-all flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>

      {/* Notificación flotante en tiempo real (SSE Observer) */}
      {alertaEnVivo && (
        <div className="fixed bottom-5 right-5 z-[95] max-w-sm rounded-2xl bg-surface-card border border-primary/40 p-4 shadow-xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">notifications_active</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-text-primary flex items-center justify-between gap-2">
              <span className="truncate">Alerta en vivo • {alertaEnVivo.tipoEvento}</span>
              <button
                type="button"
                onClick={() => setAlertaEnVivo(null)}
                className="text-text-dim hover:text-text-primary cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1 break-words">{alertaEnVivo.mensaje}</p>
          </div>
        </div>
      )}
      <AsistenteVozDrawer
        abierto={asistenteAbierto}
        alCerrar={() => setAsistenteAbierto(false)}
      />
    </div>
  );
}
