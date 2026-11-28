-- Migración 019: Catálogo de Planes de Hosting (SaaS) y Solicitudes de Suscripción (QR/Transferencia/Efectivo)

CREATE TABLE IF NOT EXISTS planes_hosting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  precio_bs NUMERIC(10,2) NOT NULL DEFAULT 0,
  periodo VARCHAR(30) NOT NULL DEFAULT 'mes',
  cuota_ram_mb INTEGER NOT NULL DEFAULT 512,
  cuota_cpu NUMERIC(4,2) NOT NULL DEFAULT 0.50,
  max_proyectos INTEGER NOT NULL DEFAULT 2,
  ia_basica_habilitada BOOLEAN NOT NULL DEFAULT FALSE,
  beneficios JSONB NOT NULL DEFAULT '[]'::jsonb,
  destacado BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  orden INTEGER NOT NULL DEFAULT 10,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitudes_suscripcion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_usuario VARCHAR(80) NOT NULL,
  plan_id UUID NOT NULL REFERENCES planes_hosting(id) ON DELETE CASCADE,
  plan_nombre VARCHAR(120) NOT NULL,
  monto_bs NUMERIC(10,2) NOT NULL DEFAULT 0,
  metodo_pago VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('qr', 'transferencia', 'efectivo')),
  referencia_pago VARCHAR(200) NOT NULL DEFAULT '',
  nota_cliente TEXT NOT NULL DEFAULT '',
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  revisado_por VARCHAR(80) NOT NULL DEFAULT '',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_suscripcion_usuario
  ON solicitudes_suscripcion (usuario_id, creado_en DESC);

-- Planes iniciales sugeridos para estudiantes (editables y eliminables desde el panel Superadmin)
INSERT INTO planes_hosting (codigo, nombre, descripcion, precio_bs, periodo, cuota_ram_mb, cuota_cpu, max_proyectos, ia_basica_habilitada, beneficios, destacado, activo, orden)
VALUES
  (
    'basico',
    'Plan Estudiante Básico',
    'Ideal para proyectos de materias, landing pages, APIs REST y sistemas web académicos.',
    20,
    'mes',
    512,
    0.50,
    2,
    FALSE,
    '["Hasta 2 proyectos desplegados","512 MB RAM y 0.5 vCPU por servicio","Despliegue directo desde GitHub + HTTPS","Modo GPU Remota (BYO-GPU) incluido","Soporte para Node.js, Python, PHP, Rust y Docker"]'::jsonb,
    FALSE,
    TRUE,
    1
  ),
  (
    'pro',
    'Plan Full-Stack Pro',
    'Pensado para sistemas completos con backend, frontend, microservicios y modelos de IA ligeros.',
    35,
    'mes',
    1024,
    1.00,
    4,
    TRUE,
    '["Hasta 4 proyectos o microservicios","1 GB RAM y 1.0 vCPU por servicio","Incluye modelos de IA ligeros en el servidor","Modo GPU Remota para modelos pesados (Llama/Whisper)","Reporte Antes vs. Después a Telegram"]'::jsonb,
    TRUE,
    TRUE,
    2
  ),
  (
    'ia_especial',
    'Plan IA & Tesis',
    'Mayor memoria y CPU dedicada para tesis, procesamiento de datos y modelos locales medianos.',
    60,
    'mes',
    2048,
    2.00,
    6,
    TRUE,
    '["Hasta 6 proyectos o microservicios","2 GB RAM y 2.0 vCPU por servicio","Modelos de IA ligeros/medianos habilitados","Modo GPU Remota prioritario para defensas","Backups y soporte prioritario"]'::jsonb,
    FALSE,
    TRUE,
    3
  )
ON CONFLICT (codigo) DO NOTHING;
