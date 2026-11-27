-- Migración 006: Fase 3a — Conexión con GitHub (RF-28, RF-29)
-- El Personal Access Token se guarda cifrado (AES-256-GCM); nunca en texto plano.

CREATE TABLE IF NOT EXISTS conexion_github (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  usuario_github VARCHAR(100) NOT NULL,
  token_cifrado TEXT NOT NULL,
  alcances VARCHAR(255) NOT NULL DEFAULT '',
  modo VARCHAR(20) NOT NULL DEFAULT 'real' CHECK (modo IN ('real', 'simulacion')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
