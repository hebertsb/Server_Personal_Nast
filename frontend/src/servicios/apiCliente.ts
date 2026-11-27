export interface CuerpoErrorApi {
  error?: {
    codigo?: string;
    mensaje?: string;
    detalles?: Array<{ campo?: string; mensaje?: string }>;
  };
}

export class ErrorApi extends Error {
  public readonly codigo: string;
  public readonly estado: number;
  public readonly detalles?: Array<{ campo?: string; mensaje?: string }>;

  constructor(
    mensaje: string,
    estado: number,
    codigo = 'ERROR_API',
    detalles?: Array<{ campo?: string; mensaje?: string }>,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

interface OpcionesSolicitud {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  cuerpo?: unknown;
  token?: string | null;
}

const baseApi = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || '/api/v1';

async function solicitar<T>(ruta: string, opciones: OpcionesSolicitud = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (opciones.cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (opciones.token) {
    headers.Authorization = `Bearer ${opciones.token}`;
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${baseApi}${ruta}`, {
      method: opciones.metodo || 'GET',
      headers,
      credentials: 'include',
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(
      'No se pudo conectar con el servidor de HomeSOC. Verifica que el backend esté activo.',
      0,
      'ERROR_CONEXION',
    );
  }

  const contenidoTexto = await respuesta.text();
  let datos: unknown = null;
  if (contenidoTexto) {
    try {
      datos = JSON.parse(contenidoTexto);
    } catch {
      datos = null;
    }
  }

  if (!respuesta.ok) {
    const cuerpoError = datos as CuerpoErrorApi | null;
    const mensaje =
      cuerpoError?.error?.mensaje || `Error en la solicitud (HTTP ${respuesta.status})`;
    const codigo = cuerpoError?.error?.codigo || 'ERROR_HTTP';
    throw new ErrorApi(mensaje, respuesta.status, codigo, cuerpoError?.error?.detalles);
  }

  return datos as T;
}

export const apiCliente = {
  base: baseApi,
  get: <T>(ruta: string, token?: string | null) =>
    solicitar<T>(ruta, { metodo: 'GET', token }),
  post: <T>(ruta: string, cuerpo?: unknown, token?: string | null) =>
    solicitar<T>(ruta, { metodo: 'POST', cuerpo, token }),
  patch: <T>(ruta: string, cuerpo?: unknown, token?: string | null) =>
    solicitar<T>(ruta, { metodo: 'PATCH', cuerpo, token }),
  put: <T>(ruta: string, cuerpo?: unknown, token?: string | null) =>
    solicitar<T>(ruta, { metodo: 'PUT', cuerpo, token }),
  delete: <T>(ruta: string, token?: string | null) =>
    solicitar<T>(ruta, { metodo: 'DELETE', token }),
};
