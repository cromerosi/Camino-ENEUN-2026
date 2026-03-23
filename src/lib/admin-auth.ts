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
  campuses: string[];
  isSuper: boolean;
  isGlobal: boolean;
  exp: number;
}

function normalizeAdminIdentity(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function isSupremeAdminSession(session: Pick<AdminSession, 'username' | 'name'>): boolean {
  const rawUsername = (session.username ?? '').trim().toLowerCase();
  const rawName = (session.name ?? '').trim().toLowerCase();
  const normalizedUsername = normalizeAdminIdentity(session.username);
  const normalizedName = normalizeAdminIdentity(session.name);
  const combined = `${normalizedUsername}${normalizedName}`;

  return (
    rawUsername === 'admin supremo' ||
    rawName === 'admin supremo' ||
    rawUsername === 'supremo' ||
    rawName === 'supremo' ||
    normalizedUsername === 'adminsupremo' ||
    normalizedName === 'adminsupremo' ||
    combined === 'adminsupremo' ||
    combined === 'supremoadmin' ||
    combined.includes('adminsupremo')
  );
}

function normalizeCampusName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeCampusList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeCampusName(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function parseCampusField(rawCampus: unknown): string[] {
  if (Array.isArray(rawCampus)) {
    return rawCampus.filter((value): value is string => typeof value === 'string');
  }

  if (typeof rawCampus !== 'string') {
    return [];
  }

  const trimmed = rawCampus.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === 'string');
      }
    } catch {
      // If parsing fails, treat as regular single-campus string.
    }
  }

  return [trimmed];
}

export function resolveAdminCampuses(rawCampus: unknown, rawAssignedCampuses: unknown): string[] {
  const baseCampuses = parseCampusField(rawCampus);
  const assignedCampuses = Array.isArray(rawAssignedCampuses)
    ? rawAssignedCampuses.filter((value): value is string => typeof value === 'string')
    : [];

  const merged = [...baseCampuses, ...assignedCampuses];
  return normalizeCampusList(merged);
}

export function hasCampusAccess(session: AdminSession, campus: string): boolean {
  if (session.isSuper || session.isGlobal) {
    return true;
  }

  const target = normalizeCampusName(campus);
  return session.campuses.includes(target);
}

export function canAccessAllCampuses(session: AdminSession): boolean {
  return session.isSuper || session.isGlobal;
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
    const payload = JSON.parse(fromBase64Url(payloadBase64)) as Partial<AdminSession>;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    const baseCampus = typeof payload.campus === 'string' ? payload.campus : '';
    const normalizedCampuses = Array.isArray(payload.campuses)
      ? normalizeCampusList(payload.campuses)
      : normalizeCampusList(baseCampus ? [baseCampus] : []);

    return {
      id: Number(payload.id),
      username: String(payload.username ?? ''),
      name: String(payload.name ?? ''),
      campus: baseCampus,
      campuses: normalizedCampuses,
      isSuper: Boolean(payload.isSuper),
      isGlobal: Boolean(payload.isGlobal),
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function getAdminSessionCookieName() {
  return ADMIN_SESSION_COOKIE_NAME;
}
