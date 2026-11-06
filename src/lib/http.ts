import type { ServerResponse } from 'http';

function secureFlag(): string {
  return process.env.NODE_ENV === 'production' ? '; Secure' : '';
}

export function buildCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag()}`;
}

export function buildExpiredCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag()}`;
}

export function redirectTo(res: ServerResponse, destination: string, statusCode = 303): void {
  res.writeHead(statusCode, { Location: destination });
  res.end();
}

export function setNoStore(res: ServerResponse): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

export function getQueryValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? (value[0] ?? '') : (value ?? '')).trim();
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parsePositiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
