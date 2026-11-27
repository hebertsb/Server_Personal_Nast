import { useCallback, useEffect, useState } from 'react';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import { ErrorApi } from '../servicios/apiCliente';
import { recursosServicio } from '../servicios/recursosServicio';
import {
  RangoHistorico,
  RecursosHost,
  RespuestaHistoricoRecursos,
} from '../tipos/RecursosHost';

export function usarRecursosHost(rango: RangoHistorico, intervaloMs = 8_000) {
  const { tokenAcceso, cerrarSesion } = usarAutenticacion();
  const [recursos, setRecursos] = useState<RecursosHost | null>(null);
  const [historico, setHistorico] = useState<RespuestaHistoricoRecursos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoHistorico, setCargandoHistorico] = useState(false);
  const [recargando, setRecargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresco, setAutoRefresco] = useState(true);

  const manejarError = useCallback(
    (err: unknown) => {
      if (err instanceof ErrorApi) {
        if (err.estado === 401) {
          cerrarSesion();
          return;
        }
        setError(err.message);
      } else {
        setError('No se pudieron obtener las métricas del servidor');
      }
    },
    [cerrarSesion],
  );

  const cargarActual = useCallback(
    async (silencioso = false) => {
      if (!tokenAcceso) return;
      if (!silencioso) setRecargando(true);
      try {
        const actual = await recursosServicio.obtenerActual(tokenAcceso);
        setRecursos(actual);
        setError(null);
      } catch (err) {
        manejarError(err);
      } finally {
        setCargando(false);
        setRecargando(false);
      }
    },
    [tokenAcceso, manejarError],
  );

  const cargarHistorico = useCallback(
    async (rangoObjetivo: RangoHistorico, silencioso = false) => {
      if (!tokenAcceso) return;
      if (!silencioso) setCargandoHistorico(true);
      try {
        const hist = await recursosServicio.obtenerHistorico(rangoObjetivo, tokenAcceso);
        setHistorico(hist);
        setError(null);
      } catch (err) {
        manejarError(err);
      } finally {
        setCargandoHistorico(false);
      }
    },
    [tokenAcceso, manejarError],
  );

  // Carga inicial de métricas actuales
  useEffect(() => {
    void cargarActual(false);
  }, [cargarActual]);

  // Al cambiar de rango (1h / 24h / 7d), consulta únicamente el histórico sin alterar las tarjetas ni insertar muestras
  useEffect(() => {
    void cargarHistorico(rango, false);
  }, [rango, cargarHistorico]);

  // Refresco periódico independiente
  useEffect(() => {
    if (!autoRefresco || !tokenAcceso) return;
    const timer = window.setInterval(() => {
      void Promise.all([cargarActual(true), cargarHistorico(rango, true)]);
    }, intervaloMs);
    return () => window.clearInterval(timer);
  }, [autoRefresco, tokenAcceso, intervaloMs, rango, cargarActual, cargarHistorico]);

  const recargar = useCallback(async () => {
    await Promise.all([cargarActual(false), cargarHistorico(rango, false)]);
  }, [cargarActual, cargarHistorico, rango]);

  return {
    recursos,
    historico,
    cargando,
    cargandoHistorico,
    recargando,
    error,
    autoRefresco,
    setAutoRefresco,
    recargar,
  };
}
