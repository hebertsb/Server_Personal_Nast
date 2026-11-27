import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';
import Login from '../paginas/Login';
import RecursosServidor from '../paginas/RecursosServidor';
import ServiciosYDespliegues from '../paginas/ServiciosYDespliegues';
import RedYConectividad from '../paginas/RedYConectividad';
import Seguridad from '../paginas/Seguridad';
import Automatizacion from '../paginas/Automatizacion';
import ConfiguracionGeneral from '../paginas/ConfiguracionGeneral';
import LayoutPrincipal from '../componentes/comunes/LayoutPrincipal';

function RutaProtegida({ children }: { children: React.ReactNode }) {
  const { usuario, inicializando } = usarAutenticacion();
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
  return <LayoutPrincipal>{children}</LayoutPrincipal>;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Rutas protegidas */}
        <Route path="/" element={<RutaProtegida><RecursosServidor /></RutaProtegida>} />
        <Route path="/servicios" element={<RutaProtegida><ServiciosYDespliegues /></RutaProtegida>} />
        <Route path="/red" element={<RutaProtegida><RedYConectividad /></RutaProtegida>} />
        <Route path="/seguridad" element={<RutaProtegida><Seguridad /></RutaProtegida>} />
        <Route path="/automatizacion" element={<RutaProtegida><Automatizacion /></RutaProtegida>} />
        <Route path="/configuracion" element={<RutaProtegida><ConfiguracionGeneral /></RutaProtegida>} />
        
        {/* Fallback de ruta no encontrada */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
