-- Migración 009: Fase 4 — Automatización de servicios y reglas condición-acción (RF-51 a RF-53)

CREATE TABLE IF NOT EXISTS automatizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(140) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('horario', 'condicion')),
  configuracion JSONB NOT NULL,
  habilitado BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automatizaciones_log (
  id BIGSERIAL PRIMARY KEY,
  automatizacion_id UUID NOT NULL REFERENCES automatizaciones(id) ON DELETE CASCADE,
  resultado VARCHAR(20) NOT NULL CHECK (resultado IN ('exitoso', 'error')),
  detalle TEXT NOT NULL,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automatizaciones_log_fecha
  ON automatizaciones_log (fecha_hora DESC);

-- Semilla inicial de reglas de demostración en entorno local si la tabla está vacía
INSERT INTO automatizaciones (nombre, tipo, configuracion, habilitado)
SELECT * FROM (
  VALUES
    (
      'Apagado nocturno de test-nginx',
      'horario',
      '{"contenedorNombre":"test-nginx","accion":"detener","hora":"23:30","diasSemana":[1,2,3,4,5]}'::jsonb,
      TRUE
    ),
    (
      'Encendido matutino de test-nginx',
      'horario',
      '{"contenedorNombre":"test-nginx","accion":"iniciar","hora":"07:30","diasSemana":[1,2,3,4,5]}'::jsonb,
      TRUE
    ),
    (
      'Alerta por CPU del host superior al 85%',
      'condicion',
      '{"metrica":"cpu_porcentaje","operador":">","umbral":85,"accion":"notificar"}'::jsonb,
      TRUE
    )
) AS semilla(nombre, tipo, configuracion, habilitado)
WHERE NOT EXISTS (SELECT 1 FROM automatizaciones LIMIT 1);
