import type { NextApiRequest, NextApiResponse } from 'next';
import { getAdminSessionCookieName, verifyAdminSessionToken, type AdminSession } from './admin-auth';
import { setNoStore } from './http';

/**
 * Valida la sesión de admin de una ruta de API. Si no es válida responde 401
 * y devuelve `null`.
 */
export async function requireAdminSession(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<AdminSession | null> {
  setNoStore(res);
  const session = await verifyAdminSessionToken(req.cookies[getAdminSessionCookieName()]);
  if (!session) {
    res.status(401).json({ error: 'No autorizado' });
    return null;
  }
  return session;
}

export function methodNotAllowed(res: NextApiResponse, allowed: string[]): void {
  res.setHeader('Allow', allowed.join(', '));
  res.status(405).json({ error: 'Method Not Allowed' });
}
