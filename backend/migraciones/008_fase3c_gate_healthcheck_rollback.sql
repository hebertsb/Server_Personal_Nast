-- Migración 008: Fase 3c — Gate de seguridad pre-deploy, health check y rollback (RF-32..33, RF-40..50)

ALTER TABLE despliegues
  ADD COLUMN IF NOT EXISTS health_check_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS log_health_check TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rollback_automatico BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS despliegue_origen_id UUID REFERENCES despliegues(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS escaneos_seguridad_despliegue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  despliegue_id UUID NOT NULL REFERENCES despliegues(id) ON DELETE CASCADE,
  tipo_escaneo VARCHAR(30) NOT NULL CHECK (tipo_escaneo IN ('secretos', 'dependencias', 'imagen')),
  herramienta VARCHAR(40) NOT NULL,
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('aprobado', 'advertencia', 'critico')),
  hallazgos_criticos INTEGER NOT NULL DEFAULT 0,
  resumen TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escaneos_despliegue_id
  ON escaneos_seguridad_despliegue (despliegue_id);
