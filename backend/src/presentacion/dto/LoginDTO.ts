import { z } from 'zod';

const esquemaNombreUsuarioNuevo = z
  .string({ error: 'El nombre de usuario es obligatorio' })
  .trim()
  .min(3, 'El usuario debe tener al menos 3 caracteres')
  .max(60, 'El usuario no puede superar 60 caracteres')
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'El usuario solo puede contener letras, números, puntos, guiones y guion bajo',
  );

const esquemaContrasenaFuerte = z
  .string({ error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(200, 'La contraseña excede la longitud permitida')
  .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
  .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula')
  .regex(/\d/, 'Debe incluir al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un símbolo (ej. @, #, $, _, -)');

const esquemaRecordarDias = z
  .number()
  .int()
  .refine((v) => v === 0 || v === 1 || v === 7 || v === 30, {
    message: 'Duración de sesión inválida',
  })
  .optional()
  .default(7);

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
  recordarSesionDias: esquemaRecordarDias,
});

export const esquemaSetupInicial = z.object({
  nombreUsuario: esquemaNombreUsuarioNuevo,
  contrasena: esquemaContrasenaFuerte,
  recordarSesionDias: esquemaRecordarDias,
});

export const esquemaRegistroInvitacion = z.object({
  tokenInvitacion: z
    .string({ error: 'El token de invitación es obligatorio' })
    .trim()
    .min(10, 'Token de invitación inválido')
    .max(120, 'Token de invitación demasiado largo'),
  nombreUsuario: esquemaNombreUsuarioNuevo,
  contrasena: esquemaContrasenaFuerte,
  recordarSesionDias: esquemaRecordarDias,
});

export const esquemaRegistroPublico = z.object({
  nombreUsuario: esquemaNombreUsuarioNuevo,
  contrasena: esquemaContrasenaFuerte,
  whatsappNumero: z
    .string()
    .trim()
    .max(30, 'Número de WhatsApp demasiado largo')
    .regex(/^[0-9+\s-]*$/, 'Usa solo números (ej. 59173655782)')
    .optional()
    .default(''),
  telegramChatId: z
    .string()
    .trim()
    .max(40, 'Chat ID de Telegram demasiado largo')
    .regex(/^[0-9-]*$/, 'El Chat ID de Telegram debe ser numérico')
    .optional()
    .default(''),
  recordarSesionDias: esquemaRecordarDias,
});

export const esquemaRecuperarTotp = z.object({
  nombreUsuario: z
    .string({ error: 'El nombre de usuario es obligatorio' })
    .trim()
    .min(1, 'El nombre de usuario es obligatorio')
    .max(100),
  codigo: z
    .string({ error: 'El código 2FA es obligatorio' })
    .trim()
    .min(6, 'El código 2FA debe tener al menos 6 caracteres')
    .max(16, 'Código demasiado largo'),
  nuevaContrasena: esquemaContrasenaFuerte,
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
  id: z.string().uuid('Identificador inválido'),
});

export type LoginDTO = z.infer<typeof esquemaLogin>;
export type SetupInicialDTO = z.infer<typeof esquemaSetupInicial>;
export type RegistroInvitacionDTO = z.infer<typeof esquemaRegistroInvitacion>;
export type RegistroPublicoDTO = z.infer<typeof esquemaRegistroPublico>;
export type RecuperarTotpDTO = z.infer<typeof esquemaRecuperarTotp>;
export type Verificar2FADTO = z.infer<typeof esquemaVerificar2FA>;
export type Confirmar2FADTO = z.infer<typeof esquemaConfirmar2FA>;
export type Desactivar2FADTO = z.infer<typeof esquemaDesactivar2FA>;
