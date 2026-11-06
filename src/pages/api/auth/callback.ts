import type { NextApiRequest, NextApiResponse } from 'next';
import {
  SESSION_MAX_AGE_SECONDS,
  createSignedSessionToken,
  exchangeCodeForTokens,
  fetchAuth0UserInfo,
  getAuthPkceCookieName,
  getAuthStateCookieName,
  getSessionCookieName,
  isAllowedUnalEmail,
} from '../../../lib/auth';
import { getSql } from '../../../lib/db';
import { buildCookie, buildExpiredCookie, getQueryValue, redirectTo, setNoStore } from '../../../lib/http';

function clearAuthFlowCookies(): string[] {
  return [buildExpiredCookie(getAuthStateCookieName()), buildExpiredCookie(getAuthPkceCookieName())];
}

function failLogin(res: NextApiResponse, errorCode: string, clearSession = false): void {
  const cookies = clearAuthFlowCookies();
  if (clearSession) {
    cookies.push(buildExpiredCookie(getSessionCookieName()));
  }
  res.setHeader('Set-Cookie', cookies);
  redirectTo(res, `/landing?error=${errorCode}`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return;
  }

  setNoStore(res);

  const stateFromQuery = getQueryValue(req.query.state);
  const code = getQueryValue(req.query.code);
  const auth0Error = getQueryValue(req.query.error);
  const auth0ErrorDescription = getQueryValue(req.query.error_description).toLowerCase();
  const stateFromCookie = String(req.cookies[getAuthStateCookieName()] ?? '').trim();
  const codeVerifier = String(req.cookies[getAuthPkceCookieName()] ?? '').trim();

  if (auth0Error) {
    const isMissingAuth0Session =
      auth0Error === 'invalid_request' && auth0ErrorDescription.includes("couldn't find your session");
    failLogin(res, isMissingAuth0Session ? 'auth0_session_missing' : 'auth_failed');
    return;
  }

  if (!stateFromQuery || !code || !stateFromCookie || !codeVerifier || stateFromQuery !== stateFromCookie) {
    failLogin(res, 'auth_failed');
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const auth0User = await fetchAuth0UserInfo(tokens.access_token);
    const email = String(auth0User.email ?? '').trim().toLowerCase();

    if (!email || !isAllowedUnalEmail(email)) {
      failLogin(res, 'forbidden_email_domain', true);
      return;
    }

    const sql = getSql();
    const registrations = await sql`
      SELECT 1
      FROM registrations
      WHERE lower(trim(email)) = lower(trim(${email}))
      LIMIT 1
    `;

    if (registrations.length === 0) {
      failLogin(res, 'not_registered', true);
      return;
    }

    const sessionToken = await createSignedSessionToken({
      sub: auth0User.sub,
      email,
      name: auth0User.name?.trim() || email,
      picture: auth0User.picture,
    });

    res.setHeader('Set-Cookie', [
      ...clearAuthFlowCookies(),
      buildCookie(getSessionCookieName(), sessionToken, SESSION_MAX_AGE_SECONDS),
    ]);
    redirectTo(res, '/');
  } catch (error) {
    console.error('Error en el callback de Auth0:', error);
    failLogin(res, 'auth_failed');
  }
}
