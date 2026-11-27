import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usarAutenticacion } from '../../contexto/ContextoAutenticacion';
import { ErrorApi } from '../../servicios/apiCliente';
import {
  autenticacionServicio,
  RespuestaPendiente2FA,
} from '../../servicios/autenticacionServicio';

type ModoPortal = 'login' | 'registro' | 'recuperar' | 'setup';

export default function FormularioLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { iniciarSesion, completarSegundoFactor, establecerSesionDirecta } = usarAutenticacion();

  const [requiereSetup, setRequiereSetup] = useState(false);
  const [verificandoEstado, setVerificandoEstado] = useState(true);
  const [modo, setModo] = useState<ModoPortal>('login');

  // Animación de compuerta electrónica al cambiar de vista
  const [compuertaCerrada, setCompuertaCerrada] = useState(false);
  const [mensajeCompuerta, setMensajeCompuerta] = useState('INICIALIZANDO COMPUERTA...');

  // Campos de Login
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  // Campos de Registro por Invitación / Setup Inicial
  const [tokenInvitacion, setTokenInvitacion] = useState('');
  const [usuarioNuevo, setUsuarioNuevo] = useState('');
  const [contrasenaNueva, setContrasenaNueva] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');

  // Campos de Recuperación por 2FA (TOTP)
  const [usuarioRecuperar, setUsuarioRecuperar] = useState('');
  const [codigoRecuperarTotp, setCodigoRecuperarTotp] = useState('');
  const [nuevaContrasenaRecuperar, setNuevaContrasenaRecuperar] = useState('');
  const [confirmarRecuperar, setConfirmarRecuperar] = useState('');

  // Paso 2 (2FA condicional en Login)
  const [desafio2FA, setDesafio2FA] = useState<RespuestaPendiente2FA | null>(null);
  const [digitosOtp, setDigitosOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [usarRecuperacion, setUsarRecuperacion] = useState(false);
  const [codigoRecuperacion, setCodigoRecuperacion] = useState('');
  const [recordarDispositivo, setRecordarDispositivo] = useState(true);
  const refsOtp = useRef<Array<HTMLInputElement | null>>([]);

  // Estados de carga y mensajes
  const [cargando, setCargando] = useState(false);
  const [textoCarga, setTextoCarga] = useState('VERIFICANDO CREDENCIALES...');
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Detecta si es primer arranque (Setup Superadmin) o si viene un enlace de invitación (?token=...)
  useEffect(() => {
    let activo = true;
    const tokenUrl = searchParams.get('token')?.trim();
    const modoUrl = searchParams.get('modo');

    void (async () => {
      try {
        const estado = await autenticacionServicio.estadoInicial();
        if (!activo) return;
        setRequiereSetup(estado.requiereSetup);
        if (estado.requiereSetup) {
          setModo('setup');
        } else if (tokenUrl || modoUrl === 'registro') {
          if (tokenUrl) setTokenInvitacion(tokenUrl);
          setModo('registro');
        }
      } catch {
        // Si falla la consulta inicial, queda en modo login estándar
      } finally {
        if (activo) setVerificandoEstado(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [searchParams]);

  /** Ejecuta la secuencia animada de cierre/escaneo/apertura de compuerta electrónica. */
  const transicionarCompuerta = (etiqueta: string, alCambiar: () => void) => {
    setMensajeError(null);
    setMensajeExito(null);
    setMensajeCompuerta(etiqueta);
    setCompuertaCerrada(true);
    window.setTimeout(() => {
      alCambiar();
    }, 280);
    window.setTimeout(() => {
      setCompuertaCerrada(false);
    }, 560);
  };

  const cambiarModo = (nuevoModo: ModoPortal) => {
    if (nuevoModo === modo && !desafio2FA) return;
    const etiquetas: Record<ModoPortal, string> = {
      login: 'ABRIENDO TERMINAL DE ACCESO...',
      registro: 'ACTIVANDO COMPUERTA DE INVITACIÓN...',
      recuperar: 'PROTOCOLO DE RECUPERACIÓN 2FA...',
      setup: 'MODO DESPLIEGUE SUPERADMIN...',
    };
    transicionarCompuerta(etiquetas[nuevoModo], () => {
      setDesafio2FA(null);
      setModo(nuevoModo);
    });
  };

  const manejarPaso1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);
    setTextoCarga('VERIFICANDO HASH BCRYPT Y POLÍTICA DE RED...');
    setCargando(true);

    try {
      const respuesta = await iniciarSesion(nombreUsuario, contrasena);
      if (respuesta.requiere2FA) {
        transicionarCompuerta('DESAFÍO 2FA REQUERIDO — SELLANDO CANAL...', () => {
          setDesafio2FA(respuesta);
          setDigitosOtp(['', '', '', '', '', '']);
          setCodigoRecuperacion('');
          setUsarRecuperacion(false);
          setTimeout(() => refsOtp.current[0]?.focus(), 320);
        });
      } else {
        setTextoCarga('ACCESO CONCEDIDO — DESBLOQUEANDO COMPUERTA...');
        setCompuertaCerrada(true);
        setMensajeCompuerta('ACCESO AUTORIZADO');
        window.setTimeout(() => navigate('/', { replace: true }), 420);
      }
    } catch (error) {
      setMensajeError(
        error instanceof ErrorApi
          ? error.message
          : 'Ocurrió un error inesperado al iniciar sesión',
      );
    } finally {
      setCargando(false);
    }
  };

  const manejarPaso2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desafio2FA) return;
    setMensajeError(null);

    const codigo = usarRecuperacion ? codigoRecuperacion.trim() : digitosOtp.join('');
    if (!usarRecuperacion && codigo.length < 6) {
      setMensajeError('Ingresa los 6 dígitos de tu aplicación autenticadora');
      return;
    }

    setTextoCarga('VALIDANDO FIRMA TOTP EN TIEMPO REAL...');
    setCargando(true);
    try {
      await completarSegundoFactor({
        tokenTemporal2FA: desafio2FA.tokenTemporal2FA,
        codigo,
        recordarDispositivo,
      });
      setCompuertaCerrada(true);
      setMensajeCompuerta('IDENTIDAD VERIFICADA — BIENVENIDO');
      window.setTimeout(() => navigate('/', { replace: true }), 420);
    } catch (error) {
      setMensajeError(
        error instanceof ErrorApi
          ? error.message
          : 'No se pudo verificar el segundo factor',
      );
    } finally {
      setCargando(false);
    }
  };

  const manejarSetupInicial = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    if (contrasenaNueva.length < 8) {
      setMensajeError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (contrasenaNueva !== confirmarContrasena) {
      setMensajeError('Las contraseñas no coinciden');
      return;
    }

    setTextoCarga('CREANDO BÓVEDA SUPERADMIN...');
    setCargando(true);
    try {
      const sesion = await autenticacionServicio.setupInicial({
        nombreUsuario: usuarioNuevo,
        contrasena: contrasenaNueva,
      });
      establecerSesionDirecta(sesion);
      setCompuertaCerrada(true);
      setMensajeCompuerta('SUPERADMIN ACTIVADO — ABRIENDO SOC');
      window.setTimeout(() => navigate('/', { replace: true }), 450);
    } catch (error) {
      setMensajeError(
        error instanceof ErrorApi ? error.message : 'No se pudo completar el setup inicial',
      );
    } finally {
      setCargando(false);
    }
  };

  const manejarRegistroInvitacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    if (contrasenaNueva.length < 8) {
      setMensajeError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (contrasenaNueva !== confirmarContrasena) {
      setMensajeError('Las contraseñas no coinciden');
      return;
    }

    setTextoCarga('VALIDANDO TOKEN TEMPORAL SHA-256...');
    setCargando(true);
    try {
      const sesion = await autenticacionServicio.registrarConInvitacion({
        tokenInvitacion,
        nombreUsuario: usuarioNuevo,
        contrasena: contrasenaNueva,
      });
      establecerSesionDirecta(sesion);
      setCompuertaCerrada(true);
      setMensajeCompuerta('CUENTA ACTIVADA — ACCESO CONCEDIDO');
      window.setTimeout(() => navigate('/', { replace: true }), 450);
    } catch (error) {
      setMensajeError(
        error instanceof ErrorApi ? error.message : 'No se pudo registrar con esa invitación',
      );
    } finally {
      setCargando(false);
    }
  };

  const manejarRecuperarTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    if (nuevaContrasenaRecuperar.length < 8) {
      setMensajeError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (nuevaContrasenaRecuperar !== confirmarRecuperar) {
      setMensajeError('Las contraseñas no coinciden');
      return;
    }

    setTextoCarga('VALIDANDO 2FA Y ROTANDO CREDENCIALES...');
    setCargando(true);
    try {
      const res = await autenticacionServicio.recuperarConTotp({
        nombreUsuario: usuarioRecuperar,
        codigo: codigoRecuperarTotp,
        nuevaContrasena: nuevaContrasenaRecuperar,
      });
      setNombreUsuario(usuarioRecuperar);
      setContrasena('');
      setCodigoRecuperarTotp('');
      setNuevaContrasenaRecuperar('');
      setConfirmarRecuperar('');
      transicionarCompuerta('CLAVE RESTABLECIDA — REDIRIGIENDO A ACCESO...', () => {
        setModo('login');
        setMensajeExito(res.mensaje);
      });
    } catch (error) {
      setMensajeError(
        error instanceof ErrorApi
          ? error.message
          : 'No se pudo restablecer la contraseña con 2FA',
      );
    } finally {
      setCargando(false);
    }
  };

  const cambiarDigitoOtp = (indice: number, valor: string) => {
    const soloDigitos = valor.replace(/\D/g, '');
    if (soloDigitos.length > 1) {
      const nuevos = ['', '', '', '', '', ''];
      for (let i = 0; i < 6 && i < soloDigitos.length; i++) {
        nuevos[i] = soloDigitos[i];
      }
      setDigitosOtp(nuevos);
      refsOtp.current[Math.min(5, soloDigitos.length)]?.focus();
      return;
    }

    const copia = [...digitosOtp];
    copia[indice] = soloDigitos;
    setDigitosOtp(copia);
    if (soloDigitos && indice < 5) {
      refsOtp.current[indice + 1]?.focus();
    }
  };

  const manejarTeclaOtp = (indice: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digitosOtp[indice] && indice > 0) {
      refsOtp.current[indice - 1]?.focus();
    }
  };

  return (
    <div className="w-full max-w-[460px] flex flex-col items-center">
      {/* Cabecera de identidad SOC */}
      <div className="flex flex-col items-center mb-6 text-center">
        <div className="relative hs-float-slow mb-4">
          <div className="absolute -inset-3 rounded-[28px] bg-primary/25 blur-2xl" />
          <div className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-2xl ring-2 ring-primary/40 border border-white/15 bg-[#081412]">
            <img
              src="/logo-homesoc.jpg"
              alt="HomeSOC"
              className="w-full h-full object-cover scale-110"
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          Home<span className="text-primary">SOC</span>
        </h1>
        <p className="text-text-muted text-xs sm:text-sm mt-1">
          Compuerta de acceso criptográfico • Homelab Security Operations
        </p>
      </div>

      {/* Selector de modos (solo si el setup inicial ya fue completado y no estamos en paso 2FA) */}
      {!requiereSetup && !desafio2FA && !verificandoEstado && (
        <div className="w-full grid grid-cols-3 gap-1.5 p-1.5 mb-4 rounded-2xl bg-surface-card/90 backdrop-blur-xl border border-border-hairline shadow-sm">
          {(
            [
              { id: 'login', etiqueta: 'Acceder', icono: 'login' },
              { id: 'registro', etiqueta: 'Invitación', icono: 'vpn_key' },
              { id: 'recuperar', etiqueta: 'Recuperar 2FA', icono: 'lock_reset' },
            ] as const
          ).map((tab) => {
            const activo = modo === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={cargando || compuertaCerrada}
                onClick={() => cambiarModo(tab.id)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activo
                    ? 'bg-primary text-[var(--hs-on-accent)] shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-low'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tab.icono}</span>
                <span className="truncate">{tab.etiqueta}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bóveda principal con Compuerta Electrónica Animada */}
      <div
        className="relative w-full rounded-2xl bg-surface-card/95 backdrop-blur-xl border border-border-strong overflow-hidden transition-all duration-300"
        style={{ boxShadow: 'var(--hs-shadow-sidebar)' }}
      >
        {/* Barra superior de telemetría */}
        <div className="h-1.5 w-full bg-surface-high relative overflow-hidden">
          <div
            className={`h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent ${
              cargando || compuertaCerrada ? 'hs-progress-sweep' : 'w-full opacity-80'
            }`}
          />
        </div>

        {/* Compuerta electrónica (hojas izquierda y derecha que se cierran y abren) */}
        <div
          aria-hidden={!compuertaCerrada}
          className={`absolute inset-0 z-30 pointer-events-none flex ${
            compuertaCerrada ? 'pointer-events-auto' : ''
          }`}
        >
          {/* Hoja izquierda */}
          <div
            className={`w-1/2 h-full hs-door-panel border-r-2 border-primary/70 transition-transform duration-300 ease-in-out flex items-center justify-end pr-3 ${
              compuertaCerrada ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="w-1.5 h-20 rounded-full bg-primary/70 hs-door-seam" />
          </div>
          {/* Hoja derecha */}
          <div
            className={`w-1/2 h-full hs-door-panel border-l-2 border-primary/70 transition-transform duration-300 ease-in-out flex items-center justify-start pl-3 ${
              compuertaCerrada ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="w-1.5 h-20 rounded-full bg-primary/70 hs-door-seam" />
          </div>

          {/* Escáner central sobre la compuerta cerrada */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center px-6 text-center transition-opacity duration-200 ${
              compuertaCerrada ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-surface-card/90 border border-primary/60 text-primary flex items-center justify-center shadow-lg mb-3">
              <span className="material-symbols-outlined text-[28px] animate-spin">
                settings_ethernet
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-surface-card/90 border border-primary/40 font-mono text-[11px] font-semibold tracking-wider text-primary uppercase">
              {mensajeCompuerta}
            </span>
          </div>
        </div>

        {/* Overlay realista de escaneo durante peticiones al backend */}
        {cargando && !compuertaCerrada && (
          <div className="absolute inset-0 z-20 bg-surface-card/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <div className="relative w-16 h-16 rounded-2xl border border-primary/40 bg-primary/10 flex items-center justify-center overflow-hidden mb-3">
              <span className="material-symbols-outlined text-[30px] text-primary">
                fingerprint
              </span>
              <div className="absolute inset-x-0 h-1 bg-primary shadow-[0_0_12px_var(--hs-accent)] hs-scanline" />
            </div>
            <p className="font-mono text-xs font-semibold text-primary tracking-wide">
              {textoCarga}
            </p>
            <div className="w-48 h-1.5 rounded-full bg-surface-high overflow-hidden mt-3">
              <div className="h-full w-1/2 bg-primary rounded-full hs-progress-sweep" />
            </div>
          </div>
        )}

        <div className="p-6 sm:p-7">
          {verificandoEstado ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
              <span className="material-symbols-outlined text-[28px] text-primary animate-spin">
                progress_activity
              </span>
              <p className="font-mono text-xs text-text-muted">
                Comprobando estado del nodo HomeSOC...
              </p>
            </div>
          ) : (
            <>
              {mensajeError && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-xl bg-error-container border border-status-critical/30 text-status-critical text-xs flex items-start gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                    gpp_maybe
                  </span>
                  <span>{mensajeError}</span>
                </div>
              )}

              {mensajeExito && (
                <div className="mb-4 p-3 rounded-xl bg-primary/12 border border-primary/30 text-primary text-xs flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                    verified
                  </span>
                  <span>{mensajeExito}</span>
                </div>
              )}

              {/* MODO 0: SETUP INICIAL DE SUPERADMIN (1 sola vez cuando no hay usuarios) */}
              {modo === 'setup' && (
                <form onSubmit={manejarSetupInicial} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">
                        Configuración Inicial
                      </h2>
                      <p className="text-xs text-text-dim mt-0.5">
                        Crea tu cuenta maestra Superadmin (uso único)
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-mono font-semibold border border-primary/30">
                      SUPERADMIN
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-text-muted">Usuario Superadmin</label>
                    <input
                      type="text"
                      value={usuarioNuevo}
                      onChange={(e) => setUsuarioNuevo(e.target.value)}
                      placeholder="hebert"
                      className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 px-3.5 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-text-muted">
                      Contraseña maestra (mín. 8 caracteres)
                    </label>
                    <input
                      type="password"
                      value={contrasenaNueva}
                      onChange={(e) => setContrasenaNueva(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 px-3.5 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-text-muted">Confirmar contraseña</label>
                    <input
                      type="password"
                      value={confirmarContrasena}
                      onChange={(e) => setConfirmarContrasena(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 px-3.5 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full py-2.5 mt-1 bg-primary hover:opacity-95 text-[var(--hs-on-accent)] font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <span>Inicializar HomeSOC</span>
                    <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                  </button>
                </form>
              )}

              {/* MODO 1A: INICIAR SESIÓN */}
              {modo === 'login' && !desafio2FA && (
                <form onSubmit={manejarPaso1} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">Iniciar sesión</h2>
                      <p className="text-xs text-text-dim mt-0.5">
                        Acceso protegido con 2FA adaptativo
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-mono border border-primary/20">
                      SOC-AUTH
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="nombreUsuario" className="text-xs font-medium text-text-muted">
                      Usuario
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-[18px]">
                        person
                      </span>
                      <input
                        id="nombreUsuario"
                        type="text"
                        autoComplete="username"
                        value={nombreUsuario}
                        onChange={(e) => setNombreUsuario(e.target.value)}
                        className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 pl-10 pr-4 text-text-primary text-sm placeholder:text-text-dim focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        placeholder="tu_usuario"
                        disabled={cargando}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="contrasena" className="text-xs font-medium text-text-muted">
                      Contraseña
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-dim text-[18px]">
                        lock
                      </span>
                      <input
                        id="contrasena"
                        type={mostrarContrasena ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={contrasena}
                        onChange={(e) => setContrasena(e.target.value)}
                        className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 pl-10 pr-10 text-text-primary text-sm placeholder:text-text-dim focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        placeholder="••••••••••••"
                        disabled={cargando}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarContrasena((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary transition-colors cursor-pointer"
                        aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {mostrarContrasena ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full py-2.5 mt-1 bg-primary hover:opacity-95 disabled:opacity-60 text-[var(--hs-on-accent)] font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <span>Desbloquear acceso</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </form>
              )}

              {/* MODO 1B: VERIFICACIÓN 2FA TOTP */}
              {modo === 'login' && desafio2FA && (
                <form onSubmit={manejarPaso2} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">Verificación 2FA</h2>
                      <p className="text-xs text-text-dim mt-0.5">
                        Cuenta:{' '}
                        <span className="font-mono text-text-primary">
                          {desafio2FA.usuario.nombreUsuario}
                        </span>
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                        desafio2FA.esRedLocal
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-status-warning/15 text-status-warning border-status-warning/30'
                      }`}
                    >
                      {desafio2FA.esRedLocal ? 'Dispositivo nuevo' : 'Red externa'}
                    </span>
                  </div>

                  {!usarRecuperacion ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-text-muted text-center">
                        Código de 6 dígitos de tu app autenticadora
                      </label>
                      <div className="grid grid-cols-6 gap-2">
                        {digitosOtp.map((digito, idx) => (
                          <input
                            key={idx}
                            ref={(el) => {
                              refsOtp.current[idx] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={digito}
                            onChange={(e) => cambiarDigitoOtp(idx, e.target.value)}
                            onKeyDown={(e) => manejarTeclaOtp(idx, e)}
                            disabled={cargando}
                            className="h-12 w-full text-center text-lg font-mono font-bold rounded-xl bg-surface-low border border-border-hairline text-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-text-muted">
                        Código de recuperación de un solo uso
                      </label>
                      <input
                        type="text"
                        value={codigoRecuperacion}
                        onChange={(e) => setCodigoRecuperacion(e.target.value.toUpperCase())}
                        placeholder="XXXX-XXXX"
                        disabled={cargando}
                        className="w-full text-center tracking-widest font-mono uppercase bg-surface-low border border-border-hairline rounded-xl py-2.5 px-4 text-text-primary text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        required
                      />
                    </div>
                  )}

                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-low border border-border-hairline cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recordarDispositivo}
                      onChange={(e) => setRecordarDispositivo(e.target.checked)}
                      className="mt-0.5 accent-[var(--hs-accent)]"
                    />
                    <span className="text-xs text-text-muted leading-snug">
                      <strong className="text-text-primary block">
                        Marcar dispositivo confiable (30 días)
                      </strong>
                      Solo omite 2FA en red local; desde redes externas siempre se solicita.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full py-2.5 bg-primary hover:opacity-95 text-[var(--hs-on-accent)] font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <span>Verificar y entrar</span>
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        transicionarCompuerta('VOLVIENDO A CREDENCIALES...', () =>
                          setDesafio2FA(null),
                        )
                      }
                      className="text-text-muted hover:text-text-primary cursor-pointer"
                    >
                      ← Volver
                    </button>
                    <button
                      type="button"
                      onClick={() => setUsarRecuperacion((prev) => !prev)}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      {usarRecuperacion ? 'Usar código TOTP' : 'Usar código de recuperación'}
                    </button>
                  </div>
                </form>
              )}

              {/* MODO 2: REGISTRO CON TOKEN DE INVITACIÓN TEMPORAL */}
              {modo === 'registro' && (
                <form onSubmit={manejarRegistroInvitacion} className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">
                        Registro con Invitación
                      </h2>
                      <p className="text-xs text-text-dim mt-0.5">
                        Requiere token temporal emitido por el Superadmin
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-mono border border-primary/25">
                      1 USO
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-text-muted">
                      Token de invitación temporal
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-[18px]">
                        vpn_key
                      </span>
                      <input
                        type="text"
                        value={tokenInvitacion}
                        onChange={(e) => setTokenInvitacion(e.target.value)}
                        placeholder="hs_inv_..."
                        className="w-full font-mono bg-surface-low border border-border-hairline rounded-xl py-2.5 pl-10 pr-3 text-text-primary text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-text-muted">Nombre de usuario</label>
                    <input
                      type="text"
                      value={usuarioNuevo}
                      onChange={(e) => setUsuarioNuevo(e.target.value)}
                      placeholder="colaborador.dev"
                      className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 px-3.5 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-text-muted">Contraseña</label>
                      <input
                        type="password"
                        value={contrasenaNueva}
                        onChange={(e) => setContrasenaNueva(e.target.value)}
                        placeholder="Mín. 8 chars"
                        className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 px-3 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-text-muted">Confirmar</label>
                      <input
                        type="password"
                        value={confirmarContrasena}
                        onChange={(e) => setConfirmarContrasena(e.target.value)}
                        placeholder="Repetir clave"
                        className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 px-3 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full py-2.5 mt-1 bg-primary hover:opacity-95 text-[var(--hs-on-accent)] font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <span>Validar token y crear cuenta</span>
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                  </button>
                </form>
              )}

              {/* MODO 3: RECUPERAR CONTRASEÑA CON 2FA (TOTP DEL AUTENTICADOR) */}
              {modo === 'recuperar' && (
                <form onSubmit={manejarRecuperarTotp} className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">
                        Recuperar con 2FA
                      </h2>
                      <p className="text-xs text-text-dim mt-0.5">
                        Restablece tu clave usando tu app autenticadora
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-mono border border-primary/25">
                      TOTP
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-text-muted">Usuario</label>
                    <input
                      type="text"
                      value={usuarioRecuperar}
                      onChange={(e) => setUsuarioRecuperar(e.target.value)}
                      placeholder="tu_usuario"
                      className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 px-3.5 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-text-muted">
                      Código 2FA (6 dígitos o código de recuperación)
                    </label>
                    <input
                      type="text"
                      value={codigoRecuperarTotp}
                      onChange={(e) => setCodigoRecuperarTotp(e.target.value)}
                      placeholder="123456"
                      className="w-full font-mono tracking-widest bg-surface-low border border-border-hairline rounded-xl py-2.5 px-3.5 text-primary text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-text-muted">Nueva contraseña</label>
                      <input
                        type="password"
                        value={nuevaContrasenaRecuperar}
                        onChange={(e) => setNuevaContrasenaRecuperar(e.target.value)}
                        placeholder="Mín. 8 chars"
                        className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 px-3 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-text-muted">Confirmar</label>
                      <input
                        type="password"
                        value={confirmarRecuperar}
                        onChange={(e) => setConfirmarRecuperar(e.target.value)}
                        placeholder="Repetir clave"
                        className="w-full bg-surface-low border border-border-hairline rounded-xl py-2.5 px-3 text-text-primary text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full py-2.5 mt-1 bg-primary hover:opacity-95 text-[var(--hs-on-accent)] font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    <span>Verificar 2FA y restablecer</span>
                    <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pie de certificaciones de seguridad */}
      <div className="mt-5 flex flex-wrap justify-center items-center gap-2.5 text-[11px] font-mono text-text-dim">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> 2FA TOTP
        </span>
        <span>•</span>
        <span>Tokens SHA-256</span>
        <span>•</span>
        <span>AES-256-GCM</span>
        <span>•</span>
        <span>Bcrypt</span>
      </div>
    </div>
  );
}
