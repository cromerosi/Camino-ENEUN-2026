import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionCookieName } from '../../../lib/auth';
import { buildExpiredCookie, redirectTo, setNoStore } from '../../../lib/http';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  setNoStore(res);
  res.setHeader('Set-Cookie', buildExpiredCookie(getSessionCookieName()));
  redirectTo(res, '/landing');
}
