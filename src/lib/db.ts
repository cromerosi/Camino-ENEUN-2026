import postgres from "postgres";

let sqlClient: ReturnType<typeof postgres> | null = null;

export function getSql() {
	if (sqlClient) {
		return sqlClient;
	}

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('Missing required environment variable: DATABASE_URL');
	}

	sqlClient = postgres(databaseUrl);
	return sqlClient;
}
