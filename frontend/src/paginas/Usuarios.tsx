import React, { useCallback, useEffect, useState } from 'react';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import { ErrorApi } from '../servicios/apiCliente';
import {
  ModuloSistema,
  RolUsuario,
  UsuarioAutenticado,
} from '../servicios/autenticacionServicio';
import {
  InvitacionUsuarioItem,
  RolInvitacion,
  usuariosServicio,
} from '../servicios/usuariosServicio';

const CATALOGO_MODULOS: Array<{ id: Exclude<ModuloSistema, 'usuarios'>; nombre: string; icono: string }> = [
  { id: 'recursos', nombre: 'Recursos', icono: 'monitoring' },
  { id: 'servicios', nombre: 'Servicios y Despliegues', icono: 'deployed_code' },
  { id: 'red', nombre: 'Red y Conectividad', icono: 'hub' },
  { id: 'seguridad', nombre: 'Seguridad y Auditoría', icono: 'shield' },
  { id: 'automatizacion', nombre: 'Automatización', icono: 'bolt' },
  { id: 'ia', nombre: 'Asistente IA / Voz', icono: 'graphic_eq' },
  { id: 'configuracion', nombre: 'Configuración', icono: 'tune' },
];

const PERMISOS_PRESET: Record<RolInvitacion, Array<Exclude<ModuloSistema, 'usuarios'>>> = {
  colaborador: ['recursos', 'servicios', 'ia'],
  administrador: ['recursos', 'servicios', 'red', 'seguridad', 'automatizacion', 'ia', 'configuracion'],
  solo_lectura: ['recursos', 'servicios', 'red'],
};

function formatearFecha(iso?: string | null): string {
  if (!iso) return 'Sin registros';
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

export default function Usuarios() {
  const { tokenAcceso, usuario: usuarioActual } = usarAutenticacion();
  const [usuarios, setUsuarios] = useState<UsuarioAutenticado[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionUsuarioItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Formulario nueva invitación
  const [rolInv, setRolInv] = useState<RolInvitacion>('colaborador');
  const [modulosInv, setModulosInv] = useState<Array<Exclude<ModuloSistema, 'usuarios'>>>(
    PERMISOS_PRESET.colaborador,
  );
  const [expiraEnHoras, setExpiraEnHoras] = useState<number>(24);
  const [notaInv, setNotaInv] = useState('');
  const [creandoInv, setCreandoInv] = useState(false);
  const [tokenRecienCreado, setTokenRecienCreado] = useState<string | null>(null);

  // Edición de permisos de un usuario existente
  const [editandoUsuarioId, setEditandoUsuarioId] = useState<string | null>(null);
  const [rolEdit, setRolEdit] = useState<RolUsuario>('colaborador');
  const [modulosEdit, setModulosEdit] = useState<ModuloSistema[]>([]);
  const [editandoContactoId, setEditandoContactoId] = useState<string | null>(null);
  const [telegramEdit, setTelegramEdit] = useState('');
  const [whatsappEdit, setWhatsappEdit] = useState('');

  const cargarTodo = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargando(true);
    setError(null);
    try {
      const [resU, resI] = await Promise.all([
        usuariosServicio.listarUsuarios(tokenAcceso),
        usuariosServicio.listarInvitaciones(tokenAcceso),
      ]);
      setUsuarios(resU.usuarios);
      setInvitaciones(resI.invitaciones);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los usuarios');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    void cargarTodo();
  }, [cargarTodo]);

  const alternarModuloInv = (mod: Exclude<ModuloSistema, 'usuarios'>) => {
    setModulosInv((prev) =>
      prev.includes(mod) ? (prev.length > 1 ? prev.filter((m) => m !== mod) : prev) : [...prev, mod],
    );
  };

  const alternarModuloEdit = (mod: ModuloSistema) => {
    setModulosEdit((prev) =>
      prev.includes(mod) ? (prev.length > 1 ? prev.filter((m) => m !== mod) : prev) : [...prev, mod],
    );
  };

  const manejarCrearInvitacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAcceso) return;
    setCreandoInv(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await usuariosServicio.crearInvitacion(
        {
          rol: rolInv,
          permisosModulos: modulosInv,
          expiraEnHoras,
          nota: notaInv.trim() || undefined,
        },
        tokenAcceso,
      );
      setTokenRecienCreado(res.tokenPlano);
      setNotaInv('');
      setMensaje('Token temporal generado. Cópialo ahora: solo se muestra una vez.');
      await cargarTodo();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo generar la invitación');
    } finally {
      setCreandoInv(false);
    }
  };

  const copiarTexto = async (texto: string, etiqueta: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setMensaje(`${etiqueta} copiado al portapapeles`);
    } catch {
      setError('No se pudo copiar automáticamente; selecciona y copia manualmente.');
    }
  };

  const abrirEditorPermisos = (u: UsuarioAutenticado) => {
    setEditandoUsuarioId(u.id);
    setRolEdit(u.rol);
    setModulosEdit(
      (u.permisosModulos ?? ['recursos']).filter((m) => m !== 'usuarios'),
    );
  };

  const guardarPermisos = async (usuarioId: string) => {
    if (!tokenAcceso) return;
    setError(null);
    try {
      await usuariosServicio.actualizarPermisos(
        usuarioId,
        { rol: rolEdit, permisosModulos: modulosEdit },
        tokenAcceso,
      );
      setEditandoUsuarioId(null);
      setMensaje('Permisos y ventanas actualizados correctamente');
      await cargarTodo();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'Error al actualizar permisos');
    }
  };

  const alternarEstadoUsuario = async (u: UsuarioAutenticado) => {
    if (!tokenAcceso) return;
    setError(null);
    try {
      await usuariosServicio.cambiarEstado(u.id, !(u.activo ?? true), tokenAcceso);
      setMensaje(
        u.activo === false
          ? `Cuenta ${u.nombreUsuario} reactivada`
          : `Cuenta ${u.nombreUsuario} suspendida y sesiones cerradas`,
      );
      await cargarTodo();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cambiar el estado');
    }
  };

  const revocarSesiones = async (u: UsuarioAutenticado) => {
    if (!tokenAcceso) return;
    setError(null);
    try {
      const res = await usuariosServicio.revocarSesiones(u.id, tokenAcceso);
      setMensaje(res.mensaje);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron revocar las sesiones');
    }
  };

  const abrirEditorContacto = (u: UsuarioAutenticado) => {
    setEditandoContactoId(u.id);
    setTelegramEdit(u.telegramChatId ?? '');
    setWhatsappEdit(u.whatsappNumero ?? '');
  };

  const guardarContacto = async (usuarioId: string) => {
    if (!tokenAcceso) return;
    setError(null);
    try {
      await usuariosServicio.actualizarContacto(
        usuarioId,
        { telegramChatId: telegramEdit.trim(), whatsappNumero: whatsappEdit.trim() },
        tokenAcceso,
      );
      setEditandoContactoId(null);
      setMensaje('Contacto de alertas (Telegram / WhatsApp) guardado correctamente');
      await cargarTodo();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar el contacto');
    }
  };

  const revocarInvitacion = async (id: string) => {
    if (!tokenAcceso) return;
    try {
      await usuariosServicio.revocarInvitacion(id, tokenAcceso);
      setMensaje('Invitación revocada');
      await cargarTodo();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo revocar la invitación');
    }
  };

  const activosCount = usuarios.filter((u) => u.activo !== false).length;
  const con2FACount = usuarios.filter((u) => u.totpHabilitado).length;
  const invitacionesVigentes = invitaciones.filter(
    (i) => !i.revocada && !i.usadoEn && new Date(i.expiraEn).getTime() > Date.now(),
  ).length;

  const enlaceInvitacion = tokenRecienCreado
    ? `${window.location.origin}/login?modo=registro&token=${encodeURIComponent(tokenRecienCreado)}`
    : '';

  return (
    <div className="pt-20 pb-10 px-4 sm:px-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Usuarios, Roles e Invitaciones
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Control de acceso Superadmin: genera tokens temporales y decide qué ventanas ve cada colaborador.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void cargarTodo()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-card border border-border-hairline text-xs font-semibold text-text-primary hover:border-primary/40 transition-all cursor-pointer self-start"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Actualizar
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-error-container border border-status-critical/30 text-status-critical text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[17px]">error</span>
          <span>{error}</span>
        </div>
      )}
      {mensaje && (
        <div className="p-3.5 rounded-xl bg-primary/12 border border-primary/30 text-primary text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[17px]">check_circle</span>
          <span>{mensaje}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { etiqueta: 'Usuarios totales', valor: usuarios.length, icono: 'group' },
          { etiqueta: 'Cuentas activas', valor: activosCount, icono: 'verified_user' },
          { etiqueta: 'Protegidos con 2FA', valor: con2FACount, icono: 'phonelink_lock' },
          { etiqueta: 'Invitaciones vigentes', valor: invitacionesVigentes, icono: 'vpn_key' },
        ].map((kpi) => (
          <div
            key={kpi.etiqueta}
            className="rounded-2xl bg-surface-card border border-border-hairline p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-xs text-text-muted">{kpi.etiqueta}</p>
              <p className="text-2xl font-bold font-mono text-text-primary mt-1">{kpi.valor}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">{kpi.icono}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Generador de Token de Invitación Temporal */}
      <section className="rounded-2xl bg-surface-card border border-border-hairline p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">key</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Generar token temporal de invitación
            </h2>
            <p className="text-xs text-text-muted">
              El token es de un solo uso y define exactamente qué ventanas podrá ver el colaborador.
            </p>
          </div>
        </div>

        <form onSubmit={manejarCrearInvitacion} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Rol asignado</label>
              <select
                value={rolInv}
                onChange={(e) => {
                  const nuevoRol = e.target.value as RolInvitacion;
                  setRolInv(nuevoRol);
                  setModulosInv(PERMISOS_PRESET[nuevoRol]);
                }}
                className="bg-surface-low border border-border-hairline rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="colaborador">Colaborador (proyectos y servicios)</option>
                <option value="administrador">Administrador (operación completa)</option>
                <option value="solo_lectura">Solo lectura (monitoreo)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Expiración del token</label>
              <select
                value={expiraEnHoras}
                onChange={(e) => setExpiraEnHoras(Number(e.target.value))}
                className="bg-surface-low border border-border-hairline rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                <option value={1}>1 hora</option>
                <option value={6}>6 horas</option>
                <option value={24}>24 horas</option>
                <option value={72}>3 días</option>
                <option value={168}>7 días</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Nota (opcional)</label>
              <input
                type="text"
                value={notaInv}
                onChange={(e) => setNotaInv(e.target.value)}
                placeholder="Ej: Colaborador proyecto web"
                className="bg-surface-low border border-border-hairline rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-text-muted mb-2">
              Ventanas permitidas para este usuario:
            </p>
            <div className="flex flex-wrap gap-2">
              {CATALOGO_MODULOS.map((mod) => {
                const marcado = modulosInv.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => alternarModuloInv(mod.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      marcado
                        ? 'bg-primary/15 text-primary border-primary/40'
                        : 'bg-surface-low text-text-muted border-border-hairline hover:text-text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">{mod.icono}</span>
                    {mod.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={creandoInv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold hover:opacity-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            {creandoInv ? 'Generando token...' : 'Generar token de invitación'}
          </button>
        </form>

        {tokenRecienCreado && (
          <div className="p-4 rounded-xl bg-surface-low border border-primary/40 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-primary">
                Token listo (se muestra una sola vez):
              </span>
              <button
                type="button"
                onClick={() => setTokenRecienCreado(null)}
                className="text-xs text-text-dim hover:text-text-primary cursor-pointer"
              >
                Ocultar
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-surface-card border border-border-hairline font-mono text-xs text-text-primary break-all">
                {tokenRecienCreado}
              </code>
              <button
                type="button"
                onClick={() => void copiarTexto(tokenRecienCreado, 'Token')}
                className="px-3 py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 text-xs font-semibold cursor-pointer shrink-0"
              >
                Copiar token
              </button>
              <button
                type="button"
                onClick={() => void copiarTexto(enlaceInvitacion, 'Enlace directo')}
                className="px-3 py-2 rounded-lg bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer shrink-0"
              >
                Copiar enlace
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Tabla de Usuarios */}
      <section className="rounded-2xl bg-surface-card border border-border-hairline p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-semibold text-text-primary">Usuarios con acceso al sistema</h2>

        {cargando ? (
          <p className="text-xs text-text-muted py-6 text-center">Cargando usuarios...</p>
        ) : (
          <div className="space-y-3">
            {usuarios.map((u) => {
              const esYo = u.id === usuarioActual?.id;
              const enEdicion = editandoUsuarioId === u.id;

              return (
                <div
                  key={u.id}
                  className="p-4 rounded-xl bg-surface-low border border-border-hairline space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {u.nombreUsuario.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary">
                            {u.nombreUsuario}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-primary/12 text-primary font-mono text-[10px] uppercase font-semibold">
                            {u.rol}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              u.activo === false
                                ? 'bg-error-container text-status-critical'
                                : 'bg-emerald-500/15 text-emerald-500'
                            }`}
                          >
                            {u.activo === false ? 'Suspendido' : 'Activo'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                              u.totpHabilitado
                                ? 'bg-primary/10 text-primary'
                                : 'bg-surface-high text-text-dim'
                            }`}
                          >
                            {u.totpHabilitado ? '2FA Activo' : 'Sin 2FA'}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-1 font-mono">
                          Último acceso: {formatearFecha(u.ultimoAccesoEn)} • IP:{' '}
                          {u.ultimaIpAcceso || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          editandoContactoId === u.id
                            ? setEditandoContactoId(null)
                            : abrirEditorContacto(u)
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-surface-card border border-border-hairline text-xs font-medium text-primary hover:border-primary/40 cursor-pointer"
                      >
                        {editandoContactoId === u.id ? 'Cerrar contacto' : 'Telegram / WhatsApp'}
                      </button>
                      {!esYo && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              enEdicion ? setEditandoUsuarioId(null) : abrirEditorPermisos(u)
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-surface-card border border-border-hairline text-xs font-medium text-text-primary hover:border-primary/40 cursor-pointer"
                          >
                            {enEdicion ? 'Cancelar' : 'Permisos'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void revocarSesiones(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-card border border-border-hairline text-xs font-medium text-text-muted hover:text-text-primary cursor-pointer"
                          >
                            Cerrar sesiones
                          </button>
                          <button
                            type="button"
                            onClick={() => void alternarEstadoUsuario(u)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                              u.activo === false
                                ? 'bg-primary/15 text-primary'
                                : 'bg-error-container text-status-critical'
                            }`}
                          >
                            {u.activo === false ? 'Reactivar' : 'Suspender'}
                          </button>
                        </>
                      )}
                      {esYo && (
                        <span className="text-[11px] font-mono text-text-dim px-2">
                          Tu sesión actual
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contacto actual (Telegram / WhatsApp) */}
                  {editandoContactoId === u.id ? (
                    <div className="pt-3 border-t border-border-hairline flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={telegramEdit}
                        onChange={(e) => setTelegramEdit(e.target.value)}
                        placeholder="Telegram Chat ID (ej. 1463499995)"
                        className="flex-1 rounded-lg bg-surface-card border border-border-hairline px-3 py-1.5 text-xs font-mono text-text-primary"
                      />
                      <input
                        type="text"
                        value={whatsappEdit}
                        onChange={(e) => setWhatsappEdit(e.target.value)}
                        placeholder="WhatsApp (ej. 5917XXXXXXX)"
                        className="flex-1 rounded-lg bg-surface-card border border-border-hairline px-3 py-1.5 text-xs font-mono text-text-primary"
                      />
                      <button
                        type="button"
                        onClick={() => void guardarContacto(u.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer"
                      >
                        Guardar contacto
                      </button>
                    </div>
                  ) : (
                    (u.telegramChatId || u.whatsappNumero) && (
                      <div className="flex flex-wrap gap-2 text-[11px] font-mono text-text-muted">
                        {u.telegramChatId && (
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">
                            Telegram ID: {u.telegramChatId}
                          </span>
                        )}
                        {u.whatsappNumero && (
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">
                            WhatsApp: {u.whatsappNumero}
                          </span>
                        )}
                      </div>
                    )
                  )}

                  {/* Chips de módulos visibles */}
                  {!enEdicion && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(u.permisosModulos ?? []).map((mod) => (
                        <span
                          key={mod}
                          className="px-2 py-0.5 rounded-md bg-surface-card border border-border-hairline text-[10px] font-mono text-text-muted"
                        >
                          {mod}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Editor inline de rol y ventanas */}
                  {enEdicion && (
                    <div className="pt-3 border-t border-border-hairline space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="text-xs text-text-muted">Rol:</label>
                        <select
                          value={rolEdit}
                          onChange={(e) => setRolEdit(e.target.value as RolUsuario)}
                          className="bg-surface-card border border-border-hairline rounded-lg px-2.5 py-1.5 text-xs text-text-primary"
                        >
                          <option value="colaborador">colaborador</option>
                          <option value="administrador">administrador</option>
                          <option value="solo_lectura">solo_lectura</option>
                          <option value="superadmin">superadmin</option>
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {CATALOGO_MODULOS.map((mod) => {
                          const activo =
                            rolEdit === 'superadmin' || modulosEdit.includes(mod.id);
                          return (
                            <button
                              key={mod.id}
                              type="button"
                              disabled={rolEdit === 'superadmin'}
                              onClick={() => alternarModuloEdit(mod.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer ${
                                activo
                                  ? 'bg-primary/15 text-primary border-primary/40'
                                  : 'bg-surface-card text-text-dim border-border-hairline'
                              }`}
                            >
                              {mod.nombre}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => void guardarPermisos(u.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer"
                      >
                        Guardar cambios
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Historial de Invitaciones */}
      <section className="rounded-2xl bg-surface-card border border-border-hairline p-5 sm:p-6 space-y-3">
        <h2 className="text-base font-semibold text-text-primary">Invitaciones emitidas</h2>
        {invitaciones.length === 0 ? (
          <p className="text-xs text-text-dim">Aún no has generado tokens de invitación.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-hairline text-text-dim font-mono">
                  <th className="py-2 pr-3">Prefijo</th>
                  <th className="py-2 pr-3">Rol</th>
                  <th className="py-2 pr-3">Ventanas</th>
                  <th className="py-2 pr-3">Nota</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-hairline">
                {invitaciones.map((inv) => {
                  const expirada = new Date(inv.expiraEn).getTime() <= Date.now();
                  const estado = inv.usadoEn
                    ? `Usada (${inv.usadoPorNombre || 'usuario'})`
                    : inv.revocada
                      ? 'Revocada'
                      : expirada
                        ? 'Expirada'
                        : `Vigente hasta ${formatearFecha(inv.expiraEn)}`;
                  const vigente = !inv.usadoEn && !inv.revocada && !expirada;

                  return (
                    <tr key={inv.id}>
                      <td className="py-2.5 pr-3 font-mono text-text-primary">{inv.prefijoToken}…</td>
                      <td className="py-2.5 pr-3 font-mono text-primary">{inv.rol}</td>
                      <td className="py-2.5 pr-3 text-text-muted">
                        {inv.permisosModulos.join(', ')}
                      </td>
                      <td className="py-2.5 pr-3 text-text-muted">{inv.nota || '—'}</td>
                      <td className="py-2.5 pr-3 text-text-muted">{estado}</td>
                      <td className="py-2.5 text-right">
                        {vigente && (
                          <button
                            type="button"
                            onClick={() => void revocarInvitacion(inv.id)}
                            className="text-status-critical hover:underline font-medium cursor-pointer"
                          >
                            Revocar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
