import { describe, expect, it } from 'vitest';
import { ejecutarCadenaVerificacionDespliegue } from '../../../src/dominio/reglas/CadenaVerificacionDespliegue';

describe('CadenaVerificacionDespliegue (Chain of Responsibility)', () => {
  it('aprueba un repositorio con Dockerfile, sin .env y puerto libre', () => {
    const { verificacion, deteccion } = ejecutarCadenaVerificacionDespliegue({
      nombreCompleto: 'hebertsb/mi-app',
      rama: 'main',
      puerto: 4100,
      archivosRaiz: ['Dockerfile', '.dockerignore', 'package.json', 'src'],
    });

    expect(deteccion.tipoDetectado).toBe('dockerfile');
    expect(verificacion.aptoParaDesplegar).toBe(true);
    expect(verificacion.pasos).toHaveLength(5);
    expect(verificacion.pasos.every((p) => p.estado === 'aprobado')).toBe(true);
  });

  it('rechaza un repositorio sin Dockerfile/Node/HTML o con archivo .env expuesto', () => {
    const { verificacion } = ejecutarCadenaVerificacionDespliegue({
      nombreCompleto: 'hebertsb/discoclaro',
      rama: 'main',
      puerto: 3000,
      archivosRaiz: ['main.py', 'requirements.txt', '.env'],
    });

    expect(verificacion.aptoParaDesplegar).toBe(false);
    const rechazados = verificacion.pasos.filter((p) => p.estado === 'rechazado').map((p) => p.id);
    expect(rechazados).toContain('stack_dockerfile');
    expect(rechazados).toContain('seguridad_secretos');
    expect(rechazados).toContain('puerto_servidor');
  });
});
