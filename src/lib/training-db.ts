import postgres from 'postgres';

let trainingSqlClient: ReturnType<typeof postgres> | null = null;

export function getTrainingSql() {
  if (trainingSqlClient) {
    return trainingSqlClient;
  }

  // Credentials provided by the user
  const host = 'ep-quiet-dream-aauekdmd-pooler.westus3.azure.neon.tech';
  const user = 'neondb_owner';
  const pass = 'npg_J1whWSLDsbV0';
  const database = 'neondb';

  const connectionString = `postgres://${user}:${pass}@${host}/${database}?sslmode=require`;

  trainingSqlClient = postgres(connectionString);
  return trainingSqlClient;
}
