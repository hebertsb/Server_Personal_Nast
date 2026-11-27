-- Migración 010: Fase 4 ampliada — Auto-healing, limpieza Docker, heartbeat, actualizaciones, energía y edición

ALTER TABLE automatizaciones
  DROP CONSTRAINT IF EXISTS automatizaciones_tipo_check;

ALTER TABLE automatizaciones
  ADD CONSTRAINT automatizaciones_tipo_check
  CHECK (tipo IN (
    'horario',
    'condicion',
    'auto_healing',
    'limpieza_docker',
    'heartbeat',
    'actualizaciones',
    'energia'
  ));

ALTER TABLE automatizaciones
  ADD COLUMN IF NOT EXISTS descripcion TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS canal_notificacion VARCHAR(30) NOT NULL DEFAULT 'panel'
    CHECK (canal_notificacion IN ('panel', 'telegram', 'email', 'webhook')),
  ADD COLUMN IF NOT EXISTS ultima_ejecucion_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_resultado VARCHAR(20)
    CHECK (ultimo_resultado IN ('exitoso', 'error')),
  ADD COLUMN IF NOT EXISTS proxima_ejecucion_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enfriamiento_hasta TIMESTAMPTZ;

-- Habilitar canales de notificación por defecto para arranque del servidor, automatizaciones y despliegues
INSERT INTO configuracion_notificaciones (tipo_evento, canal, destino, habilitado)
VALUES
  ('servidor_arranque', 'telegram', 'chat_local_dev', TRUE),
  ('alerta_recurso', 'telegram', 'chat_local_dev', TRUE),
  ('auto_healing', 'telegram', 'chat_local_dev', TRUE),
  ('auto_healing_critico', 'telegram', 'chat_local_dev', TRUE),
  ('energia_corte_luz', 'telegram', 'chat_local_dev', TRUE),
  ('energia_bateria_critica', 'telegram', 'chat_local_dev', TRUE),
  ('aviso_actualizaciones', 'telegram', 'chat_local_dev', TRUE),
  ('gate_seguridad_bloqueado', 'telegram', 'chat_local_dev', TRUE),
  ('despliegue_rollback_automatico', 'telegram', 'chat_local_dev', TRUE)
ON CONFLICT (tipo_evento, canal) DO NOTHING;
