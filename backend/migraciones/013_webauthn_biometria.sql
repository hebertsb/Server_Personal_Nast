-- Migración 013: Credenciales biométricas WebAuthn / Passkeys (Huella Digital, Face ID, Windows Hello)

CREATE TABLE IF NOT EXISTS credenciales_biometricas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  credencial_id TEXT NOT NULL UNIQUE,
  clave_publica TEXT NOT NULL,
  contador BIGINT NOT NULL DEFAULT 0,
  transports JSONB NOT NULL DEFAULT '[]'::jsonb,
  etiqueta_dispositivo VARCHAR(150) NOT NULL DEFAULT 'Dispositivo biométrico',
  ultimo_uso_en TIMESTAMPTZ NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credenciales_biometricas_usuario
  ON credenciales_biometricas (usuario_id, creado_en DESC);
