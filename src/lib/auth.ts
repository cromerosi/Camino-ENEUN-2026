import {
  createRandomToken,
  nowInSeconds,
  sha256Base64Url,
  signTokenPayload,
  verifyTokenPayload,
} from './session-token';

const SESSION_COOKIE_NAME = 'eneun_session';
const AUTH_STATE_COOKIE_NAME = 'eneun_auth_state';
const AUTH_PKCE_COOKIE_NAME = 'eneun_auth_pkce';

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const AUTH_FLOW_COOKIE_MAX_AGE_SECONDS = 60 * 10;

const AUTH0_REQUEST_TIMEOUT_MS = 10_000;
const ALLOWED_EMAIL_DOMAIN = '@unal.edu.co';

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
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createAuthState(): string {
  return createRandomToken(24);
}

export function createPkceCodeVerifier(): string {
  return createRandomToken(48);
}

export function createPkceCodeChallenge(codeVerifier: string): Promise<string> {
  return sha256Base64Url(codeVerifier);
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

  const requestBody: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
  };

  if (clientSecret) {
    requestBody.client_secret = clientSecret;
  }

  if (codeVerifier) {
    requestBody.code_verifier = codeVerifier;
  }

  const response = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(AUTH0_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Auth0 token exchange failed: ${response.status} ${errorBody}`);
  }

  return (await response.json()) as Auth0TokenResponse;
}

export async function fetchAuth0UserInfo(accessToken: string): Promise<Auth0UserInfo> {
  const domain = getEnv('AUTH0_DOMAIN');
  const response = await fetch(`https://${domain}/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(AUTH0_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Auth0 userinfo failed: ${response.status} ${errorBody}`);
  }

  return (await response.json()) as Auth0UserInfo;
}

export function isAllowedUnalEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN);
}

export function createSignedSessionToken(user: Omit<AuthSessionUser, 'exp'>): Promise<string> {
  const payload: AuthSessionUser = {
    ...user,
    exp: nowInSeconds() + SESSION_MAX_AGE_SECONDS,
  };
  return signTokenPayload(payload);
}

export async function verifySignedSessionToken(token: string | undefined): Promise<AuthSessionUser | null> {
  const payload = await verifyTokenPayload(token);
  if (!payload) {
    return null;
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (!exp || exp < nowInSeconds()) {
    return null;
  }

  const email = typeof payload.email === 'string' ? payload.email : '';
  if (!email || !isAllowedUnalEmail(email)) {
    return null;
  }

  return {
    sub: String(payload.sub ?? ''),
    email,
    name: typeof payload.name === 'string' ? payload.name : email,
    ...(typeof payload.picture === 'string' ? { picture: payload.picture } : {}),
    exp,
  };
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
