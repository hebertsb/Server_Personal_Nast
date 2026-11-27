import { z } from 'zod';

export const esquemaConsultaHistorico = z.object({
  rango: z.enum(['1h', '24h', '7d']).default('24h'),
});
