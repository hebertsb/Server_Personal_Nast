import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { apiCliente } from '../servicios/apiCliente';
import {
  autenticacionServicio,
  ModuloSistema,
  RespuestaLogin,
  RespuestaSesionActiva,
  UsuarioAutenticado,
} from '../servicios/autenticacionServicio';

interface ValorContextoAutenticacion {
  usuario: UsuarioAutenticado | null;
  tokenAcceso: string | null;
  autenticado: boolean;
  inicializando: boolean;
  iniciarSesion: (
    nombreUsuario: string,
    contrasena: string,
    recordarSesionDias?: number,
  ) => Promise<RespuestaLogin>;
  completarSegundoFactor: (datos: {
    tokenTemporal2FA: string;
    codigo: string;
    recordarDispositivo: boolean;
  }) => Promise<RespuestaSesionActiva>;
  establecerSesionDirecta: (respuesta: RespuestaSesionActiva) => void;
  tienePermisoModulo: (modulo: ModuloSistema) => boolean;
  renovarSesion: () => Promise<boolean>;
  cerrarSesion: () => Promise<void>;
  setUsuario: (usuario: UsuarioAutenticado | null) => void;
}

const ContextoAutenticacion = createContext<ValorContextoAutenticacion | null>(null);

export function ProveedorAutenticacion({ children }: { children: ReactNode }) {
  const inicializadoRef = useRef<boolean>(false);
  const [usuario, setUsuarioEstado] = useState<UsuarioAutenticado | null>(null);
  const [tokenAcceso, setTokenAcceso] = useState<string | null>(null);
  const [inicializando, setInicializando] = useState<boolean>(true);

  const guardarSesion = useCallback((respuesta: RespuestaSesionActiva) => {
    setUsuarioEstado(respuesta.usuario);
    setTokenAcceso(respuesta.tokenAcceso);
  }, []);

  const limpiarEstadoLocal = useCallback(() => {
    setUsuarioEstado(null);
    setTokenAcceso(null);
    try {
      sessionStorage.removeItem('homesoc_sesion');
    } catch {
      // Ignorar si storage no está disponible
    }
  }, []);

  const iniciarSesion = useCallback(
    async (
      nombreUsuario: string,
      contrasena: string,
      recordarSesionDias = 7,
    ): Promise<RespuestaLogin> => {
      const respuesta = await autenticacionServicio.login({
        nombreUsuario,
        contrasena,
        recordarSesionDias,
      });
      if (!respuesta.requiere2FA) {
        guardarSesion(respuesta);
      }
      return respuesta;
    },
    [guardarSesion],
  );

  const completarSegundoFactor = useCallback(
    async (datos: {
      tokenTemporal2FA: string;
      codigo: string;
      recordarDispositivo: boolean;
    }): Promise<RespuestaSesionActiva> => {
      const respuesta = await autenticacionServicio.verificar2FA(datos);
      guardarSesion(respuesta);
      return respuesta;
    },
    [guardarSesion],
  );

  const renovarSesionYDevolverToken = useCallback(async (): Promise<string | null> => {
    try {
      const respuesta = await autenticacionServicio.renovar();
      guardarSesion(respuesta);
      return respuesta.tokenAcceso;
    } catch {
      limpiarEstadoLocal();
      return null;
    }
  }, [guardarSesion, limpiarEstadoLocal]);

  const renovarSesion = useCallback(async (): Promise<boolean> => {
    const token = await renovarSesionYDevolverToken();
    return Boolean(token);
  }, [renovarSesionYDevolverToken]);

  const cerrarSesion = useCallback(async (): Promise<void> => {
    try {
      await autenticacionServicio.cerrarSesion();
    } catch {
      // Si el backend no responde, igualmente limpiamos la sesión local
    } finally {
      limpiarEstadoLocal();
    }
  }, [limpiarEstadoLocal]);

  const setUsuario = useCallback(
    (nuevoUsuario: UsuarioAutenticado | null) => {
      setUsuarioEstado(nuevoUsuario);
      if (!nuevoUsuario) {
        limpiarEstadoLocal();
      }
    },
    [limpiarEstadoLocal],
  );

  const tienePermisoModulo = useCallback(
    (modulo: ModuloSistema): boolean => {
      if (!usuario) return false;
      if (usuario.rol === 'superadmin') return true;
      if (modulo === 'usuarios') return false;
      if (usuario.permisosModulos && usuario.permisosModulos.length > 0) {
        return usuario.permisosModulos.includes(modulo);
      }
      return usuario.rol === 'administrador';
    },
    [usuario],
  );

  useEffect(() => {
    apiCliente.registrarRenovadorToken(renovarSesionYDevolverToken);
    return () => {
      apiCliente.registrarRenovadorToken(null);
    };
  }, [renovarSesionYDevolverToken]);

  useEffect(() => {
    if (!usuario || !tokenAcceso) return;
    // Renueva proactivamente el JWT de acceso cada 11 minutos (expira a los 15m)
    const id = window.setInterval(() => {
      void renovarSesionYDevolverToken();
    }, 11 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [usuario, tokenAcceso, renovarSesionYDevolverToken]);

  useEffect(() => {
    if (inicializadoRef.current) return;
    inicializadoRef.current = true;

    let activo = true;
    void (async () => {
      await renovarSesion();
      if (activo) setInicializando(false);
    })();
    return () => {
      activo = false;
    };
  }, [renovarSesion]);

  return (
    <ContextoAutenticacion.Provider
      value={{
        usuario,
        tokenAcceso,
        autenticado: Boolean(usuario && tokenAcceso),
        inicializando,
        iniciarSesion,
        completarSegundoFactor,
        establecerSesionDirecta: guardarSesion,
        tienePermisoModulo,
        renovarSesion,
        cerrarSesion,
        setUsuario,
      }}
    >
      {children}
    </ContextoAutenticacion.Provider>
  );
}

export function usarAutenticacion(): ValorContextoAutenticacion {
  const contexto = useContext(ContextoAutenticacion);
  if (!contexto) {
    throw new Error('usarAutenticacion debe utilizarse dentro de ProveedorAutenticacion');
  }
  return contexto;
}
