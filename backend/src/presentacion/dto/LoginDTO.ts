import { z } from 'zod';

export const esquemaLogin = z.object({
  nombreUsuario: z
    .string({ error: 'El nombre de usuario es obligatorio' })
    .trim()
    .min(1, 'El nombre de usuario es obligatorio')
    .max(100, 'El nombre de usuario no puede superar 100 caracteres'),
  contrasena: z
    .string({ error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria')
    .max(200, 'La contraseña excede la longitud permitida'),
});

export const esquemaVerificar2FA = z.object({
  tokenTemporal2FA: z.string({ error: 'Token temporal requerido' }).min(10),
  codigo: z
    .string({ error: 'El código de verificación es obligatorio' })
    .trim()
    .min(6, 'El código debe tener al menos 6 caracteres')
    .max(16, 'Código demasiado largo'),
  recordarDispositivo: z.boolean().default(false),
  etiquetaDispositivo: z.string().trim().max(150).optional(),
});

export const esquemaConfirmar2FA = z.object({
  codigo: z
    .string({ error: 'El código de 6 dígitos es obligatorio' })
    .trim()
    .regex(/^\d{6}$/, 'El código debe contener exactamente 6 dígitos'),
});

export const esquemaDesactivar2FA = z
  .object({
    contrasena: z.string().trim().max(200).optional(),
    codigoRecuperacion: z.string().trim().max(32).optional(),
  })
  .refine(
    (datos) =>
      Boolean(datos.contrasena && datos.contrasena.length > 0) ||
      Boolean(datos.codigoRecuperacion && datos.codigoRecuperacion.length > 0),
    {
      message: 'Debes ingresar tu contraseña actual o un código de recuperación válido',
    },
  );

export const esquemaParametroUuid = z.object({
  id: z.string().uuid('Identificador de dispositivo inválido'),
});

export type LoginDTO = z.infer<typeof esquemaLogin>;
export type Verificar2FADTO = z.infer<typeof esquemaVerificar2FA>;
export type Confirmar2FADTO = z.infer<typeof esquemaConfirmar2FA>;
export type Desactivar2FADTO = z.infer<typeof esquemaDesactivar2FA>;
