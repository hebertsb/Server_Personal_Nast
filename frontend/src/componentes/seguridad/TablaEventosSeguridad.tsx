import { useCallback, useEffect, useState } from 'react';
import { usarAutenticacion } from '../../contexto/ContextoAutenticacion';
import { ErrorApi } from '../../servicios/apiCliente';
import {
  EventoSeguridadItem,
  RegistroAuditoriaItem,
  seguridadServicio,
  SeveridadEvento,
} from '../../servicios/seguridadServicio';

function estiloSeveridad(severidad: SeveridadEvento): string {
  switch (severidad) {
    case 'critica':
    case 'alta':
      return 'bg-error-container text-status-critical border border-status-critical/30';
    case 'media':
      return 'bg-status-warning/15 text-status-warning border border-status-warning/30';
    default:
      return 'bg-primary/12 text-primary border border-primary/25';
  }
}

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

export default function TablaEventosSeguridad() {
  const { tokenAcceso } = usarAutenticacion();
  const [eventos, setEventos] = useState<EventoSeguridadItem[]>([]);
  const [auditoria, setAuditoria] = useState<RegistroAuditoriaItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargando(true);
    try {
      const [resEv, resAud] = await Promise.all([
        seguridadServicio.listarEventos(tokenAcceso, 50),
        seguridadServicio.listarAuditoria(tokenAcceso, 50),
      ]);
      setEventos(resEv.eventos);
      setAuditoria(resAud.registros);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudieron cargar los registros');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/12 text-primary border border-primary/25 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            PostgreSQL RLS activo
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-card text-text-muted border border-border-hairline font-medium">
            Auditoría inmutable (solo inserción)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-card text-text-muted border border-border-hairline font-medium">
            Rate Limit activo (Login 5/15m • API 100/m)
          </span>
        </div>

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

      {error && (
        <div className="rounded-xl bg-error-container border border-status-critical/30 px-4 py-3 text-xs text-status-critical">
          {error}
        </div>
      )}

      {/* Eventos de seguridad */}
      <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-border-hairline flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Eventos de Seguridad</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Bloqueos por rate limiting, cambios de 2FA e intentos externos fallidos
            </p>
          </div>
          <span className="text-xs font-mono text-text-dim">{eventos.length} eventos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-hairline bg-surface-low/60 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                <th className="py-3 px-5">Evento</th>
                <th className="py-3 px-4">Severidad</th>
                <th className="py-3 px-4">IP de origen</th>
                <th className="py-3 px-5 text-right">Fecha y hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline">
              {eventos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 px-5 text-center text-xs text-text-dim">
                    Sin eventos de seguridad registrados todavía.
                  </td>
                </tr>
              ) : (
                eventos.map((ev) => (
                  <tr key={ev.id} className="hover:bg-surface-card-elevated/40">
                    <td className="py-3 px-5 font-mono text-xs font-semibold text-text-primary">
                      {ev.tipoEvento}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase ${estiloSeveridad(
                          ev.severidad,
                        )}`}
                      >
                        {ev.severidad}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-text-muted">{ev.ipOrigen}</td>
                    <td className="py-3 px-5 text-right font-mono text-xs text-text-dim">
                      {formatearFechaHora(ev.fechaHora)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auditoría inmutable de acciones */}
      <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-border-hairline flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Auditoría Inmutable de Acciones
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Registro protegido en PostgreSQL (bloquea UPDATE y DELETE)
            </p>
          </div>
          <span className="text-xs font-mono text-text-dim">{auditoria.length} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-hairline bg-surface-low/60 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
                <th className="py-3 px-5">Acción</th>
                <th className="py-3 px-4">Recurso</th>
                <th className="py-3 px-4">Usuario / Origen</th>
                <th className="py-3 px-4">IP</th>
                <th className="py-3 px-5 text-right">Fecha y hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-hairline">
              {auditoria.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 px-5 text-center text-xs text-text-dim">
                    Sin acciones auditadas todavía.
                  </td>
                </tr>
              ) : (
                auditoria.map((reg) => (
                  <tr key={reg.id} className="hover:bg-surface-card-elevated/40">
                    <td className="py-3 px-5 font-mono text-xs font-semibold text-primary">
                      {reg.accion}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-text-primary">{reg.recurso}</td>
                    <td className="py-3 px-4 text-xs text-text-muted">
                      {reg.nombreUsuario || 'sistema'}{' '}
                      <span className="px-1.5 py-0.5 rounded bg-surface-low border border-border-hairline font-mono text-[10px]">
                        {reg.origen}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-text-dim">
                      {reg.direccionIp || '—'}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-xs text-text-dim">
                      {formatearFechaHora(reg.fechaHora)}
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
