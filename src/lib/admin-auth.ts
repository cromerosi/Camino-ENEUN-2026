import { normalizeCampusName } from './campus';
import { nowInSeconds, signTokenPayload, verifyTokenPayload } from './session-token';

const ADMIN_SESSION_COOKIE_NAME = 'eneun_admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export interface AdminSession {
  id: number;
  username: string;
  name: string;
  /** Etiqueta para mostrar: la sede del admin, "Multisede" o "Global". */
  campus: string;
  /** Sedes con acceso, normalizadas (minúsculas y sin tildes). */
  campuses: string[];
  isSuper: boolean;
  isGlobal: boolean;
  exp: number;
}

function normalizeAdminIdentity(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

function toStringList(values: unknown[]): string[] {
  return values.filter((value): value is string => typeof value === 'string');
}

function parseCampusField(rawCampus: unknown): string[] {
  if (Array.isArray(rawCampus)) {
    return toStringList(rawCampus);
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
        return toStringList(parsed);
      }
    } catch {
      // Si no es JSON válido se trata como el nombre de una sola sede.
    }
  }

  return [trimmed];
}

function collectRawCampuses(rawCampus: unknown, rawAssignedCampuses: unknown): string[] {
  const assignedCampuses = Array.isArray(rawAssignedCampuses) ? toStringList(rawAssignedCampuses) : [];
  return [...parseCampusField(rawCampus), ...assignedCampuses];
}

export function resolveAdminCampuses(rawCampus: unknown, rawAssignedCampuses: unknown): string[] {
  return normalizeCampusList(collectRawCampuses(rawCampus, rawAssignedCampuses));
}

/** Etiqueta de sede que se guarda en la sesión del admin. */
export function resolveAdminCampusLabel(
  rawCampus: unknown,
  rawAssignedCampuses: unknown,
  scope: { isSuper: boolean; isGlobal: boolean },
): string {
  if (scope.isSuper || scope.isGlobal) {
    return 'Global';
  }

  const campuses = collectRawCampuses(rawCampus, rawAssignedCampuses)
    .map((value) => value.trim())
    .filter(Boolean);

  if (normalizeCampusList(campuses).length > 1) {
    return 'Multisede';
  }

  return campuses[0] || 'Sin sede';
}

export function canAccessAllCampuses(session: AdminSession): boolean {
  return session.isSuper || session.isGlobal;
}

export function hasCampusAccess(session: AdminSession, campus: string | null | undefined): boolean {
  if (canAccessAllCampuses(session)) {
    return true;
  }

  const target = normalizeCampusName(campus);
  return target !== '' && session.campuses.includes(target);
}

/** El admin gestiona más de una sede y debe indicar sobre cuál actúa. */
export function hasMultipleCampusScope(session: AdminSession): boolean {
  return canAccessAllCampuses(session) || session.campuses.length > 1;
}

export function createAdminSessionToken(admin: Omit<AdminSession, 'exp'>): Promise<string> {
  const payload: AdminSession = {
    ...admin,
    exp: nowInSeconds() + ADMIN_SESSION_MAX_AGE_SECONDS,
  };
  return signTokenPayload(payload);
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<AdminSession | null> {
  const payload = await verifyTokenPayload(token);
  if (!payload) {
    return null;
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (!exp || exp < nowInSeconds()) {
    return null;
  }

  const baseCampus = typeof payload.campus === 'string' ? payload.campus : '';
  const campuses = Array.isArray(payload.campuses)
    ? normalizeCampusList(toStringList(payload.campuses))
    : normalizeCampusList(baseCampus ? [baseCampus] : []);

  return {
    id: Number(payload.id),
    username: String(payload.username ?? ''),
    name: String(payload.name ?? ''),
    campus: baseCampus,
    campuses,
    isSuper: Boolean(payload.isSuper),
    isGlobal: Boolean(payload.isGlobal),
    exp,
  };
}

export function getAdminSessionCookieName(): string {
  return ADMIN_SESSION_COOKIE_NAME;
}
