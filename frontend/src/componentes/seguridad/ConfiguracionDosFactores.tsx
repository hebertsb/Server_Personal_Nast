import React, { useCallback, useEffect, useState } from 'react';
import { usarAutenticacion } from '../../contexto/ContextoAutenticacion';
import { ErrorApi } from '../../servicios/apiCliente';
import {
  autenticacionServicio,
  ConfiguracionInicial2FA,
  Estado2FA,
} from '../../servicios/autenticacionServicio';

function formatearFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-BO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function ConfiguracionDosFactores() {
  const { tokenAcceso } = usarAutenticacion();
  const [estado, setEstado] = useState<Estado2FA | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Flujo de activación (QR + verificación inicial)
  const [configPendiente, setConfigPendiente] = useState<ConfiguracionInicial2FA | null>(null);
  const [codigoConfirmacion, setCodigoConfirmacion] = useState('');
  const [codigosGenerados, setCodigosGenerados] = useState<string[] | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [copiadoSecreto, setCopiadoSecreto] = useState(false);
  const [copiadosCodigos, setCopiadosCodigos] = useState(false);

  // Flujo de desactivación con contraseña o código de recuperación
  const [mostrarDesactivar, setMostrarDesactivar] = useState(false);
  const [metodoDesactivar, setMetodoDesactivar] = useState<'contrasena' | 'codigo'>('contrasena');
  const [credencialConfirmar, setCredencialConfirmar] = useState('');

  const cargarEstado = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargando(true);
    try {
      const datos = await autenticacionServicio.obtenerEstado2FA(tokenAcceso);
      setEstado(datos);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el estado 2FA');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    void cargarEstado();
  }, [cargarEstado]);

  const iniciarActivacion = async () => {
    if (!tokenAcceso) return;
    setProcesando(true);
    setError(null);
    setMensajeExito(null);
    try {
      const config = await autenticacionServicio.iniciar2FA(tokenAcceso);
      setConfigPendiente(config);
      setCodigoConfirmacion('');
      setCodigosGenerados(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'Error al generar el código QR');
    } finally {
      setProcesando(false);
    }
  };

  const confirmarActivacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAcceso) return;
    setProcesando(true);
    setError(null);
    try {
      const res = await autenticacionServicio.confirmar2FA(codigoConfirmacion, tokenAcceso);
      setCodigosGenerados(res.codigosRecuperacion);
      setConfigPendiente(null);
      setCodigoConfirmacion('');
      setMensajeExito(
        'Autenticación 2FA activada. Guarda tus 8 códigos de recuperación en un lugar seguro.',
      );
      await cargarEstado();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo confirmar el código TOTP');
    } finally {
      setProcesando(false);
    }
  };

  const desactivar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAcceso) return;
    setProcesando(true);
    setError(null);
    try {
      const payload =
        metodoDesactivar === 'codigo'
          ? { codigoRecuperacion: credencialConfirmar.trim().toUpperCase() }
          : { contrasena: credencialConfirmar };
      await autenticacionServicio.desactivar2FA(payload, tokenAcceso);
      setMostrarDesactivar(false);
      setCredencialConfirmar('');
      setCodigosGenerados(null);
      setMensajeExito('2FA desactivado y dispositivos confiables revocados.');
      await cargarEstado();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo desactivar 2FA');
    } finally {
      setProcesando(false);
    }
  };

  const revocarDispositivo = async (id: string) => {
    if (!tokenAcceso) return;
    setError(null);
    try {
      await autenticacionServicio.revocarDispositivo2FA(id, tokenAcceso);
      setMensajeExito('Dispositivo confiable revocado correctamente.');
      await cargarEstado();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo revocar el dispositivo');
    }
  };

  const copiarTexto = async (texto: string, tipo: 'secreto' | 'codigos') => {
    try {
      await navigator.clipboard.writeText(texto);
      if (tipo === 'secreto') {
        setCopiadoSecreto(true);
        setTimeout(() => setCopiadoSecreto(false), 1800);
      } else {
        setCopiadosCodigos(true);
        setTimeout(() => setCopiadosCodigos(false), 1800);
      }
    } catch {
      setError('No se pudo copiar al portapapeles');
    }
  };

  if (cargando) {
    return (
      <div className="rounded-2xl bg-surface-card border border-border-hairline p-6 animate-pulse">
        <div className="h-5 w-48 rounded bg-surface-card-elevated mb-3" />
        <div className="h-24 w-full rounded-xl bg-surface-card-elevated" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-error-container border border-status-critical/30 px-4 py-3 text-xs text-status-critical flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {mensajeExito && (
        <div
          role="status"
          className="rounded-xl bg-primary/12 border border-primary/30 px-4 py-3 text-xs text-primary flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* Tarjeta principal de estado 2FA */}
      <div className="rounded-2xl bg-surface-card border border-border-hairline p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                estado?.totpHabilitado
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'bg-surface-low text-text-muted border border-border-hairline'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">
                {estado?.totpHabilitado ? 'verified_user' : 'shield'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary">
                  Autenticación de Dos Factores (TOTP Adaptativo)
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    estado?.totpHabilitado
                      ? 'bg-primary/15 text-primary'
                      : 'bg-surface-card-elevated text-text-muted'
                  }`}
                >
                  {estado?.totpHabilitado ? 'Activo' : 'Desactivado'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Compatible con Google Authenticator, Authy o Ente. Se solicita automáticamente
                desde redes externas o dispositivos nuevos; los dispositivos de confianza en red
                local recuerdan la verificación por 30 días.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {!estado?.totpHabilitado ? (
              <button
                type="button"
                disabled={procesando}
                onClick={() => void iniciarActivacion()}
                className="px-4 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold hover:opacity-90 disabled:opacity-60 transition-all cursor-pointer"
              >
                {configPendiente ? 'Regenerar código QR' : 'Configurar 2FA (TOTP)'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarDesactivar((prev) => !prev)}
                className="px-4 py-2 rounded-xl bg-surface-low hover:bg-error-container border border-border-hairline hover:border-status-critical/30 text-xs font-medium text-text-muted hover:text-status-critical transition-all cursor-pointer"
              >
                Desactivar 2FA
              </button>
            )}
          </div>
        </div>

        {/* Resumen rápido cuando está activo */}
        {estado?.totpHabilitado && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border-hairline">
            <div className="p-3.5 rounded-xl bg-surface-low border border-border-hairline">
              <span className="text-[11px] text-text-dim block">Método activo</span>
              <span className="text-sm font-semibold text-text-primary mt-0.5 block">
                TOTP (RFC 6238 • 30s)
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-low border border-border-hairline">
              <span className="text-[11px] text-text-dim block">Códigos de recuperación</span>
              <span className="text-sm font-mono font-semibold text-primary mt-0.5 block">
                {estado.codigosRecuperacionRestantes} disponibles
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-surface-low border border-border-hairline">
              <span className="text-[11px] text-text-dim block">Dispositivos de confianza</span>
              <span className="text-sm font-mono font-semibold text-text-primary mt-0.5 block">
                {estado.dispositivosConfiables.length} activos
              </span>
            </div>
          </div>
        )}

        {/* Paso de vinculación: QR + secreto manual + verificación */}
        {configPendiente && (
          <div className="pt-5 border-t border-border-hairline grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-4 flex flex-col items-center p-4 rounded-2xl bg-surface-low border border-border-hairline">
              <img
                src={configPendiente.qrDataUrl}
                alt="Código QR para app autenticadora"
                className="w-48 h-48 rounded-xl bg-white p-2 shadow-sm"
              />
              <span className="text-[11px] text-text-dim mt-2 text-center">
                Escanea este QR con Google Authenticator, Authy o Ente
              </span>
            </div>

            <div className="lg:col-span-8 flex flex-col gap-4">
              <div>
                <span className="text-xs font-medium text-text-muted block mb-1.5">
                  O ingresa el secreto manualmente (Base32):
                </span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-xl bg-surface-low border border-border-hairline font-mono text-xs text-primary break-all select-all">
                    {configPendiente.secretoManual}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copiarTexto(configPendiente.secretoManual, 'secreto')}
                    className="px-3 py-2 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[15px] text-primary">
                      {copiadoSecreto ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiadoSecreto ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <form onSubmit={confirmarActivacion} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={codigoConfirmacion}
                  onChange={(e) => setCodigoConfirmacion(e.target.value.replace(/\D/g, ''))}
                  placeholder="Código de 6 dígitos"
                  className="flex-1 h-10 px-3.5 rounded-xl bg-surface-low border border-border-hairline font-mono text-sm tracking-widest text-text-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
                <button
                  type="submit"
                  disabled={procesando || codigoConfirmacion.length !== 6}
                  className="h-10 px-5 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {procesando ? 'Verificando...' : 'Confirmar y activar 2FA'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Códigos de recuperación mostrados una única vez tras activar */}
        {codigosGenerados && (
          <div className="p-5 rounded-2xl bg-surface-low border border-primary/30 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Códigos de recuperación de un solo uso
                </h3>
                <p className="text-xs text-text-muted">
                  Guárdalos ahora: por seguridad no volverán a mostrarse en texto plano.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copiarTexto(codigosGenerados.join('\n'), 'codigos')}
                className="px-3 py-1.5 rounded-xl bg-surface-card border border-border-hairline text-xs font-medium text-primary flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {copiadosCodigos ? 'check' : 'content_copy'}
                </span>
                <span>{copiadosCodigos ? 'Copiados' : 'Copiar los 8 códigos'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {codigosGenerados.map((codigo) => (
                <code
                  key={codigo}
                  className="py-2 px-3 rounded-lg bg-surface-card border border-border-hairline text-center font-mono text-xs font-semibold text-text-primary select-all"
                >
                  {codigo}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Confirmación con contraseña o código de recuperación para desactivar 2FA */}
        {mostrarDesactivar && (
          <form
            onSubmit={desactivar}
            className="p-4 rounded-xl bg-error-container border border-status-critical/30 flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-status-critical">
                Elige cómo confirmar la desactivación de 2FA:
              </span>
              <div className="inline-flex p-0.5 rounded-lg bg-surface-card border border-border-hairline text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMetodoDesactivar('contrasena');
                    setCredencialConfirmar('');
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    metodoDesactivar === 'contrasena'
                      ? 'bg-primary text-[var(--hs-on-accent)]'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Con contraseña
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMetodoDesactivar('codigo');
                    setCredencialConfirmar('');
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    metodoDesactivar === 'codigo'
                      ? 'bg-primary text-[var(--hs-on-accent)]'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Con código de recuperación
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <input
                type={metodoDesactivar === 'contrasena' ? 'password' : 'text'}
                value={credencialConfirmar}
                onChange={(e) =>
                  setCredencialConfirmar(
                    metodoDesactivar === 'codigo'
                      ? e.target.value.toUpperCase()
                      : e.target.value,
                  )
                }
                placeholder={
                  metodoDesactivar === 'contrasena'
                    ? 'Ingresa tu contraseña actual'
                    : 'Ingresa uno de tus 8 códigos (ej. XXXX-XXXX)'
                }
                className={`flex-1 h-9 px-3 rounded-lg bg-surface-card border border-border-hairline text-xs text-text-primary focus:outline-none focus:border-status-critical ${
                  metodoDesactivar === 'codigo' ? 'font-mono tracking-wider uppercase' : ''
                }`}
                required
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarDesactivar(false);
                    setCredencialConfirmar('');
                  }}
                  className="h-9 px-3 rounded-lg bg-surface-card border border-border-hairline text-xs text-text-muted cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="h-9 px-4 rounded-lg bg-status-critical text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Confirmar desactivación
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Tabla de dispositivos confiables (RF-04d) */}
      <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-border-hairline flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Dispositivos de Confianza</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Navegadores autorizados en red local tras completar 2FA
            </p>
          </div>
          <span className="text-xs font-mono text-text-dim">
            {estado?.dispositivosConfiables.length ?? 0} activos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-hairline bg-surface-low/60 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                <th className="py-3 px-5">Dispositivo</th>
                <th className="py-3 px-4">Última IP</th>
                <th className="py-3 px-4">Válido hasta</th>
                <th className="py-3 px-5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline">
              {!estado || estado.dispositivosConfiables.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 px-5 text-center text-xs text-text-dim">
                    No hay dispositivos confiables registrados todavía.
                  </td>
                </tr>
              ) : (
                estado.dispositivosConfiables.map((disp) => (
                  <tr key={disp.id} className="hover:bg-surface-card-elevated/40">
                    <td className="py-3 px-5 font-medium text-text-primary">
                      {disp.etiquetaDispositivo}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-text-muted">
                      {disp.ultimaIp}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-text-muted">
                      {formatearFecha(disp.confiableHasta)}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => void revocarDispositivo(disp.id)}
                        className="px-2.5 py-1 rounded-lg bg-surface-low hover:bg-error-container border border-border-hairline text-xs text-text-muted hover:text-status-critical transition-colors cursor-pointer"
                      >
                        Revocar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
