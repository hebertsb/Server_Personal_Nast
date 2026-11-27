import { ResultadoDeteccionProyecto } from '../entidades/Despliegue';
import { detectarTipoProyecto } from './DetectorTipoProyecto';

export type EstadoPasoVerificacion = 'aprobado' | 'advertencia' | 'rechazado';

export interface PasoVerificacionDespliegue {
  id: string;
  nombre: string;
  estado: EstadoPasoVerificacion;
  detalle: string;
  recomendacion?: string;
}

export interface ContextoVerificacionDespliegue {
  nombreCompleto: string;
  rama: string;
  puerto: number;
  archivosRaiz: string[];
  deteccion: ResultadoDeteccionProyecto;
}

export interface ResultadoCadenaVerificacion {
  aptoParaDesplegar: boolean;
  resumen: string;
  pasos: PasoVerificacionDespliegue[];
}

const PUERTOS_RESERVADOS_HOMELAB = new Set([22, 53, 80, 443, 3000, 3001, 4000, 5432, 8000, 8443, 8444, 9443]);

/**
 * Eslabón base del patrón Chain of Responsibility (Cadena de Responsabilidad)
 * para validar paso a paso si un repositorio cumple las normas antes de desplegarse.
 */
abstract class EslabonVerificacion {
  private siguiente: EslabonVerificacion | null = null;

  public establecerSiguiente(eslabon: EslabonVerificacion): EslabonVerificacion {
    this.siguiente = eslabon;
    return eslabon;
  }

  public ejecutar(
    ctx: ContextoVerificacionDespliegue,
    acumulado: PasoVerificacionDespliegue[] = [],
  ): PasoVerificacionDespliegue[] {
    const paso = this.evaluar(ctx);
    acumulado.push(paso);
    if (this.siguiente) {
      return this.siguiente.ejecutar(ctx, acumulado);
    }
    return acumulado;
  }

  protected abstract evaluar(ctx: ContextoVerificacionDespliegue): PasoVerificacionDespliegue;
}

class EslabonContenidoRaiz extends EslabonVerificacion {
  protected evaluar(ctx: ContextoVerificacionDespliegue): PasoVerificacionDespliegue {
    if (ctx.archivosRaiz.length === 0) {
      return {
        id: 'contenido_raiz',
        nombre: '1. Estructura del repositorio',
        estado: 'rechazado',
        detalle: `La rama "${ctx.rama}" no devolvió archivos en la raíz.`,
        recomendacion: 'Verifica que el repositorio tenga commits y la rama principal exista.',
      };
    }
    return {
      id: 'contenido_raiz',
      nombre: '1. Estructura del repositorio',
      estado: 'aprobado',
      detalle: `${ctx.archivosRaiz.length} archivos detectados en la raíz (${ctx.rama}).`,
    };
  }
}

class EslabonStackYDockerfile extends EslabonVerificacion {
  protected evaluar(ctx: ContextoVerificacionDespliegue): PasoVerificacionDespliegue {
    if (!ctx.deteccion.tipoDetectado) {
      return {
        id: 'stack_dockerfile',
        nombre: '2. Dockerfile / Stack compatible',
        estado: 'rechazado',
        detalle: 'No se encontró Dockerfile, package.json (Node.js) ni index.html en la raíz.',
        recomendacion:
          'Agrega un Dockerfile en la raíz del repositorio para que HomeSOC pueda construir y ejecutar este proyecto.',
      };
    }
    if (ctx.deteccion.tipoDetectado === 'dockerfile') {
      return {
        id: 'stack_dockerfile',
        nombre: '2. Dockerfile / Stack compatible',
        estado: 'aprobado',
        detalle: 'Dockerfile detectado en la raíz (compatible con cualquier lenguaje).',
      };
    }
    return {
      id: 'stack_dockerfile',
      nombre: '2. Dockerfile / Stack compatible',
      estado: 'aprobado',
      detalle: `Stack ${ctx.deteccion.tipoDetectado} detectado (se aplicará plantilla Docker base).`,
    };
  }
}

class EslabonSeguridadSecretos extends EslabonVerificacion {
  protected evaluar(ctx: ContextoVerificacionDespliegue): PasoVerificacionDespliegue {
    const minusculas = ctx.archivosRaiz.map((a) => a.toLowerCase());
    const riesgos = minusculas.filter(
      (a) => a === '.env' || a === '.env.production' || a.endsWith('.pem') || a === 'id_rsa',
    );
    if (riesgos.length > 0) {
      return {
        id: 'seguridad_secretos',
        nombre: '3. Higiene de secretos (.env / llaves)',
        estado: 'rechazado',
        detalle: `Se detectaron archivos sensibles en el repositorio: ${riesgos.join(', ')}.`,
        recomendacion:
          'Elimina el archivo .env o llaves privadas del repositorio y carga las variables cifradas en HomeSOC.',
      };
    }
    return {
      id: 'seguridad_secretos',
      nombre: '3. Higiene de secretos (.env / llaves)',
      estado: 'aprobado',
      detalle: 'Sin archivos .env ni llaves privadas expuestas en la raíz.',
    };
  }
}

class EslabonPuertoDisponible extends EslabonVerificacion {
  protected evaluar(ctx: ContextoVerificacionDespliegue): PasoVerificacionDespliegue {
    if (ctx.puerto < 1024 || ctx.puerto > 65535) {
      return {
        id: 'puerto_servidor',
        nombre: '4. Validación de puerto de despliegue',
        estado: 'rechazado',
        detalle: `El puerto ${ctx.puerto} está fuera del rango permitido (1024–65535).`,
        recomendacion: 'Elige un puerto libre entre 3200 y 9000 (ej. 4100).',
      };
    }
    if (PUERTOS_RESERVADOS_HOMELAB.has(ctx.puerto)) {
      return {
        id: 'puerto_servidor',
        nombre: '4. Validación de puerto de despliegue',
        estado: 'rechazado',
        detalle: `El puerto ${ctx.puerto} está reservado por servicios base del servidor.`,
        recomendacion: 'Usa otro puerto libre (ej. 4100, 4200, 5100).',
      };
    }
    return {
      id: 'puerto_servidor',
      nombre: '4. Validación de puerto de despliegue',
      estado: 'aprobado',
      detalle: `Puerto ${ctx.puerto} válido y libre de colisiones con servicios base.`,
    };
  }
}

class EslabonBuenasPracticas extends EslabonVerificacion {
  protected evaluar(ctx: ContextoVerificacionDespliegue): PasoVerificacionDespliegue {
    const minusculas = new Set(ctx.archivosRaiz.map((a) => a.toLowerCase()));
    const tieneDockerignore = minusculas.has('.dockerignore');
    if (!tieneDockerignore) {
      return {
        id: 'buenas_practicas',
        nombre: '5. Optimización de imagen (.dockerignore)',
        estado: 'advertencia',
        detalle: 'No se encontró .dockerignore en la raíz (opcional, pero recomendado).',
        recomendacion: 'Agregar .dockerignore acelera el build y evita copiar node_modules o .git.',
      };
    }
    return {
      id: 'buenas_practicas',
      nombre: '5. Optimización de imagen (.dockerignore)',
      estado: 'aprobado',
      detalle: '.dockerignore presente para builds rápidos y limpios.',
    };
  }
}

/**
 * Ejecuta la cadena completa de verificación previa al despliegue (Chain of Responsibility).
 */
export function ejecutarCadenaVerificacionDespliegue(entrada: {
  nombreCompleto: string;
  rama: string;
  puerto: number;
  archivosRaiz: string[];
}): { deteccion: ResultadoDeteccionProyecto; verificacion: ResultadoCadenaVerificacion } {
  const deteccion = detectarTipoProyecto(entrada.archivosRaiz, entrada.puerto);
  const cadena = new EslabonContenidoRaiz();
  cadena
    .establecerSiguiente(new EslabonStackYDockerfile())
    .establecerSiguiente(new EslabonSeguridadSecretos())
    .establecerSiguiente(new EslabonPuertoDisponible())
    .establecerSiguiente(new EslabonBuenasPracticas());

  const pasos = cadena.ejecutar({ ...entrada, deteccion });
  const rechazados = pasos.filter((p) => p.estado === 'rechazado');
  const aptoParaDesplegar = rechazados.length === 0;
  const resumen = aptoParaDesplegar
    ? 'Repositorio verificado: cumple todas las normas para desplegarse en HomeSOC.'
    : `No cumple ${rechazados.length} norma(s) obligatoria(s) antes de desplegar.`;

  return {
    deteccion,
    verificacion: {
      aptoParaDesplegar,
      resumen,
      pasos,
    },
  };
}
