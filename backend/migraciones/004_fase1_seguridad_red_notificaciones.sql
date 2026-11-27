-- Migración 004: Fase 1 — Seguridad (IPs bloqueadas) y Notificaciones (Observer / Telegram)
-- Nombres de tablas y columnas según docs/HomeSOC_Requerimientos.md sección 5

CREATE TABLE IF NOT EXISTS ips_bloqueadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direccion_ip VARCHAR(45) NOT NULL UNIQUE,
  motivo VARCHAR(255) NOT NULL,
  bloqueado_por VARCHAR(100) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ips_bloqueadas_creado
  ON ips_bloqueadas (creado_en DESC);

CREATE TABLE IF NOT EXISTS configuracion_notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_evento VARCHAR(60) NOT NULL,
  canal VARCHAR(30) NOT NULL CHECK (canal IN ('telegram', 'email', 'webhook')),
  destino VARCHAR(255) NOT NULL DEFAULT '',
  habilitado BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_config_notif_evento_canal UNIQUE (tipo_evento, canal)
);

CREATE TABLE IF NOT EXISTS alertas_enviadas (
  id BIGSERIAL PRIMARY KEY,
  tipo_evento VARCHAR(60) NOT NULL,
  mensaje TEXT NOT NULL,
  canal VARCHAR(30) NOT NULL,
  enviado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_enviadas_fecha
  ON alertas_enviadas (enviado_en DESC);

-- Configuración inicial por defecto para el canal Telegram
INSERT INTO configuracion_notificaciones (tipo_evento, canal, destino, habilitado)
VALUES
  ('fuerza_bruta_ssh', 'telegram', 'chat_local_simulado', TRUE),
  ('2fa_fallido_externo', 'telegram', 'chat_local_simulado', TRUE),
  ('rate_limit_login', 'telegram', 'chat_local_simulado', TRUE),
  ('ip_bloqueada', 'telegram', 'chat_local_simulado', TRUE)
ON CONFLICT (tipo_evento, canal) DO NOTHING;

GRANT SELECT ON TABLE
  ips_bloqueadas,
  configuracion_notificaciones,
  alertas_enviadas
TO homesoc_lector;
