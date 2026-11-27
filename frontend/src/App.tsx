import { ProveedorAutenticacion } from './contexto/ContextoAutenticacion';
import { ProveedorTema } from './contexto/ContextoTema';
import AppRoutes from './rutas/AppRoutes';

export default function App() {
  return (
    <ProveedorTema>
      <ProveedorAutenticacion>
        <AppRoutes />
      </ProveedorAutenticacion>
    </ProveedorTema>
  );
}
