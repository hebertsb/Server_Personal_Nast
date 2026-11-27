-- Migración 005: Fase 2 — Flujo de datos y analítica de accesos a proyectos desplegados (RF-16 a RF-19)
-- Nombre de tabla y columnas según docs/HomeSOC_Requerimientos.md sección 5

CREATE TABLE IF NOT EXISTS solicitudes_proyecto (
  id BIGSERIAL PRIMARY KEY,
  nombre_proyecto VARCHAR(120) NOT NULL,
  ip_origen VARCHAR(45) NOT NULL,
  ruta VARCHAR(500) NOT NULL,
  metodo VARCHAR(12) NOT NULL,
  codigo_estado INTEGER NOT NULL,
  user_agent VARCHAR(500) NOT NULL DEFAULT '',
  pais VARCHAR(40) NULL,
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_proyecto_fecha
  ON solicitudes_proyecto (fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_solicitudes_proyecto_nombre_fecha
  ON solicitudes_proyecto (nombre_proyecto, fecha_hora DESC);

GRANT SELECT ON TABLE solicitudes_proyecto TO homesoc_lector;

-- Datos semilla iniciales para pruebas locales (solo si la tabla está vacía)
INSERT INTO solicitudes_proyecto (nombre_proyecto, ip_origen, ruta, metodo, codigo_estado, user_agent, pais, fecha_hora)
SELECT * FROM (
  VALUES
    ('barberapp', '181.115.140.22', '/api/reservas', 'POST', 201, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'BO', NOW() - INTERVAL '45 minutes'),
    ('barberapp', '181.115.140.22', '/turnos/disponibles', 'GET', 200, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'BO', NOW() - INTERVAL '44 minutes'),
    ('barberapp', '190.186.42.10', '/', 'GET', 200, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0', 'BO', NOW() - INTERVAL '38 minutes'),
    ('barberapp', '200.87.110.55', '/servicios', 'GET', 200, 'Mozilla/5.0 (Linux; Android 14)', 'BO', NOW() - INTERVAL '30 minutes'),
    ('portafolio-personal', '186.136.80.19', '/', 'GET', 200, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4)', 'AR', NOW() - INTERVAL '25 minutes'),
    ('portafolio-personal', '186.136.80.19', '/proyectos/homesoc', 'GET', 200, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4)', 'AR', NOW() - INTERVAL '24 minutes'),
    ('portafolio-personal', '34.120.55.90', '/cv.pdf', 'GET', 200, 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0', 'US', NOW() - INTERVAL '18 minutes'),
    ('api-facturacion', '192.168.1.105', '/api/v1/facturas', 'GET', 200, 'HomeSOC-Client/1.0', 'LAN Local', NOW() - INTERVAL '12 minutes'),
    ('api-facturacion', '100.99.124.109', '/api/v1/facturas/emitir', 'POST', 201, 'HomeSOC-Client/1.0', 'Tailscale Mesh', NOW() - INTERVAL '8 minutes'),
    ('barberapp', '177.222.40.15', '/wp-admin', 'GET', 404, 'Mozilla/5.0 (compatible; Scanner/1.0)', 'BR', NOW() - INTERVAL '4 minutes')
) AS semilla(nombre_proyecto, ip_origen, ruta, metodo, codigo_estado, user_agent, pais, fecha_hora)
WHERE NOT EXISTS (SELECT 1 FROM solicitudes_proyecto LIMIT 1);
