-- Migración 012: Gestión de usuarios, roles granulares, permisos por módulo e invitaciones temporales

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('superadmin', 'administrador', 'colaborador', 'solo_lectura'));

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS permisos_modulos JSONB NOT NULL DEFAULT '["recursos","servicios","red","seguridad","automatizacion","configuracion","usuarios","ia"]'::jsonb,
  ADD COLUMN IF NOT EXISTS ultimo_acceso_en TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS ultima_ip_acceso VARCHAR(45) NULL,
  ADD COLUMN IF NOT EXISTS version_sesion INTEGER NOT NULL DEFAULT 1;

-- Promover el primer usuario existente a superadmin si todavía no hay ninguno (compatibilidad dev/upgrade)
UPDATE usuarios
SET rol = 'superadmin',
    permisos_modulos = '["recursos","servicios","red","seguridad","automatizacion","configuracion","usuarios","ia"]'::jsonb
WHERE id = (SELECT id FROM usuarios ORDER BY creado_en ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM usuarios WHERE rol = 'superadmin');

CREATE TABLE IF NOT EXISTS invitaciones_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  prefijo_token VARCHAR(16) NOT NULL,
  rol VARCHAR(30) NOT NULL
    CHECK (rol IN ('administrador', 'colaborador', 'solo_lectura')),
  permisos_modulos JSONB NOT NULL DEFAULT '["recursos","servicios"]'::jsonb,
  nota VARCHAR(200) NULL,
  creado_por_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  usado_en TIMESTAMPTZ NULL,
  usado_por_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  revocada BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitaciones_usuario_hash
  ON invitaciones_usuario (token_hash);

CREATE INDEX IF NOT EXISTS idx_invitaciones_usuario_creado
  ON invitaciones_usuario (creado_en DESC);
