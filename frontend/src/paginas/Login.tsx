import { Navigate } from 'react-router-dom';
import FormularioLogin from '../componentes/autenticacion/FormularioLogin';
import SelectorTema from '../componentes/comunes/SelectorTema';
import { usarAutenticacion } from '../contexto/ContextoAutenticacion';

export default function Login() {
  const { autenticado } = usarAutenticacion();

  if (autenticado) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen w-full bg-canvas-base text-text-primary antialiased flex flex-col justify-between relative overflow-x-hidden font-sans transition-colors duration-200">
      {/* Fondo sutil con malla tenue y resplandor ambiental del acento activo */}
      <div className="fixed inset-0 grid-bg pointer-events-none opacity-80 z-0" />
      <div
        className="fixed -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-3xl opacity-15 pointer-events-none z-0 bg-primary"
      />
      <div
        className="fixed -bottom-40 -right-40 w-[480px] h-[480px] rounded-full blur-3xl opacity-10 pointer-events-none z-0 bg-secondary-container"
      />

      {/* Barra superior minimalista con selector de Modo Día/Noche y tonalidad */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-card/90 backdrop-blur-md border border-border-hairline text-xs text-text-muted">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-medium text-text-primary">HomeSOC</span>
          <span className="text-text-dim">•</span>
          <span className="font-mono text-[11px]">Entorno Local</span>
        </div>

        <SelectorTema alineacion="derecha" />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <FormularioLogin />
      </main>

      <footer className="relative z-10 py-4 text-center text-[11px] text-text-dim">
        HomeLab Security Operations Center • Proyecto Open Source (Licencia MIT)
      </footer>
    </div>
  );
}
