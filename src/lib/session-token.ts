/**
 * Utilidades de firma de tokens de sesión (HMAC-SHA256).
 *
 * Solo usa Web APIs (`crypto.subtle`, `btoa`/`atob`, `TextEncoder`), por lo que
 * funciona igual en el middleware (Edge Runtime) y en las rutas de Node.js.
 * El formato del token es `<payload base64url>.<firma base64url>` y es
 * compatible con los tokens emitidos por versiones anteriores.
 */

const DEV_FALLBACK_SECRET = 'eneun-dev-session-secret-change-me';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let warnedAboutFallbackSecret = false;
let cachedKey: { secret: string; key: Promise<CryptoKey> } | null = null;

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.ADMIN_JWT_SECRET;
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production' && !warnedAboutFallbackSecret) {
    warnedAboutFallbackSecret = true;
    console.error(
      '[auth] AUTH_SESSION_SECRET no está configurado. Se está usando un secreto de desarrollo inseguro: configúralo en las variables de entorno.',
    );
  }

  return DEV_FALLBACK_SECRET;
}

function getHmacKey(): Promise<CryptoKey> {
  const secret = getSessionSecret();
  if (!cachedKey || cachedKey.secret !== secret) {
    cachedKey = {
      secret,
      key: crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      ),
    };
  }
  return cachedKey.key;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  const binary = atob(base64 + '='.repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function createRandomToken(byteLength: number): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function signTokenPayload(payload: object): Promise<string> {
  const payloadBase64 = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64));
  return `${payloadBase64}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/**
 * Verifica la firma del token y devuelve el payload decodificado, o `null` si
 * el token no existe, está mal formado o la firma no coincide.
 * No valida la expiración: eso le corresponde a cada tipo de sesión.
 */
export async function verifyTokenPayload(token: string | undefined): Promise<Record<string, unknown> | null> {
  if (!token) {
    return null;
  }

  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) {
    return null;
  }

  try {
    const key = await getHmacKey();
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signature),
      encoder.encode(payloadBase64),
    );
    if (!isValid) {
      return null;
    }

    const payload = JSON.parse(decoder.decode(base64UrlToBytes(payloadBase64))) as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
