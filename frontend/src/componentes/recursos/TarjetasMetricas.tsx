export default function TarjetasMetricas() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
      {/* Card 1: CPU Load (Host) */}
      <div className="relative overflow-hidden flex flex-col justify-between p-space-md rounded-xl bg-surface-card border border-border-hairline hover:border-primary/50 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)] group">
        <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>
        <div>
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">CPU Load (Host)</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-data-metric text-[32px] font-bold text-text-primary tracking-tight">24.8</span>
                <span className="font-data-metric text-headline-md text-primary font-semibold">%</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/30 text-primary font-mono text-[11px] font-semibold">
                <span className="material-symbols-outlined text-[14px]">thermostat</span>
                46.2 °C
              </span>
              <span className="font-mono text-[9px] text-text-dim">Normal • Tctl/Tdie</span>
            </div>
          </div>
          {/* Mini Sparkline SVG in Cyan / Cobalt */}
          <div className="my-space-sm h-10 w-full bg-surface-container-lowest/80 border border-border-hairline/60 rounded-lg p-1 flex items-center">
            <svg className="w-full h-full text-primary" fill="none" preserveAspectRatio="none" viewBox="0 0 160 30">
              <defs>
                <linearGradient id="sparklineGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--hs-accent)' }} stopOpacity="0.35"></stop>
                  <stop offset="100%" style={{ stopColor: 'var(--hs-accent-soft)' }} stopOpacity="0.0"></stop>
                </linearGradient>
              </defs>
              <path d="M0 24 L20 22 L40 18 L60 25 L80 14 L100 17 L120 9 L140 16 L160 12 L160 30 L0 30 Z" fill="url(#sparklineGrad)"></path>
              <path d="M0 24 L20 22 L40 18 L60 25 L80 14 L100 17 L120 9 L140 16 L160 12" style={{ stroke: 'var(--hs-accent)' }} strokeLinecap="round" strokeWidth="2" vectorEffect="non-scaling-stroke"></path>
            </svg>
          </div>
        </div>
        {/* Core Distribution Breakdown (C1 to C6) */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full" style={{ width: '24.8%' }}></div>
          </div>
          <div className="grid grid-cols-6 gap-1 pt-1">
            <div className="flex flex-col items-center bg-surface-container-lowest/80 border border-border-hairline/40 py-1 rounded">
              <span className="font-mono text-[9px] text-text-dim">C1</span>
              <span className="font-mono text-[11px] text-primary font-semibold">28%</span>
            </div>
            <div className="flex flex-col items-center bg-surface-container-lowest/80 border border-border-hairline/40 py-1 rounded">
              <span className="font-mono text-[9px] text-text-dim">C2</span>
              <span className="font-mono text-[11px] text-primary font-semibold">19%</span>
            </div>
            <div className="flex flex-col items-center bg-surface-container-lowest/80 border border-border-hairline/40 py-1 rounded">
              <span className="font-mono text-[9px] text-text-dim">C3</span>
              <span className="font-mono text-[11px] text-primary font-semibold">42%</span>
            </div>
            <div className="flex flex-col items-center bg-surface-container-lowest/80 border border-border-hairline/40 py-1 rounded">
              <span className="font-mono text-[9px] text-text-dim">C4</span>
              <span className="font-mono text-[11px] text-primary font-semibold">12%</span>
            </div>
            <div className="flex flex-col items-center bg-surface-container-lowest/80 border border-border-hairline/40 py-1 rounded">
              <span className="font-mono text-[9px] text-text-dim">C5</span>
              <span className="font-mono text-[11px] text-primary font-semibold">31%</span>
            </div>
            <div className="flex flex-col items-center bg-surface-container-lowest/80 border border-border-hairline/40 py-1 rounded">
              <span className="font-mono text-[9px] text-text-dim">C6</span>
              <span className="font-mono text-[11px] text-primary font-semibold">17%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Memoria RAM Total */}
      <div className="relative overflow-hidden flex flex-col justify-between p-space-md rounded-xl bg-surface-card border border-border-hairline hover:border-secondary/50 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)] group">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Memoria RAM Total</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-data-metric text-[32px] font-bold text-text-primary tracking-tight">9.4</span>
              <span className="font-mono text-body-md text-text-muted">/ 15.8 GB</span>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary-container/20 border border-secondary/30 text-secondary font-mono text-[11px] font-semibold">
            59.5%
          </span>
        </div>
        {/* Segmented Progress Bar */}
        <div className="my-space-sm flex flex-col gap-1.5">
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden flex">
            <div className="bg-secondary h-full" style={{ width: '48%' }} title="Activa: 7.6 GB"></div>
            <div className="bg-primary/50 h-full" style={{ width: '11.5%' }} title="Buffers / Caché: 1.8 GB"></div>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary"></span> Activa: 7.6 GB
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary/50"></span> Buff/Cache: 1.8 GB
            </span>
            <span className="text-text-dim">Libre: 6.4 GB</span>
          </div>
        </div>
        {/* Swap Memory row */}
        <div className="p-2 rounded-lg bg-surface-container-lowest/80 border border-border-hairline/60 flex items-center justify-between font-mono text-[11px]">
          <span className="text-text-muted flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-secondary">swap_horiz</span>
            Swap Utilizada
          </span>
          <span className="text-text-primary font-medium">0.8 GB <span className="text-text-dim">/ 4.0 GB</span> (20.0%)</span>
        </div>
      </div>

      {/* Card 3: NVMe SSD Principal */}
      <div className="relative overflow-hidden flex flex-col justify-between p-space-md rounded-xl bg-surface-card border border-border-hairline hover:border-primary/50 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)] group">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">SSD NVMe (Sistema / Var)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-data-metric text-[32px] font-bold text-text-primary tracking-tight">142</span>
              <span className="font-mono text-body-md text-text-muted">/ 512 GB</span>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 border border-primary/30 text-primary font-mono text-[11px] font-semibold">
            27.7%
          </span>
        </div>
        <div className="my-space-sm flex flex-col gap-1.5">
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-secondary h-full rounded-full" style={{ width: '27.7%' }}></div>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] text-text-muted">
            <span>Montaje: <code className="text-text-primary">/dev/nvme0n1p2</code></span>
            <span className="text-primary font-semibold">Libre: 370 GB</span>
          </div>
        </div>
        {/* Read / Write Speed stats */}
        <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-surface-container-lowest/80 border border-border-hairline/60 font-mono text-[11px]">
          <div className="flex items-center justify-between px-1">
            <span className="text-text-muted flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-primary">arrow_downward</span> Read
            </span>
            <span className="text-text-primary font-bold">1.2 MB/s</span>
          </div>
          <div className="flex items-center justify-between px-1 border-l border-border-hairline/60">
            <span className="text-text-muted flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-secondary">arrow_upward</span> Write
            </span>
            <span className="text-text-primary font-bold">4.8 MB/s</span>
          </div>
        </div>
      </div>

      {/* Card 4: Disco NAS / Backup Externo (ZFS) */}
      <div className="relative overflow-hidden flex flex-col justify-between p-space-md rounded-xl bg-surface-card border border-border-hairline hover:border-tertiary/50 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)] group">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">Storage NAS / Backups</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="font-data-metric text-[32px] font-bold text-text-primary tracking-tight">1.34</span>
              <span className="font-mono text-body-md text-text-muted">/ 2.0 TB</span>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-tertiary/15 border border-tertiary/30 text-tertiary font-mono text-[11px] font-semibold">
            67.0%
          </span>
        </div>
        <div className="my-space-sm flex flex-col gap-1.5">
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-secondary-container to-tertiary h-full rounded-full" style={{ width: '67%' }}></div>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] text-text-muted">
            <span>ZFS Pool: <code className="text-text-primary">tank/homelab</code></span>
            <span className="text-tertiary font-semibold">Libre: 660 GB</span>
          </div>
        </div>
        {/* SMART status badge */}
        <div className="p-2 rounded-lg bg-surface-container-lowest/80 border border-border-hairline/60 flex items-center justify-between font-mono text-[11px]">
          <span className="text-text-muted flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px] text-primary">health_and_safety</span>
            SMART: <strong className="text-primary font-mono">PASSED</strong>
          </span>
          <span className="text-text-dim">Alerta: &gt;80%</span>
        </div>
      </div>
    </div>
  );
}
