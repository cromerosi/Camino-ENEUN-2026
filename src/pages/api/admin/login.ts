import type { NextApiRequest, NextApiResponse } from 'next';
import { getSql } from '../../../lib/db';
import { buildCookie, isPlainObject, setNoStore } from '../../../lib/http';
import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  getAdminSessionCookieName,
  resolveAdminCampusLabel,
  resolveAdminCampuses,
} from '../../../lib/admin-auth';

interface AdminRow {
  id: number;
  username: string;
  name: string | null;
  password: string | null;
  campus: unknown;
  is_super: boolean | null;
  is_global: boolean | null;
  assigned_campuses: unknown;
}

/** Comparación en tiempo constante para no filtrar información por tiempos de respuesta. */
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  setNoStore(res);

  const body = isPlainObject(req.body) ? req.body : {};
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  try {
    const sql = getSql();
    // Las contraseñas se guardan en texto plano en la tabla admins (ver README).
    const admins = (await sql`
      SELECT id, username, name, password, campus, is_super, is_global, assigned_campuses
      FROM admins
      WHERE username = ${username}
      LIMIT 1
    `) as AdminRow[];

    const admin = admins[0];
    if (!admin || typeof admin.password !== 'string' || !safeEqual(admin.password, password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isSuper = Boolean(admin.is_super);
    const isGlobal = Boolean(admin.is_global);

    const token = await createAdminSessionToken({
      id: admin.id,
      username: admin.username,
      name: admin.name ?? '',
      campus: resolveAdminCampusLabel(admin.campus, admin.assigned_campuses, { isSuper, isGlobal }),
      campuses: resolveAdminCampuses(admin.campus, admin.assigned_campuses),
      isSuper,
      isGlobal,
    });

    res.setHeader('Set-Cookie', buildCookie(getAdminSessionCookieName(), token, ADMIN_SESSION_MAX_AGE_SECONDS));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Admin login error', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
