// No imports needed for Env because we use process.env

const ADMIN_SESSION_COOKIE_NAME = 'eneun_admin_session';
const encoder = new TextEncoder();

function getSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.ADMIN_JWT_SECRET ||
    'eneun-dev-session-secret-change-me'
  );
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

async function signValue(value: string): Promise<string> {
  const secret = getSessionSecret();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Buffer.from(signature).toString('base64url');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export interface AdminSession {
  id: number;
  username: string;
  name: string;
  campus: string;
  exp: number;
}

export async function createAdminSessionToken(admin: Omit<AdminSession, 'exp'>): Promise<string> {
  const payload: AdminSession = {
    ...admin,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8, // 8 hours
  };
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = await signValue(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) return null;
  const expectedSignature = await signValue(payloadBase64);
  if (!safeEqual(signature, expectedSignature)) return null;
  try {
    const payload = JSON.parse(fromBase64Url(payloadBase64)) as AdminSession;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAdminSessionCookieName() {
  return ADMIN_SESSION_COOKIE_NAME;
}
