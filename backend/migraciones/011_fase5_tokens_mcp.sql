-- Migración 011: Fase 5 — Tokens del servidor MCP con permisos acotados (RF-63 a RF-65)
-- Solo se guarda el hash SHA-256 del token; nunca el token en texto plano.

CREATE TABLE IF NOT EXISTS tokens_mcp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(120) NOT NULL,
  prefijo VARCHAR(20) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  permiso VARCHAR(20) NOT NULL CHECK (permiso IN ('lectura', 'escritura')),
  ultimo_uso_en TIMESTAMPTZ,
  revocado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_mcp_hash
  ON tokens_mcp (token_hash)
  WHERE revocado = FALSE;
