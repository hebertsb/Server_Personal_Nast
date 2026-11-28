-- Migración 020: Ciclo de facturación anual y porcentaje de descuento por plan

ALTER TABLE planes_hosting
  ADD COLUMN IF NOT EXISTS descuento_anual_pct INTEGER NOT NULL DEFAULT 20
  CHECK (descuento_anual_pct >= 0 AND descuento_anual_pct <= 80);

ALTER TABLE solicitudes_suscripcion
  ADD COLUMN IF NOT EXISTS ciclo_facturacion VARCHAR(20) NOT NULL DEFAULT 'mensual'
  CHECK (ciclo_facturacion IN ('mensual', 'anual'));
