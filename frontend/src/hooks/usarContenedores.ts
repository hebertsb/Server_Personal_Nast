import { useCallback, useEffect, useState } from 'react';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import { ErrorApi } from '../servicios/apiCliente';
import { contenedoresServicio } from '../servicios/contenedoresServicio';
import {
  AccionContenedor,
  Contenedor,
  ResumenContenedores,
} from '../tipos/Contenedor';

const RESUMEN_INICIAL: ResumenContenedores = {
  total: 0,
  activos: 0,
  detenidos: 0,
  conProblemas: 0,
};

export function usarContenedores(intervaloMs = 10_000) {
  const { tokenAcceso, cerrarSesion } = usarAutenticacion();
  const [contenedores, setContenedores] = useState<Contenedor[]>([]);
  const [resumen, setResumen] = useState<ResumenContenedores>(RESUMEN_INICIAL);
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [recargando, setRecargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [autoRefresco, setAutoRefresco] = useState(true);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!tokenAcceso) return;
      if (!silencioso) {
        setRecargando(true);
      }

      try {
        const datos = await contenedoresServicio.listar(tokenAcceso);
        setContenedores(datos.contenedores);
        setResumen(datos.resumen);
        setActualizadoEn(datos.actualizadoEn);
        setError(null);
      } catch (err) {
        if (err instanceof ErrorApi) {
          if (err.estado === 401) {
            cerrarSesion();
            return;
          }
          setError(err.message);
        } else {
          setError('No se pudo obtener la lista de contenedores');
        }
      } finally {
        setCargando(false);
        setRecargando(false);
      }
    },
    [tokenAcceso, cerrarSesion],
  );

  useEffect(() => {
    void cargar(false);
  }, [cargar]);

  useEffect(() => {
    if (!autoRefresco || !tokenAcceso) return;
    const temporizador = window.setInterval(() => {
      void cargar(true);
    }, intervaloMs);
    return () => window.clearInterval(temporizador);
  }, [autoRefresco, tokenAcceso, intervaloMs, cargar]);

  const controlarContenedor = useCallback(
    async (contenedorId: string, accion: AccionContenedor): Promise<string> => {
      if (!tokenAcceso) {
        throw new Error('Sesión no iniciada');
      }
      setAccionEnCurso(`${contenedorId}:${accion}`);
      try {
        const respuesta = await contenedoresServicio.ejecutarAccion(
          contenedorId,
          accion,
          tokenAcceso,
        );
        await cargar(true);
        return respuesta.mensaje;
      } finally {
        setAccionEnCurso(null);
      }
    },
    [tokenAcceso, cargar],
  );

  return {
    contenedores,
    resumen,
    actualizadoEn,
    cargando,
    recargando,
    error,
    accionEnCurso,
    autoRefresco,
    setAutoRefresco,
    recargar: () => cargar(false),
    controlarContenedor,
  };
}
