import { z } from 'zod';

export const esquemaParametroContenedor = z.object({
  id: z
    .string({ error: 'El identificador del contenedor es obligatorio' })
    .trim()
    .min(1, 'El identificador del contenedor es obligatorio')
    .max(128, 'Identificador de contenedor demasiado largo')
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
      'El identificador del contenedor contiene caracteres no permitidos',
    ),
});

export const esquemaConsultaLogs = z.object({
  lineas: z.coerce
    .number()
    .int('El parámetro lineas debe ser un número entero')
    .min(1, 'Debe solicitar al menos 1 línea de log')
    .max(500, 'El máximo permitido por consulta es 500 líneas')
    .default(100),
});
