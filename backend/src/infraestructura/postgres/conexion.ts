import { Pool } from 'pg';

let instanciaPool: Pool | null = null;

/** Devuelve la instancia única (Singleton) del pool de conexiones a PostgreSQL. */
export function obtenerPoolPostgres(databaseUrl: string): Pool {
  if (!instanciaPool) {
    instanciaPool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return instanciaPool;
}

export async function verificarConexionPostgres(pool: Pool): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function cerrarPoolPostgres(): Promise<void> {
  if (instanciaPool) {
    await instanciaPool.end();
    instanciaPool = null;
  }
}
