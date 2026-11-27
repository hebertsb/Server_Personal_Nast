export interface IntentoSshFallido {
  ipOrigen: string;
  usuarioIntentado: string;
  puerto: number;
  fechaHora: string;
  lineaCruda: string;
}

export interface HallazgoFuerzaBruta {
  ipOrigen: string;
  totalIntentos: number;
  usuariosIntentados: string[];
  primerIntento: string;
  ultimoIntento: string;
  severidad: 'alta' | 'critica';
}

export interface OpcionesPoliticaFuerzaBruta {
  umbralIntentos: number;
  ventanaMinutos: number;
  ahoraMs?: number;
}

/**
 * Regla de dominio pura (RF-13 y docs/HomeSOC_Arquitectura.md sección 5):
 * agrupa intentos SSH fallidos por IP dentro de la ventana temporal configurada
 * y devuelve las IPs que superan o igualan el umbral de fuerza bruta.
 */
export class PoliticaBloqueoFuerzaBruta {
  public evaluar(
    intentos: IntentoSshFallido[],
    opciones: OpcionesPoliticaFuerzaBruta,
  ): HallazgoFuerzaBruta[] {
    if (intentos.length === 0) return [];

    const ventanaMs = opciones.ventanaMinutos * 60 * 1000;
    const referenciaMs =
      opciones.ahoraMs ??
      Math.max(
        ...intentos.map((i) => {
          const t = Date.parse(i.fechaHora);
          return Number.isFinite(t) ? t : 0;
        }),
      );

    const limiteInferiorMs = referenciaMs - ventanaMs;
    const porIp = new Map<string, IntentoSshFallido[]>();

    for (const intento of intentos) {
      const t = Date.parse(intento.fechaHora);
      if (Number.isFinite(t) && t < limiteInferiorMs) {
        continue;
      }
      const lista = porIp.get(intento.ipOrigen) ?? [];
      lista.push(intento);
      porIp.set(intento.ipOrigen, lista);
    }

    const hallazgos: HallazgoFuerzaBruta[] = [];

    for (const [ipOrigen, grupo] of porIp.entries()) {
      if (grupo.length < opciones.umbralIntentos) continue;

      const ordenados = [...grupo].sort(
        (a, b) => Date.parse(a.fechaHora) - Date.parse(b.fechaHora),
      );
      const usuariosUnicos = Array.from(new Set(ordenados.map((i) => i.usuarioIntentado)));

      hallazgos.push({
        ipOrigen,
        totalIntentos: ordenados.length,
        usuariosIntentados: usuariosUnicos,
        primerIntento: ordenados[0].fechaHora,
        ultimoIntento: ordenados[ordenados.length - 1].fechaHora,
        severidad: ordenados.length >= opciones.umbralIntentos * 2 ? 'critica' : 'alta',
      });
    }

    return hallazgos.sort((a, b) => b.totalIntentos - a.totalIntentos);
  }
}
