import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createSignedSessionToken,
  exchangeCodeForTokens,
  fetchAuth0UserInfo,
  getAuthPkceCookieName,
  getAuthStateCookieName,
  getSessionCookieName,
  isAllowedUnalEmail,
} from '../../../lib/auth';
import { getSql } from '../../../lib/db';

function redirect(res: NextApiResponse, destination: string): void {
  res.writeHead(303, { Location: destination });
  res.end();
}

function buildCookie(name: string, value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearCookie(name: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function getQueryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end('Method Not Allowed');
    return;
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const stateFromQuery = getQueryValue(req.query.state).trim();
  const code = getQueryValue(req.query.code).trim();
  const auth0Error = getQueryValue(req.query.error).trim();
  const auth0ErrorDescription = getQueryValue(req.query.error_description).trim().toLowerCase();
  const stateFromCookie = String(req.cookies[getAuthStateCookieName()] ?? '').trim();
  const codeVerifier = String(req.cookies[getAuthPkceCookieName()] ?? '').trim();

  if (auth0Error) {
    const isMissingAuth0Session =
      auth0Error === 'invalid_request' && auth0ErrorDescription.includes("couldn't find your session");
    res.setHeader('Set-Cookie', [
      clearCookie(getAuthStateCookieName()),
      clearCookie(getAuthPkceCookieName()),
    ]);
    redirect(res, isMissingAuth0Session ? '/landing?error=auth0_session_missing' : '/landing?error=auth_failed');
    return;
  }

  if (!stateFromQuery || !code || !stateFromCookie || !codeVerifier || stateFromQuery !== stateFromCookie) {
    res.setHeader('Set-Cookie', [
      clearCookie(getAuthStateCookieName()),
      clearCookie(getAuthPkceCookieName()),
    ]);
    redirect(res, '/landing?error=auth_failed');
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const auth0User = await fetchAuth0UserInfo(tokens.access_token);
    const email = String(auth0User.email ?? '').trim().toLowerCase();

    if (!email || !isAllowedUnalEmail(email)) {
      res.setHeader('Set-Cookie', [
        clearCookie(getAuthStateCookieName()),
        clearCookie(getAuthPkceCookieName()),
        clearCookie(getSessionCookieName()),
      ]);
      redirect(res, '/landing?error=forbidden_email_domain');
      return;
    }

    const sql = getSql();
    const registrations = (await sql`
      SELECT 1
      FROM registrations
      WHERE lower(trim(email)) = lower(trim(${email}))
      LIMIT 1
    `) as Array<{ '?column?': number }>;

    if (registrations.length === 0) {
      res.setHeader('Set-Cookie', [
        clearCookie(getAuthStateCookieName()),
        clearCookie(getAuthPkceCookieName()),
        clearCookie(getSessionCookieName()),
      ]);
      redirect(res, '/landing?error=not_registered');
      return;
    }

    const sessionToken = await createSignedSessionToken({
      sub: auth0User.sub,
      email,
      name: auth0User.name?.trim() || email,
      picture: auth0User.picture,
    });

    res.setHeader('Set-Cookie', [
      clearCookie(getAuthStateCookieName()),
      clearCookie(getAuthPkceCookieName()),
      buildCookie(getSessionCookieName(), sessionToken, 60 * 60 * 8),
    ]);

    redirect(res, '/');
    return;
  } catch {
    res.setHeader('Set-Cookie', [
      clearCookie(getAuthStateCookieName()),
      clearCookie(getAuthPkceCookieName()),
    ]);
    redirect(res, '/landing?error=auth_failed');
    return;
  }
}
