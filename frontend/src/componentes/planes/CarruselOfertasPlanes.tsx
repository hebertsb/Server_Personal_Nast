import { useEffect, useState } from 'react';
import { OfertaBannerItem, TemaVisualOferta } from '../../servicios/planesServicio';

const GRADIENTES_TEMA: Record<TemaVisualOferta, string> = {
  azul_neon: 'from-[#061a52] via-[#0b3ba8] to-[#0891b2]',
  fuego_naranja: 'from-[#ea580c] via-[#f97316] to-[#38bdf8]',
  esmeralda_soc: 'from-[#052e2b] via-[#047857] to-[#06b6d4]',
  purpura_ia: 'from-[#2e1065] via-[#6d28d9] to-[#ec4899]',
};

function calcularRestante(fechaFinIso: string): {
  dias: string;
  horas: string;
  minutos: string;
  segundos: string;
  vigente: boolean;
} {
  if (!fechaFinIso) {
    return { dias: '00', horas: '00', minutos: '00', segundos: '00', vigente: false };
  }
  const diff = new Date(fechaFinIso).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) {
    return { dias: '00', horas: '00', minutos: '00', segundos: '00', vigente: false };
  }
  const totalSeg = Math.floor(diff / 1000);
  const dias = Math.floor(totalSeg / 86400);
  const horas = Math.floor((totalSeg % 86400) / 3600);
  const minutos = Math.floor((totalSeg % 3600) / 60);
  const segundos = totalSeg % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    dias: pad(dias),
    horas: pad(horas),
    minutos: pad(minutos),
    segundos: pad(segundos),
    vigente: true,
  };
}

export function TarjetaBannerOferta({
  oferta,
  onAccion,
}: {
  oferta: OfertaBannerItem;
  onAccion?: () => void;
}) {
  const [tiempo, setTiempo] = useState(() => calcularRestante(oferta.fechaFinIso));

  useEffect(() => {
    setTiempo(calcularRestante(oferta.fechaFinIso));
    if (!oferta.fechaFinIso) return;
    const id = window.setInterval(() => {
      setTiempo(calcularRestante(oferta.fechaFinIso));
    }, 1000);
    return () => window.clearInterval(id);
  }, [oferta.fechaFinIso]);

  const gradiente = GRADIENTES_TEMA[oferta.temaVisual] || GRADIENTES_TEMA.azul_neon;

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-gradient-to-r ${gradiente} px-6 py-6 sm:px-9 sm:py-7 text-white`}
    >
      {/* Imagen de fondo opcional subida por el Superadmin */}
      {oferta.imagenFondoDataUrl && (
        <>
          <img
            src={oferta.imagenFondoDataUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/30" />
        </>
      )}

      {/* Destellos ambientales sutiles */}
      <div className="pointer-events-none absolute -top-16 -left-12 w-56 h-56 rounded-full bg-white/15 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-20 right-1/4 w-64 h-64 rounded-full bg-cyan-300/20 blur-3xl animate-pulse" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-2.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {oferta.descuentoTexto && (
              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-extrabold tracking-wide uppercase shadow-md animate-pulse">
                {oferta.descuentoTexto}
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[11px] font-semibold">
              {oferta.etiqueta || 'Oferta especial'}
            </span>
          </div>

          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight leading-tight drop-shadow-sm">
            {oferta.titulo || '¡Oferta por tiempo limitado!'}
          </h2>

          {oferta.subtitulo && (
            <p className="text-xs sm:text-sm text-white/90 leading-relaxed">{oferta.subtitulo}</p>
          )}

          {onAccion && oferta.textoBoton && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onAccion}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white text-slate-950 hover:bg-white/90 text-xs sm:text-sm font-bold shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                <span>{oferta.textoBoton}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_outward</span>
              </button>
            </div>
          )}
        </div>

        {/* Cuenta regresiva estilo tarjetas blancas */}
        {tiempo.vigente && (
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {[
              { valor: tiempo.dias, label: 'Días' },
              { valor: tiempo.horas, label: 'Horas' },
              { valor: tiempo.minutos, label: 'Minutos' },
              { valor: tiempo.segundos, label: 'Segundos' },
            ].map((bloque) => (
              <div
                key={bloque.label}
                className="w-16 sm:w-20 py-2.5 sm:py-3 rounded-2xl bg-white/95 text-slate-950 shadow-xl flex flex-col items-center justify-center"
              >
                <span className="text-xl sm:text-2xl font-extrabold font-mono leading-none">
                  {bloque.valor}
                </span>
                <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 mt-1">
                  {bloque.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CarruselOfertasPlanes({
  ofertas,
  onAccionOferta,
}: {
  ofertas: OfertaBannerItem[];
  onAccionOferta?: (oferta: OfertaBannerItem) => void;
}) {
  const activas = ofertas.filter((o) => o.activa);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (activas.length <= 1) return;
    const id = window.setInterval(() => {
      setIndice((prev) => (prev + 1) % activas.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [activas.length]);

  if (activas.length === 0) return null;

  const actual = activas[indice % activas.length];

  return (
    <div className="w-full flex flex-col gap-2.5">
      <TarjetaBannerOferta
        oferta={actual}
        onAccion={onAccionOferta ? () => onAccionOferta(actual) : undefined}
      />
      {activas.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {activas.map((o, i) => (
            <button
              key={o.id}
              type="button"
              aria-label={`Ver oferta ${i + 1}`}
              onClick={() => setIndice(i)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                i === indice % activas.length ? 'w-7 bg-primary' : 'w-2 bg-white/30 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
