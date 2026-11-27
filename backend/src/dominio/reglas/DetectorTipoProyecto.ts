import {
  ResultadoDeteccionProyecto,
  TipoProyectoDespliegue,
} from '../entidades/Despliegue';

const PLANTILLA_NODEJS = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
EXPOSE {{PUERTO}}
CMD ["npm", "start"]`;

const PLANTILLA_HTML_ESTATICO = `FROM nginx:1.27-alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;

/**
 * Regla de dominio RF-31: prioriza Dockerfile (cualquier lenguaje); en su ausencia
 * auto-detecta únicamente Node.js (package.json) o HTML estático (index.html).
 */
export function detectarTipoProyecto(
  archivosRaiz: string[],
  puerto = 3000,
): ResultadoDeteccionProyecto {
  const normalizados = new Set(archivosRaiz.map((a) => a.trim().toLowerCase()));

  if (normalizados.has('dockerfile')) {
    return {
      tipoDetectado: 'dockerfile',
      archivosEncontrados: archivosRaiz,
      motivo: 'Se encontró Dockerfile en la raíz del repositorio (prioridad máxima).',
      plantillaSugerida: null,
    };
  }

  if (normalizados.has('package.json')) {
    return {
      tipoDetectado: 'nodejs',
      archivosEncontrados: archivosRaiz,
      motivo: 'Sin Dockerfile; detectado package.json — se aplicará plantilla base Node.js.',
      plantillaSugerida: obtenerPlantillaBase('nodejs', puerto),
    };
  }

  if (normalizados.has('index.html')) {
    return {
      tipoDetectado: 'html_estatico',
      archivosEncontrados: archivosRaiz,
      motivo: 'Sin Dockerfile; detectado index.html — se aplicará plantilla base HTML estático (Nginx).',
      plantillaSugerida: obtenerPlantillaBase('html_estatico', puerto),
    };
  }

  return {
    tipoDetectado: null,
    archivosEncontrados: archivosRaiz,
    motivo:
      'No se encontró Dockerfile, package.json ni index.html en la raíz. Agrega un Dockerfile para desplegar este stack.',
    plantillaSugerida: null,
  };
}

export function obtenerPlantillaBase(
  tipo: TipoProyectoDespliegue,
  puerto = 3000,
): string | null {
  if (tipo === 'nodejs') {
    return PLANTILLA_NODEJS.replace('{{PUERTO}}', String(puerto));
  }
  if (tipo === 'html_estatico') {
    return PLANTILLA_HTML_ESTATICO;
  }
  return null;
}
