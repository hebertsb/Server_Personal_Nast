import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { usarAutenticacion } from '../../contexto/ContextoAutenticacion';
import { ErrorApi } from '../../servicios/apiCliente';
import {
  ConexionGithubItem,
  DespliegueRegistroItem,
  githubServicio,
  ModoActualizacionRepo,
  ProyectoConectadoItem,
  RepositorioGithubItem,
  ResultadoDeteccionItem,
  TipoProyectoDespliegue,
  VariableEntornoItem,
} from '../../servicios/githubServicio';
import { ExplicacionFalloItem, iaMcpServicio } from '../../servicios/iaMcpServicio';
import { usuariosServicio } from '../../servicios/usuariosServicio';

function formatearFechaCorta(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-BO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function etiquetaTipoProyecto(tipo: TipoProyectoDespliegue): string {
  switch (tipo) {
    case 'dockerfile':
      return 'Dockerfile';
    case 'nodejs':
      return 'Node.js (Plantilla)';
    case 'html_estatico':
      return 'HTML Estático (Nginx)';
  }
}

export default function PanelDesplieguesGithub() {
  const { tokenAcceso, usuario } = usarAutenticacion();
  const [conexion, setConexion] = useState<ConexionGithubItem | null>(null);
  const [oauthHabilitado, setOauthHabilitado] = useState(false);
  const [mostrarPatAvanzado, setMostrarPatAvanzado] = useState(false);
  const [iniciandoOAuth, setIniciandoOAuth] = useState(false);
  const [repositorios, setRepositorios] = useState<RepositorioGithubItem[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoConectadoItem[]>([]);
  const [tokenInput, setTokenInput] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtroVisibilidad, setFiltroVisibilidad] = useState<'todos' | 'privados' | 'publicos'>(
    'todos',
  );
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Estado del asistente guiado de despliegue (RF-30, RF-31)
  const [repoEnAsistente, setRepoEnAsistente] = useState<RepositorioGithubItem | null>(null);
  const [deteccion, setDeteccion] = useState<ResultadoDeteccionItem | null>(null);
  const [detectando, setDetectando] = useState(false);
  const [puertoAsistente, setPuertoAsistente] = useState('4100');
  const [modoAsistente, setModoAsistente] = useState<ModoActualizacionRepo>('polling');
  const [aprobacionAsistente, setAprobacionAsistente] = useState(false);
  const [creandoProyecto, setCreandoProyecto] = useState(false);

  // Estado de panel expandido por proyecto (Variables cifradas o Historial/Logs)
  const [proyectoSeleccionadoId, setProyectoSeleccionadoId] = useState<string | null>(null);
  const [vistaDetalle, setVistaDetalle] = useState<'variables' | 'historial'>('variables');
  const [variablesProyecto, setVariablesProyecto] = useState<VariableEntornoItem[]>([]);
  const [historialProyecto, setHistorialProyecto] = useState<DespliegueRegistroItem[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [claveVar, setClaveVar] = useState('');
  const [valorVar, setValorVar] = useState('');
  const [guardandoVar, setGuardandoVar] = useState(false);
  const [redeployId, setRedeployId] = useState<string | null>(null);
  const [accionDespliegueId, setAccionDespliegueId] = useState<string | null>(null);
  const [ejecutandoPolling, setEjecutandoPolling] = useState(false);
  const [explicacionesIa, setExplicacionesIa] = useState<Record<string, ExplicacionFalloItem>>({});
  const [explicandoId, setExplicandoId] = useState<string | null>(null);
  const [urlEditorSync, setUrlEditorSync] = useState<string>(
    () => localStorage.getItem('homesoc_codeserver_url') || '',
  );
  const [rutaEditorSync, setRutaEditorSync] = useState<string>(
    () => localStorage.getItem('homesoc_codeserver_ruta') || '/home/coder/project',
  );

  const construirUrlCodeServer = (nombreProyecto: string): string | null => {
    const base = urlEditorSync.trim().replace(/\/+$/, '');
    if (!base) return null;
    const carpetaBase = (rutaEditorSync || '/home/coder/project').trim().replace(/\/+$/, '');
    return `${base}/?folder=${encodeURIComponent(`${carpetaBase}/${nombreProyecto}`)}`;
  };

  const manejarExplicarConIa = async (proyectoId: string, despliegueId: string) => {
    if (!tokenAcceso) return;
    setExplicandoId(despliegueId);
    try {
      const { explicacion } = await iaMcpServicio.explicarDespliegue(
        proyectoId,
        despliegueId,
        tokenAcceso,
      );
      setExplicacionesIa((prev) => ({ ...prev, [despliegueId]: explicacion }));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo analizar el despliegue con IA');
    } finally {
      setExplicandoId(null);
    }
  };

  const esAdmin =
    usuario?.rol === 'superadmin' ||
    usuario?.rol === 'administrador' ||
    usuario?.rol === 'colaborador';

  const cargarTodo = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargando(true);
    try {
      const [
        { conexion: estado, oauthHabilitado: oauthOk },
        { proyectos: listaProyectos },
        resEditor,
      ] = await Promise.all([
        githubServicio.obtenerEstado(tokenAcceso),
        githubServicio.listarProyectos(tokenAcceso),
        usuariosServicio.obtenerConfigEditor(tokenAcceso).catch(() => null),
      ]);
      if (resEditor?.editor) {
        setUrlEditorSync(resEditor.editor.url);
        setRutaEditorSync(resEditor.editor.rutaBase);
        localStorage.setItem('homesoc_codeserver_url', resEditor.editor.url);
        localStorage.setItem('homesoc_codeserver_ruta', resEditor.editor.rutaBase);
      }
      setConexion(estado);
      setOauthHabilitado(Boolean(oauthOk));
      setProyectos(listaProyectos);
      if (estado) {
        const { repositorios: lista } = await githubServicio.listarRepositorios(tokenAcceso);
        setRepositorios(lista);
      } else {
        setRepositorios([]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo consultar el estado de GitHub');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    void cargarTodo();
    const params = new URLSearchParams(window.location.search);
    const estadoOAuth = params.get('oauth');
    if (estadoOAuth === 'ok') {
      setAviso('¡Cuenta de GitHub conectada mediante OAuth! Tus repositorios ya están sincronizados.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (estadoOAuth === 'error') {
      setError(
        `No se pudo completar la conexión con GitHub (${params.get('motivo') || 'cancelado'}).`,
      );
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [cargarTodo]);

  const manejarIniciarOAuth = async () => {
    if (!tokenAcceso) return;
    setIniciandoOAuth(true);
    setError(null);
    try {
      const { urlAutorizacion } = await githubServicio.iniciarOAuth(tokenAcceso);
      window.location.href = urlAutorizacion;
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo iniciar GitHub OAuth');
      setIniciandoOAuth(false);
    }
  };

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const cargarDetalleProyecto = useCallback(
    async (proyectoId: string, vista: 'variables' | 'historial') => {
      if (!tokenAcceso) return;
      setCargandoDetalle(true);
      try {
        if (vista === 'variables') {
          const { variables } = await githubServicio.listarVariables(proyectoId, tokenAcceso);
          setVariablesProyecto(variables);
        } else {
          const { despliegues } = await githubServicio.listarHistorial(proyectoId, tokenAcceso);
          setHistorialProyecto(despliegues);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el detalle');
      } finally {
        setCargandoDetalle(false);
      }
    },
    [tokenAcceso],
  );

  const abrirDetalle = (proyectoId: string, vista: 'variables' | 'historial') => {
    if (proyectoSeleccionadoId === proyectoId && vistaDetalle === vista) {
      setProyectoSeleccionadoId(null);
      return;
    }
    setProyectoSeleccionadoId(proyectoId);
    setVistaDetalle(vista);
    void cargarDetalleProyecto(proyectoId, vista);
  };

  const manejarConectar = async (e: FormEvent) => {
    e.preventDefault();
    if (!tokenAcceso || !tokenInput.trim()) return;
    setGuardando(true);
    try {
      const { conexion: nueva } = await githubServicio.conectar(tokenInput.trim(), tokenAcceso);
      setConexion(nueva);
      setTokenInput('');
      setAviso(`Cuenta de GitHub conectada (${nueva.usuarioGithub})`);
      const { repositorios: lista } = await githubServicio.listarRepositorios(tokenAcceso);
      setRepositorios(lista);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo conectar con GitHub');
    } finally {
      setGuardando(false);
    }
  };

  const manejarDesconectar = async () => {
    if (!tokenAcceso) return;
    if (!window.confirm('¿Desconectar la cuenta de GitHub y eliminar el token cifrado guardado?')) {
      return;
    }
    setDesconectando(true);
    try {
      await githubServicio.desconectar(tokenAcceso);
      setConexion(null);
      setRepositorios([]);
      setAviso('Cuenta de GitHub desconectada correctamente');
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo desconectar GitHub');
    } finally {
      setDesconectando(false);
    }
  };

  const abrirAsistenteDeploy = async (repo: RepositorioGithubItem) => {
    if (!tokenAcceso) return;
    setRepoEnAsistente(repo);
    setDeteccion(null);
    setDetectando(true);
    const puertoSugerido = 4100 + proyectos.length * 10;
    setPuertoAsistente(String(puertoSugerido));
    setModoAsistente('polling');
    setAprobacionAsistente(false);
    try {
      const { deteccion: res } = await githubServicio.detectarProyecto(
        {
          nombreCompleto: repo.nombreCompleto,
          rama: repo.ramaPrincipal,
          puerto: puertoSugerido,
        },
        tokenAcceso,
      );
      setDeteccion(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo inspeccionar el repositorio');
    } finally {
      setDetectando(false);
    }
  };

  const confirmarDeployAsistente = async (e: FormEvent) => {
    e.preventDefault();
    if (!tokenAcceso || !repoEnAsistente || !deteccion?.tipoDetectado) return;
    setCreandoProyecto(true);
    try {
      const { proyecto } = await githubServicio.crearProyecto(
        {
          repoGithubId: repoEnAsistente.id,
          nombreProyecto: repoEnAsistente.nombre,
          nombreCompleto: repoEnAsistente.nombreCompleto,
          rama: repoEnAsistente.ramaPrincipal,
          puerto: Number(puertoAsistente),
          tipoProyecto: deteccion.tipoDetectado,
          modoActualizacion: modoAsistente,
          requiereAprobacion: aprobacionAsistente,
          ultimoCommitSha: repoEnAsistente.ultimoCommit?.sha ?? null,
          desplegarAhora: true,
        },
        tokenAcceso,
      );
      setRepoEnAsistente(null);
      setDeteccion(null);
      setAviso(`Proyecto "${proyecto.nombreProyecto}" desplegado en el puerto ${proyecto.puerto}`);
      await cargarTodo();
      abrirDetalle(proyecto.id, 'historial');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo desplegar el proyecto');
    } finally {
      setCreandoProyecto(false);
    }
  };

  const manejarRedeploy = async (proyecto: ProyectoConectadoItem) => {
    if (!tokenAcceso) return;
    setRedeployId(proyecto.id);
    try {
      await githubServicio.redeployProyecto(proyecto.id, tokenAcceso);
      setAviso(`Redeploy completado para "${proyecto.nombreProyecto}"`);
      await cargarTodo();
      if (proyectoSeleccionadoId === proyecto.id && vistaDetalle === 'historial') {
        await cargarDetalleProyecto(proyecto.id, 'historial');
      }
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'Error al ejecutar redeploy');
    } finally {
      setRedeployId(null);
    }
  };

  const alternarAprobacion = async (proyecto: ProyectoConectadoItem) => {
    if (!tokenAcceso) return;
    try {
      const { proyecto: act } = await githubServicio.actualizarProyecto(
        proyecto.id,
        { requiereAprobacion: !proyecto.requiereAprobacion },
        tokenAcceso,
      );
      setProyectos((prev) => prev.map((p) => (p.id === act.id ? act : p)));
      setAviso(
        act.requiereAprobacion
          ? `"${act.nombreProyecto}" ahora requiere aprobación manual antes de desplegar`
          : `"${act.nombreProyecto}" activado en auto-deploy`,
      );
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo actualizar la configuración');
    }
  };

  const alternarModoActualizacion = async (proyecto: ProyectoConectadoItem) => {
    if (!tokenAcceso) return;
    const nuevoModo: ModoActualizacionRepo =
      proyecto.modoActualizacion === 'polling' ? 'webhook' : 'polling';
    try {
      const { proyecto: act } = await githubServicio.actualizarProyecto(
        proyecto.id,
        { modoActualizacion: nuevoModo },
        tokenAcceso,
      );
      setProyectos((prev) => prev.map((p) => (p.id === act.id ? act : p)));
      setAviso(`Modo de "${act.nombreProyecto}" cambiado a ${nuevoModo.toUpperCase()}`);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar el modo');
    }
  };

  const manejarGuardarVariable = async (e: FormEvent, proyectoId: string) => {
    e.preventDefault();
    if (!tokenAcceso || !claveVar.trim() || !valorVar) return;
    setGuardandoVar(true);
    try {
      await githubServicio.guardarVariable(
        proyectoId,
        { clave: claveVar.trim(), valor: valorVar },
        tokenAcceso,
      );
      setClaveVar('');
      setValorVar('');
      setAviso('Variable cifrada guardada. Se aplicará en el próximo despliegue.');
      await Promise.all([cargarDetalleProyecto(proyectoId, 'variables'), cargarTodo()]);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar la variable');
    } finally {
      setGuardandoVar(false);
    }
  };

  const manejarEliminarVariable = async (proyectoId: string, varItem: VariableEntornoItem) => {
    if (!tokenAcceso) return;
    if (!window.confirm(`¿Eliminar la variable cifrada "${varItem.clave}"?`)) return;
    try {
      await githubServicio.eliminarVariable(proyectoId, varItem.id, tokenAcceso);
      setAviso(`Variable "${varItem.clave}" eliminada`);
      await Promise.all([cargarDetalleProyecto(proyectoId, 'variables'), cargarTodo()]);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo eliminar la variable');
    }
  };

  const manejarEliminarProyecto = async (proyecto: ProyectoConectadoItem) => {
    if (!tokenAcceso) return;
    if (
      !window.confirm(
        `¿Desconectar "${proyecto.nombreProyecto}"? Se eliminarán sus variables cifradas e historial.`,
      )
    ) {
      return;
    }
    try {
      await githubServicio.eliminarProyecto(proyecto.id, tokenAcceso);
      if (proyectoSeleccionadoId === proyecto.id) {
        setProyectoSeleccionadoId(null);
      }
      setAviso(`Proyecto "${proyecto.nombreProyecto}" eliminado`);
      await cargarTodo();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo eliminar el proyecto');
    }
  };

  const manejarPollingManual = async () => {
    if (!tokenAcceso) return;
    setEjecutandoPolling(true);
    try {
      const res = await githubServicio.ejecutarPolling(tokenAcceso);
      setAviso(
        `Polling ejecutado: ${res.revisados} proyecto(s) revisado(s), ${res.disparados} despliegue(s) disparado(s).`,
      );
      await cargarTodo();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo ejecutar el polling');
    } finally {
      setEjecutandoPolling(false);
    }
  };

  const manejarSimularPush = async (
    proyectoId: string,
    escenario: 'normal' | 'gate_critico' | 'fallo_healthcheck',
  ) => {
    if (!tokenAcceso) return;
    setAccionDespliegueId(`sim-${escenario}`);
    try {
      const { despliegue } = await githubServicio.simularPush(proyectoId, escenario, tokenAcceso);
      setAviso(
        escenario === 'gate_critico'
          ? `Gate de seguridad detuvo el commit ${despliegue.commitSha} (requiere aprobación manual)`
          : escenario === 'fallo_healthcheck'
            ? `Health check fallido en ${despliegue.commitSha}: rollback automático aplicado`
            : `Push simulado desplegado con éxito (${despliegue.commitSha})`,
      );
      await Promise.all([cargarTodo(), cargarDetalleProyecto(proyectoId, 'historial')]);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'Error al simular push');
    } finally {
      setAccionDespliegueId(null);
    }
  };

  const manejarAprobarDespliegue = async (proyectoId: string, despliegueId: string) => {
    if (!tokenAcceso) return;
    setAccionDespliegueId(despliegueId);
    try {
      const { despliegue } = await githubServicio.aprobarDespliegue(
        proyectoId,
        despliegueId,
        tokenAcceso,
      );
      setAviso(`Despliegue aprobado y completado (${despliegue.commitSha})`);
      await Promise.all([cargarTodo(), cargarDetalleProyecto(proyectoId, 'historial')]);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo aprobar el despliegue');
    } finally {
      setAccionDespliegueId(null);
    }
  };

  const manejarRevertirDespliegue = async (proyectoId: string, despliegue: DespliegueRegistroItem) => {
    if (!tokenAcceso) return;
    if (
      !window.confirm(
        `¿Revertir manualmente al commit ${despliegue.commitSha}? Se desplegará esa versión inmediatamente.`,
      )
    ) {
      return;
    }
    setAccionDespliegueId(despliegue.id);
    try {
      const { despliegue: nuevo } = await githubServicio.revertirDespliegue(
        proyectoId,
        despliegue.id,
        tokenAcceso,
      );
      setAviso(`Reversión manual completada al commit ${nuevo.commitSha}`);
      await Promise.all([cargarTodo(), cargarDetalleProyecto(proyectoId, 'historial')]);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo revertir el despliegue');
    } finally {
      setAccionDespliegueId(null);
    }
  };

  const nombresReposConectados = useMemo(
    () => new Set(proyectos.map((p) => p.nombreCompleto.toLowerCase())),
    [proyectos],
  );

  const reposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return repositorios.filter((r) => {
      if (filtroVisibilidad === 'privados' && !r.privado) return false;
      if (filtroVisibilidad === 'publicos' && r.privado) return false;
      if (!q) return true;
      return [r.nombre, r.nombreCompleto, r.descripcion ?? '', r.lenguaje ?? ''].some((campo) =>
        campo.toLowerCase().includes(q),
      );
    });
  }, [repositorios, busqueda, filtroVisibilidad]);

  const proyectoActivoDetalle = useMemo(
    () => proyectos.find((p) => p.id === proyectoSeleccionadoId) ?? null,
    [proyectos, proyectoSeleccionadoId],
  );

  return (
    <div className="flex flex-col gap-5">
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

      {/* Tarjeta de estado y conexión PAT (RF-28) */}
      <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary border border-primary/25 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">code_blocks</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary">
                  Conexión con GitHub (RF-28)
                </h2>
                {conexion ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/12 border border-primary/25 text-[11px] font-medium text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Conectado ({conexion.modo === 'simulacion' ? 'Simulación local' : 'API real'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-low border border-border-hairline text-[11px] font-medium text-text-muted">
                    Sin conectar
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                El Personal Access Token se almacena cifrado con AES-256-GCM en PostgreSQL y nunca
                se expone en respuestas de la API.
              </p>
            </div>
          </div>

          {conexion && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void cargarTodo()}
                disabled={cargando}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer"
              >
                <span
                  className={`material-symbols-outlined text-[15px] text-primary ${
                    cargando ? 'animate-spin' : ''
                  }`}
                >
                  refresh
                </span>
                <span>Sincronizar</span>
              </button>
              {esAdmin && (
                <button
                  type="button"
                  onClick={() => void manejarDesconectar()}
                  disabled={desconectando}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-status-critical/30 hover:bg-error-container text-xs font-medium text-status-critical cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[15px]">link_off</span>
                  <span>{desconectando ? 'Desconectando…' : 'Desconectar'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {conexion ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-surface-low/65 border border-border-hairline text-xs">
            <div>
              <span className="text-[11px] text-text-dim block">Cuenta vinculada</span>
              <span className="font-mono font-semibold text-text-primary">
                @{conexion.usuarioGithub}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-text-dim block">Permisos (scopes)</span>
              <span className="font-mono text-text-primary">
                {conexion.alcances || 'No reportados'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-text-dim block">Última actualización</span>
              <span className="font-mono text-text-muted">
                {formatearFechaCorta(conexion.actualizadoEn)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                disabled={!esAdmin || iniciandoOAuth || !oauthHabilitado}
                onClick={() => void manejarIniciarOAuth()}
                className="inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl bg-[#24292f] hover:bg-[#1b1f23] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.69-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.19-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.66.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                </svg>
                <span>
                  {iniciandoOAuth
                    ? 'Redirigiendo a GitHub…'
                    : oauthHabilitado
                      ? 'Conectar con GitHub (OAuth)'
                      : 'Conectar con GitHub (configura Client ID/Secret)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMostrarPatAvanzado((prev) => !prev)}
                className="text-xs text-text-muted hover:text-primary underline-offset-2 hover:underline cursor-pointer self-start sm:self-center"
              >
                {mostrarPatAvanzado ? 'Ocultar conexión manual por PAT' : 'Avanzado: conectar con PAT'}
              </button>
            </div>

            {(mostrarPatAvanzado || !oauthHabilitado) && (
              <form
                onSubmit={(e) => void manejarConectar(e)}
                className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border-hairline"
              >
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={!esAdmin || guardando}
                  autoComplete="off"
                  className="flex-1 rounded-xl bg-surface-low border border-border-hairline px-3.5 py-2 text-xs font-mono text-text-primary placeholder:text-text-dim focus:outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={!esAdmin || guardando || tokenInput.trim().length < 20}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">key</span>
                  <span>{guardando ? 'Validando…' : 'Conectar con PAT'}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Asistente guiado de despliegue (RF-30, RF-31) */}
      {repoEnAsistente && (
        <form
          onSubmit={(e) => void confirmarDeployAsistente(e)}
          className="rounded-2xl bg-surface-card border-2 border-primary/40 p-5 flex flex-col gap-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Desplegar {repoEnAsistente.nombreCompleto} (RF-30 / RF-31)
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Auto-detección prioriza <code className="font-mono">Dockerfile</code>; en su
                ausencia aplica plantilla base para Node.js o HTML estático.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRepoEnAsistente(null)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-low cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {detectando ? (
            <div className="text-xs font-mono text-text-muted py-3">
              Inspeccionando archivos raíz de la rama {repoEnAsistente.ramaPrincipal}…
            </div>
          ) : deteccion ? (
            <div className="flex flex-col gap-3">
              <div
                className={`rounded-xl px-4 py-3 border text-xs ${
                  deteccion.tipoDetectado
                    ? 'bg-primary/10 border-primary/25 text-text-primary'
                    : 'bg-error-container border-status-critical/30 text-status-critical'
                }`}
              >
                <div className="font-semibold">
                  {deteccion.tipoDetectado
                    ? `Stack detectado: ${etiquetaTipoProyecto(deteccion.tipoDetectado)}`
                    : 'Stack no soportado sin Dockerfile'}
                </div>
                <p className="text-text-muted mt-0.5">{deteccion.motivo}</p>
              </div>

              {deteccion.plantillaSugerida && (
                <pre className="p-3 rounded-xl bg-surface-low border border-border-hairline text-[11px] font-mono text-text-muted overflow-x-auto">
                  {deteccion.plantillaSugerida}
                </pre>
              )}

              {deteccion.tipoDetectado && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-text-dim block mb-1">Puerto interno</label>
                    <input
                      type="number"
                      min={1024}
                      max={65535}
                      value={puertoAsistente}
                      onChange={(e) => setPuertoAsistente(e.target.value)}
                      className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-text-dim block mb-1">
                      Detección de commits (RF-32)
                    </label>
                    <select
                      value={modoAsistente}
                      onChange={(e) => setModoAsistente(e.target.value as ModoActualizacionRepo)}
                      className="w-full rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
                    >
                      <option value="polling">Polling (cada 1–2 min, sin puertos)</option>
                      <option value="webhook">Webhook GitHub (HMAC)</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="inline-flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aprobacionAsistente}
                        onChange={(e) => setAprobacionAsistente(e.target.checked)}
                        className="accent-[var(--hs-accent)]"
                      />
                      <span>Requerir aprobación manual (RF-35)</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRepoEnAsistente(null)}
                  className="px-3.5 py-2 rounded-xl bg-surface-low border border-border-hairline text-xs font-medium text-text-muted cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!deteccion.tipoDetectado || creandoProyecto}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                  <span>{creandoProyecto ? 'Desplegando…' : 'Confirmar y desplegar'}</span>
                </button>
              </div>
            </div>
          ) : null}
        </form>
      )}

      {/* Proyectos desplegados y gestionados (RF-30, RF-34..50) */}
      <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
        <div className="px-5 py-4 border-b border-border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Proyectos Desplegados ({proyectos.length})
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Redeploy (RF-34), Webhook HMAC / Polling (RF-32), Gate de seguridad (RF-40..44),
              health check y reversión manual (RF-50).
            </p>
          </div>
          {esAdmin && proyectos.length > 0 && (
            <button
              type="button"
              onClick={() => void manejarPollingManual()}
              disabled={ejecutandoPolling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-text-primary cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px] text-primary">sync</span>
              <span>{ejecutandoPolling ? 'Revisando…' : 'Ejecutar Polling'}</span>
            </button>
          )}
        </div>

        {proyectos.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-dim">
            Todavía no hay proyectos desplegados. Elige un repositorio abajo y haz clic en{' '}
            <strong className="text-text-primary">Desplegar</strong>.
          </div>
        ) : (
          <div className="divide-y divide-border-hairline">
            {proyectos.map((proy) => {
              const abierto = proyectoSeleccionadoId === proy.id;
              return (
                <div key={proy.id} className="p-5 flex flex-col gap-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">
                          {proy.nombreProyecto}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-primary/12 border border-primary/25 text-[10px] font-mono font-semibold text-primary">
                          {proy.estadoActual}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-surface-low border border-border-hairline text-[10px] font-mono text-text-muted">
                          {etiquetaTipoProyecto(proy.tipoProyecto)}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-surface-low border border-border-hairline text-[10px] font-mono text-text-muted">
                          :{proy.puerto}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-text-dim mt-1 flex flex-wrap items-center gap-2">
                        <span>{proy.nombreCompleto}</span>
                        <span>• rama {proy.rama}</span>
                        {proy.ultimoCommitSha && <span>• commit {proy.ultimoCommitSha}</span>}
                        <span>• {proy.totalVariables} vars cifradas</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {esAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => void alternarModoActualizacion(proy)}
                            className="px-2.5 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-[11px] font-mono text-text-primary cursor-pointer"
                            title="Alternar modo Webhook / Polling"
                          >
                            Modo: {proy.modoActualizacion}
                          </button>
                          <button
                            type="button"
                            onClick={() => void alternarAprobacion(proy)}
                            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium cursor-pointer ${
                              proy.requiereAprobacion
                                ? 'bg-status-warning/15 border-status-warning/30 text-status-warning'
                                : 'bg-surface-low border-border-hairline text-text-muted'
                            }`}
                          >
                            {proy.requiereAprobacion ? 'Aprobación manual' : 'Auto-deploy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void manejarRedeploy(proy)}
                            disabled={redeployId === proy.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[15px]">replay</span>
                            <span>{redeployId === proy.id ? 'Desplegando…' : 'Redeploy'}</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => abrirDetalle(proy.id, 'variables')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                          abierto && vistaDetalle === 'variables'
                            ? 'border-primary bg-primary/12 text-primary'
                            : 'bg-surface-low border-border-hairline text-text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">vpn_key</span>
                        <span>Variables</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirDetalle(proy.id, 'historial')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer ${
                          abierto && vistaDetalle === 'historial'
                            ? 'border-primary bg-primary/12 text-primary'
                            : 'bg-surface-low border-border-hairline text-text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">history</span>
                        <span>Historial</span>
                      </button>

                      {(() => {
                        const urlCode = construirUrlCodeServer(proy.nombreProyecto);
                        return urlCode ? (
                          <a
                            href={urlCode}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir carpeta del proyecto en VS Code Web (code-server)"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-xs font-medium text-primary"
                          >
                            <span className="material-symbols-outlined text-[15px]">code</span>
                            <span>VS Code</span>
                          </a>
                        ) : null;
                      })()}

                      {esAdmin && (
                        <button
                          type="button"
                          onClick={() => void manejarEliminarProyecto(proy)}
                          title="Eliminar proyecto"
                          className="p-1.5 rounded-xl border border-status-critical/30 text-status-critical hover:bg-error-container cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detalle expandido: Variables de entorno cifradas o Historial */}
                  {abierto && proyectoActivoDetalle && (
                    <div className="mt-1 p-4 rounded-xl bg-surface-low/65 border border-border-hairline flex flex-col gap-3">
                      {vistaDetalle === 'variables' ? (
                        <>
                          <div className="text-xs text-text-muted">
                            <strong className="text-text-primary">
                              Variables de entorno cifradas (RF-36..39):
                            </strong>{' '}
                            se almacenan con AES-256-GCM y nunca se leen del repositorio ni se
                            exponen en texto plano. Carga las variables nuevas antes de hacer{' '}
                            <code className="font-mono">git push</code>.
                          </div>

                          {esAdmin && (
                            <form
                              onSubmit={(e) => void manejarGuardarVariable(e, proy.id)}
                              className="flex flex-col sm:flex-row gap-2"
                            >
                              <input
                                type="text"
                                value={claveVar}
                                onChange={(e) => setClaveVar(e.target.value)}
                                placeholder="CLAVE (ej. DATABASE_URL)"
                                className="sm:w-56 rounded-xl bg-surface-card border border-border-hairline px-3 py-1.5 text-xs font-mono text-text-primary"
                              />
                              <input
                                type="password"
                                value={valorVar}
                                onChange={(e) => setValorVar(e.target.value)}
                                placeholder="Valor secreto (se cifrará en reposo)"
                                autoComplete="off"
                                className="flex-1 rounded-xl bg-surface-card border border-border-hairline px-3 py-1.5 text-xs font-mono text-text-primary"
                              />
                              <button
                                type="submit"
                                disabled={guardandoVar || !claveVar.trim() || !valorVar}
                                className="px-3.5 py-1.5 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
                              >
                                {guardandoVar ? 'Cifrando…' : 'Guardar'}
                              </button>
                            </form>
                          )}

                          {cargandoDetalle ? (
                            <p className="text-xs font-mono text-text-dim">Cargando variables…</p>
                          ) : variablesProyecto.length === 0 ? (
                            <p className="text-xs text-text-dim">
                              Este proyecto no tiene variables de entorno configuradas.
                            </p>
                          ) : (
                            <div className="divide-y divide-border-hairline rounded-xl bg-surface-card border border-border-hairline">
                              {variablesProyecto.map((v) => (
                                <div
                                  key={v.id}
                                  className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="font-mono font-semibold text-primary">
                                      {v.clave}
                                    </span>
                                    <span className="font-mono text-text-dim">
                                      {v.valorEnmascarado}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-mono text-[11px] text-text-dim">
                                      {formatearFechaCorta(v.actualizadoEn)}
                                    </span>
                                    {esAdmin && (
                                      <button
                                        type="button"
                                        onClick={() => void manejarEliminarVariable(proy.id, v)}
                                        className="text-status-critical hover:underline text-[11px] cursor-pointer"
                                      >
                                        Eliminar
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : cargandoDetalle ? (
                        <p className="text-xs font-mono text-text-dim">Cargando historial…</p>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {esAdmin && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border-hairline">
                              <span className="text-[11px] text-text-muted">
                                Simulador local de pipeline (Webhook + Gate + Health Check):
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={accionDespliegueId !== null}
                                  onClick={() => void manejarSimularPush(proy.id, 'normal')}
                                  className="px-2.5 py-1 rounded-lg bg-primary/12 border border-primary/25 text-[11px] font-medium text-primary cursor-pointer disabled:opacity-50"
                                >
                                  Simular Push OK
                                </button>
                                <button
                                  type="button"
                                  disabled={accionDespliegueId !== null}
                                  onClick={() => void manejarSimularPush(proy.id, 'gate_critico')}
                                  className="px-2.5 py-1 rounded-lg bg-status-warning/15 border border-status-warning/30 text-[11px] font-medium text-status-warning cursor-pointer disabled:opacity-50"
                                >
                                  Simular Gate Crítico
                                </button>
                                <button
                                  type="button"
                                  disabled={accionDespliegueId !== null}
                                  onClick={() =>
                                    void manejarSimularPush(proy.id, 'fallo_healthcheck')
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-error-container border border-status-critical/30 text-[11px] font-medium text-status-critical cursor-pointer disabled:opacity-50"
                                >
                                  Simular Fallo Health Check
                                </button>
                              </div>
                            </div>
                          )}

                          {historialProyecto.length === 0 ? (
                            <p className="text-xs text-text-dim">
                              Aún no hay despliegues registrados.
                            </p>
                          ) : (
                            historialProyecto.map((d) => (
                              <div
                                key={d.id}
                                className="rounded-xl bg-surface-card border border-border-hairline p-3.5 flex flex-col gap-2.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div className="flex flex-wrap items-center gap-2 font-mono">
                                    <span
                                      className={`px-2 py-0.5 rounded-md font-semibold ${
                                        d.estado === 'exitoso'
                                          ? 'bg-primary/12 text-primary'
                                          : d.estado === 'pendiente_aprobacion'
                                            ? 'bg-status-warning/15 text-status-warning'
                                            : 'bg-error-container text-status-critical'
                                      }`}
                                    >
                                      {d.estado}
                                    </span>
                                    <span className="font-semibold text-text-primary">
                                      {d.commitSha}
                                    </span>
                                    <span className="text-text-dim">• {d.origen}</span>
                                    <span className="text-text-dim">• {d.duracionMs} ms</span>
                                    {d.rollbackAutomatico && (
                                      <span className="px-2 py-0.5 rounded-md bg-status-warning/15 text-status-warning text-[10px] font-semibold">
                                        Rollback automático (RF-47)
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] text-text-dim">
                                      {d.ejecutadoPor} • {formatearFechaCorta(d.creadoEn)}
                                    </span>
                                    {esAdmin && d.estado === 'pendiente_aprobacion' && (
                                      <button
                                        type="button"
                                        disabled={accionDespliegueId === d.id}
                                        onClick={() => void manejarAprobarDespliegue(proy.id, d.id)}
                                        className="px-2.5 py-1 rounded-lg bg-primary text-[var(--hs-on-accent)] text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                                      >
                                        Aprobar y desplegar
                                      </button>
                                    )}
                                    {esAdmin && d.estado === 'exitoso' && (
                                      <button
                                        type="button"
                                        disabled={accionDespliegueId === d.id}
                                        onClick={() => void manejarRevertirDespliegue(proy.id, d)}
                                        className="px-2.5 py-1 rounded-lg bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-[11px] font-medium text-text-primary cursor-pointer disabled:opacity-50"
                                      >
                                        Revertir aquí
                                      </button>
                                    )}
                                    {d.estado !== 'exitoso' && (
                                      <button
                                        type="button"
                                        disabled={explicandoId === d.id}
                                        onClick={() => void manejarExplicarConIa(proy.id, d.id)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/12 border border-primary/25 text-[11px] font-semibold text-primary cursor-pointer disabled:opacity-50"
                                      >
                                        <span className="material-symbols-outlined text-[13px]">
                                          auto_awesome
                                        </span>
                                        <span>
                                          {explicandoId === d.id
                                            ? 'Analizando…'
                                            : 'Explicar con IA'}
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {explicacionesIa[d.id] && (
                                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/25 text-xs flex flex-col gap-1.5">
                                    <div className="font-semibold text-primary">
                                      Diagnóstico IA ({explicacionesIa[d.id].proveedor}):
                                    </div>
                                    <p className="text-text-primary">
                                      {explicacionesIa[d.id].causaProbable}
                                    </p>
                                    <ul className="list-disc pl-4 text-text-muted space-y-0.5">
                                      {explicacionesIa[d.id].accionesSugeridas.map((acc, i) => (
                                        <li key={i}>{acc}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Resultados del Gate de Seguridad (RF-44) */}
                                {d.escaneos && d.escaneos.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    {d.escaneos.map((esc) => (
                                      <span
                                        key={esc.id}
                                        title={esc.resumen}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono ${
                                          esc.estado === 'critico'
                                            ? 'bg-error-container border-status-critical/30 text-status-critical'
                                            : 'bg-primary/10 border-primary/25 text-primary'
                                        }`}
                                      >
                                        <span>{esc.herramienta}:</span>
                                        <span className="font-semibold">{esc.estado}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <pre className="p-2.5 rounded-lg bg-surface-low text-[11px] font-mono text-text-muted overflow-x-auto whitespace-pre-wrap">
                                  {d.logConstruccion}
                                </pre>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de repositorios accesibles (RF-29) */}
      {conexion && (
        <div className="rounded-2xl bg-surface-card border border-border-hairline overflow-hidden">
          <div className="px-5 py-4 border-b border-border-hairline flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Repositorios Accesibles (RF-29)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Selecciona un repositorio para auto-detectar su stack y desplegarlo con un clic.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-low border border-border-hairline">
                {(['todos', 'privados', 'publicos'] as const).map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => setFiltroVisibilidad(opcion)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                      filtroVisibilidad === opcion
                        ? 'bg-primary text-on-primary'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {opcion === 'publicos' ? 'Públicos' : opcion}
                  </button>
                ))}
              </div>

              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar repositorio o lenguaje…"
                className="rounded-xl bg-surface-low border border-border-hairline px-3 py-1.5 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-primary"
              />

              <span className="text-xs font-mono text-text-muted">
                {reposFiltrados.length} de {repositorios.length}
              </span>
            </div>
          </div>

          <div className="divide-y divide-border-hairline">
            {cargando ? (
              <div className="p-8 text-center text-xs text-text-dim font-mono">
                Consultando repositorios…
              </div>
            ) : reposFiltrados.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-dim">
                No se encontraron repositorios con el filtro actual.
              </div>
            ) : (
              reposFiltrados.map((repo) => {
                const yaConectado = nombresReposConectados.has(repo.nombreCompleto.toLowerCase());
                return (
                  <div
                    key={repo.id}
                    className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-surface-card-elevated/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={repo.urlHtml}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-text-primary hover:text-primary transition-colors"
                        >
                          {repo.nombreCompleto}
                        </a>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold ${
                            repo.privado
                              ? 'bg-status-warning/15 text-status-warning border-status-warning/30'
                              : 'bg-primary/12 text-primary border-primary/25'
                          }`}
                        >
                          {repo.privado ? 'Privado' : 'Público'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-surface-low border border-border-hairline text-[10px] font-mono text-text-muted">
                          {repo.ramaPrincipal}
                        </span>
                        {repo.lenguaje && (
                          <span className="text-[11px] font-mono text-text-dim">
                            • {repo.lenguaje}
                          </span>
                        )}
                      </div>

                      {repo.descripcion && (
                        <p className="text-xs text-text-muted mt-1">{repo.descripcion}</p>
                      )}

                      <div className="mt-1.5 text-[11px] font-mono text-text-dim flex flex-wrap items-center gap-2">
                        {repo.ultimoCommit ? (
                          <>
                            <span className="text-primary font-semibold">
                              {repo.ultimoCommit.sha}
                            </span>
                            <span className="truncate max-w-md text-text-muted">
                              {repo.ultimoCommit.mensaje}
                            </span>
                            <span>• {formatearFechaCorta(repo.ultimoCommit.fecha)}</span>
                          </>
                        ) : (
                          <span>Sin commits recientes en {repo.ramaPrincipal}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(() => {
                        const urlVscode = construirUrlCodeServer(repo.nombre);
                        if (!urlVscode) return null;
                        return (
                          <a
                            href={urlVscode}
                            target="_blank"
                            rel="noreferrer"
                            title={`Abrir ${repo.nombre} en VS Code Web`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-low hover:bg-surface-card-elevated border border-border-hairline hover:border-primary/40 text-xs font-semibold text-text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[15px] text-primary">
                              code
                            </span>
                            <span>VS Code</span>
                          </a>
                        );
                      })()}
                      {yaConectado ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/12 border border-primary/25 text-xs font-semibold text-primary">
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          <span>Conectado</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!esAdmin}
                          onClick={() => void abrirAsistenteDeploy(repo)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            rocket_launch
                          </span>
                          <span>Desplegar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
