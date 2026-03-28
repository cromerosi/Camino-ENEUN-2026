import postgres from "postgres";

let sqlClient: ReturnType<typeof postgres> | null = null;

const DB_DEBUG_ENABLED =
	process.env.DEBUG_ATTENDANCE_LOGS === 'true' || process.env.NODE_ENV !== 'production';

function dbDebugLog(message: string, details?: Record<string, unknown>): void {
	if (!DB_DEBUG_ENABLED) {
		return;
	}

	if (details) {
		console.log(`[db-retry] ${message}`, details);
		return;
	}

	console.log(`[db-retry] ${message}`);
}

type SqlClient = ReturnType<typeof postgres>;

interface DbRetryOptions {
	attempts?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableDbError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	return (
		message.includes('econnrefused') ||
		message.includes('connection terminated') ||
		message.includes('connection reset') ||
		message.includes('timeout') ||
		message.includes('enotfound') ||
		message.includes('server closed the connection')
	);
}

export async function resetSqlClient(): Promise<void> {
	if (!sqlClient) {
		return;
	}

	const current = sqlClient;
	sqlClient = null;

	try {
		await current.end({ timeout: 1 });
	} catch {
		// Ignoramos errores de cierre para permitir una recreación limpia.
	}

	dbDebugLog('SQL client reset complete');
}

export function getSql() {
	if (sqlClient) {
		return sqlClient;
	}

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('Missing required environment variable: DATABASE_URL');
	}

	sqlClient = postgres(databaseUrl, {
		max: Number.parseInt(process.env.DB_POOL_MAX ?? '10', 10),
		connect_timeout: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_SECONDS ?? '8', 10),
		idle_timeout: Number.parseInt(process.env.DB_IDLE_TIMEOUT_SECONDS ?? '20', 10),
	});
	return sqlClient;
}

export async function withDbRetry<T>(
	operation: (sql: SqlClient) => Promise<T>,
	options?: DbRetryOptions,
): Promise<T> {
	const attempts = options?.attempts ?? 3;
	const baseDelayMs = options?.baseDelayMs ?? 200;
	const maxDelayMs = options?.maxDelayMs ?? 2000;

	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		const sql = getSql();
		dbDebugLog('Running DB operation', { attempt, attempts });

		try {
			return await operation(sql);
		} catch (error) {
			lastError = error;
			dbDebugLog('DB operation failed', {
				attempt,
				attempts,
				retryable: isRetryableDbError(error),
				error: error instanceof Error ? error.message : 'unknown error',
			});

			if (!isRetryableDbError(error) || attempt === attempts) {
				throw error;
			}

			await resetSqlClient();
			const nextDelay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
			dbDebugLog('Retrying DB operation after delay', { attempt, nextDelay });
			await sleep(nextDelay);
		}
	}

	throw lastError instanceof Error ? lastError : new Error('Database operation failed');
}
