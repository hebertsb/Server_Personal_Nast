import {
  AnaliticaAccesosProyecto,
  FiltroAccesosProyecto,
  NuevaSolicitudProyecto,
  SolicitudProyecto,
} from '../../dominio/entidades/SolicitudProyecto';
import { RepositorioAccesosProyecto } from '../../dominio/interfaces/RepositorioAccesosProyecto';
import { estimarPaisPorIp } from '../../dominio/reglas/GeolocalizadorIpBestEffort';

/**
 * Caso de uso RF-16 a RF-19: registra solicitudes HTTP a proyectos desplegados
 * (aplicando geolocalización best-effort) y devuelve analítica agregada y filtrable.
 */
export class GestionarAccesosProyecto {
  constructor(private readonly repositorioAccesos: RepositorioAccesosProyecto) {}

  public async registrar(entrada: NuevaSolicitudProyecto): Promise<SolicitudProyecto> {
    const pais = estimarPaisPorIp(entrada.ipOrigen, entrada.pais);
    return this.repositorioAccesos.registrarSolicitud({
      ...entrada,
      nombreProyecto: entrada.nombreProyecto.trim().toLowerCase(),
      metodo: entrada.metodo.trim().toUpperCase(),
      pais,
    });
  }

  public async consultarAnalitica(
    filtro: FiltroAccesosProyecto,
  ): Promise<AnaliticaAccesosProyecto> {
    const proyectoNormalizado =
      filtro.proyecto && filtro.proyecto !== 'todos' ? filtro.proyecto.trim() : undefined;

    return this.repositorioAccesos.obtenerAnalitica({
      ...filtro,
      proyecto: proyectoNormalizado,
    });
  }

  /** Genera un lote simulado de solicitudes HTTP distribuidas en varias horas para pruebas locales. */
  public async simularTraficoLocal(): Promise<number> {
    const ahora = Date.now();
    const horasOffset = [0, 1, 2, 3, 5, 7, 9, 12, 15, 18];
    const plantillas: Array<Omit<NuevaSolicitudProyecto, 'pais' | 'fechaHora'>> = [
      {
        nombreProyecto: 'barberapp',
        ipOrigen: '181.115.140.88',
        ruta: '/api/reservas/confirmar',
        metodo: 'POST',
        codigoEstado: 201,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)',
      },
      {
        nombreProyecto: 'barberapp',
        ipOrigen: '190.186.42.91',
        ruta: '/turnos/hoy',
        metodo: 'GET',
        codigoEstado: 200,
        userAgent: 'Mozilla/5.0 (Android 14; Mobile)',
      },
      {
        nombreProyecto: 'portafolio-personal',
        ipOrigen: '186.136.80.44',
        ruta: '/proyectos/homesoc',
        metodo: 'GET',
        codigoEstado: 200,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)',
      },
      {
        nombreProyecto: 'api-facturacion',
        ipOrigen: '192.168.1.105',
        ruta: '/api/v1/facturas/resumen',
        metodo: 'GET',
        codigoEstado: 200,
        userAgent: 'HomeSOC-Internal/1.0',
      },
      {
        nombreProyecto: 'barberapp',
        ipOrigen: '34.120.10.19',
        ruta: '/.env',
        metodo: 'GET',
        codigoEstado: 404,
        userAgent: 'curl/8.4.0',
      },
      {
        nombreProyecto: 'portafolio-personal',
        ipOrigen: '200.87.120.14',
        ruta: '/',
        metodo: 'GET',
        codigoEstado: 200,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      {
        nombreProyecto: 'api-facturacion',
        ipOrigen: '100.99.124.20',
        ruta: '/api/v1/facturas/emitir',
        metodo: 'POST',
        codigoEstado: 201,
        userAgent: 'FacturadorCLI/2.1',
      },
      {
        nombreProyecto: 'barberapp',
        ipOrigen: '177.54.144.23',
        ruta: '/barberos',
        metodo: 'GET',
        codigoEstado: 200,
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      },
    ];

    const muestras: NuevaSolicitudProyecto[] = plantillas.map((m, idx) => {
      const offsetHoras = horasOffset[idx % horasOffset.length];
      return {
        ...m,
        pais: estimarPaisPorIp(m.ipOrigen),
        fechaHora: new Date(ahora - offsetHoras * 3600_000).toISOString(),
      };
    });

    return this.repositorioAccesos.registrarLote(muestras);
  }
}
