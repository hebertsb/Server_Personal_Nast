import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CarruselOfertasPlanes from '../componentes/planes/CarruselOfertasPlanes';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import {
  CicloFacturacion,
  OfertaBannerItem,
  PlanHostingItem,
  planesServicio,
} from '../servicios/planesServicio';

export default function PreciosPublicos() {
  const navigate = useNavigate();
  const { autenticado } = usarAutenticacion();
  const [planes, setPlanes] = useState<PlanHostingItem[]>([]);
  const [ofertas, setOfertas] = useState<OfertaBannerItem[]>([]);
  const [ciclo, setCiclo] = useState<CicloFacturacion>('anual');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const [resP, resO] = await Promise.all([
          planesServicio.listarPlanesPublicos().catch(() => ({ planes: [] })),
          planesServicio.listarOfertasPublicas().catch(() => ({ ofertas: [] })),
        ]);
        if (!activo) return;
        setPlanes(resP.planes ?? []);
        setOfertas(resO.ofertas ?? []);
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const maxDescuento = Math.max(20, ...planes.map((p) => p.descuentoAnualPct ?? 20));

  const elegirPlan = (plan: PlanHostingItem) => {
    if (autenticado) {
      navigate(`/planes?plan=${encodeURIComponent(plan.id)}&ciclo=${ciclo}`);
      return;
    }
    navigate(`/login?modo=registro&plan=${encodeURIComponent(plan.id)}&ciclo=${ciclo}`);
  };

  return (
    <div className="min-h-screen w-full bg-[#06090f] text-white antialiased flex flex-col relative overflow-x-hidden">
      {/* Resplandores ambientales */}
      <div className="pointer-events-none fixed -top-40 left-1/4 w-[560px] h-[560px] rounded-full bg-cyan-500/12 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Cabecera superior limpia */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#06090f]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <Link to="/login" className="inline-flex items-center gap-2.5">
            <img
              src="/logo-homesoc.png"
              alt="HomeSOC"
              className="w-9 h-9 rounded-xl object-cover border border-emerald-400/40"
            />
            <div>
              <div className="text-base font-extrabold tracking-tight leading-none">
                Home<span className="text-cyan-400">SOC</span>
              </div>
              <div className="text-[10px] font-mono text-white/60">Cloud Hosting Universitario</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {autenticado ? (
              <Link
                to="/planes"
                className="px-4 py-2 rounded-full bg-cyan-400 text-slate-950 text-xs font-bold hover:opacity-95"
              >
                Ir a mi panel
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/login?modo=registro"
                  className="px-4 py-2 rounded-full bg-cyan-400 hover:opacity-95 text-slate-950 text-xs font-bold"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-10 flex flex-col gap-8">
        {/* Banner Carrusel de Ofertas con Cuenta Regresiva */}
        {ofertas.length > 0 && (
          <CarruselOfertasPlanes
            ofertas={ofertas}
            onAccionOferta={() => {
              document.getElementById('grid-planes-publicos')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        )}

        {/* Hero motivador + Selector de ciclo */}
        <div className="text-center flex flex-col items-center gap-4">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight max-w-3xl">
            Desata el poder de tu propio servidor en{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
              HomeSOC
            </span>
          </h1>
          <p className="text-sm sm:text-base text-white/70 max-w-2xl">
            Publica tus proyectos de la universidad desde GitHub en minutos, trabaja en equipo con
            tus compañeros y paga fácil en bolivianos sin tarjeta de crédito internacional.
          </p>

          {/* Selector Anualmente / Mensualmente estilo píldora */}
          <div className="inline-flex items-center p-1.5 rounded-full bg-white/8 border border-white/15 gap-1 mt-1">
            <button
              type="button"
              onClick={() => setCiclo('anual')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                ciclo === 'anual'
                  ? 'bg-white text-slate-950 shadow-lg'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <span>Anualmente</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
                  ciclo === 'anual'
                    ? 'bg-emerald-500 text-white animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                Hasta {maxDescuento}% DTO
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCiclo('mensual')}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                ciclo === 'mensual'
                  ? 'bg-white text-slate-950 shadow-lg'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Mensualmente
            </button>
          </div>
        </div>

        {/* Grid de tarjetas de planes a lo grande */}
        <section id="grid-planes-publicos" className="w-full">
          {cargando ? (
            <div className="py-16 text-center text-sm font-mono text-white/50">
              Cargando planes disponibles…
            </div>
          ) : planes.length === 0 ? (
            <div className="py-16 text-center text-sm text-white/60">
              Pronto publicaremos nuestros planes de hosting.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {planes.map((plan, idx) => {
                const pct = Math.max(0, Math.min(80, plan.descuentoAnualPct ?? 20));
                const totalSinDesc = Math.round(plan.precioBs * 12);
                const totalAnual = Math.round(plan.precioBs * 12 * (1 - pct / 100));
                const ahorroAnual = Math.max(0, totalSinDesc - totalAnual);
                const eqMes = Math.round((totalAnual / 12) * 10) / 10;

                const esTopTier = idx === planes.length - 1 && planes.length >= 3 && !plan.destacado;
                const estiloCard = plan.destacado
                  ? 'bg-gradient-to-b from-[#0b2a78] via-[#0c2052] to-[#0b1224] border-cyan-400/70 shadow-2xl shadow-cyan-500/20 lg:-translate-y-2'
                  : esTopTier
                    ? 'bg-gradient-to-b from-[#7c230f] via-[#4a160c] to-[#1a0c0a] border-orange-500/60 shadow-2xl shadow-orange-500/15'
                    : 'bg-gradient-to-b from-[#131a26] to-[#0c1018] border-white/12';

                const cintaSuperior = plan.destacado
                  ? {
                      texto: '⚡ Más elegido por estudiantes • Mejor valor',
                      clases: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950',
                    }
                  : esTopTier
                    ? {
                        texto: '🔥 Máxima potencia para Tesis & Modelos IA',
                        clases: 'bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950',
                      }
                    : null;

                return (
                  <div
                    key={plan.id}
                    className={`rounded-3xl border overflow-hidden flex flex-col justify-between transition-all duration-300 hover:scale-[1.015] ${estiloCard}`}
                  >
                    <div>
                      {cintaSuperior ? (
                        <div
                          className={`w-full py-2 px-4 text-center text-[11px] font-extrabold tracking-wide ${cintaSuperior.clases}`}
                        >
                          {cintaSuperior.texto}
                        </div>
                      ) : (
                        <div className="h-2 w-full bg-white/5" />
                      )}

                      <div className="p-6 sm:p-7 flex flex-col gap-5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-xl font-extrabold text-white">{plan.nombre}</h3>
                            <p className="text-xs text-white/65 mt-1 leading-relaxed">
                              {plan.descripcion}
                            </p>
                          </div>
                          {ciclo === 'anual' && pct > 0 && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono font-extrabold shrink-0 animate-pulse">
                              {pct}% DTO
                            </span>
                          )}
                        </div>

                        {/* Precio grande estilo Dreamina */}
                        <div className="flex flex-col gap-1">
                          {ciclo === 'anual' ? (
                            <>
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-4xl font-extrabold font-mono text-white">
                                  Bs {eqMes}
                                </span>
                                <span className="text-xs text-white/65">/ mes</span>
                                <span className="text-sm font-mono text-white/40 line-through">
                                  Bs {plan.precioBs}
                                </span>
                              </div>
                              <div className="text-xs font-mono text-emerald-300">
                                Pago anual único: Bs {totalAnual}/año (ahorras Bs {ahorroAnual})
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-4xl font-extrabold font-mono text-white">
                                  Bs {plan.precioBs}
                                </span>
                                <span className="text-xs text-white/65">/ {plan.periodo}</span>
                              </div>
                              {pct > 0 && (
                                <div className="text-xs font-mono text-cyan-300">
                                  O paga anual Bs {totalAnual}/año (-{pct}%)
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Caja interna de recursos y miembros */}
                        <div className="rounded-2xl bg-black/30 border border-white/10 p-4 flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-2.5 text-xs">
                            <div className="p-2.5 rounded-xl bg-white/5 border border-white/8">
                              <div className="text-[10px] text-white/55 uppercase">Memoria RAM</div>
                              <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                                {plan.cuotaRamMb} MB
                              </div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/5 border border-white/8">
                              <div className="text-[10px] text-white/55 uppercase">Procesador</div>
                              <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                                {plan.cuotaCpu} vCPU
                              </div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/5 border border-white/8">
                              <div className="text-[10px] text-white/55 uppercase">Proyectos</div>
                              <div className="text-sm font-extrabold font-mono text-white mt-0.5">
                                Hasta {plan.maxProyectos}
                              </div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-cyan-400/12 border border-cyan-400/30">
                              <div className="text-[10px] text-cyan-200 uppercase">Equipo</div>
                              <div className="text-sm font-extrabold font-mono text-cyan-300 mt-0.5">
                                Hasta {plan.maxMiembros ?? 5} miembros
                              </div>
                            </div>
                          </div>

                          <div className="text-[11px] text-white/75 flex items-start gap-2 pt-1 border-t border-white/10">
                            <span className="material-symbols-outlined text-[16px] text-amber-300 shrink-0">
                              auto_awesome
                            </span>
                            <span>
                              {plan.iaBasicaHabilitada
                                ? 'Incluye modelos IA ligeros en el servidor + Modo GPU Remota (laptop).'
                                : 'Apps Web/API + APIs externas de IA + Modo GPU Remota (laptop).'}
                            </span>
                          </div>
                        </div>

                        {/* Lista completa de beneficios */}
                        {plan.beneficios.length > 0 && (
                          <ul className="space-y-2 text-xs text-white/85">
                            {plan.beneficios.map((b, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-[16px] text-emerald-400 shrink-0 mt-0.5">
                                  check_circle
                                </span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="px-6 sm:px-7 pb-6 pt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => elegirPlan(plan)}
                        className={`w-full py-3.5 rounded-2xl text-sm font-extrabold transition-all cursor-pointer shadow-lg active:scale-[0.98] ${
                          plan.destacado
                            ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 hover:opacity-95'
                            : esTopTier
                              ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 hover:opacity-95'
                              : 'bg-white text-slate-950 hover:bg-white/90'
                        }`}
                      >
                        Adquirir {plan.nombre} →
                      </button>
                      <div className="text-center text-[11px] text-white/50">
                        Activa en minutos con QR Simple, Transferencia o Efectivo
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Barra inferior de confianza */}
        <footer className="mt-4 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-white/55">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-400">
                qr_code_2
              </span>
              QR Simple Bolivia • Transferencia • Efectivo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-cyan-400">groups</span>
              1 sola suscripción compartida con tu equipo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-amber-400">bolt</span>
              Node.js · Python · PHP · Rust · Docker
            </span>
          </div>
          <Link to="/login" className="text-cyan-400 hover:underline font-semibold">
            ← Volver al inicio de sesión
          </Link>
        </footer>
      </main>
    </div>
  );
}
