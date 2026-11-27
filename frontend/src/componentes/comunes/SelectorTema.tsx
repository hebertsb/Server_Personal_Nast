import { useEffect, useRef, useState } from 'react';
import { PALETAS_ACENTO, usarTema } from '../../contexto/ContextoTema';

interface PropiedadesSelectorTema {
  alineacion?: 'izquierda' | 'derecha';
}

/**
 * Selector compacto de Modo Día/Noche y las 5 tonalidades vivas de acento.
 * Se utiliza tanto en la barra superior del dashboard como en la pantalla de login.
 */
export default function SelectorTema({ alineacion = 'derecha' }: PropiedadesSelectorTema) {
  const { tema, acento, esOscuro, establecerTema, establecerAcento } = usarTema();
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const manejarClickFuera = (evento: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(evento.target as Node)) {
        setAbierto(false);
      }
    };
    if (abierto) {
      document.addEventListener('mousedown', manejarClickFuera);
    }
    return () => document.removeEventListener('mousedown', manejarClickFuera);
  }, [abierto]);

  const paletaActual = PALETAS_ACENTO.find((p) => p.id === acento) ?? PALETAS_ACENTO[0];
  const colorActual = esOscuro ? paletaActual.colorNoche : paletaActual.colorDia;

  return (
    <div ref={contenedorRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className="h-9 px-3 rounded-xl bg-surface-card hover:bg-surface-card-elevated border border-border-hairline text-text-primary transition-all flex items-center gap-2 cursor-pointer"
        title="Apariencia y tonalidad"
        aria-expanded={abierto}
      >
        <span
          className="w-3.5 h-3.5 rounded-full ring-2 ring-offset-1 ring-offset-surface-card transition-colors"
          style={{ backgroundColor: colorActual, boxShadow: `0 0 0 1px ${colorActual}40` }}
        />
        <span className="hidden sm:inline text-xs font-medium text-text-muted">
          {paletaActual.nombre}
        </span>
        <span className="material-symbols-outlined text-[15px] text-text-dim">
          expand_more
        </span>
      </button>

      {abierto && (
        <div
          className={`absolute top-11 z-50 w-64 rounded-2xl border border-border-hairline bg-surface-card/95 backdrop-blur-xl p-3.5 shadow-xl ${
            alineacion === 'derecha' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="mb-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-text-dim mb-2">
              Apariencia
            </span>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-low border border-border-hairline">
              <button
                type="button"
                onClick={() => establecerTema('claro')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  tema === 'claro'
                    ? 'bg-surface-card text-text-primary shadow-sm border border-border-hairline'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">light_mode</span>
                Día
              </button>
              <button
                type="button"
                onClick={() => establecerTema('oscuro')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  tema === 'oscuro'
                    ? 'bg-surface-card text-text-primary shadow-sm border border-border-hairline'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">dark_mode</span>
                Noche
              </button>
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-text-dim mb-2">
              Tonalidad de acento
            </span>
            <div className="flex flex-col gap-1">
              {PALETAS_ACENTO.map((opcion) => {
                const seleccionado = opcion.id === acento;
                const muestra = esOscuro ? opcion.colorNoche : opcion.colorDia;
                return (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => establecerAcento(opcion.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer ${
                      seleccionado
                        ? 'bg-primary/12 text-text-primary border border-primary/30'
                        : 'hover:bg-surface-card-elevated text-text-muted hover:text-text-primary border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: muestra }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-text-primary leading-tight">
                          {opcion.nombre}
                        </span>
                        <span className="text-[10px] text-text-dim truncate">
                          {opcion.descripcion}
                        </span>
                      </div>
                    </div>
                    {seleccionado && (
                      <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
