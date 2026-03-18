import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.writeHead(303, { Location: '/landing?error=auth_disabled' });
  res.end();
}
