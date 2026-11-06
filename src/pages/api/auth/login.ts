import type { NextApiRequest, NextApiResponse } from 'next';
import {
  AUTH_FLOW_COOKIE_MAX_AGE_SECONDS,
  createAuthState,
  createPkceCodeChallenge,
  createPkceCodeVerifier,
  getAuth0AuthorizeUrl,
  getAuthPkceCookieName,
  getAuthStateCookieName,
} from '../../../lib/auth';
import { buildCookie, redirectTo, setNoStore } from '../../../lib/http';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  setNoStore(res);

  try {
    const state = createAuthState();
    const codeVerifier = createPkceCodeVerifier();
    const codeChallenge = await createPkceCodeChallenge(codeVerifier);
    const authorizeUrl = getAuth0AuthorizeUrl(state, codeChallenge);

    res.setHeader('Set-Cookie', [
      buildCookie(getAuthStateCookieName(), state, AUTH_FLOW_COOKIE_MAX_AGE_SECONDS),
      buildCookie(getAuthPkceCookieName(), codeVerifier, AUTH_FLOW_COOKIE_MAX_AGE_SECONDS),
    ]);
    redirectTo(res, authorizeUrl);
  } catch (error) {
    console.error('Error iniciando el login con Auth0:', error);
    redirectTo(res, '/landing?error=auth_disabled');
  }
}
