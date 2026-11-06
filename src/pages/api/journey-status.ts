import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionCookieName, verifySignedSessionToken } from '../../lib/auth';
import { setNoStore } from '../../lib/http';
import { getJourneyStepsByEmail } from '../../lib/participant';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  setNoStore(res);

  try {
    const authUser = await verifySignedSessionToken(req.cookies[getSessionCookieName()]);
    if (!authUser?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const journeySteps = await getJourneyStepsByEmail(authUser.email);

    return res.status(200).json({
      journeySteps,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /api/journey-status:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
