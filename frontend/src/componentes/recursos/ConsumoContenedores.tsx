export default function ConsumoContenedores() {
  return (
    <div className="flex flex-col rounded-xl bg-surface-card border border-border-hairline shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-sm bg-surface-card border-b border-border-hairline">
        <div className="flex items-center gap-space-sm">
          <div className="p-2 rounded-lg bg-surface-card-elevated border border-primary/30 text-primary">
            <span className="material-symbols-outlined text-[20px]">developer_board</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline-md text-text-primary font-semibold">Consumo de Recursos por Contenedor</h3>
              <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary font-mono text-[11px] font-semibold">7 activos</span>
            </div>
            <p className="font-body-sm text-text-muted">Estadísticas recolectadas en tiempo real mediante el Docker Daemon Socket</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search filter input */}
          <div className="relative min-w-[220px]">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-text-dim">search</span>
            <input className="w-full pl-8 pr-space-sm py-1.5 rounded-lg bg-surface-container-lowest border border-border-hairline text-text-primary placeholder:text-text-dim text-mono text-[12px] font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" placeholder="Filtrar por nombre o imagen..." type="text" />
          </div>
          {/* Sort dropdown pill */}
          <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-border-hairline text-text-muted font-mono text-[11px]">
            <span className="material-symbols-outlined text-[15px] text-text-dim">sort</span>
            <span>Ordenar:</span>
            <select className="bg-transparent text-primary font-semibold focus:outline-none cursor-pointer">
              <option className="bg-surface-card text-text-primary" value="cpu">Mayor CPU</option>
              <option className="bg-surface-card text-text-primary" value="ram">Mayor RAM</option>
              <option className="bg-surface-card text-text-primary" value="name">Nombre A-Z</option>
            </select>
          </div>
        </div>
      </div>
      {/* Table Container */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left font-body-sm text-on-surface border-collapse">
          <thead className="bg-surface-container-lowest/80 text-text-muted font-mono text-[11px] uppercase tracking-wider select-none border-b border-border-hairline">
            <tr>
              <th className="py-3 px-space-md">Contenedor / Servicio</th>
              <th className="py-3 px-space-sm text-center">Estado</th>
              <th className="py-3 px-space-sm text-right">CPU</th>
              <th className="py-3 px-space-sm text-right">Memoria RAM</th>
              <th className="py-3 px-space-sm text-right">Red (Entrada / Salida)</th>
              <th className="py-3 px-space-sm text-center">Reinicios</th>
              <th className="py-3 px-space-md text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-hairline/40 font-mono text-[12px]">
            {/* Row 1: barberapp-prod */}
            <tr className="hover:bg-surface-card-elevated/60 transition-colors group">
              <td className="py-3 px-space-md">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_#06b6d4]"></span>
                  <div className="flex flex-col">
                    <span className="font-headline-md text-[13px] font-semibold text-text-primary group-hover:text-primary transition-colors">barberapp-prod</span>
                    <span className="font-mono text-[10px] text-text-dim">ghcr.io/app/barberapp:v2.4.1</span>
                  </div>
                </div>
              </td>
              <td className="py-3 px-space-sm text-center">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary font-mono text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  En ejecución
                </span>
              </td>
              <td className="py-3 px-space-sm text-right">
                <div className="flex flex-col items-end">
                  <span className="font-mono text-[13px] font-bold text-text-primary">5.1%</span>
                  <div className="w-16 h-1 bg-surface-container-highest rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '25%' }}></div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-space-sm text-right">
                <div className="flex flex-col items-end">
                  <span className="font-mono text-[12px] font-semibold text-text-primary">512 MB</span>
                  <span className="font-mono text-[10px] text-text-dim">3.2% de 16GB</span>
                </div>
              </td>
              <td className="py-3 px-space-sm text-right font-mono text-[11px] text-text-primary">
                <span className="text-primary font-medium">↓ 1.8k req/h</span> • <span className="text-text-muted">↑ 84 MB</span>
              </td>
              <td className="py-3 px-space-sm text-center font-mono text-[11px] text-text-primary">
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest border border-border-hairline">0</span>
              </td>
              <td className="py-3 px-space-md text-right">
                <div className="inline-flex items-center gap-1">
                  <button className="p-1.5 rounded bg-surface-container-lowest hover:bg-surface-card border border-border-hairline text-text-muted hover:text-primary transition-all" title="Ver Logs / Terminal">
                    <span className="material-symbols-outlined text-[15px]">terminal</span>
                  </button>
                  <button className="p-1.5 rounded bg-surface-container-lowest hover:bg-surface-card border border-border-hairline text-text-muted hover:text-tertiary transition-all" title="Reiniciar Contenedor">
                    <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                  </button>
                  <button className="p-1.5 rounded bg-surface-container-lowest hover:bg-surface-card border border-border-hairline text-text-muted hover:text-status-critical transition-all" title="Detener Contenedor">
                    <span className="material-symbols-outlined text-[15px]">pause</span>
                  </button>
                </div>
              </td>
            </tr>
            {/* Row 2: postgres-homesoc */}
            <tr className="hover:bg-surface-card-elevated/60 transition-colors group bg-surface-container-lowest/40">
              <td className="py-3 px-space-md">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_#06b6d4]"></span>
                  <div className="flex flex-col">
                    <span className="font-headline-md text-[13px] font-semibold text-text-primary group-hover:text-primary transition-colors">postgres-homesoc</span>
                    <span className="font-mono text-[10px] text-text-dim">postgres:16-alpine (Internal Network)</span>
                  </div>
                </div>
              </td>
              <td className="py-3 px-space-sm text-center">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary font-mono text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  En ejecución
                </span>
              </td>
              <td className="py-3 px-space-sm text-right">
                <div className="flex flex-col items-end">
                  <span className="font-mono text-[13px] font-bold text-text-primary">3.2%</span>
                  <div className="w-16 h-1 bg-surface-container-highest rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '16%' }}></div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-space-sm text-right">
                <div className="flex flex-col items-end">
                  <span className="font-mono text-[12px] font-semibold text-text-primary">384 MB</span>
                  <span className="font-mono text-[10px] text-text-dim">2.4% de 16GB</span>
                </div>
              </td>
              <td className="py-3 px-space-sm text-right font-mono text-[11px] text-text-primary">
                <span className="text-secondary font-medium">↓ 45 MB</span> • <span className="text-primary font-medium">↑ 120 MB</span>
              </td>
              <td className="py-3 px-space-sm text-center font-mono text-[11px] text-text-primary">
                <span className="px-2 py-0.5 rounded bg-surface-container-lowest border border-border-hairline">0</span>
              </td>
              <td className="py-3 px-space-md text-right">
                <div className="inline-flex items-center gap-1">
                  <button className="p-1.5 rounded bg-surface-container-lowest hover:bg-surface-card border border-border-hairline text-text-muted hover:text-primary transition-all" title="Ver Logs / Terminal">
                    <span className="material-symbols-outlined text-[15px]">terminal</span>
                  </button>
                  <button className="p-1.5 rounded bg-surface-container-lowest hover:bg-surface-card border border-border-hairline text-text-muted hover:text-tertiary transition-all" title="Reiniciar Contenedor">
                    <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                  </button>
                  <button className="p-1.5 rounded bg-surface-container-lowest hover:bg-surface-card border border-border-hairline text-text-muted hover:text-status-critical transition-all" title="Detener Contenedor">
                    <span className="material-symbols-outlined text-[15px]">pause</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Table Footer Summary Bar */}
      <div className="p-space-sm bg-surface-container-lowest/90 border-t border-border-hairline/70 flex flex-col sm:flex-row items-center justify-between gap-space-xs font-mono text-[11px] text-text-muted">
        <div className="flex items-center gap-space-sm">
          <span>Monitoreo de aislamiento cgroups v2 activo</span>
          <span className="text-text-dim">•</span>
          <span>Límite de memoria global: 15.8 GB</span>
        </div>
        <div className="flex items-center gap-1.5 text-primary">
          <span className="material-symbols-outlined text-[15px]">security</span>
          <span>Escaneo de imágenes Trivy: 0 CVEs Críticos detectados</span>
        </div>
      </div>
    </div>
  );
}
