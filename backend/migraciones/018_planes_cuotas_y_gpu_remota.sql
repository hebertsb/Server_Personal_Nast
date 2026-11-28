-- Migración 018: Planes/Cuotas por usuario (Multi-Tenant SaaS) y Modo GPU Remota (BYO-GPU)

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS plan_nombre VARCHAR(40) NOT NULL DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS cuota_ram_mb INTEGER NOT NULL DEFAULT 512,
  ADD COLUMN IF NOT EXISTS cuota_cpu NUMERIC(4,2) NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS max_proyectos INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS ia_basica_habilitada BOOLEAN NOT NULL DEFAULT FALSE;

-- El superadmin recibe cuota amplia por defecto
UPDATE usuarios
SET plan_nombre = 'ilimitado',
    cuota_ram_mb = 4096,
    cuota_cpu = 4.00,
    max_proyectos = 50,
    ia_basica_habilitada = TRUE
WHERE rol = 'superadmin';

ALTER TABLE repositorios_conectados
  ADD COLUMN IF NOT EXISTS gpu_remota_url TEXT NOT NULL DEFAULT '';
