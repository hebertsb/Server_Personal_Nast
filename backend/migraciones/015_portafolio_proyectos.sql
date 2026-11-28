-- Migración 015: Portafolio de Proyectos, Sub-componentes (Sistema/Landing/Demo/API/BD) y Pendientes

CREATE TABLE IF NOT EXISTS portafolio_proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(120) NOT NULL UNIQUE,
  descripcion TEXT NOT NULL DEFAULT '',
  prefijo_contenedor VARCHAR(80) NOT NULL DEFAULT '',
  estado VARCHAR(30) NOT NULL DEFAULT 'en_desarrollo'
    CHECK (estado IN ('en_desarrollo', 'en_produccion', 'pausado')),
  repositorio_url TEXT NOT NULL DEFAULT '',
  creado_por VARCHAR(80) NOT NULL DEFAULT 'sistema',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portafolio_componentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES portafolio_proyectos(id) ON DELETE CASCADE,
  tipo VARCHAR(30) NOT NULL DEFAULT 'sistema'
    CHECK (tipo IN ('sistema', 'landing', 'demo', 'api', 'bd', 'otro')),
  nombre VARCHAR(120) NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  contenedor_nombre VARCHAR(120) NOT NULL DEFAULT '',
  estado_manual VARCHAR(30) NOT NULL DEFAULT 'pendiente'
    CHECK (estado_manual IN ('activo', 'pendiente', 'caido', 'en_progreso')),
  responsable VARCHAR(80) NOT NULL DEFAULT '',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portafolio_tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES portafolio_proyectos(id) ON DELETE CASCADE,
  titulo VARCHAR(240) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_progreso', 'completado')),
  prioridad VARCHAR(20) NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('alta', 'media', 'baja')),
  asignado_a VARCHAR(80) NOT NULL DEFAULT '',
  actualizado_por VARCHAR(80) NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portafolio_componentes_proyecto
  ON portafolio_componentes (proyecto_id);

CREATE INDEX IF NOT EXISTS idx_portafolio_tareas_proyecto
  ON portafolio_tareas (proyecto_id, estado);
