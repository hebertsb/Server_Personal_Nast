export default function SensoresHardware() {
  return (
    <div className="xl:col-span-4 flex flex-col gap-space-md">
      {/* Network Traffic */}
      <div className="flex flex-col rounded-xl bg-surface-card border border-border-hairline shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-space-md border-b border-border-hairline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-text-dim">wifi_tethering</span>
            <h3 className="font-headline-sm font-semibold text-text-primary">Tráfico de Red</h3>
          </div>
          <span className="text-[10px] font-mono text-text-muted">eth0</span>
        </div>
        <div className="p-space-md flex flex-col gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between font-mono text-[11px] text-text-muted">
              <span>Descarga</span>
              <span className="text-secondary font-bold">14.2 MB/s</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
              <div className="h-full bg-secondary" style={{ width: '45%' }}></div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between font-mono text-[11px] text-text-muted">
              <span>Subida</span>
              <span className="text-primary font-bold">2.8 MB/s</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: '15%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Sensors */}
      <div className="flex flex-col rounded-xl bg-surface-card border border-border-hairline shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="p-space-md border-b border-border-hairline flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-text-dim">device_thermostat</span>
            <h3 className="font-headline-sm font-semibold text-text-primary">Sensores de Hardware</h3>
          </div>
        </div>
        <div className="divide-y divide-border-hairline/40 font-mono text-[12px]">
          <div className="p-space-md flex items-center justify-between">
            <span className="text-text-muted">CPU Tdie</span>
            <span className="text-status-warning font-semibold">62.5°C</span>
          </div>
          <div className="p-space-md flex items-center justify-between">
            <span className="text-text-muted">CPU Tctl</span>
            <span className="text-status-warning font-semibold">62.5°C</span>
          </div>
          <div className="p-space-md flex items-center justify-between">
            <span className="text-text-muted">SSD NVMe</span>
            <span className="text-primary font-semibold">38.0°C</span>
          </div>
          <div className="p-space-md flex items-center justify-between">
            <span className="text-text-muted">Velocidad Ventilador</span>
            <span className="text-text-primary font-semibold">2150 RPM</span>
          </div>
        </div>
      </div>
    </div>
  );
}
