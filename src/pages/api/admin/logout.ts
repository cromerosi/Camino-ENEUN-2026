import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminSessionCookieName } from '../../../lib/admin-auth';
import { buildExpiredCookie, setNoStore } from '../../../lib/http';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  setNoStore(res);
  res.setHeader('Set-Cookie', buildExpiredCookie(getAdminSessionCookieName()));
  return res.status(200).json({ success: true });
}
