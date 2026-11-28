import { FormEvent, useRef, useState } from 'react';
import { usarAutenticacion } from '../../contexto/ContextoAutenticacion';
import { ErrorApi } from '../../servicios/apiCliente';
import { iaMcpServicio } from '../../servicios/iaMcpServicio';

interface MensajeChat {
  id: number;
  autor: 'usuario' | 'asistente';
  texto: string;
  proveedor?: string;
}

interface SpeechRecognitionInstancia {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function AsistenteVozDrawer({
  abierto,
  alCerrar,
}: {
  abierto: boolean;
  alCerrar: () => void;
}) {
  const { tokenAcceso } = usarAutenticacion();
  const [mensajes, setMensajes] = useState<MensajeChat[]>([
    {
      id: 1,
      autor: 'asistente',
      texto:
        'Hola, soy el asistente IA de HomeSOC. Pregúntame por voz o texto sobre recursos, contenedores, despliegues o el resumen diario de seguridad.',
    },
  ]);
  const [entrada, setEntrada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [vozActiva, setVozActiva] = useState(true);
  const reconocimientoRef = useRef<SpeechRecognitionInstancia | null>(null);

  if (!abierto) return null;

  const hablar = (texto: string) => {
    if (!vozActiva || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'es-BO';
    utter.rate = 1.04;
    window.speechSynthesis.speak(utter);
  };

  const enviarConsulta = async (preguntaTexto: string) => {
    const limpia = preguntaTexto.trim();
    if (!limpia || !tokenAcceso) return;

    setMensajes((prev) => [...prev, { id: Date.now(), autor: 'usuario', texto: limpia }]);
    setEntrada('');
    setCargando(true);
    try {
      if (limpia.toLowerCase().includes('resumen diario')) {
        const { resumen } = await iaMcpServicio.resumenSeguridad(tokenAcceso);
        const texto = `${resumen.resumenEjecutivo} ${resumen.destacados.join('. ')}.`;
        setMensajes((prev) => [
          ...prev,
          { id: Date.now() + 1, autor: 'asistente', texto, proveedor: resumen.proveedor },
        ]);
        hablar(resumen.resumenEjecutivo);
      } else {
        const { resultado } = await iaMcpServicio.consultar(limpia, tokenAcceso);
        setMensajes((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            autor: 'asistente',
            texto: resultado.respuesta,
            proveedor: resultado.proveedor,
          },
        ]);
        hablar(resultado.textoParaVoz);
      }
    } catch (err) {
      const msg = err instanceof ErrorApi ? err.message : 'No se pudo consultar al asistente IA';
      setMensajes((prev) => [...prev, { id: Date.now() + 1, autor: 'asistente', texto: msg }]);
    } finally {
      setCargando(false);
    }
  };

  const alternarMicrofono = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstancia;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstancia;
    };
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Ctor) {
      setMensajes((prev) => [
        ...prev,
        {
          id: Date.now(),
          autor: 'asistente',
          texto:
            'Tu navegador no soporta reconocimiento de voz integrado. Puedes escribir aquí o conectar N.O.V.A. (GlassIsland) vía el servidor MCP.',
        },
      ]);
      return;
    }

    if (escuchando && reconocimientoRef.current) {
      reconocimientoRef.current.stop();
      setEscuchando(false);
      return;
    }

    const rec = new Ctor();
    rec.lang = 'es-BO';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const texto = e.results?.[0]?.[0]?.transcript ?? '';
      if (texto) {
        void enviarConsulta(texto);
      }
    };
    rec.onerror = () => setEscuchando(false);
    rec.onend = () => setEscuchando(false);
    reconocimientoRef.current = rec;
    setEscuchando(true);
    rec.start();
  };

  const manejarSubmit = (e: FormEvent) => {
    e.preventDefault();
    void enviarConsulta(entrada);
  };

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/35 backdrop-blur-xs">
      <div className="w-full max-w-md h-full bg-surface-card border-l border-border-hairline shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border-hairline flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">graphic_eq</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Asistente IA &amp; Voz</h2>
              <p className="text-[11px] text-text-dim">
                Fase 5 • Compatible con N.O.V.A. vía MCP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setVozActiva((v) => !v)}
              title={vozActiva ? 'Silenciar lectura en voz alta' : 'Activar lectura en voz alta'}
              className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                vozActiva
                  ? 'border-primary/30 bg-primary/12 text-primary'
                  : 'border-border-hairline text-text-dim'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {vozActiva ? 'volume_up' : 'volume_off'}
              </span>
            </button>
            <button
              type="button"
              onClick={alCerrar}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Sugerencias rápidas */}
        <div className="px-4 py-2.5 border-b border-border-hairline flex flex-wrap gap-1.5">
          {[
            '¿Cómo está el servidor?',
            '¿Qué proyectos tengo a medias?',
            '¿Cuánta RAM consume cada proyecto?',
            '¿Cuál proyecto tiene Landing Page?',
            'Resumen diario de seguridad',
          ].map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => void enviarConsulta(sug)}
              disabled={cargando}
              className="px-2.5 py-1 rounded-lg bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-[11px] text-text-primary cursor-pointer"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {mensajes.map((m) => (
            <div
              key={m.id}
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                m.autor === 'usuario'
                  ? 'self-end bg-primary text-[var(--hs-on-accent)]'
                  : 'self-start bg-surface-low border border-border-hairline text-text-primary'
              }`}
            >
              <p>{m.texto}</p>
              {m.proveedor && (
                <span className="block text-[10px] font-mono text-text-dim mt-1">
                  motor: {m.proveedor}
                </span>
              )}
            </div>
          ))}
          {cargando && (
            <div className="self-start text-xs font-mono text-text-dim">Analizando servidor…</div>
          )}
        </div>

        {/* Input con micrófono */}
        <form
          onSubmit={manejarSubmit}
          className="p-3.5 border-t border-border-hairline flex items-center gap-2"
        >
          <button
            type="button"
            onClick={alternarMicrofono}
            title="Hablar por micrófono (es-BO)"
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all ${
              escuchando
                ? 'bg-status-critical text-white animate-pulse'
                : 'bg-surface-low hover:bg-surface-card-elevated border border-border-hairline text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {escuchando ? 'mic_off' : 'mic'}
            </span>
          </button>
          <input
            type="text"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder={escuchando ? 'Escuchando en español…' : 'Pregunta o habla al micrófono…'}
            className="flex-1 rounded-xl bg-surface-low border border-border-hairline px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={cargando || !entrada.trim()}
            className="px-3.5 py-2 rounded-xl bg-primary text-[var(--hs-on-accent)] text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
