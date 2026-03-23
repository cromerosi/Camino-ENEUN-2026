import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getAdminSessionCookieName,
  isSupremeAdminSession,
  verifyAdminSessionToken,
} from '../../../lib/admin-auth';
import {
  getFinalFormAccessForEmail,
  getFinalFormGlobalState,
  listFinalFormAllowedUsers,
  setFinalFormGlobalState,
  setFinalFormUserAccess,
} from '../../../lib/final-form-access';

function normalizeEmail(email: unknown): string {
  if (typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies[getAdminSessionCookieName()];
  const session = await verifyAdminSessionToken(token);

  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (!isSupremeAdminSession(session)) {
    return res.status(403).json({ error: 'Solo el usuario Admin SUPREMO puede gestionar este control.' });
  }

  if (req.method === 'GET') {
    try {
      const checkEmail = normalizeEmail(req.query.email);
      const isOpen = await getFinalFormGlobalState();
      const access = checkEmail ? await getFinalFormAccessForEmail(checkEmail) : null;
      const allowedUsers = await listFinalFormAllowedUsers(150);

      return res.status(200).json({
        isOpen,
        allowedUsers,
        check: checkEmail
          ? {
              email: checkEmail,
              allowedWhenClosed: access?.isAllowedWhenClosed ?? false,
              canAccess: access?.canAccess ?? false,
            }
          : null,
      });
    } catch (error) {
      console.error('Error reading final form access settings:', error);
      return res.status(500).json({ error: 'No se pudo consultar la configuración' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { isOpen, email, allow } = req.body as {
        isOpen?: boolean;
        email?: string;
        allow?: boolean;
      };

      if (typeof isOpen === 'boolean') {
        await setFinalFormGlobalState(isOpen);
      }

      const normalizedEmail = normalizeEmail(email);
      if (normalizedEmail && typeof allow === 'boolean') {
        await setFinalFormUserAccess(normalizedEmail, allow);
      }

      const refreshedIsOpen = await getFinalFormGlobalState();
      const allowedUsers = await listFinalFormAllowedUsers(150);

      return res.status(200).json({
        success: true,
        isOpen: refreshedIsOpen,
        allowedUsers,
      });
    } catch (error) {
      console.error('Error updating final form access settings:', error);
      return res.status(500).json({ error: 'No se pudo actualizar la configuración' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
