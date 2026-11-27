import { z } from 'zod';

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET debe tener al menos 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET debe tener al menos 16 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  SEED_ADMIN_USER: z.string().trim().min(1).default('admin'),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  DISCOS_MONITOREADOS: z.string().trim().min(1).default('Sistema:/'),
  ENCRYPTION_KEY: z
    .string()
    .min(16, 'ENCRYPTION_KEY debe tener al menos 16 caracteres')
    .default('dev_fallback_encryption_key_change_me'),
  REDES_CONFIABLES_CIDR: z
    .string()
    .trim()
    .min(1)
    .default('127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'),
  DIAS_DISPOSITIVO_CONFIABLE: z.coerce.number().int().min(1).max(365).default(30),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().min(1).max(100).default(5),
  RATE_LIMIT_LOGIN_VENTANA_MIN: z.coerce.number().int().min(1).max(120).default(15),
  RATE_LIMIT_API_MAX: z.coerce.number().int().min(10).max(5000).default(300),
  RUTA_AUTH_LOG: z.string().trim().min(1).default('./fixtures/auth.log'),
  UMBRAL_FUERZA_BRUTA_SSH: z.coerce.number().int().min(2).max(100).default(5),
  VENTANA_FUERZA_BRUTA_MIN: z.coerce.number().int().min(1).max(1440).default(15),
  TELEGRAM_TOKEN: z.string().trim().default('dummy'),
  TELEGRAM_CHAT_ID: z.string().trim().default('dummy_chat'),
  WEBHOOK_ALERTAS_URL: z.string().trim().default(''),
  WEBHOOK_ALERTAS_SECRET: z.string().trim().default(''),
  PIHOLE_MODO: z.enum(['simulacion', 'real']).default('simulacion'),
  PIHOLE_API_URL: z.string().trim().default('http://host.docker.internal:80/api'),
  PIHOLE_API_PASSWORD: z.string().trim().default(''),
  GITHUB_MODO: z.enum(['simulacion', 'real']).default('simulacion'),
  DESPLIEGUE_MODO: z.enum(['simulacion', 'real']).default('simulacion'),
  GITHUB_OAUTH_CLIENT_ID: z.string().trim().default(''),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().trim().default(''),
  GITHUB_WEBHOOK_SECRET: z
    .string()
    .trim()
    .min(8)
    .default('dev_github_webhook_secret_change_me'),
  GITHUB_POLLING_INTERVALO_SEG: z.coerce.number().int().min(30).max(3600).default(120),
  RUTA_ACTUALIZACIONES_SO: z.string().trim().min(1).default('./fixtures/actualizaciones_so.txt'),
  ENERGIA_MODO: z.enum(['simulacion', 'real']).default('simulacion'),
  NOTIFICAR_ARRANQUE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  IA_PROVEEDOR: z.enum(['auto', 'nube', 'ollama', 'local']).default('auto'),
  IA_API_KEY: z.string().trim().default(''),
  IA_OLLAMA_URL: z.string().trim().default('http://host.docker.internal:11434'),
  IA_MODELO: z.string().trim().default('gemini-2.5-flash'),
});

export type ConfiguracionEntorno = z.infer<typeof esquemaEntorno>;

/** Valida y devuelve las variables de entorno requeridas al iniciar la aplicación. */
export function cargarConfiguracion(
  fuente: NodeJS.ProcessEnv = process.env,
): ConfiguracionEntorno {
  const resultado = esquemaEntorno.safeParse(fuente);

  if (!resultado.success) {
    const detalles = resultado.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración de entorno inválida: ${detalles}`);
  }

  return resultado.data;
}
