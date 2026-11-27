import { Logger } from 'pino';
import { ConfiguracionEntorno } from '../../config/env';
import { RepositorioUsuarios } from '../../dominio/interfaces/RepositorioUsuarios';
import { ServicioHashContrasena } from '../../dominio/interfaces/ServicioHashContrasena';

/**
 * Crea un usuario administrador inicial en entorno de desarrollo si aún no existe.
 * Nunca se ejecuta en producción ni registra contraseñas en logs.
 */
export async function ejecutarSeedDesarrollo(
  config: ConfiguracionEntorno,
  repositorioUsuarios: RepositorioUsuarios,
  servicioHash: ServicioHashContrasena,
  logger: Logger,
): Promise<void> {
  if (config.NODE_ENV !== 'development') {
    return;
  }

  const usuarioExistente = await repositorioUsuarios.buscarPorNombreUsuario(
    config.SEED_ADMIN_USER,
  );

  if (usuarioExistente) {
    logger.debug(
      { nombreUsuario: config.SEED_ADMIN_USER },
      'Usuario administrador inicial ya existe; se omite seed de desarrollo',
    );
    return;
  }

  if (!config.SEED_ADMIN_PASSWORD) {
    logger.warn(
      'SEED_ADMIN_PASSWORD no está configurada; no se creó el usuario administrador inicial',
    );
    return;
  }

  const hashContrasena = await servicioHash.generarHash(config.SEED_ADMIN_PASSWORD);

  await repositorioUsuarios.crear({
    nombreUsuario: config.SEED_ADMIN_USER,
    hashContrasena,
    rol: 'administrador',
  });

  logger.info(
    { nombreUsuario: config.SEED_ADMIN_USER, rol: 'administrador' },
    'Usuario administrador inicial creado automáticamente en modo desarrollo',
  );
}
