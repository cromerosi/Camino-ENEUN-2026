import type { NextApiRequest, NextApiResponse } from 'next';
import { isSupremeAdminSession } from '../../../lib/admin-auth';
import { methodNotAllowed, requireAdminSession } from '../../../lib/admin-api';
import {
  getFinalFormAccessForEmail,
  getFinalFormGlobalState,
  listFinalFormAllowedUsers,
  setFinalFormGlobalState,
  setFinalFormUserAccess,
} from '../../../lib/final-form-access';
import { getQueryValue, isPlainObject } from '../../../lib/http';

const ALLOWED_USERS_LIMIT = 150;

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdminSession(req, res);
  if (!session) return;

  if (!isSupremeAdminSession(session)) {
    return res.status(403).json({ error: 'Solo el usuario Admin SUPREMO puede gestionar este control.' });
  }

  if (req.method === 'GET') {
    try {
      const checkEmail = normalizeEmail(getQueryValue(req.query.email));
      const [isOpen, access, allowedUsers] = await Promise.all([
        getFinalFormGlobalState(),
        checkEmail ? getFinalFormAccessForEmail(checkEmail) : Promise.resolve(null),
        listFinalFormAllowedUsers(ALLOWED_USERS_LIMIT),
      ]);

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
      const body = isPlainObject(req.body) ? req.body : {};

      if (typeof body.isOpen === 'boolean') {
        await setFinalFormGlobalState(body.isOpen);
      }

      const email = normalizeEmail(body.email);
      if (email && typeof body.allow === 'boolean') {
        await setFinalFormUserAccess(email, body.allow);
      }

      const [isOpen, allowedUsers] = await Promise.all([
        getFinalFormGlobalState(),
        listFinalFormAllowedUsers(ALLOWED_USERS_LIMIT),
      ]);

      return res.status(200).json({ success: true, isOpen, allowedUsers });
    } catch (error) {
      console.error('Error updating final form access settings:', error);
      return res.status(500).json({ error: 'No se pudo actualizar la configuración' });
    }
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}
