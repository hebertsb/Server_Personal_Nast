import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export type ModoTema = 'claro' | 'oscuro';
export type AcentoTema = 'esmeralda' | 'indigo' | 'coral' | 'cian' | 'lima';

export interface DefinicionAcento {
  id: AcentoTema;
  nombre: string;
  colorDia: string;
  colorNoche: string;
  descripcion: string;
}

export const PALETAS_ACENTO: DefinicionAcento[] = [
  {
    id: 'esmeralda',
    nombre: 'Esmeralda',
    colorDia: '#059669',
    colorNoche: '#10b981',
    descripcion: 'Equilibrado y orientado a monitoreo',
  },
  {
    id: 'indigo',
    nombre: 'Índigo',
    colorDia: '#4f46e5',
    colorNoche: '#818cf8',
    descripcion: 'Moderno y vibrante',
  },
  {
    id: 'coral',
    nombre: 'Coral',
    colorDia: '#ea580c',
    colorNoche: '#fb923c',
    descripcion: 'Cálido y energético',
  },
  {
    id: 'cian',
    nombre: 'Cian',
    colorDia: '#0284c7',
    colorNoche: '#22d3ee',
    descripcion: 'Azul técnico limpio',
  },
  {
    id: 'lima',
    nombre: 'Lima',
    colorDia: '#65a30d',
    colorNoche: '#a3e635',
    descripcion: 'Fresco y de alto contraste',
  },
];

const CLAVE_TEMA = 'homesoc_tema';
const CLAVE_ACENTO = 'homesoc_acento';
const ACENTOS_VALIDOS: AcentoTema[] = ['esmeralda', 'indigo', 'coral', 'cian', 'lima'];

function leerTemaInicial(): ModoTema {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    if (guardado === 'claro' || guardado === 'oscuro') {
      return guardado;
    }
  } catch {
    // Ignora errores de almacenamiento en navegadores restringidos
  }
  return 'claro';
}

function leerAcentoInicial(): AcentoTema {
  try {
    const guardado = localStorage.getItem(CLAVE_ACENTO) as AcentoTema | null;
    if (guardado && ACENTOS_VALIDOS.includes(guardado)) {
      return guardado;
    }
  } catch {
    // Ignora errores de almacenamiento en navegadores restringidos
  }
  return 'esmeralda';
}

interface ValorContextoTema {
  tema: ModoTema;
  acento: AcentoTema;
  esOscuro: boolean;
  establecerTema: (tema: ModoTema) => void;
  alternarTema: () => void;
  establecerAcento: (acento: AcentoTema) => void;
}

const ContextoTema = createContext<ValorContextoTema | null>(null);

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<ModoTema>(leerTemaInicial);
  const [acento, setAcento] = useState<AcentoTema>(leerAcentoInicial);

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema);
    try {
      localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
      // Ignora error de cuota/privacidad
    }
  }, [tema]);

  useEffect(() => {
    document.documentElement.setAttribute('data-acento', acento);
    try {
      localStorage.setItem(CLAVE_ACENTO, acento);
    } catch {
      // Ignora error de cuota/privacidad
    }
  }, [acento]);

  const establecerTema = useCallback((nuevoTema: ModoTema) => {
    setTema(nuevoTema);
  }, []);

  const alternarTema = useCallback(() => {
    setTema((actual) => (actual === 'claro' ? 'oscuro' : 'claro'));
  }, []);

  const establecerAcento = useCallback((nuevoAcento: AcentoTema) => {
    setAcento(nuevoAcento);
  }, []);

  return (
    <ContextoTema.Provider
      value={{
        tema,
        acento,
        esOscuro: tema === 'oscuro',
        establecerTema,
        alternarTema,
        establecerAcento,
      }}
    >
      {children}
    </ContextoTema.Provider>
  );
}

export function usarTema(): ValorContextoTema {
  const contexto = useContext(ContextoTema);
  if (!contexto) {
    throw new Error('usarTema debe utilizarse dentro de ProveedorTema');
  }
  return contexto;
}
