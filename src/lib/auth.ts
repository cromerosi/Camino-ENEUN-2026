const SESSION_COOKIE_NAME = 'eneun_session';
const AUTH_STATE_COOKIE_NAME = 'eneun_auth_state';
const AUTH_PKCE_COOKIE_NAME = 'eneun_auth_pkce';

const encoder = new TextEncoder();

export interface AuthSessionUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  exp: number;
}

interface Auth0TokenResponse {
  access_token: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface Auth0UserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

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
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function createAuthState(): string {
  const random = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(random).toString('base64url');
}

export function createPkceCodeVerifier(): string {
  const random = crypto.getRandomValues(new Uint8Array(48));
  return Buffer.from(random).toString('base64url');
}

export async function createPkceCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
  return Buffer.from(digest).toString('base64url');
}

export function getAuth0AuthorizeUrl(state: string, codeChallenge?: string): string {
  const domain = getEnv('AUTH0_DOMAIN');
  const clientId = getEnv('AUTH0_CLIENT_ID');
  const redirectUri = getEnv('AUTH0_CALLBACK_URL');
  const connection = process.env.AUTH0_CONNECTION?.trim() || 'google-oauth2';

  const url = new URL(`https://${domain}/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('connection', connection);
  url.searchParams.set('prompt', 'login');
  if (codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  return url.toString();
}

export async function exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<Auth0TokenResponse> {
  const domain = getEnv('AUTH0_DOMAIN');
  const clientId = getEnv('AUTH0_CLIENT_ID');
  const clientSecret = process.env.AUTH0_CLIENT_SECRET?.trim();
  const redirectUri = getEnv('AUTH0_CALLBACK_URL');

  if (!clientSecret && !codeVerifier) {
    throw new Error('Missing Auth0 credentials: provide AUTH0_CLIENT_SECRET or PKCE code verifier.');
  }

  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
  };

  if (clientSecret) {
    body.client_secret = clientSecret;
  }

  if (codeVerifier) {
    body.code_verifier = codeVerifier;
  }

  const response = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Auth0 token exchange failed: ${response.status} ${body}`);
  }

  return (await response.json()) as Auth0TokenResponse;
}

export async function fetchAuth0UserInfo(accessToken: string): Promise<Auth0UserInfo> {
  const domain = getEnv('AUTH0_DOMAIN');
  const response = await fetch(`https://${domain}/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Auth0 userinfo failed: ${response.status} ${body}`);
  }

  return (await response.json()) as Auth0UserInfo;
}

export function isAllowedUnalEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@unal.edu.co');
}

export async function createSignedSessionToken(user: Omit<AuthSessionUser, 'exp'>): Promise<string> {
  const payload: AuthSessionUser = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  };
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = await signValue(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export async function verifySignedSessionToken(token: string | undefined): Promise<AuthSessionUser | null> {
  if (!token) {
    return null;
  }

  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) {
    return null;
  }

  const expectedSignature = await signValue(payloadBase64);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadBase64)) as AuthSessionUser;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (!payload.email || !isAllowedUnalEmail(payload.email)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getAuthStateCookieName(): string {
  return AUTH_STATE_COOKIE_NAME;
}

export function getAuthPkceCookieName(): string {
  return AUTH_PKCE_COOKIE_NAME;
}

export function getAuthCookieOptions(maxAgeSeconds: number) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    maxAge: maxAgeSeconds,
  };
}

export function getAuth0LogoutUrl(): string {
  const domain = getEnv('AUTH0_DOMAIN');
  const clientId = getEnv('AUTH0_CLIENT_ID');
  const returnTo = getEnv('AUTH0_LOGOUT_RETURN_TO');
  const url = new URL(`https://${domain}/v2/logout`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('returnTo', returnTo);
  return url.toString();
}
