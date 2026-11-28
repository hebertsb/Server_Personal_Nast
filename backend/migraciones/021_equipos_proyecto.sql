-- Migración 021: Equipos y colaboradores por proyecto desplegado (grupos universitarios)

CREATE TABLE IF NOT EXISTS equipo_proyecto_miembros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repositorio_id UUID NOT NULL REFERENCES repositorios_conectados(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_equipo VARCHAR(20) NOT NULL DEFAULT 'colaborador' CHECK (rol_equipo IN ('colaborador', 'lectura')),
  agregado_por VARCHAR(80) NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (repositorio_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_equipo_proyecto_usuario
  ON equipo_proyecto_miembros (usuario_id);

CREATE INDEX IF NOT EXISTS idx_equipo_proyecto_repo
  ON equipo_proyecto_miembros (repositorio_id);
