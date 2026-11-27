import React, { useCallback, useEffect, useState } from 'react';
import ConfiguracionDosFactores from '../componentes/seguridad/ConfiguracionDosFactores';
import TablaEventosSeguridad from '../componentes/seguridad/TablaEventosSeguridad';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import { ErrorApi } from '../servicios/apiCliente';
import {
  AlertaEnviadaItem,
  HallazgoFuerzaBruta,
  IntentoSshFallido,
  IpBloqueadaItem,
  seguridadServicio,
} from '../servicios/seguridadServicio';

type PestanaSeguridad = '2fa' | 'auditoria' | 'intrusion';

function formatearFechaHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-BO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function Seguridad() {
  const { tokenAcceso } = usarAutenticacion();
  const [pestana, setPestana] = useState<PestanaSeguridad>('2fa');

  // Estado Fase 1: SSH + Fuerza Bruta + Bloqueo IPs + Alertas Observer
  const [intentosSsh, setIntentosSsh] = useState<IntentoSshFallido[]>([]);
  const [hallazgos, setHallazgos] = useState<HallazgoFuerzaBruta[]>([]);
  const [ipsBloqueadas, setIpsBloqueadas] = useState<IpBloqueadaItem[]>([]);
  const [alertas, setAlertas] = useState<AlertaEnviadaItem[]>([]);
  const [cargandoSsh, setCargandoSsh] = useState(false);
  const [nuevaIp, setNuevaIp] = useState('');
  const [motivoIp, setMotivoIp] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarDatosIntrusion = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargandoSsh(true);
    try {
      const [resSsh, resIps, resAlertas] = await Promise.all([
        seguridadServicio.obtenerSsh(tokenAcceso),
        seguridadServicio.listarIpsBloqueadas(tokenAcceso),
        seguridadServicio.listarAlertasNotificaciones(tokenAcceso),
      ]);
      setIntentosSsh(resSsh.intentosFallidos);
      setHallazgos(resSsh.hallazgosFuerzaBruta);
      setIpsBloqueadas(resIps.ips);
      setAlertas(resAlertas.alertas);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'Error al cargar datos de intrusión SSH');
    } finally {
      setCargandoSsh(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    if (pestana === 'intrusion') {
      void cargarDatosIntrusion();
    }
  }, [pestana, cargarDatosIntrusion]);

  const ejecutarSimulacion = async () => {
    if (!tokenAcceso) return;
    setCargandoSsh(true);
    setError(null);
    try {
      const res = await seguridadServicio.simularAtaqueSsh(tokenAcceso);
      setMensaje(
        `Ráfaga SSH simulada: ${res.hallazgosFuerzaBruta.length} patrón(es) de fuerza bruta detectados y ${res.alertasEmitidas} alerta(s) Observer emitidas.`,
      );
      await cargarDatosIntrusion();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo simular el ataque SSH');
    } finally {
      setCargandoSsh(false);
    }
  };

  const bloquearIpManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAcceso) return;
    setError(null);
    try {
      await seguridadServicio.bloquearIp({ direccionIp: nuevaIp, motivo: motivoIp }, tokenAcceso);
      setNuevaIp('');
      setMotivoIp('');
      setMensaje('Dirección IP bloqueada y notificada.');
      await cargarDatosIntrusion();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo bloquear la IP');
    }
  };

  const bloquearIpDirecto = async (ip: string, intentos: number) => {
    if (!tokenAcceso) return;
    setError(null);
    try {
      await seguridadServicio.bloquearIp(
        {
          direccionIp: ip,
          motivo: `Fuerza bruta SSH detectada (${intentos} intentos fallidos)`,
        },
        tokenAcceso,
      );
      setMensaje(`IP ${ip} bloqueada y registrada en auditoría.`);
      await cargarDatosIntrusion();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo bloquear la IP');
    }
  };

  const desbloquearIp = async (id: string) => {
    if (!tokenAcceso) return;
    try {
      await seguridadServicio.desbloquearIp(id, tokenAcceso);
      setMensaje('Dirección IP desbloqueada.');
      await cargarDatosIntrusion();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo desbloquear la IP');
    }
  };

  const probarTelegram = async () => {
    if (!tokenAcceso) return;
    try {
      await seguridadServicio.probarNotificacion(tokenAcceso);
      setMensaje('Notificación de prueba enviada por el Observer (Telegram).');
      await cargarDatosIntrusion();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'Error al probar notificación');
    }
  };

  const ipsBloqueadasSet = new Set(ipsBloqueadas.map((i) => i.direccionIp));

  return (
    <div className="w-full pt-20 px-4 sm:px-6 lg:px-7 pb-12 min-h-screen bg-canvas-base text-text-primary">
      <div className="w-full flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Seguridad y Auditoría
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Autenticación 2FA adaptativa, detección de fuerza bruta SSH, bloqueo de IPs y
            notificaciones Observer.
          </p>
        </div>

        <div className="flex items-center border-b border-border-hairline pb-3 overflow-x-auto">
          <div className="inline-flex items-center p-1 rounded-xl bg-surface-card border border-border-hairline gap-1">
            <button
              type="button"
              onClick={() => setPestana('2fa')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                pestana === '2fa'
                  ? 'bg-primary text-[var(--hs-on-accent)]'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>2FA y Dispositivos</span>
            </button>

            <button
              type="button"
              onClick={() => setPestana('auditoria')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                pestana === 'auditoria'
                  ? 'bg-primary text-[var(--hs-on-accent)]'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">policy</span>
              <span>Eventos y Auditoría</span>
            </button>

            <button
              type="button"
              onClick={() => setPestana('intrusion')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                pestana === 'intrusion'
                  ? 'bg-primary text-[var(--hs-on-accent)]'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">gpp_maybe</span>
              <span>SSH, Fuerza Bruta y Firewall</span>
            </button>
          </div>
        </div>

        {pestana === '2fa' && <ConfiguracionDosFactores />}
        {pestana === 'auditoria' && <TablaEventosSeguridad />}
        {pestana === 'intrusion' && (
          <div className="flex flex-col gap-5">
            {error && (
              <div className="rounded-xl bg-error-container border border-status-critical/30 px-4 py-3 text-xs text-status-critical">
                {error}
              </div>
            )}
            {mensaje && (
              <div className="rounded-xl bg-primary/12 border border-primary/30 px-4 py-3 text-xs text-primary flex items-center justify-between">
                <span>{mensaje}</span>
                <button
                  type="button"
                  onClick={() => setMensaje(null)}
                  className="text-xs underline cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            )}

            {/* Barra de acciones SSH + Observer Telegram */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/12 text-primary border border-primary/25 font-medium">
                  Colector auth.log (Fixture local)
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-card text-text-muted border border-border-hairline font-medium">
                  Política fuerza bruta: ≥ 5 intentos / 15m
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={cargandoSsh}
                  onClick={() => void probarTelegram()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">send</span>
                  <span>Probar alerta Telegram</span>
                </button>
                <button
                  type="button"
                  disabled={cargandoSsh}
                  onClick={() => void ejecutarSimulacion()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold hover:opacity-90 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">bolt</span>
                  <span>Simular ataque fuerza bruta SSH</span>
                </button>
              </div>
            </div>

            {/* Patrones de Fuerza Bruta Detectados (RF-13) */}
            <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
              <div className="px-5 py-4 border-b border-border-hairline flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    Patrones de Fuerza Bruta Detectados (RF-13)
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Evaluados por la regla pura de dominio PoliticaBloqueoFuerzaBruta
                  </p>
                </div>
                <span className="text-xs font-mono text-status-critical font-semibold">
                  {hallazgos.length} {hallazgos.length === 1 ? 'IP atacante' : 'IPs atacantes'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-hairline bg-surface-low/60 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                      <th className="py-3 px-5">IP Atacante</th>
                      <th className="py-3 px-4">Intentos</th>
                      <th className="py-3 px-4">Usuarios probados</th>
                      <th className="py-3 px-4">Último intento</th>
                      <th className="py-3 px-5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-hairline">
                    {hallazgos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 px-5 text-center text-xs text-text-dim">
                          Sin patrones de fuerza bruta activos en la ventana actual.
                        </td>
                      </tr>
                    ) : (
                      hallazgos.map((h) => {
                        const yaBloqueada = ipsBloqueadasSet.has(h.ipOrigen);
                        return (
                          <tr key={h.ipOrigen} className="hover:bg-surface-card-elevated/40">
                            <td className="py-3 px-5 font-mono text-xs font-bold text-status-critical">
                              {h.ipOrigen}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-text-primary">
                              {h.totalIntentos} fallos
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-text-muted">
                              {h.usuariosIntentados.join(', ')}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-text-dim">
                              {formatearFechaHora(h.ultimoIntento)}
                            </td>
                            <td className="py-3 px-5 text-right">
                              {yaBloqueada ? (
                                <span className="px-2.5 py-1 rounded-full bg-surface-low border border-border-hairline text-[11px] font-mono text-text-dim">
                                  Bloqueada
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void bloquearIpDirecto(h.ipOrigen, h.totalIntentos)}
                                  className="px-3 py-1 rounded-lg bg-status-critical text-white text-xs font-semibold hover:opacity-90 cursor-pointer"
                                >
                                  Bloquear IP
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bloqueo manual de IPs (RF-15) + Alertas Observer (RF-20) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              <div className="xl:col-span-7 rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
                <div className="px-5 py-4 border-b border-border-hairline">
                  <h2 className="text-sm font-semibold text-text-primary">
                    Firewall / IPs Bloqueadas (RF-15)
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Bloqueo manual con registro en auditoría inmutable
                  </p>
                </div>

                <form
                  onSubmit={bloquearIpManual}
                  className="p-4 border-b border-border-hairline bg-surface-low/50 flex flex-col sm:flex-row gap-2.5"
                >
                  <input
                    type="text"
                    value={nuevaIp}
                    onChange={(e) => setNuevaIp(e.target.value)}
                    placeholder="IP a bloquear (ej. 185.220.101.42)"
                    className="h-9 px-3 rounded-xl bg-surface-card border border-border-hairline font-mono text-xs text-text-primary focus:outline-none focus:border-primary sm:w-52"
                    required
                  />
                  <input
                    type="text"
                    value={motivoIp}
                    onChange={(e) => setMotivoIp(e.target.value)}
                    placeholder="Motivo del bloqueo"
                    className="flex-1 h-9 px-3 rounded-xl bg-surface-card border border-border-hairline text-xs text-text-primary focus:outline-none focus:border-primary"
                    required
                  />
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer shrink-0"
                  >
                    Bloquear IP
                  </button>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-hairline bg-surface-low/60 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                        <th className="py-2.5 px-4">IP</th>
                        <th className="py-2.5 px-4">Motivo</th>
                        <th className="py-2.5 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-hairline">
                      {ipsBloqueadas.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 px-4 text-center text-xs text-text-dim">
                            No hay direcciones IP bloqueadas.
                          </td>
                        </tr>
                      ) : (
                        ipsBloqueadas.map((ip) => (
                          <tr key={ip.id}>
                            <td className="py-2.5 px-4 font-mono text-xs font-semibold text-text-primary">
                              {ip.direccionIp}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-text-muted">{ip.motivo}</td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => void desbloquearIp(ip.id)}
                                className="px-2.5 py-1 rounded-lg bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs text-text-muted hover:text-text-primary cursor-pointer"
                              >
                                Desbloquear
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historial de Alertas Observer / Telegram (RF-20) */}
              <div className="xl:col-span-5 rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
                <div className="px-5 py-4 border-b border-border-hairline flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">
                      Alertas Emitidas (Observer / Telegram)
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Registro de notificaciones despachadas (`alertas_enviadas`)
                    </p>
                  </div>
                  <span className="text-xs font-mono text-primary">{alertas.length}</span>
                </div>

                <div className="divide-y divide-border-hairline max-h-80 overflow-y-auto">
                  {alertas.length === 0 ? (
                    <p className="py-8 px-5 text-center text-xs text-text-dim">
                      Sin alertas emitidas todavía.
                    </p>
                  ) : (
                    alertas.map((a) => (
                      <div key={a.id} className="p-4 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-primary font-semibold uppercase">
                            {a.canal} • {a.tipoEvento}
                          </span>
                          <span className="text-text-dim">{formatearFechaHora(a.enviadoEn)}</span>
                        </div>
                        <p className="text-xs text-text-primary leading-snug">{a.mensaje}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Últimos intentos SSH fallidos (RF-12) */}
            <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
              <div className="px-5 py-4 border-b border-border-hairline flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    Intentos de Acceso SSH Fallidos (RF-12)
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Extraídos por ColectorAuthLog desde auth.log
                  </p>
                </div>
                <span className="text-xs font-mono text-text-dim">
                  {intentosSsh.length} registros
                </span>
              </div>

              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-hairline bg-surface-low/60 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                      <th className="py-2.5 px-5">IP Origen</th>
                      <th className="py-2.5 px-4">Usuario intentado</th>
                      <th className="py-2.5 px-4">Puerto</th>
                      <th className="py-2.5 px-5 text-right">Fecha y hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-hairline">
                    {intentosSsh.slice(0, 25).map((intento, idx) => (
                      <tr key={idx} className="hover:bg-surface-card-elevated/40">
                        <td className="py-2.5 px-5 font-mono text-xs font-semibold text-text-primary">
                          {intento.ipOrigen}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs text-primary">
                          {intento.usuarioIntentado}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs text-text-muted">
                          {intento.puerto}
                        </td>
                        <td className="py-2.5 px-5 text-right font-mono text-xs text-text-dim">
                          {formatearFechaHora(intento.fechaHora)}
                        </td>
                      </tr>
                    ))}
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
