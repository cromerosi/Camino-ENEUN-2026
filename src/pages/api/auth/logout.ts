import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getSessionCookieName,
} from '../../../lib/auth';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${getSessionCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
  res.writeHead(303, { Location: '/landing' });
  res.end();
}
