import React, { useCallback, useEffect, useState } from 'react';
import { usarAutenticacion } from '../../contexto/ContextoAutenticacion';
import { ErrorApi } from '../../servicios/apiCliente';
import {
  biometriaServicio,
  biometriaSoportada,
  CredencialBiometricaItem,
} from '../../servicios/biometriaServicio';

function detectarNombreDispositivo(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone (Face ID)';
  if (/iPad/i.test(ua)) return 'iPad (Face ID / Touch ID)';
  if (/Android/i.test(ua)) return 'Celular Android (Huella)';
  if (/Macintosh/i.test(ua)) return 'Mac (Touch ID)';
  if (/Windows/i.test(ua)) return 'PC Windows (Windows Hello)';
  return 'Dispositivo biométrico';
}

function formatearFecha(iso: string | null): string {
  if (!iso) return 'Sin usos aún';
  try {
    return new Date(iso).toLocaleString('es-BO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Panel para registrar y administrar dispositivos biométricos WebAuthn / Passkeys
 * (Huella Digital Android, Face ID / Touch ID iPhone, Windows Hello).
 */
export default function ConfiguracionBiometria() {
  const { tokenAcceso } = usarAutenticacion();
  const [credenciales, setCredenciales] = useState<CredencialBiometricaItem[]>([]);
  const [etiqueta, setEtiqueta] = useState(() => detectarNombreDispositivo());
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const soportado = biometriaSoportada();

  const cargar = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargando(true);
    try {
      const res = await biometriaServicio.listarCredenciales(tokenAcceso);
      setCredenciales(res.credenciales);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los dispositivos biométricos');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const manejarRegistrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAcceso) return;
    setRegistrando(true);
    setError(null);
    setMensaje(null);
    try {
      await biometriaServicio.registrarDispositivo(
        etiqueta.trim() || detectarNombreDispositivo(),
        tokenAcceso,
      );
      setMensaje(
        '¡Dispositivo biométrico registrado! Ya podés ingresar o verificar 2FA con tu Huella o Face ID.',
      );
      await cargar();
    } catch (err) {
      if (err instanceof ErrorApi) {
        setError(err.message);
      } else if (err instanceof DOMException && err.name === 'InvalidStateError') {
        setError(
          'Este dispositivo (o tu cuenta sincronizada de Google/iCloud) ya tiene una llave biométrica registrada en HomeSOC. Ya podés usar tu Huella o Face ID directamente al iniciar sesión.',
        );
      } else if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Verificación biométrica cancelada o agotó el tiempo de espera.');
      } else if (err instanceof DOMException && err.name === 'SecurityError') {
        setError('La biometría requiere abrir HomeSOC desde tu dirección segura HTTPS.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('No se pudo registrar el dispositivo biométrico');
      }
    } finally {
      setRegistrando(false);
    }
  };

  const manejarRevocar = async (id: string) => {
    if (!tokenAcceso) return;
    setError(null);
    try {
      await biometriaServicio.revocarCredencial(id, tokenAcceso);
      setMensaje('Dispositivo biométrico revocado correctamente');
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo revocar el dispositivo');
    }
  };

  return (
    <section className="rounded-2xl bg-surface-card border border-border-hairline p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">fingerprint</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Acceso y 2FA Biométrico (Huella Digital / Face ID)
            </h2>
            <p className="text-xs text-text-muted">
              Estándar WebAuthn / Passkeys — tu huella o rostro nunca sale de tu celular.
            </p>
          </div>
        </div>
        <span
          className={`self-start px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${
            credenciales.length > 0
              ? 'bg-primary/12 text-primary border-primary/30'
              : 'bg-surface-low text-text-dim border-border-hairline'
          }`}
        >
          {credenciales.length} dispositivo(s)
        </span>
      </div>

      {!soportado && (
        <div className="p-3.5 rounded-xl bg-status-warning/12 border border-status-warning/30 text-status-warning text-xs flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">https</span>
          <div>
            <strong className="block">Se requiere conexión segura HTTPS para usar Huella o Face ID.</strong>
            Abrí HomeSOC desde tu enlace seguro de Tailscale HTTPS (ej.{' '}
            <code className="font-mono">https://home-lab.tail3b5ebb.ts.net:8444</code>) en tu
            celular o PC para registrar tu biometría.
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-error-container border border-status-critical/30 text-status-critical text-xs">
          {error}
        </div>
      )}
      {mensaje && (
        <div className="p-3 rounded-xl bg-primary/12 border border-primary/30 text-primary text-xs">
          {mensaje}
        </div>
      )}

      <form onSubmit={manejarRegistrar} className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="text"
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          placeholder="Nombre del dispositivo (ej. Celular Hebert)"
          className="flex-1 bg-surface-low border border-border-hairline rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
          disabled={registrando}
        />
        <button
          type="submit"
          disabled={registrando || !soportado}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">fingerprint</span>
          {registrando ? 'Esperando huella / Face ID...' : 'Registrar este dispositivo'}
        </button>
      </form>

      {cargando ? (
        <p className="text-xs text-text-dim">Cargando dispositivos biométricos...</p>
      ) : credenciales.length === 0 ? (
        <p className="text-xs text-text-dim">
          Todavía no registraste ningún celular o dispositivo con huella/Face ID.
        </p>
      ) : (
        <div className="space-y-2">
          {credenciales.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-low border border-border-hairline"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-[20px] text-primary shrink-0">
                  smartphone
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">
                    {c.etiquetaDispositivo}
                  </p>
                  <p className="text-[11px] font-mono text-text-dim">
                    Último uso: {formatearFecha(c.ultimoUsoEn)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void manejarRevocar(c.id)}
                className="px-2.5 py-1 rounded-lg bg-error-container text-status-critical text-xs font-medium cursor-pointer shrink-0"
              >
                Revocar
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
