-- Migración 002: Fase 0.5 — Autenticación reforzada (2FA TOTP condicional, dispositivos confiables y eventos de seguridad)

CREATE TABLE IF NOT EXISTS dispositivos_confiables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  huella_dispositivo VARCHAR(128) NOT NULL,
  etiqueta_dispositivo VARCHAR(150) NOT NULL,
  ultima_ip VARCHAR(45) NOT NULL,
  confiable_hasta TIMESTAMPTZ NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dispositivo_usuario_huella UNIQUE (usuario_id, huella_dispositivo)
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_confiables_usuario
  ON dispositivos_confiables (usuario_id, confiable_hasta DESC);

CREATE TABLE IF NOT EXISTS codigos_recuperacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  hash_codigo TEXT NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_codigos_recuperacion_usuario
  ON codigos_recuperacion (usuario_id, usado);

CREATE TABLE IF NOT EXISTS eventos_seguridad (
  id BIGSERIAL PRIMARY KEY,
  tipo_evento VARCHAR(60) NOT NULL,
  ip_origen VARCHAR(45) NOT NULL,
  detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
  severidad VARCHAR(20) NOT NULL DEFAULT 'media'
    CHECK (severidad IN ('baja', 'media', 'alta', 'critica')),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_seguridad_fecha
  ON eventos_seguridad (fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_eventos_seguridad_tipo_ip
  ON eventos_seguridad (tipo_evento, ip_origen, fecha_hora DESC);
