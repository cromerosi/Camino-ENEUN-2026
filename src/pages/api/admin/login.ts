import type { NextApiRequest, NextApiResponse } from 'next';
import { getSql } from '../../../lib/db';
import { createAdminSessionToken, getAdminSessionCookieName } from '../../../lib/admin-auth';

function buildCookie(name: string, value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  try {
    const sql = getSql();
    // Use md5 or direct comparison based on how passwords were historically populated. Usually plaintext or postgres md5 depending on setup.
    // For this simple implementation we'll match it directly.
    const admins = await sql`
      SELECT id, username, name, password, campus
      FROM admins
      WHERE username = ${username}
    `;

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const admin = admins[0];
    
    // Simple verification (update if the DB uses hashes like bcrypt or md5)
    if (admin.password !== password) {
       return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = await createAdminSessionToken({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      campus: admin.campus
    });

    res.setHeader('Set-Cookie', buildCookie(getAdminSessionCookieName(), token, 60 * 60 * 8));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Admin login error', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
