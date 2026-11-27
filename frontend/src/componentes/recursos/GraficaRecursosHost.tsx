export default function GraficaRecursosHost() {
  return (
    <div className="xl:col-span-8 flex flex-col p-space-md rounded-xl bg-surface-card border border-border-hairline shadow-[0_4px_24px_rgba(0,0,0,0.5)] gap-space-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <div className="p-2 rounded-lg bg-surface-card-elevated border border-primary/30 text-primary shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            <span className="material-symbols-outlined text-[20px]">stacked_line_chart</span>
          </div>
          <div>
            <h3 className="font-headline-md text-text-primary font-semibold">Histórico de Carga y Rendimiento</h3>
            <p className="font-body-sm text-text-muted">Monitoreo continuo de telemetría del kernel del servidor</p>
          </div>
        </div>
        {/* Metric selector and Time range toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-surface-container-lowest border border-border-hairline p-0.5 font-mono text-[11px]">
            <button className="px-2.5 py-1 rounded bg-primary/20 text-primary font-semibold border border-primary/40 shadow-sm">CPU %</button>
            <button className="px-2.5 py-1 rounded text-text-muted hover:text-text-primary">RAM GB</button>
            <button className="px-2.5 py-1 rounded text-text-muted hover:text-text-primary">Red (I/O)</button>
          </div>
          <div className="inline-flex rounded-lg bg-surface-container-lowest border border-border-hairline p-0.5 font-mono text-[11px]">
            <button className="px-2.5 py-1 rounded bg-surface-card-elevated text-secondary font-semibold border border-border-hairline">24h</button>
            <button className="px-2.5 py-1 rounded text-text-muted hover:text-text-primary">7 días</button>
          </div>
        </div>
      </div>
      {/* Simulated SVG Multi-line Telemetry Chart */}
      <div className="relative w-full h-72 rounded-lg bg-surface-container-lowest/90 border border-border-hairline p-space-sm overflow-hidden flex flex-col justify-between">
        {/* Peak incident annotation badge: Borg backup */}
        <div className="absolute top-8 left-1/3 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-card-elevated border border-status-warning/40 text-status-warning shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <span className="w-2 h-2 rounded-full bg-status-warning animate-ping"></span>
          <span className="font-mono text-[11px] font-semibold">Pico 88.4% — Backup nocturno Borg (03:15 AM)</span>
        </div>
        {/* Grid reference lines & Axis values */}
        <div className="w-full h-full relative">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="w-full h-px bg-border-hairline border-b border-dashed border-primary"></div>
            <div className="w-full h-px bg-border-hairline border-b border-dashed border-primary"></div>
            <div className="w-full h-px bg-border-hairline border-b border-dashed border-primary"></div>
            <div className="w-full h-px bg-border-hairline border-b border-dashed border-primary"></div>
          </div>
          <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-between font-mono text-[10px] text-text-dim pointer-events-none select-none">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>
          {/* SVG Paths */}
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 220">
            <defs>
              <linearGradient id="cyanChartGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--hs-accent)' }} stopOpacity="0.36"></stop>
                <stop offset="100%" style={{ stopColor: 'var(--hs-accent-soft)' }} stopOpacity="0.0"></stop>
              </linearGradient>
              <linearGradient id="strokeGrad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" style={{ stopColor: 'var(--hs-accent-secondary)' }}></stop>
                <stop offset="45%" style={{ stopColor: 'var(--hs-accent)' }}></stop>
                <stop offset="100%" style={{ stopColor: 'var(--hs-accent-tertiary)' }}></stop>
              </linearGradient>
            </defs>
            {/* Gradient fill under curve */}
            <path d="M 0,180
                             L 45,175
                             L 90,165
                             L 135,170
                             L 180,140
                             L 225,28
                             L 245,60
                             L 290,162
                             L 340,150
                             L 390,158
                             L 450,135
                             L 510,145
                             L 570,120
                             L 630,148
                             L 700,142
                             L 700,220
                             L 0,220 Z" fill="url(#cyanChartGrad)"></path>
            {/* Main Curve Line */}
            <path d="M 0,180
                             L 45,175
                             L 90,165
                             L 135,170
                             L 180,140
                             L 225,28
                             L 245,60
                             L 290,162
                             L 340,150
                             L 390,158
                             L 450,135
                             L 510,145
                             L 570,120
                             L 630,148
                             L 700,142" fill="none" stroke="url(#strokeGrad)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
            {/* Highlight points */}
            <circle cx="225" cy="28" style={{ fill: 'var(--hs-warning)', stroke: 'var(--hs-surface-lowest)' }} r="4.5" strokeWidth="2"></circle>
            <circle cx="700" cy="142" style={{ fill: 'var(--hs-accent)', stroke: 'var(--hs-surface-lowest)' }} r="4.5" strokeWidth="2"></circle>
          </svg>
        </div>
        {/* X-Axis Timeline Footer */}
        <div className="flex items-center justify-between pt-2 px-2 font-mono text-[11px] text-text-dim border-t border-border-hairline/40">
          <span>00:00 (Ayer)</span>
          <span>03:00 (Backup)</span>
          <span>06:00</span>
          <span>09:00</span>
          <span>12:00</span>
          <span>15:00</span>
          <span>18:00</span>
          <span>21:00</span>
          <span className="text-primary font-bold">Ahora (24.8%)</span>
        </div>
      </div>
    </div>
  );
}
