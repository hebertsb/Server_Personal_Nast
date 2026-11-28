-- Migración 016: Contacto de notificación por usuario (Telegram Chat ID y WhatsApp)
-- Permite enrutamiento dinámico de tickets y alertas desde un único flujo n8n.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_numero VARCHAR(32) NOT NULL DEFAULT '';
