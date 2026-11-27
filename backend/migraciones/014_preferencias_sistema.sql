-- Migración 014: Preferencias globales sincronizadas del sistema (ej. Editor Remoto VS Code Web)

CREATE TABLE IF NOT EXISTS preferencias_sistema (
  clave VARCHAR(100) PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
