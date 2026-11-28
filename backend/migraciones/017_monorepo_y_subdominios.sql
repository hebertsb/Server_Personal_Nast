-- Migración 017: Soporte de Monorepos/Microservicios (carpeta_raiz) y Subdominios (PaaS)

ALTER TABLE repositorios_conectados
  ADD COLUMN IF NOT EXISTS carpeta_raiz VARCHAR(200) NOT NULL DEFAULT '/',
  ADD COLUMN IF NOT EXISTS subdominio VARCHAR(120) NOT NULL DEFAULT '';
