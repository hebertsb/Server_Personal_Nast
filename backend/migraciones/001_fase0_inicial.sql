-- Migración 001: Esquema inicial Fase 0 (MVP) de HomeSOC
-- Todas las tablas y columnas siguen la convención en español definida en docs/HomeSOC_Requerimientos.md

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_usuario VARCHAR(100) NOT NULL UNIQUE,
  hash_contrasena TEXT NOT NULL,
  rol VARCHAR(30) NOT NULL DEFAULT 'administrador'
    CHECK (rol IN ('administrador', 'solo_lectura')),
  secreto_totp TEXT NULL,
  totp_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intentos_inicio_sesion (
  id BIGSERIAL PRIMARY KEY,
  nombre_usuario VARCHAR(100) NOT NULL,
  direccion_ip VARCHAR(45) NOT NULL,
  exitoso BOOLEAN NOT NULL,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intentos_inicio_sesion_fecha
  ON intentos_inicio_sesion (fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_intentos_inicio_sesion_ip_fecha
  ON intentos_inicio_sesion (direccion_ip, fecha_hora DESC);

CREATE TABLE IF NOT EXISTS contenedores_snapshot (
  id BIGSERIAL PRIMARY KEY,
  nombre_contenedor VARCHAR(255) NOT NULL,
  estado VARCHAR(50) NOT NULL,
  porcentaje_cpu NUMERIC(6, 2) NOT NULL DEFAULT 0,
  ram_mb NUMERIC(10, 2) NOT NULL DEFAULT 0,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contenedores_snapshot_nombre_fecha
  ON contenedores_snapshot (nombre_contenedor, fecha_hora DESC);

CREATE TABLE IF NOT EXISTS recursos_host_snapshot (
  id BIGSERIAL PRIMARY KEY,
  porcentaje_cpu NUMERIC(5, 2) NOT NULL,
  ram_usada_mb NUMERIC(10, 2) NOT NULL,
  ram_total_mb NUMERIC(10, 2) NOT NULL,
  temperatura_c NUMERIC(5, 2) NULL,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recursos_host_snapshot_fecha
  ON recursos_host_snapshot (fecha_hora DESC);

CREATE TABLE IF NOT EXISTS auditoria_acciones (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  accion VARCHAR(100) NOT NULL,
  recurso VARCHAR(255) NOT NULL,
  origen VARCHAR(30) NOT NULL DEFAULT 'web',
  direccion_ip VARCHAR(45) NULL,
  detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_acciones_fecha
  ON auditoria_acciones (fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_acciones_usuario_fecha
  ON auditoria_acciones (usuario_id, fecha_hora DESC);
