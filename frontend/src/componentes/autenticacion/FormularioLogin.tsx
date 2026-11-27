import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usarAutenticacion } from '../../contexto/ContextoAutenticacion';
import { ErrorApi } from '../../servicios/apiCliente';
import { RespuestaPendiente2FA } from '../../servicios/autenticacionServicio';

export default function FormularioLogin() {
  const navigate = useNavigate();
  const { iniciarSesion, completarSegundoFactor } = usarAutenticacion();

  const [nombreUsuario, setNombreUsuario] = useState('admin');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  // Estado Paso 2 (2FA condicional)
  const [desafio2FA, setDesafio2FA] = useState<RespuestaPendiente2FA | null>(null);
  const [digitosOtp, setDigitosOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [usarRecuperacion, setUsarRecuperacion] = useState(false);
  const [codigoRecuperacion, setCodigoRecuperacion] = useState('');
  const [recordarDispositivo, setRecordarDispositivo] = useState(true);
  const refsOtp = useRef<Array<HTMLInputElement | null>>([]);

  const [cargando, setCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  const manejarPaso1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setCargando(true);

    try {
      const respuesta = await iniciarSesion(nombreUsuario, contrasena);
      if (respuesta.requiere2FA) {
        setDesafio2FA(respuesta);
        setDigitosOtp(['', '', '', '', '', '']);
        setCodigoRecuperacion('');
        setUsarRecuperacion(false);
        setTimeout(() => refsOtp.current[0]?.focus(), 40);
      } else {
        navigate('/', { replace: true });
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

    setCargando(true);
    try {
      await completarSegundoFactor({
        tokenTemporal2FA: desafio2FA.tokenTemporal2FA,
        codigo,
        recordarDispositivo,
      });
      navigate('/', { replace: true });
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
    <div className="w-full max-w-[430px] flex flex-col items-center">
      {/* Identidad limpia */}
      <div className="flex flex-col items-center mb-7 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary text-[var(--hs-on-accent)] flex items-center justify-center shadow-md mb-4">
          <span className="material-symbols-outlined text-[28px]">shield_with_heart</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">
          Home<span className="text-primary">SOC</span>
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Panel centralizado de monitoreo y seguridad homelab
        </p>
      </div>

      {/* Tarjeta adaptable a Modo Día y Modo Noche */}
      <div
        className="w-full rounded-2xl bg-surface-card/95 backdrop-blur-xl border border-border-hairline overflow-hidden"
        style={{ boxShadow: 'var(--hs-shadow-sidebar)' }}
      >
        <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary-container to-primary" />

        <div className="p-7 sm:p-8">
          {!desafio2FA ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Iniciar sesión</h2>
                  <p className="text-xs text-text-dim mt-0.5">
                    Ingresa con tu cuenta de administrador
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">
                  Local
                </span>
              </div>

              {mensajeError && (
                <div
                  role="alert"
                  className="mb-5 p-3 rounded-xl bg-error-container border border-status-critical/30 text-status-critical text-xs flex items-start gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                    error
                  </span>
                  <span>{mensajeError}</span>
                </div>
              )}

              <form onSubmit={manejarPaso1} className="flex flex-col gap-4">
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
                      placeholder="admin"
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
                  className="w-full py-2.5 mt-2 bg-primary hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed text-[var(--hs-on-accent)] font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {cargando ? (
                    <span>Verificando credenciales...</span>
                  ) : (
                    <>
                      <span>Entrar al panel</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Paso 2: Verificación 2FA TOTP adaptativa */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Verificación 2FA</h2>
                  <p className="text-xs text-text-dim mt-0.5">
                    Cuenta: <span className="font-mono text-text-primary">{desafio2FA.usuario.nombreUsuario}</span>
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

              {mensajeError && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-xl bg-error-container border border-status-critical/30 text-status-critical text-xs flex items-start gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                    error
                  </span>
                  <span>{mensajeError}</span>
                </div>
              )}

              <form onSubmit={manejarPaso2} className="flex flex-col gap-4">
                {!usarRecuperacion ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-text-muted text-center">
                      Ingresa el código de 6 dígitos de tu app autenticadora
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
                    <label htmlFor="codigoRec" className="text-xs font-medium text-text-muted">
                      Código de recuperación de un solo uso
                    </label>
                    <input
                      id="codigoRec"
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
                      Marcar como dispositivo de confianza (30 días)
                    </strong>
                    Solo omite 2FA en red local; desde redes externas siempre se solicitará.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full py-2.5 bg-primary hover:opacity-95 disabled:opacity-60 text-[var(--hs-on-accent)] font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <span>{cargando ? 'Validando...' : 'Verificar y entrar'}</span>
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDesafio2FA(null);
                      setMensajeError(null);
                    }}
                    className="text-text-muted hover:text-text-primary cursor-pointer"
                  >
                    ← Volver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUsarRecuperacion((prev) => !prev);
                      setMensajeError(null);
                    }}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    {usarRecuperacion ? 'Usar código TOTP de 6 dígitos' : 'Usar código de recuperación'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-1.5 text-center">
        <div className="flex flex-wrap justify-center items-center gap-2.5 text-[11px] font-mono text-text-dim">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" /> 2FA TOTP Adaptativo
          </span>
          <span>•</span>
          <span>AES-256-GCM</span>
          <span>•</span>
          <span>Bcrypt</span>
        </div>
      </div>
    </div>
  );
}
