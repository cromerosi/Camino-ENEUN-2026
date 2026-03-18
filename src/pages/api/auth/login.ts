import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createSignedSessionToken,
  getSessionCookieName,
} from '../../../lib/auth';
import { authenticateWithDocument } from '../../../lib/participant';

function redirect(res: NextApiResponse, destination: string): void {
  res.writeHead(303, { Location: destination });
  res.end();
}

function buildCookie(name: string, value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    redirect(res, '/landing');
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const username = String(req.body?.username ?? '').trim();
  const document = String(req.body?.document ?? '').trim();

  if (!username || !document) {
    redirect(res, '/landing?error=missing_fields');
    return;
  }

  try {
    const user = await authenticateWithDocument(username, document);
    if (!user) {
      redirect(res, '/landing?error=invalid_credentials');
      return;
    }

    const sessionToken = await createSignedSessionToken(user);
    res.setHeader('Set-Cookie', buildCookie(getSessionCookieName(), sessionToken, 60 * 60 * 8));
    redirect(res, '/');
    return;
  } catch {
    redirect(res, '/landing?error=auth_failed');
    return;
  }
}
