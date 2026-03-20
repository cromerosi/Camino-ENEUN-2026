import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminSessionCookieName } from '../../../lib/admin-auth';

function buildExpiredCookie(name: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('Set-Cookie', buildExpiredCookie(getAdminSessionCookieName()));
  return res.status(200).json({ success: true });
}
