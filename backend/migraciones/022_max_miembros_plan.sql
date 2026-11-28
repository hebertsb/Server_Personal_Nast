-- Migración 022: Límite de miembros/colaboradores por equipo en cada plan de hosting

ALTER TABLE planes_hosting
  ADD COLUMN IF NOT EXISTS max_miembros INTEGER NOT NULL DEFAULT 5
  CHECK (max_miembros >= 1 AND max_miembros <= 50);

UPDATE planes_hosting SET max_miembros = 2 WHERE codigo = 'basico';
UPDATE planes_hosting SET max_miembros = 5 WHERE codigo = 'pro';
UPDATE planes_hosting SET max_miembros = 8 WHERE codigo = 'ia_especial';
