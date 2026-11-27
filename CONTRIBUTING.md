# Guía de Contribución — HomeSOC

¡Gracias por tu interés en contribuir a **HomeSOC**!

## Arquitectura y convenciones

1. **Arquitectura en 4 capas (Clean Architecture):**
   - `backend/src/dominio`: entidades, reglas puras, errores de dominio e interfaces (puertos). Sin dependencias de Express ni PostgreSQL.
   - `backend/src/aplicacion`: casos de uso con dependencias inyectadas por constructor.
   - `backend/src/infraestructura`: adaptadores de PostgreSQL, Docker, sistema, GitHub y notificadores.
   - `backend/src/presentacion`: controladores HTTP, middlewares y esquemas Zod.
2. **Idioma:** tablas, columnas, entidades de dominio, variables de negocio y mensajes de commit en **español**.
3. **Seguridad obligatoria:**
   - Queries SQL siempre parametrizadas (`$1`, `$2`, ...).
   - Validación de toda entrada HTTP con Zod.
   - Secretos cifrados en reposo (AES-256-GCM) y jamás expuestos en logs ni respuestas.
   - Nunca commitear archivos `.env` ni credenciales reales.
4. **Tests y calidad:**
   - Todo caso de uso nuevo debe incluir pruebas unitarias en `backend/tests/unitarias/`.
   - Ejecuta `npm run build && npm test` en `backend/` y `bun run lint` en `frontend/` antes de abrir un Pull Request.
5. **Mensajes de commit:** seguir [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `test:`, `security:`, `docs:`).
