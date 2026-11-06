import postgres from 'postgres';

type SqlClient = ReturnType<typeof postgres>;

// Se guardan en globalThis para reutilizar las conexiones entre recargas en
// caliente (next dev) y entre invocaciones de la misma instancia serverless.
const globalForDb = globalThis as typeof globalThis & {
  __eneunSql?: SqlClient;
  __eneunTrainingSql?: SqlClient;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Base de datos principal de ENEUN. */
export function getSql(): SqlClient {
  if (!globalForDb.__eneunSql) {
    globalForDb.__eneunSql = postgres(getRequiredEnv('DATABASE_URL'));
  }
  return globalForDb.__eneunSql;
}

/**
 * Ejecuta `callback` dentro de una transacción de la base principal.
 * (Los tipos de postgres.js no exponen la firma de llamada de TransactionSql,
 * por eso se adapta aquí una sola vez.)
 */
export async function withTransaction<T>(callback: (tx: SqlClient) => Promise<T>): Promise<T> {
  const result = await getSql().begin((tx) => callback(tx as unknown as SqlClient));
  return result as T;
}

/** Base de datos de la plataforma de capacitaciones (tabla student_capacitaciones). */
export function getTrainingSql(): SqlClient {
  if (!globalForDb.__eneunTrainingSql) {
    globalForDb.__eneunTrainingSql = postgres(getRequiredEnv('TRAINING_DATABASE_URL'));
  }
  return globalForDb.__eneunTrainingSql;
}
