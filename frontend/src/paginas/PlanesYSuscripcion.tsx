import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import { ErrorApi } from '../servicios/apiCliente';
import {
  ConfiguracionCobroItem,
  MetodoPagoSuscripcion,
  PlanHostingItem,
  planesServicio,
  RecomendacionPlanIa,
  SolicitudSuscripcionItem,
} from '../servicios/planesServicio';

type PestanaPlanes = 'tienda' | 'editor' | 'cobros';

function formatearNumeroCuenta(raw: string): string {
  const limpio = raw.replace(/\s+/g, '');
  if (!limpio) return '0000 0000 0000 0000';
  return limpio.replace(/(.{4})/g, '$1 ').trim();
}

/** Marco institucional HomeSOC alrededor del QR Bancario (para vista previa y modal de pago). */
function MarcoQrHomeSoc({
  qrImagenDataUrl,
  banco,
  titular,
  montoBs,
}: {
  qrImagenDataUrl: string;
  banco: string;
  titular: string;
  montoBs?: number;
}) {
  return (
    <div className="w-full max-w-[290px] mx-auto rounded-2xl p-[1.5px] bg-gradient-to-br from-emerald-400/70 via-cyan-500/40 to-emerald-600/70 shadow-xl">
      <div className="rounded-[15px] bg-[#07131a] text-white p-4 flex flex-col items-center gap-3 relative overflow-hidden">
        {/* Cabecera de marca */}
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img
              src="/logo-homesoc.png"
              alt="HomeSOC"
              className="w-7 h-7 rounded-lg object-cover border border-emerald-400/40"
            />
            <div className="text-left">
              <div className="text-xs font-extrabold tracking-tight leading-none">
                Home<span className="text-emerald-400">SOC</span>
              </div>
              <div className="text-[9px] font-mono text-emerald-300/80 uppercase tracking-wider mt-0.5">
                Pago QR Simple
              </div>
            </div>
          </div>
          {typeof montoBs === 'number' && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-mono font-bold text-emerald-300">
              Bs {montoBs}
            </span>
          )}
        </div>

        {/* Marco con esquinas iluminadas alrededor del QR */}
        <div className="relative p-2.5 rounded-2xl bg-white shadow-inner">
          <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl-md" />
          <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr-md" />
          <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl-md" />
          <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br-md" />
          {qrImagenDataUrl ? (
            <img
              src={qrImagenDataUrl}
              alt="QR Bancario HomeSOC"
              className="w-44 h-44 object-contain block rounded-lg"
            />
          ) : (
            <div className="w-44 h-44 rounded-lg bg-slate-100 text-slate-400 flex flex-col items-center justify-center gap-1.5 text-center px-3">
              <span className="material-symbols-outlined text-4xl">qr_code_2</span>
              <span className="text-[10px] font-medium">Tu QR bancario aparecerá aquí</span>
            </div>
          )}
        </div>

        {/* Pie con banco y titular */}
        <div className="w-full text-center border-t border-white/10 pt-2">
          <div className="text-[11px] font-semibold text-white truncate">
            {titular || 'Titular de la cuenta'}
          </div>
          <div className="text-[10px] font-mono text-emerald-300/80 truncate">
            {banco || 'Banco • Bolivia'}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tarjeta bancaria realista interactiva con botón de copiar cuenta (vista previa y pago por transferencia). */
function TarjetaBancariaVisual({
  banco,
  titular,
  numeroCuenta,
  montoBs,
}: {
  banco: string;
  titular: string;
  numeroCuenta: string;
  montoBs?: number;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiarCuenta = () => {
    if (!numeroCuenta.trim()) return;
    void navigator.clipboard.writeText(numeroCuenta.trim());
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  };

  return (
    <div className="w-full max-w-[360px] mx-auto rounded-2xl p-5 text-white relative overflow-hidden shadow-2xl border border-white/15 bg-gradient-to-br from-[#0a192f] via-[#0e3b43] to-[#064e3b]">
      {/* Brillos decorativos tipo tarjeta premium */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-emerald-400/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-cyan-400/15 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Fila superior: logo HomeSOC + nombre del banco */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img
              src="/logo-homesoc.png"
              alt="HomeSOC"
              className="w-6 h-6 rounded-md object-cover border border-white/25"
            />
            <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-200">
              Transferencia
            </span>
          </div>
          <span className="text-xs font-bold tracking-wide text-white truncate max-w-[160px]">
            {banco || 'TU BANCO'}
          </span>
        </div>

        {/* Chip EMV + contactless + monto */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 border border-amber-100/60 shadow-inner flex items-center justify-center">
              <div className="w-6 h-4 border border-amber-900/40 rounded-xs" />
            </div>
            <span className="material-symbols-outlined text-[20px] text-white/70 rotate-90">
              wifi
            </span>
          </div>
          {typeof montoBs === 'number' && (
            <span className="px-2.5 py-0.5 rounded-full bg-black/30 border border-emerald-300/35 text-xs font-mono font-bold text-emerald-300">
              Bs {montoBs}
            </span>
          )}
        </div>

        {/* Número de cuenta formateado + copiar */}
        <div className="flex items-center justify-between gap-2 bg-black/25 rounded-xl px-3 py-2 border border-white/10">
          <div className="font-mono text-sm sm:text-base tracking-widest text-white truncate">
            {formatearNumeroCuenta(numeroCuenta)}
          </div>
          {numeroCuenta.trim() && (
            <button
              type="button"
              onClick={copiarCuenta}
              title="Copiar número de cuenta"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-semibold text-white cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[13px]">
                {copiado ? 'check' : 'content_copy'}
              </span>
              <span>{copiado ? 'Copiado' : 'Copiar'}</span>
            </button>
          )}
        </div>

        {/* Pie: Titular + Moneda */}
        <div className="flex items-end justify-between gap-2 pt-0.5">
          <div className="min-w-0">
            <div className="text-[9px] uppercase tracking-widest text-white/60">Titular</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-white truncate">
              {titular || 'NOMBRE DEL TITULAR'}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] uppercase tracking-widest text-white/60">Moneda</div>
            <div className="text-xs font-mono font-bold text-emerald-300">BOB • BS</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TarjetaPlanVisual({
  plan,
  esPlanActual,
  onElegir,
  soloVistaPrevia = false,
}: {
  plan: Omit<PlanHostingItem, 'id'> & { id?: string };
  esPlanActual?: boolean;
  onElegir?: () => void;
  soloVistaPrevia?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col justify-between gap-4 border transition-all ${
        plan.destacado
          ? 'bg-surface-card border-primary shadow-lg shadow-primary/10'
          : 'bg-surface-card border-border-hairline'
      }`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-text-primary">{plan.nombre || 'Nuevo Plan'}</h3>
            <span className="text-[11px] font-mono text-text-dim">{plan.codigo || 'codigo'}</span>
          </div>
          <div className="flex flex-wrap gap-1 justify-end">
            {plan.destacado && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-[var(--hs-on-accent)] text-[10px] font-bold">
                Recomendado
              </span>
            )}
            {esPlanActual && (
              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 text-[10px] font-semibold">
                Tu plan actual
              </span>
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold font-mono text-text-primary">
            Bs {plan.precioBs}
          </span>
          <span className="text-xs text-text-muted">/ {plan.periodo || 'mes'}</span>
        </div>

        <p className="text-xs text-text-muted leading-relaxed">
          {plan.descripcion || 'Descripción comercial del plan de hosting.'}
        </p>

        {/* Badges de recursos */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="p-2 rounded-xl bg-surface-low border border-border-hairline">
            <div className="text-xs font-bold font-mono text-text-primary">{plan.cuotaRamMb} MB</div>
            <div className="text-[10px] text-text-dim">RAM</div>
          </div>
          <div className="p-2 rounded-xl bg-surface-low border border-border-hairline">
            <div className="text-xs font-bold font-mono text-text-primary">{plan.cuotaCpu}</div>
            <div className="text-[10px] text-text-dim">vCPU</div>
          </div>
          <div className="p-2 rounded-xl bg-surface-low border border-border-hairline">
            <div className="text-xs font-bold font-mono text-text-primary">{plan.maxProyectos}</div>
            <div className="text-[10px] text-text-dim">Proyectos</div>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-surface-low border border-border-hairline text-[11px] text-text-muted">
          <strong className="text-text-primary">IA & GPU:</strong>{' '}
          {plan.iaBasicaHabilitada
            ? 'Incluye modelos de IA ligeros en servidor + Modo GPU Remota (laptop).'
            : 'Apps Web/API + APIs externas de IA + Modo GPU Remota desde tu laptop.'}
        </div>

        {plan.beneficios.length > 0 && (
          <ul className="space-y-1.5 text-xs text-text-primary pt-1">
            {plan.beneficios.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[15px] text-primary shrink-0 mt-0.5">
                  check_circle
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!soloVistaPrevia && onElegir && (
        <button
          type="button"
          onClick={onElegir}
          className={`w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
            plan.destacado
              ? 'bg-primary text-[var(--hs-on-accent)] hover:opacity-95'
              : 'bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-text-primary'
          }`}
        >
          {esPlanActual ? 'Renovar este plan' : 'Adquirir / Cambiar a este plan'}
        </button>
      )}
    </div>
  );
}

export default function PlanesYSuscripcion() {
  const { tokenAcceso, usuario, renovarSesion } = usarAutenticacion();
  const esSuperadmin = usuario?.rol === 'superadmin';

  const [pestana, setPestana] = useState<PestanaPlanes>('tienda');
  const [planes, setPlanes] = useState<PlanHostingItem[]>([]);
  const [cobro, setCobro] = useState<ConfiguracionCobroItem>({
    habilitarQr: true,
    habilitarTransferencia: true,
    habilitarEfectivo: true,
    banco: '',
    titular: '',
    numeroCuenta: '',
    qrImagenDataUrl: '',
    instrucciones: '',
  });
  const [solicitudes, setSolicitudes] = useState<SolicitudSuscripcionItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Modal de adquisición / pago para cliente
  const [planElegido, setPlanElegido] = useState<PlanHostingItem | null>(null);
  const [metodoPago, setMetodoPago] = useState<MetodoPagoSuscripcion>('qr');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [notaCliente, setNotaCliente] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  // Editor de planes con Vista Previa (Superadmin)
  const [planEditId, setPlanEditId] = useState<string | null>(null);
  const [formCodigo, setFormCodigo] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrecio, setFormPrecio] = useState('25');
  const [formPeriodo, setFormPeriodo] = useState('mes');
  const [formRam, setFormRam] = useState('512');
  const [formCpu, setFormCpu] = useState('0.5');
  const [formMaxProy, setFormMaxProy] = useState('2');
  const [formIaBasica, setFormIaBasica] = useState(false);
  const [formBeneficiosTexto, setFormBeneficiosTexto] = useState('');
  const [formDestacado, setFormDestacado] = useState(false);
  const [formActivo, setFormActivo] = useState(true);
  const [consultandoIa, setConsultandoIa] = useState(false);
  const [consejoIa, setConsejoIa] = useState<RecomendacionPlanIa | null>(null);
  const [guardandoCobro, setGuardandoCobro] = useState(false);
  const [arrastrandoQr, setArrastrandoQr] = useState(false);
  const [vistaPreviaCobro, setVistaPreviaCobro] = useState<'qr' | 'transferencia'>('qr');
  const inputQrRef = useRef<HTMLInputElement | null>(null);

  const cargarTodo = useCallback(async () => {
    if (!tokenAcceso) return;
    setCargando(true);
    try {
      const [resP, resC, resS] = await Promise.all([
        planesServicio.listarPlanes(tokenAcceso),
        planesServicio.obtenerCobro(tokenAcceso),
        planesServicio.listarSolicitudes(tokenAcceso),
      ]);
      setPlanes(resP.planes ?? []);
      setCobro(resC.cobro);
      setSolicitudes(resS.solicitudes ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudieron cargar los planes');
    } finally {
      setCargando(false);
    }
  }, [tokenAcceso]);

  useEffect(() => {
    void cargarTodo();
  }, [cargarTodo]);

  const cargarPlanEnEditor = (p: PlanHostingItem) => {
    setPlanEditId(p.id);
    setFormCodigo(p.codigo);
    setFormNombre(p.nombre);
    setFormDesc(p.descripcion);
    setFormPrecio(String(p.precioBs));
    setFormPeriodo(p.periodo);
    setFormRam(String(p.cuotaRamMb));
    setFormCpu(String(p.cuotaCpu));
    setFormMaxProy(String(p.maxProyectos));
    setFormIaBasica(p.iaBasicaHabilitada);
    setFormBeneficiosTexto(p.beneficios.join('\n'));
    setFormDestacado(p.destacado);
    setFormActivo(p.activo);
    setConsejoIa(null);
    setPestana('editor');
  };

  const limpiarEditor = () => {
    setPlanEditId(null);
    setFormCodigo('');
    setFormNombre('');
    setFormDesc('');
    setFormPrecio('25');
    setFormPeriodo('mes');
    setFormRam('512');
    setFormCpu('0.5');
    setFormMaxProy('2');
    setFormIaBasica(false);
    setFormBeneficiosTexto('');
    setFormDestacado(false);
    setFormActivo(true);
    setConsejoIa(null);
  };

  const planPreview: Omit<PlanHostingItem, 'id'> = {
    codigo: formCodigo || 'mi_plan',
    nombre: formNombre || 'Nuevo Plan',
    descripcion: formDesc,
    precioBs: Number(formPrecio) || 0,
    periodo: formPeriodo || 'mes',
    cuotaRamMb: Number(formRam) || 512,
    cuotaCpu: Number(formCpu) || 0.5,
    maxProyectos: Number(formMaxProy) || 2,
    iaBasicaHabilitada: formIaBasica,
    beneficios: formBeneficiosTexto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
    destacado: formDestacado,
    activo: formActivo,
    orden: 10,
  };

  const manejarGuardarPlan = async () => {
    if (!tokenAcceso || !esSuperadmin) return;
    if (!formCodigo.trim() || !formNombre.trim()) {
      setError('Código y nombre del plan son obligatorios.');
      return;
    }
    try {
      if (planEditId) {
        await planesServicio.actualizarPlan(planEditId, planPreview, tokenAcceso);
        setAviso(`Plan "${formNombre}" actualizado.`);
      } else {
        await planesServicio.crearPlan(planPreview, tokenAcceso);
        setAviso(`Plan "${formNombre}" creado y publicado.`);
      }
      limpiarEditor();
      await cargarTodo();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el plan');
    }
  };

  const manejarRecomendarIa = async () => {
    if (!tokenAcceso || !esSuperadmin) return;
    setConsultandoIa(true);
    setError(null);
    try {
      const { recomendacion } = await planesServicio.recomendarConIa(
        {
          nombre: formNombre || 'Plan Universitario',
          cuotaRamMb: Number(formRam) || 512,
          cuotaCpu: Number(formCpu) || 0.5,
          maxProyectos: Number(formMaxProy) || 2,
          iaBasicaHabilitada: formIaBasica,
        },
        tokenAcceso,
      );
      setConsejoIa(recomendacion);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo consultar a la IA');
    } finally {
      setConsultandoIa(false);
    }
  };

  const procesarArchivoQr = (archivo?: File | null) => {
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      setError('Selecciona una imagen válida (PNG, JPG o WEBP).');
      return;
    }
    if (archivo.size > 380_000) {
      setError('La imagen del QR debe pesar menos de 380 KB (recórtala o comprímela).');
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      if (typeof lector.result === 'string') {
        setCobro((prev) => ({ ...prev, qrImagenDataUrl: lector.result as string }));
        setVistaPreviaCobro('qr');
        setError(null);
      }
    };
    lector.readAsDataURL(archivo);
  };

  const manejarSubirQr = (e: ChangeEvent<HTMLInputElement>) => {
    procesarArchivoQr(e.target.files?.[0]);
  };

  const manejarSoltarQr = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastrandoQr(false);
    procesarArchivoQr(e.dataTransfer.files?.[0]);
  };

  const manejarGuardarCobro = async () => {
    if (!tokenAcceso || !esSuperadmin) return;
    setGuardandoCobro(true);
    try {
      await planesServicio.guardarCobro(cobro, tokenAcceso);
      setAviso('Configuración de cobro (QR / Banco / Efectivo) guardada correctamente.');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar la configuración de cobro');
    } finally {
      setGuardandoCobro(false);
    }
  };

  const manejarEnviarSolicitud = async () => {
    if (!tokenAcceso || !planElegido) return;
    setEnviandoSolicitud(true);
    setError(null);
    try {
      await planesServicio.crearSolicitud(
        {
          planId: planElegido.id,
          metodoPago,
          referenciaPago: referenciaPago.trim(),
          notaCliente: notaCliente.trim(),
        },
        tokenAcceso,
      );
      setPlanElegido(null);
      setReferenciaPago('');
      setNotaCliente('');
      setAviso(
        'Solicitud enviada. El administrador recibió el aviso por Telegram y activará tu plan tras verificar el pago.',
      );
      await cargarTodo();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo enviar la solicitud');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const manejarRevisarSolicitud = async (id: string, decision: 'aprobada' | 'rechazada') => {
    if (!tokenAcceso || !esSuperadmin) return;
    try {
      await planesServicio.revisarSolicitud(id, decision, tokenAcceso);
      setAviso(
        decision === 'aprobada'
          ? 'Pago aprobado: el plan y sus cuotas de RAM/CPU ya fueron activados en la cuenta del cliente.'
          : 'Solicitud marcada como rechazada.',
      );
      await Promise.all([cargarTodo(), renovarSesion()]);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo procesar la solicitud');
    }
  };

  const manejarCancelarMiSolicitud = async (id: string) => {
    if (!tokenAcceso) return;
    try {
      await planesServicio.cancelarSolicitud(id, tokenAcceso);
      setAviso('Solicitud cancelada.');
      await cargarTodo();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cancelar la solicitud');
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden pt-20 px-4 sm:px-6 lg:px-7 pb-12 min-h-screen bg-canvas-base text-text-primary">
      <div className="w-full min-w-0 flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Planes y Suscripción
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Adquiere o mejora tu plan de hosting universitario (QR Bancario, Transferencia o
              Efectivo).
            </p>
          </div>
          {esSuperadmin && (
            <div className="w-full md:w-auto overflow-x-auto pb-0.5">
              <div className="inline-flex p-1 rounded-xl bg-surface-card border border-border-hairline gap-1 whitespace-nowrap">
                {[
                  { id: 'tienda', label: 'Vista Cliente (Planes)', icon: 'storefront' },
                  { id: 'editor', label: 'Crear / Editar + Vista Previa', icon: 'design_services' },
                  {
                    id: 'cobros',
                    label: `QR / Pagos (${solicitudes.filter((s) => s.estado === 'pendiente').length})`,
                    icon: 'qr_code_2',
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPestana(tab.id as PestanaPlanes)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      pestana === tab.id
                        ? 'bg-primary text-[var(--hs-on-accent)]'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-error-container border border-status-critical/30 text-xs text-status-critical">
            {error}
          </div>
        )}
        {aviso && (
          <div className="p-3.5 rounded-xl bg-primary/12 border border-primary/25 text-xs text-primary">
            {aviso}
          </div>
        )}

        {cargando ? (
          <div className="p-8 text-center text-xs font-mono text-text-dim">Cargando planes…</div>
        ) : pestana === 'tienda' ? (
          <>
            {/* Catálogo visual de planes */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {planes
                .filter((p) => p.activo || esSuperadmin)
                .map((p) => (
                  <div key={p.id} className="flex flex-col gap-2">
                    <TarjetaPlanVisual
                      plan={p}
                      esPlanActual={usuario?.planNombre === p.codigo}
                      onElegir={() => setPlanElegido(p)}
                    />
                    {esSuperadmin && (
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => cargarPlanEnEditor(p)}
                          className="px-2.5 py-1 rounded-lg bg-surface-card border border-border-hairline text-[11px] font-medium text-primary cursor-pointer"
                        >
                          Editar plan
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Mis solicitudes recientes */}
            {solicitudes.length > 0 && (
              <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-3">
                <h2 className="text-sm font-bold text-text-primary">
                  {esSuperadmin ? 'Últimas solicitudes de clientes' : 'Mis solicitudes de suscripción'}
                </h2>
                <div className="divide-y divide-border-hairline">
                  {solicitudes.map((s) => (
                    <div
                      key={s.id}
                      className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-text-primary">{s.planNombre}</span>{' '}
                        <span className="font-mono text-text-muted">
                          • Bs {s.montoBs} • {s.metodoPago.toUpperCase()}
                        </span>
                        {esSuperadmin && (
                          <span className="ml-2 text-primary font-mono">({s.nombreUsuario})</span>
                        )}
                        {s.referenciaPago && (
                          <div className="text-[11px] font-mono text-text-dim">
                            Ref: {s.referenciaPago}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase ${
                            s.estado === 'aprobada'
                              ? 'bg-primary/15 text-primary'
                              : s.estado === 'pendiente'
                                ? 'bg-status-warning/15 text-status-warning'
                                : 'bg-error-container text-status-critical'
                          }`}
                        >
                          {s.estado}
                        </span>
                        {!esSuperadmin && s.estado === 'pendiente' && (
                          <button
                            type="button"
                            onClick={() => void manejarCancelarMiSolicitud(s.id)}
                            className="px-2 py-1 rounded-lg border border-border-hairline text-[11px] text-text-muted hover:text-status-critical cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                        {esSuperadmin && s.estado === 'pendiente' && (
                          <>
                            <button
                              type="button"
                              onClick={() => void manejarRevisarSolicitud(s.id, 'aprobada')}
                              className="px-2.5 py-1 rounded-lg bg-primary text-[var(--hs-on-accent)] text-[11px] font-semibold cursor-pointer"
                            >
                              Aprobar y activar
                            </button>
                            <button
                              type="button"
                              onClick={() => void manejarRevisarSolicitud(s.id, 'rechazada')}
                              className="px-2.5 py-1 rounded-lg bg-error-container text-status-critical text-[11px] font-semibold cursor-pointer"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : pestana === 'editor' && esSuperadmin ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Formulario de creación / edición */}
            <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-text-primary">
                  {planEditId ? 'Editando plan existente' : 'Crear nuevo plan'}
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={consultandoIa}
                    onClick={() => void manejarRecomendarIa()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/12 border border-primary/30 text-primary text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    <span>{consultandoIa ? 'Pensando…' : 'Recomendar con IA'}</span>
                  </button>
                  {planEditId && (
                    <button
                      type="button"
                      onClick={limpiarEditor}
                      className="px-2.5 py-1.5 rounded-lg border border-border-hairline text-[11px] text-text-muted cursor-pointer"
                    >
                      Nuevo
                    </button>
                  )}
                </div>
              </div>

              {consejoIa && (
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs flex flex-col gap-2">
                  <div className="font-semibold text-primary">
                    Sugerencia IA (Precio sugerido: Bs {consejoIa.precioSugeridoBs}/mes):
                  </div>
                  <p className="text-text-primary">{consejoIa.consejoComercial}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormPrecio(String(consejoIa.precioSugeridoBs));
                      setFormDesc(consejoIa.descripcionSugerida);
                      setFormBeneficiosTexto(consejoIa.beneficiosSugeridos.join('\n'));
                    }}
                    className="self-start px-3 py-1 rounded-lg bg-primary text-[var(--hs-on-accent)] text-[11px] font-semibold cursor-pointer"
                  >
                    Aplicar sugerencia al plan
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={formCodigo}
                  onChange={(e) =>
                    setFormCodigo(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                  }
                  placeholder="Código (ej. pro_ia)"
                  className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
                />
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Nombre visible (ej. Plan Pro)"
                  className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <input
                  type="number"
                  min={0}
                  value={formPrecio}
                  onChange={(e) => setFormPrecio(e.target.value)}
                  placeholder="Precio Bs"
                  className="rounded-xl bg-surface-low border border-border-hairline px-2.5 py-2 text-xs font-mono text-text-primary"
                />
                <input
                  type="text"
                  value={formPeriodo}
                  onChange={(e) => setFormPeriodo(e.target.value)}
                  placeholder="mes"
                  className="rounded-xl bg-surface-low border border-border-hairline px-2.5 py-2 text-xs text-text-primary"
                />
                <input
                  type="number"
                  min={128}
                  max={8192}
                  value={formRam}
                  onChange={(e) => setFormRam(e.target.value)}
                  placeholder="RAM MB"
                  className="rounded-xl bg-surface-low border border-border-hairline px-2.5 py-2 text-xs font-mono text-text-primary"
                />
                <input
                  type="number"
                  step="0.25"
                  min={0.25}
                  max={8}
                  value={formCpu}
                  onChange={(e) => setFormCpu(e.target.value)}
                  placeholder="CPU"
                  className="rounded-xl bg-surface-low border border-border-hairline px-2.5 py-2 text-xs font-mono text-text-primary"
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formMaxProy}
                  onChange={(e) => setFormMaxProy(e.target.value)}
                  placeholder="Máx proy"
                  className="rounded-xl bg-surface-low border border-border-hairline px-2.5 py-2 text-xs font-mono text-text-primary"
                />
              </div>

              <textarea
                rows={2}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Descripción clara de para quién es este plan…"
                className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
              />

              <textarea
                rows={4}
                value={formBeneficiosTexto}
                onChange={(e) => setFormBeneficiosTexto(e.target.value)}
                placeholder={'Beneficios (uno por línea):\nHasta 4 proyectos\n1 GB RAM garantizada'}
                className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
              />

              <div className="flex flex-wrap gap-4 text-xs text-text-primary">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIaBasica}
                    onChange={(e) => setFormIaBasica(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Incluye IA ligera</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formDestacado}
                    onChange={(e) => setFormDestacado(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Destacado (Recomendado)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActivo}
                    onChange={(e) => setFormActivo(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Visible en tienda</span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => void manejarGuardarPlan()}
                className="w-full py-2.5 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer"
              >
                {planEditId ? 'Guardar cambios del plan' : 'Publicar nuevo plan'}
              </button>
            </div>

            {/* Vista Previa en tiempo real */}
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Vista previa en vivo (así lo verá tu cliente)
              </div>
              <TarjetaPlanVisual plan={planPreview} soloVistaPrevia />
            </div>
          </div>
        ) : (
          /* Pestaña Cobros QR / Transferencia / Efectivo + Solicitudes (Superadmin) */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-3">
              <h2 className="text-sm font-bold text-text-primary">
                Métodos de Cobro (QR Bancario, Transferencia, Efectivo)
              </h2>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cobro.habilitarQr}
                    onChange={(e) => setCobro((p) => ({ ...p, habilitarQr: e.target.checked }))}
                    className="accent-primary"
                  />
                  <span>QR Bancario</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cobro.habilitarTransferencia}
                    onChange={(e) =>
                      setCobro((p) => ({ ...p, habilitarTransferencia: e.target.checked }))
                    }
                    className="accent-primary"
                  />
                  <span>Transferencia</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cobro.habilitarEfectivo}
                    onChange={(e) =>
                      setCobro((p) => ({ ...p, habilitarEfectivo: e.target.checked }))
                    }
                    className="accent-primary"
                  />
                  <span>Efectivo</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={cobro.banco}
                  onChange={(e) => setCobro((p) => ({ ...p, banco: e.target.value }))}
                  placeholder="Banco (ej. Banco Unión / BNB / Mercantil)"
                  className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
                />
                <input
                  type="text"
                  value={cobro.titular}
                  onChange={(e) => setCobro((p) => ({ ...p, titular: e.target.value }))}
                  placeholder="Titular de la cuenta"
                  className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
                />
              </div>

              <input
                type="text"
                value={cobro.numeroCuenta}
                onChange={(e) => setCobro((p) => ({ ...p, numeroCuenta: e.target.value }))}
                placeholder="Número de cuenta bancaria"
                className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs font-mono text-text-primary"
              />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-primary">
                    Imagen de tu QR Bancario (PNG/JPG, máx 380 KB)
                  </label>
                  {cobro.qrImagenDataUrl && (
                    <button
                      type="button"
                      onClick={() => setCobro((p) => ({ ...p, qrImagenDataUrl: '' }))}
                      className="text-[11px] text-status-critical hover:underline cursor-pointer"
                    >
                      Quitar QR
                    </button>
                  )}
                </div>
                <input
                  ref={inputQrRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={manejarSubirQr}
                  className="hidden"
                />
                <div
                  onClick={() => inputQrRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setArrastrandoQr(true);
                  }}
                  onDragLeave={() => setArrastrandoQr(false)}
                  onDrop={manejarSoltarQr}
                  className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    arrastrandoQr
                      ? 'border-primary bg-primary/10'
                      : 'border-border-hairline bg-surface-low hover:border-primary/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-3xl text-primary">
                    cloud_upload
                  </span>
                  <div className="text-xs font-semibold text-text-primary">
                    {arrastrandoQr
                      ? 'Suelta aquí tu imagen QR'
                      : 'Arrastra y suelta tu QR aquí o haz clic para seleccionar'}
                  </div>
                  <div className="text-[11px] text-text-dim">
                    PNG, JPG o WEBP • Vista previa automática con marco HomeSOC
                  </div>
                </div>
              </div>

              {/* Vista previa en vivo de cómo verá el cliente el QR o la Tarjeta Bancaria */}
              <div className="rounded-2xl bg-surface-low border border-border-hairline p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Vista previa para el cliente
                  </span>
                  <div className="inline-flex p-0.5 rounded-lg bg-surface-card border border-border-hairline gap-0.5">
                    <button
                      type="button"
                      onClick={() => setVistaPreviaCobro('qr')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                        vistaPreviaCobro === 'qr'
                          ? 'bg-primary text-[var(--hs-on-accent)]'
                          : 'text-text-muted'
                      }`}
                    >
                      Marco QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setVistaPreviaCobro('transferencia')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                        vistaPreviaCobro === 'transferencia'
                          ? 'bg-primary text-[var(--hs-on-accent)]'
                          : 'text-text-muted'
                      }`}
                    >
                      Tarjeta Banco
                    </button>
                  </div>
                </div>
                {vistaPreviaCobro === 'qr' ? (
                  <MarcoQrHomeSoc
                    qrImagenDataUrl={cobro.qrImagenDataUrl}
                    banco={cobro.banco}
                    titular={cobro.titular}
                    montoBs={35}
                  />
                ) : (
                  <TarjetaBancariaVisual
                    banco={cobro.banco}
                    titular={cobro.titular}
                    numeroCuenta={cobro.numeroCuenta}
                    montoBs={35}
                  />
                )}
              </div>

              <textarea
                rows={2}
                value={cobro.instrucciones}
                onChange={(e) => setCobro((p) => ({ ...p, instrucciones: e.target.value }))}
                placeholder="Instrucciones para el estudiante al pagar…"
                className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
              />

              <button
                type="button"
                disabled={guardandoCobro}
                onClick={() => void manejarGuardarCobro()}
                className="w-full py-2.5 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {guardandoCobro ? 'Guardando…' : 'Guardar configuración de cobro'}
              </button>
            </div>

            <div className="rounded-2xl bg-surface-card border border-border-hairline p-5 flex flex-col gap-3">
              <h2 className="text-sm font-bold text-text-primary">
                Solicitudes de pago ({solicitudes.length})
              </h2>
              {solicitudes.length === 0 ? (
                <p className="text-xs text-text-dim">Aún no hay solicitudes registradas.</p>
              ) : (
                <div className="divide-y divide-border-hairline">
                  {solicitudes.map((s) => (
                    <div key={s.id} className="py-3 flex flex-col gap-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-text-primary">
                          {s.nombreUsuario} → {s.planNombre} (Bs {s.montoBs})
                        </span>
                        <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-surface-low">
                          {s.estado}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-text-muted">
                        Método: {s.metodoPago.toUpperCase()}
                        {s.referenciaPago ? ` • Ref: ${s.referenciaPago}` : ''}
                      </div>
                      {s.notaCliente && (
                        <div className="text-[11px] text-text-muted">{s.notaCliente}</div>
                      )}
                      {s.estado === 'pendiente' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void manejarRevisarSolicitud(s.id, 'aprobada')}
                            className="px-3 py-1.5 rounded-lg bg-primary text-[var(--hs-on-accent)] text-[11px] font-semibold cursor-pointer"
                          >
                            Aprobar y activar plan
                          </button>
                          <button
                            type="button"
                            onClick={() => void manejarRevisarSolicitud(s.id, 'rechazada')}
                            className="px-3 py-1.5 rounded-lg bg-error-container text-status-critical text-[11px] font-semibold cursor-pointer"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Pago para Cliente (QR Bancario / Transferencia / Efectivo) */}
      {planElegido && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => !enviandoSolicitud && setPlanElegido(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-surface-card border border-border-hairline shadow-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  Adquirir {planElegido.nombre}
                </h3>
                <p className="text-xs font-mono text-primary font-semibold">
                  Bs {planElegido.precioBs} / {planElegido.periodo} • {planElegido.cuotaRamMb} MB RAM
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlanElegido(null)}
                className="p-1 rounded-lg text-text-dim hover:text-text-primary cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {cobro.habilitarQr && (
                <button
                  type="button"
                  onClick={() => setMetodoPago('qr')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                    metodoPago === 'qr'
                      ? 'bg-primary text-[var(--hs-on-accent)] border-primary'
                      : 'bg-surface-low border-border-hairline text-text-muted'
                  }`}
                >
                  QR Bancario
                </button>
              )}
              {cobro.habilitarTransferencia && (
                <button
                  type="button"
                  onClick={() => setMetodoPago('transferencia')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                    metodoPago === 'transferencia'
                      ? 'bg-primary text-[var(--hs-on-accent)] border-primary'
                      : 'bg-surface-low border-border-hairline text-text-muted'
                  }`}
                >
                  Transferencia
                </button>
              )}
              {cobro.habilitarEfectivo && (
                <button
                  type="button"
                  onClick={() => setMetodoPago('efectivo')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                    metodoPago === 'efectivo'
                      ? 'bg-primary text-[var(--hs-on-accent)] border-primary'
                      : 'bg-surface-low border-border-hairline text-text-muted'
                  }`}
                >
                  Efectivo
                </button>
              )}
            </div>

            {metodoPago === 'qr' && (
              <MarcoQrHomeSoc
                qrImagenDataUrl={cobro.qrImagenDataUrl}
                banco={cobro.banco}
                titular={cobro.titular}
                montoBs={planElegido.precioBs}
              />
            )}

            {metodoPago === 'transferencia' && (
              <TarjetaBancariaVisual
                banco={cobro.banco}
                titular={cobro.titular}
                numeroCuenta={cobro.numeroCuenta}
                montoBs={planElegido.precioBs}
              />
            )}

            {cobro.instrucciones && (
              <p className="text-[11px] text-text-muted">{cobro.instrucciones}</p>
            )}

            <input
              type="text"
              value={referenciaPago}
              onChange={(e) => setReferenciaPago(e.target.value)}
              placeholder={
                metodoPago === 'efectivo'
                  ? 'Dónde/cuándo entregas el efectivo (ej. UAGRM lunes)'
                  : 'Nro. de comprobante / referencia de pago'
              }
              className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary"
            />
            <textarea
              rows={2}
              value={notaCliente}
              onChange={(e) => setNotaCliente(e.target.value)}
              placeholder="Nota opcional (ej. nombre de tu proyecto o materia)…"
              className="rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary resize-none"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={enviandoSolicitud}
                onClick={() => setPlanElegido(null)}
                className="px-3.5 py-2 rounded-xl border border-border-hairline text-xs text-text-muted cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={enviandoSolicitud}
                onClick={() => void manejarEnviarSolicitud()}
                className="px-4 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {enviandoSolicitud ? 'Enviando…' : 'Confirmar solicitud de pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
