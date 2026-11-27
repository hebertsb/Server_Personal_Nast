-- Migración 003: Fase 0.7 — Endurecimiento de seguridad
-- 1) Inmutabilidad de auditoria_acciones (RNF-SEC-21)
-- 2) Row Level Security (RLS) en usuarios, dispositivos_confiables y codigos_recuperacion (RNF-SEC-11..13)
-- 3) Rol de mínimos privilegios homesoc_lector (sin permisos de escritura ni BYPASSRLS)

-- ============================================================================
-- 1. Inmutabilidad de auditoria_acciones (prohibido UPDATE o DELETE)
-- ============================================================================
CREATE OR REPLACE FUNCTION impedir_modificacion_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'La tabla auditoria_acciones es inmutable y no permite operaciones %', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_inmutable ON auditoria_acciones;
CREATE TRIGGER trg_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON auditoria_acciones
  FOR EACH ROW
  EXECUTE FUNCTION impedir_modificacion_auditoria();

-- ============================================================================
-- 2. Rol de mínimos privilegios para consultas con alcance restringido (RNF-SEC-12)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'homesoc_lector') THEN
    CREATE ROLE homesoc_lector NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO homesoc_lector;
GRANT SELECT ON TABLE
  usuarios,
  dispositivos_confiables,
  codigos_recuperacion,
  contenedores_snapshot,
  recursos_host_snapshot,
  eventos_seguridad,
  auditoria_acciones
TO homesoc_lector;

-- ============================================================================
-- 3. Row Level Security (RLS) en tablas sensibles (RNF-SEC-11)
-- ============================================================================

-- Tabla: usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_usuarios_lector_propio ON usuarios;
CREATE POLICY rls_usuarios_lector_propio ON usuarios
  FOR SELECT
  TO homesoc_lector
  USING (id::text = NULLIF(current_setting('app.usuario_actual_id', true), ''));

DROP POLICY IF EXISTS rls_usuarios_app ON usuarios;
CREATE POLICY rls_usuarios_app ON usuarios
  FOR ALL
  TO PUBLIC
  USING (
    current_user <> 'homesoc_lector'
    AND (
      COALESCE(NULLIF(current_setting('app.rol_actual', true), ''), 'sistema') IN ('administrador', 'sistema')
      OR id::text = NULLIF(current_setting('app.usuario_actual_id', true), '')
    )
  )
  WITH CHECK (
    current_user <> 'homesoc_lector'
    AND COALESCE(NULLIF(current_setting('app.rol_actual', true), ''), 'sistema') IN ('administrador', 'sistema')
  );

-- Tabla: dispositivos_confiables
ALTER TABLE dispositivos_confiables ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos_confiables FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_dispositivos_lector_propio ON dispositivos_confiables;
CREATE POLICY rls_dispositivos_lector_propio ON dispositivos_confiables
  FOR SELECT
  TO homesoc_lector
  USING (usuario_id::text = NULLIF(current_setting('app.usuario_actual_id', true), ''));

DROP POLICY IF EXISTS rls_dispositivos_app ON dispositivos_confiables;
CREATE POLICY rls_dispositivos_app ON dispositivos_confiables
  FOR ALL
  TO PUBLIC
  USING (
    current_user <> 'homesoc_lector'
    AND (
      COALESCE(NULLIF(current_setting('app.rol_actual', true), ''), 'sistema') IN ('administrador', 'sistema')
      OR usuario_id::text = NULLIF(current_setting('app.usuario_actual_id', true), '')
    )
  )
  WITH CHECK (
    current_user <> 'homesoc_lector'
    AND (
      COALESCE(NULLIF(current_setting('app.rol_actual', true), ''), 'sistema') IN ('administrador', 'sistema')
      OR usuario_id::text = NULLIF(current_setting('app.usuario_actual_id', true), '')
    )
  );

-- Tabla: codigos_recuperacion
ALTER TABLE codigos_recuperacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE codigos_recuperacion FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_codigos_lector_propio ON codigos_recuperacion;
CREATE POLICY rls_codigos_lector_propio ON codigos_recuperacion
  FOR SELECT
  TO homesoc_lector
  USING (usuario_id::text = NULLIF(current_setting('app.usuario_actual_id', true), ''));

DROP POLICY IF EXISTS rls_codigos_app ON codigos_recuperacion;
CREATE POLICY rls_codigos_app ON codigos_recuperacion
  FOR ALL
  TO PUBLIC
  USING (
    current_user <> 'homesoc_lector'
    AND (
      COALESCE(NULLIF(current_setting('app.rol_actual', true), ''), 'sistema') IN ('administrador', 'sistema')
      OR usuario_id::text = NULLIF(current_setting('app.usuario_actual_id', true), '')
    )
  )
  WITH CHECK (
    current_user <> 'homesoc_lector'
    AND (
      COALESCE(NULLIF(current_setting('app.rol_actual', true), ''), 'sistema') IN ('administrador', 'sistema')
      OR usuario_id::text = NULLIF(current_setting('app.usuario_actual_id', true), '')
    )
  );
