-- Migración 007: Fase 3b — Proyectos desplegados, variables cifradas e historial (RF-30..31, RF-34..39)

CREATE TABLE IF NOT EXISTS repositorios_conectados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  repo_github_id BIGINT NOT NULL,
  nombre_proyecto VARCHAR(120) NOT NULL UNIQUE,
  nombre_completo VARCHAR(200) NOT NULL UNIQUE,
  rama VARCHAR(100) NOT NULL DEFAULT 'main',
  puerto INTEGER NOT NULL CHECK (puerto BETWEEN 1024 AND 65535),
  tipo_proyecto VARCHAR(30) NOT NULL CHECK (tipo_proyecto IN ('dockerfile', 'nodejs', 'html_estatico')),
  modo_actualizacion VARCHAR(20) NOT NULL DEFAULT 'polling' CHECK (modo_actualizacion IN ('webhook', 'polling')),
  requiere_aprobacion BOOLEAN NOT NULL DEFAULT FALSE,
  ultimo_commit_sha VARCHAR(40),
  estado_actual VARCHAR(30) NOT NULL DEFAULT 'configurado'
    CHECK (estado_actual IN ('configurado', 'desplegando', 'activo', 'fallido', 'pendiente_aprobacion')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS variables_entorno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repositorio_id UUID NOT NULL REFERENCES repositorios_conectados(id) ON DELETE CASCADE,
  clave VARCHAR(120) NOT NULL,
  valor_cifrado TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_variable_repositorio_clave UNIQUE (repositorio_id, clave)
);

CREATE INDEX IF NOT EXISTS idx_variables_entorno_repo
  ON variables_entorno (repositorio_id);

CREATE TABLE IF NOT EXISTS despliegues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repositorio_id UUID NOT NULL REFERENCES repositorios_conectados(id) ON DELETE CASCADE,
  commit_sha VARCHAR(40) NOT NULL,
  origen VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (origen IN ('manual', 'webhook', 'polling', 'rollback', 'mcp')),
  estado VARCHAR(30) NOT NULL
    CHECK (estado IN ('exitoso', 'fallido', 'pendiente_aprobacion', 'revertido')),
  log_construccion TEXT NOT NULL DEFAULT '',
  duracion_ms INTEGER NOT NULL DEFAULT 0,
  ejecutado_por VARCHAR(100) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despliegues_repositorio_fecha
  ON despliegues (repositorio_id, creado_en DESC);
