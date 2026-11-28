import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import { ModuloSistema } from '../servicios/autenticacionServicio';
import Login from '../paginas/Login';
import PreciosPublicos from '../paginas/PreciosPublicos';
import RecursosServidor from '../paginas/RecursosServidor';
import ServiciosYDespliegues from '../paginas/ServiciosYDespliegues';
import RedYConectividad from '../paginas/RedYConectividad';
import Seguridad from '../paginas/Seguridad';
import Automatizacion from '../paginas/Automatizacion';
import ConfiguracionGeneral from '../paginas/ConfiguracionGeneral';
import PlanesYSuscripcion from '../paginas/PlanesYSuscripcion';
import Usuarios from '../paginas/Usuarios';
import LayoutPrincipal from '../componentes/comunes/LayoutPrincipal';

function RutaProtegida({
  children,
  modulo,
}: {
  children: React.ReactNode;
  modulo: ModuloSistema;
}) {
  const { usuario, inicializando, tienePermisoModulo } = usarAutenticacion();
  if (inicializando) {
    return (
      <div className="min-h-screen bg-canvas-base text-text-muted flex items-center justify-center text-sm font-mono">
        Verificando sesión...
      </div>
    );
  }
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }
  if (!tienePermisoModulo(modulo)) {
    return (
      <LayoutPrincipal>
        <div className="pt-28 px-6 max-w-md mx-auto text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-error-container text-status-critical flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">lock</span>
          </div>
          <h1 className="text-lg font-bold text-text-primary">Acceso restringido</h1>
          <p className="text-xs text-text-muted">
            Tu cuenta no tiene permiso para acceder al módulo <strong className="font-mono">{modulo}</strong>.
            Solicita acceso al Superadmin si lo necesitas.
          </p>
        </div>
      </LayoutPrincipal>
    );
  }
  return <LayoutPrincipal>{children}</LayoutPrincipal>;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/precios" element={<PreciosPublicos />} />
        <Route path="/registro" element={<Navigate to="/login?modo=registro" replace />} />

        {/* Rutas protegidas por sesión y permiso de módulo */}
        <Route
          path="/"
          element={
            <RutaProtegida modulo="recursos">
              <RecursosServidor />
            </RutaProtegida>
          }
        />
        <Route
          path="/servicios"
          element={
            <RutaProtegida modulo="servicios">
              <ServiciosYDespliegues />
            </RutaProtegida>
          }
        />
        <Route
          path="/planes"
          element={
            <RutaProtegida modulo="servicios">
              <PlanesYSuscripcion />
            </RutaProtegida>
          }
        />
        <Route
          path="/red"
          element={
            <RutaProtegida modulo="red">
              <RedYConectividad />
            </RutaProtegida>
          }
        />
        <Route
          path="/seguridad"
          element={
            <RutaProtegida modulo="seguridad">
              <Seguridad />
            </RutaProtegida>
          }
        />
        <Route
          path="/automatizacion"
          element={
            <RutaProtegida modulo="automatizacion">
              <Automatizacion />
            </RutaProtegida>
          }
        />
        <Route
          path="/usuarios"
          element={
            <RutaProtegida modulo="usuarios">
              <Usuarios />
            </RutaProtegida>
          }
        />
        <Route
          path="/configuracion"
          element={
            <RutaProtegida modulo="configuracion">
              <ConfiguracionGeneral />
            </RutaProtegida>
          }
        />

        {/* Fallback de ruta no encontrada */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
