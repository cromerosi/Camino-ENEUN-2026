import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createAuthState,
  getAuth0AuthorizeUrl,
  getAuthStateCookieName,
} from '../../../lib/auth';

function redirect(res: NextApiResponse, destination: string): void {
  res.writeHead(303, { Location: destination });
  res.end();
}

function buildCookie(name: string, value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const state = createAuthState();
    const authorizeUrl = getAuth0AuthorizeUrl(state);

    res.setHeader('Set-Cookie', buildCookie(getAuthStateCookieName(), state, 60 * 10));
    redirect(res, authorizeUrl);
    return;
  } catch {
    redirect(res, '/landing?error=auth_disabled');
    return;
  }
}
